/**
 * anthropic-safe — обёртка вокруг Anthropic SDK с auto-fallback.
 *
 * TODO MIGRATION: следующие роуты используют прямой `new Anthropic()` +
 * `client.messages.create()` БЕЗ retry/timeout/circuit-breaker. Перевести
 * на safeAnthropicCreate когда будет время:
 *   - src/app/api/adapt-post/route.ts
 *   - src/app/api/chat/route.ts
 *   - src/app/api/content/analyze-style/route.ts
 *   - src/app/api/content/auto-ideas-batch/route.ts
 *   - src/app/api/content/trends/analyze/route.ts
 *   - src/app/api/ai-visibility/generate-queries/route.ts
 *   - src/app/api/ai-visibility/generate-recommendations/route.ts
 *   - src/app/api/generate-battle-cards/route.ts
 *   - src/app/api/generate-benchmarks/route.ts
 *   - src/app/api/generate-broll-prompts/route.ts
 *   - src/app/api/generate-cjm/route.ts
 *   - src/app/api/generate-competitor-insights/route.ts
 *   - src/app/api/generate-tows/route.ts
 *   - src/app/api/hook-variants/route.ts
 *   - src/app/api/presentation-brand-check/route.ts
 *   - src/app/api/seo/keyword-expand/route.ts
 *   - src/app/api/seo-cluster-keywords/route.ts
 *   - src/app/api/seo-generate-article/route.ts
 *   - src/app/api/seo-generate-brief/route.ts
 *   - src/app/api/seo-generate-outline/route.ts
 *   - src/app/api/seo-generate-meta/route.ts
 *
 * Workaround temporary: новые Anthropic-инстансы используют SDK
 * default timeout (10 минут). Если зависнет — клиент HTTP уже
 * timed out по 60s (см. fetchWithTimeout-обёртку выше). Не идеально,
 * но не катастрофа.
 *
 * Проблема: Cloudflare Worker между нами и api.anthropic.com иногда
 * возвращает HTML страницу ошибки вместо JSON. Anthropic SDK падает с
 * `SyntaxError: Unexpected token '<', "<html"...`. В UI пользователь
 * видит непонятный технический мусор.
 *
 * Решение:
 *   1. `safeAnthropicCreate()` — пробует основную модель, при HTML/timeout
 *      авто-переключается на fallback (по умолчанию Haiku↔Sonnet).
 *   2. `isProxyHtmlError()` — детектит характерную HTML-ошибку прокси.
 *   3. `extractJson()` — снимает ```json wrapper, возвращает T или null.
 *   4. `proxyErrorMessage()` — единое дружелюбное сообщение для UI.
 *
 * Использование:
 *   const { text, modelUsed, error } = await safeAnthropicCreate({
 *     model: "claude-haiku-4-5",
 *     max_tokens: 400,
 *     system: SYSTEM_PROMPT,
 *     messages: [{ role: "user", content: userMessage }],
 *   });
 *   if (!text) return NextResponse.json({ ok: false, error }, { status: 502 });
 */

import Anthropic from "@anthropic-ai/sdk";

const HTML_ERROR_PATTERN = /Unexpected token '?<'?|"<html|is not valid JSON/i;

export type AnthropicModelName = string;

interface SafeCreateOpts {
  model: AnthropicModelName;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Список fallback-моделей. По умолчанию — Sonnet для Haiku и наоборот. */
  fallbackModels?: AnthropicModelName[];
  /** Опц temperature (по умолчанию SDK-default = 1). */
  temperature?: number;
  /** Если задан — функция вызывается при HTML-ошибке прокси с первой моделью.
   *  Полезно для логирования "proxy degraded" в аналитику. */
  onProxyDegraded?: (model: AnthropicModelName, rawError: string) => void;
}

export interface SafeCreateResult {
  /** Текст ответа Claude — empty string если все попытки провалились. */
  text: string;
  /** Какая модель в итоге успешно ответила. */
  modelUsed: AnthropicModelName;
  /** Финальное сообщение об ошибке (если text пустой). */
  error?: string;
  /** True, если хотя бы одна попытка упала из-за HTML-ответа прокси. */
  proxyDegraded: boolean;
}

/** Возвращает client с правильным baseURL (CF Worker proxy для РФ). */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");
  return new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  });
}

/** Дефолтные fallback-модели — Haiku ↔ Sonnet. */
function defaultFallbacks(primary: AnthropicModelName): AnthropicModelName[] {
  if (primary.includes("haiku")) return ["claude-sonnet-4-5"];
  if (primary.includes("sonnet")) return ["claude-haiku-4-5"];
  // Opus или неизвестная модель — без fallback'а
  return [];
}

