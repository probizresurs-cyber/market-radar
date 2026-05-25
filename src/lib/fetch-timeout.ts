/**
 * fetchWithTimeout — обёртка над `fetch`, которая снимает запрос если
 * upstream долго не отвечает.
 *
 * Без таймаута Node.js по умолчанию ждёт 5 минут (socket timeout) — это
 * означает что один «зависший» вызов OpenAI / Yandex Cloud / Perplexity
 * занимает PM2-воркер пока он не упадёт по `maxDuration`. Параллельные
 * запросы пилят CPU, очередь растёт, у юзера всё «лагает».
 *
 * Использование (drop-in replacement):
 *   const res = await fetchWithTimeout(url, opts, 30_000);
 *   if (!res.ok) ...
 *
 * Если истёк таймаут — `fetchWithTimeout` бросает `Error('Request timeout: 30000ms')`.
 * Ловите так же как любую другую сетевую ошибку.
 */

const DEFAULT_TIMEOUT_MS = 60_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  // Если caller передал свой AbortSignal — комбинируем с нашим таймаутом.
  // Иначе создаём свой собственный.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Подписываемся на внешний signal если есть, чтобы не пропустить отмену
  // от верхнего уровня (например юзер закрыл вкладку).
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error(`Request timeout: ${timeoutMs}ms (${typeof input === "string" ? input : input.toString().slice(0, 100)})`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

/** Удобный пресет — 30 секунд для быстрых API (Google Places, etc). */
export const FAST_TIMEOUT_MS = 30_000;
/** 60 секунд — стандарт для OpenAI/Claude completion. */
export const NORMAL_TIMEOUT_MS = 60_000;
/** 120 секунд — для image generation (gpt-image-2 quality=high, Gemini, etc). */
export const LONG_TIMEOUT_MS = 120_000;
