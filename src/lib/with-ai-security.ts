/**
 * AI Security middleware helper.
 *
 * Использование в любом AI-роуте:
 *
 *   const access = await checkAiAccess(request);
 *   if (!access.allowed) return access.response;
 *
 *   // ... AI call ...
 *
 *   await access.log({ model: "claude-sonnet-4-6", promptTokens: 1200,
 *                      completionTokens: 800, durationMs: 3200 });
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { checkAiRateLimit, rateLimitHeaders } from "./rate-limit";
import { query } from "./db";
import { randomUUID } from "crypto";
import { getSubscription, recordTokenUsage } from "./subscription";

/**
 * Грубая оценка количества токенов по тексту (~4 символа на токен для mixed RU/EN).
 * Для учёта триала этого достаточно — точные числа потом вытащим из usage API.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export interface AiAccess {
  allowed: true;
  userId: string | null;
  identifier: string;   // userId or IP for rate-limiting
  response?: never;
  log: (opts: LogOpts) => Promise<void>;
}

export interface AiBlocked {
  allowed: false;
  response: NextResponse;
  log?: never;
}

interface LogOpts {
  endpoint: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
  manipulationDetected?: boolean;
}

export async function checkAiAccess(req: Request): Promise<AiAccess | AiBlocked> {
  // Identify caller
  const session = await getSessionUser().catch(() => null);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const identifier = session?.userId || `ip:${ip}`;

  // Rate limit check
  const limit = checkAiRateLimit(identifier);
  if (!limit.allowed) {
    const headers = rateLimitHeaders(limit);
    const minutesLeft = limit.retryAfterMs ? Math.ceil(limit.retryAfterMs / 60000) : 60;
    return {
      allowed: false,
      response: NextResponse.json(
        {
          ok: false,
          error: `Превышен лимит AI-запросов (100/день). Попробуйте через ${minutesLeft} мин.`,
          retryAfterMs: limit.retryAfterMs,
        },
        { status: 429, headers }
      ),
    };
  }

  // Subscription / trial check (skip for admins and unauthenticated calls)
  if (session?.userId && session.role !== "admin") {
    const sub = await getSubscription(session.userId).catch(() => null);
    if (sub && !sub.hasAccess) {
      const reasonCode = sub.isExpired ? "expired" : "exhausted";
      const errorMsg = sub.isExpired
        ? "Пробный период завершён. Оформите подписку, чтобы продолжить."
        : `Лимит токенов исчерпан (${sub.tokensUsed.toLocaleString("ru-RU")} / ${sub.tokensLimit.toLocaleString("ru-RU")}). Оформите подписку, чтобы продолжить.`;
      return {
        allowed: false,
        response: NextResponse.json(
          {
            ok: false,
            error: errorMsg,
            reason: reasonCode,
            subscription: {
              plan: sub.plan,
              isExpired: sub.isExpired,
              isExhausted: sub.isExhausted,
              tokensUsed: sub.tokensUsed,
              tokensLimit: sub.tokensLimit,
              daysLeft: sub.daysLeft,
            },
          },
          { status: 402 }
        ),
      };
    }
  }

  // Build log function (called after AI response)
  const log = async (opts: LogOpts) => {
    try {
      const totalTokens = (opts.promptTokens || 0) + (opts.completionTokens || 0);
      await query(
        `INSERT INTO ai_logs
           (id, user_id, endpoint, model, prompt_tokens, completion_tokens, total_tokens,
            duration_ms, success, error_code, error_message, manipulation_detected)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          randomUUID(),
          session?.userId ?? null,
          opts.endpoint,
          opts.model,
          opts.promptTokens ?? null,
          opts.completionTokens ?? null,
          totalTokens || null,
          opts.durationMs ?? null,
          opts.success !== false,
          opts.errorCode ?? null,
          opts.errorMessage ?? null,
          opts.manipulationDetected ?? false,
        ]
      );
      // Also increment user's subscription usage (only for successful calls)
      if (session?.userId && totalTokens > 0 && opts.success !== false) {
        await recordTokenUsage(session.userId, totalTokens);
      }
    } catch {
      // Never crash the main flow
    }
  };

  return { allowed: true, userId: session?.userId ?? null, identifier, log };
}
