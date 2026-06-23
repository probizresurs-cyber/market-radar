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
import { endpointProduct } from "./product-access";

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

  // КРИТИЧНО: требуем auth. Раньше анонимные звонки пропускались через
  // IP-rate-limit 100/день — с ротирующимся прокси любой мог разорить
  // наш Claude/OpenAI бюджет на $100+ за пару часов. И token usage
  // не записывался без userId — мы даже не видели куда уходит лимит.
  //
  // Bypass: NEXT_PUBLIC_DEMO_MODE=true или AI_ALLOW_ANONYMOUS=true (для
  // показов клиентам / демо-окружения), плюс некоторые публичные роуты
  // могут передать opts.allowAnonymous=true (не реализовано в текущей
  // сигнатуре — добавим если понадобится).
  if (!session?.userId && process.env.AI_ALLOW_ANONYMOUS !== "true") {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Войдите в аккаунт, чтобы пользоваться AI-функциями платформы.",
          reason: "unauthenticated",
        },
        { status: 401 }
      ),
    };
  }

  const identifier = session?.userId || `ip:${ip}`;

  // Admin bypass: админы не упираются в дневной AI-лимит. Иначе при
  // отладке/разработке любой тест-пайплайн на 5-10 шагов выжирает квоту
  // и блокирует всю работу на сутки.
  const isAdmin = session?.role === "admin";

  // Rate limit check (skip для админов)
  const limit = isAdmin
    ? { allowed: true as const, remaining: 999, resetAt: Date.now() + 86400000 }
    : checkAiRateLimit(identifier);
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
        // Этап 2: разносим расход по продукту (для статистики продуктовых
        // панелей). No-op, если у юзера нет подписки на этот продукт.
        await query(
          `UPDATE product_subscriptions SET tokens_used = tokens_used + $1, updated_at = NOW()
             WHERE user_id = $2 AND product = $3`,
          [totalTokens, session.userId, endpointProduct(opts.endpoint)],
        ).catch(() => { /* best-effort */ });
      }
    } catch {
      // Never crash the main flow
    }
  };

  return { allowed: true, userId: session?.userId ?? null, identifier, log };
}
