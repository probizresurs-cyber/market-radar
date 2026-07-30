// Shared helpers for ElevenLabs voice cloning & TTS.
// The API key is read from env first (so it can be rotated without a redeploy),
// with a hard-coded fallback as a convenience for staging bring-up.
// TODO: once ELEVENLABS_API_KEY is set in the VPS .env on prod,
// delete the fallback string below and rotate the key in the ElevenLabs cabinet.
export const ELEVENLABS_API_KEY =
  process.env.ELEVENLABS_API_KEY ??
  "sk_82f8d1f12d3ac27d765d35d87d10a03402e1984395194653";

// Base URL — нужен для российского VPS, чтобы обходить Cloudflare bot-challenge
// на api.elevenlabs.io. Указывается на Cloudflare Worker, который проксирует
// запросы (та же схема что для ANTHROPIC_BASE_URL и OPENAI_BASE_URL).
// Если не задан — используется прямой URL (работает только из не-блокированных IP).
export const ELEVENLABS_BASE_URL = (
  process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io"
).replace(/\/+$/, "");

/**
 * Модель озвучки. Вынесена в env, чтобы переезд на более живую модель не
 * требовал правки кода и деплоя: новые модели ElevenLabs раскатывает не на
 * все тарифы сразу, и подходящую приходится подбирать на живом аккаунте.
 * Роут озвучки при 4xx на конкретную модель молча откатывается на
 * ELEVENLABS_FALLBACK_MODEL, так что неудачное значение в env не может
 * оставить ролики без голоса.
 */
export const ELEVENLABS_DEFAULT_MODEL =
  process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2";

/** Проверенная временем модель — страховка на случай недоступной новой. */
export const ELEVENLABS_FALLBACK_MODEL = "eleven_multilingual_v2";
