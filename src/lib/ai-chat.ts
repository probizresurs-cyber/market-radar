/**
 * Единая точка вызова текстовой модели для роутов, переехавших с OpenAI.
 *
 * Зачем понадобилось: 31.07.26 выяснилось, что `api.openai.com` сам стоит за
 * Cloudflare, поэтому наш Cloudflare-воркер не может быть для него прокси —
 * запрос не выходит в интернет, идёт внутри сети Cloudflare и несёт
 * географию исходного клиента (московского VPS). OpenAI отвечает
 * `403 unsupported_country_region_territory`, и обойти это воркером нельзя
 * в принципе. Anthropic за Cloudflare не спрятан и через свой воркер
 * работает — отсюда решение перевести роуты на Claude.
 *
 * Что здесь важного по сравнению с прямым вызовом OpenAI:
 *  - У OpenAI был `response_format: {type:"json_object"}`, который
 *    ГАРАНТИРОВАЛ валидный JSON. У Claude такого режима нет, поэтому
 *    JSON достаётся через extractJson (он умеет вынимать объект из текста
 *    с пояснениями и из ```json-блоков). Не убирать эту обёртку.
 *  - safeAnthropicCreate сам переключается на запасную модель (Haiku ↔
 *    Sonnet) и разбирает HTML-ответы прокси, так что ретраи писать не нужно.
 */
import { safeAnthropicCreate, extractJson } from "./anthropic-safe";

/** Дешёвая быстрая модель — замена gpt-4o-mini в большинстве роутов. */
export const CHAT_MODEL_FAST = "claude-haiku-4-5";
/** Модель для тяжёлых аналитических промптов — замена gpt-4o. */
export const CHAT_MODEL_SMART = "claude-sonnet-4-6";

export interface ChatOpts {
  system: string;
  user: string;
  maxTokens: number;
  /** По умолчанию быстрая модель. */
  model?: string;
  temperature?: number;
}

export interface ChatTextResult {
  text: string;
  modelUsed: string;
  error?: string;
}

/** Свободный текст. Пустой text означает провал — проверять вызывающим кодом. */
export async function chatText(opts: ChatOpts): Promise<ChatTextResult> {
  const r = await safeAnthropicCreate({
    model: opts.model ?? CHAT_MODEL_FAST,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });
  return { text: r.text, modelUsed: r.modelUsed, error: r.error };
}

export interface ChatJsonResult<T> {
  data: T | null;
  raw: string;
  modelUsed: string;
  error?: string;
}

/**
 * Ответ в виде JSON. `data === null` значит либо модель не ответила, либо
 * ответила не-JSON — вызывающий код должен различать это по `error`:
 * при пустом raw виновата модель//прокси, при непустом — разбор.
 */
export async function chatJson<T>(opts: ChatOpts): Promise<ChatJsonResult<T>> {
  // Подсказка про формат в system: у Claude нет json-режима, и без явного
  // требования он охотно добавляет вступление вроде «Вот результат:».
  const system = opts.system.includes("JSON")
    ? opts.system
    : `${opts.system}\n\nОтвечай СТРОГО валидным JSON без markdown и без пояснений.`;

  const r = await safeAnthropicCreate({
    model: opts.model ?? CHAT_MODEL_FAST,
    max_tokens: opts.maxTokens,
    system,
    messages: [{ role: "user", content: opts.user }],
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });

  if (!r.text) return { data: null, raw: "", modelUsed: r.modelUsed, error: r.error ?? "модель не ответила" };

  const parsed = extractJson<T>(r.text);
  return {
    data: parsed,
    raw: r.text,
    modelUsed: r.modelUsed,
    error: parsed ? undefined : "ответ модели не распарсился как JSON",
  };
}

/** MIME-типы, которые принимает Claude vision (тот же список, что у SDK). */
export type VisionMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Ответ в виде JSON по картинке (замена OpenAI `image_url` контента) —
 * формат сообщения у Claude другой: `{type:"image", source:{type:"base64",...}}`
 * вместо `{type:"image_url", image_url:{url:"data:..."}}`.
 */
export async function chatJsonVision<T>(opts: {
  system: string;
  userText: string;
  imageBase64: string;
  mimeType: VisionMimeType;
  maxTokens: number;
  model?: string;
  temperature?: number;
}): Promise<ChatJsonResult<T>> {
  const system = opts.system.includes("JSON")
    ? opts.system
    : `${opts.system}\n\nОтвечай СТРОГО валидным JSON без markdown и без пояснений.`;

  const r = await safeAnthropicCreate({
    model: opts.model ?? CHAT_MODEL_FAST,
    max_tokens: opts.maxTokens,
    system,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: opts.userText },
        { type: "image", source: { type: "base64", media_type: opts.mimeType, data: opts.imageBase64 } },
      ],
    }],
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });

  if (!r.text) return { data: null, raw: "", modelUsed: r.modelUsed, error: r.error ?? "модель не ответила" };

  const parsed = extractJson<T>(r.text);
  return {
    data: parsed,
    raw: r.text,
    modelUsed: r.modelUsed,
    error: parsed ? undefined : "ответ модели не распарсился как JSON",
  };
}