export async function safeAnthropicCreate(opts: SafeCreateOpts): Promise<SafeCreateResult> {
  const client = getClient();
  const candidates = [
    opts.model,
    ...(opts.fallbackModels ?? defaultFallbacks(opts.model)),
  ];

  let lastError = "";
  let proxyDegraded = false;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    try {
      const message = await client.messages.create({
        model,
        max_tokens: opts.max_tokens,
        system: opts.system,
        messages: opts.messages,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      });
      const text =
        message.content[0]?.type === "text"
          ? message.content[0].text.trim()
          : "";
      if (text) {
        return { text, modelUsed: model, proxyDegraded };
      }
      lastError = `Модель ${model} вернула пустой ответ`;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const htmlFromProxy = HTML_ERROR_PATTERN.test(raw);

      if (htmlFromProxy) {
        proxyDegraded = true;
        // Callback на первой HTML-ошибке — полезно для алертинга
        if (i === 0 && opts.onProxyDegraded) {
          try { opts.onProxyDegraded(model, raw); } catch { /* ignore logger errors */ }
        }
        lastError = `Прокси AI вернул HTML на модели ${model}`;
      } else {
        lastError = raw;
      }
      // Продолжаем к следующей модели-кандидату
    }
  }

  return {
    text: "",
    modelUsed: candidates[0],
    proxyDegraded,
    error: lastError || "Все модели не ответили",
  };
}

/**
 * Стриминговый вариант safeAnthropicCreate. Нужен когда max_tokens большой
 * (SDK требует streaming для операций, которые потенциально дольше 10 минут —
 * иначе бросает «Streaming is required…»). Аккумулирует весь текст из потока
 * и возвращает тем же контрактом SafeCreateResult. Fallback-логика и детект
 * HTML-ошибок прокси — как в безстримовой версии.
 */
export async function safeAnthropicStream(opts: SafeCreateOpts): Promise<SafeCreateResult> {
  const client = getClient();
  const candidates = [
    opts.model,
    ...(opts.fallbackModels ?? defaultFallbacks(opts.model)),
  ];

  let lastError = "";
  let proxyDegraded = false;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: opts.max_tokens,
        system: opts.system,
        messages: opts.messages,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      });

      let text = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          text += event.delta.text;
        }
      }
      text = text.trim();
      if (text) {
        return { text, modelUsed: model, proxyDegraded };
      }
      lastError = `Модель ${model} вернула пустой ответ`;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const htmlFromProxy = HTML_ERROR_PATTERN.test(raw);
      if (htmlFromProxy) {
        proxyDegraded = true;
        if (i === 0 && opts.onProxyDegraded) {
          try { opts.onProxyDegraded(model, raw); } catch { /* ignore logger errors */ }
        }
        lastError = `Прокси AI вернул HTML на модели ${model}`;
      } else {
        lastError = raw;
      }
    }
  }

  return {
    text: "",
    modelUsed: candidates[0],
    proxyDegraded,
    error: lastError || "Все модели не ответили",
  };
}

/**
 * Универсальный retry на 429 (rate_limit_error) с экспоненциальным backoff.
 * Anthropic возвращает 429 «Type 2b rate limited» когда слишком много
 * параллельных запросов. Оборачиваем любой Anthropic-вызов:
 *
 *   const msg = await withRateLimitRetry(() => client.messages.create({...}));
 *
 * retries=4 → паузы 1.5s, 3s, 6s, 12s. Если после всех попыток всё ещё 429 —
 * пробрасываем последнюю ошибку (вызывающий покажет «попробуйте позже»).
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? 4;
  const baseDelay = opts?.baseDelayMs ?? 1500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Ретраим только rate-limit / 429 / overloaded
      const is429 = /\b429\b|rate.?limit|rate_limit_error|overloaded|too many requests/i.test(msg);
      if (!is429 || attempt === retries) throw err;
      // Jitter ±40% — чтобы N параллельных запросов не ретраились синхронно
      // (иначе снова все вместе упрутся в лимит). randomBytes вместо Math.random
      // здесь не нужен — это тайминг, не безопасность.
      const base = baseDelay * Math.pow(2, attempt);
      const jitter = base * (0.6 + Math.random() * 0.8);
      const delay = Math.round(jitter);
      console.warn(`[anthropic] 429 rate-limit, retry ${attempt + 1}/${retries} через ${delay}мс`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Детект характерной HTML-ошибки от прокси (для UI-парсера). */
export function isProxyHtmlError(message: string | null | undefined): boolean {
  if (!message) return false;
  return HTML_ERROR_PATTERN.test(message);
}

/** Дружелюбное сообщение об ошибке прокси для показа юзеру. */
export function proxyErrorMessage(modelHint?: string): string {
  if (modelHint) {
    return `Прокси AI временно вернул HTML на модели ${modelHint}. Это разовый сбой Cloudflare — повторите запрос через 30 секунд.`;
  }
  return "Прокси AI временно вернул HTML вместо JSON. Это разовый сбой Cloudflare — повторите запрос через 30 секунд.";
}

/**
 * Парсит JSON из текстового ответа Claude. Снимает ```json wrapper'ы.
 * Возвращает null, если распарсить не удалось.
 */
export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* fall through to brace-match */ }

  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
