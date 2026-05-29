/**
 * Глобальный патч `window.fetch` с автоматическим retry для transient
 * серверных ошибок (502/503/504/524). Применяется один раз при загрузке
 * клиента — все существующие `fetch(...)` вызовы автоматически защищены.
 *
 * Что меняется:
 *   - На 502/503/504/524 — автоматический повтор до 2-х раз с
 *     экспоненциальным backoff (800мс → 1600мс).
 *   - Все 2xx, 3xx, 4xx и прочие 5xx — без retry, оригинальное поведение.
 *
 * Юзер вообще не увидит сообщения если ретрай помог: просто спиннер
 * крутится чуть дольше. Если все попытки израсходованы — последний
 * Response возвращается, и фронт обработает ошибку как обычно (через
 * jsonOrThrow → понятный текст).
 *
 * НЕ ретраит:
 *   - Network errors (fetch reject) — пробрасываем как есть, чтобы не
 *     зацикливаться при оффлайне.
 *   - Запросы с body = ReadableStream (нельзя клонировать). Это редко
 *     (только если фронт пишет stream вручную). FormData и string body
 *     ретраятся нормально.
 *
 * Подключение: вызывается из лейаута или layout.tsx:
 *   import "@/lib/fetch-patch";  // импорт уже патчит при первом запуске
 */

export {}; // делает файл валидным TS-модулем

if (typeof window !== "undefined" && !(window as Window & { __mrFetchPatched?: boolean }).__mrFetchPatched) {
  const RETRIES = 2; // всего 3 попытки
  const BACKOFF_MS = 800;
  const TRANSIENT_STATUSES = new Set([502, 503, 504, 524]);
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Если body — это stream, не можем безопасно ретраить (поток
    // одноразовый). Fallback на оригинальный fetch без retry.
    const body = init?.body;
    const isStreamBody =
      body !== null &&
      body !== undefined &&
      typeof body === "object" &&
      "getReader" in body;
    if (isStreamBody) {
      return originalFetch(input, init);
    }

    let lastResponse: Response | null = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await originalFetch(input, init);
        if (!TRANSIENT_STATUSES.has(res.status)) {
          return res;
        }
        lastResponse = res;
        if (attempt < RETRIES) {
          const delay = BACKOFF_MS * Math.pow(2, attempt);
          const url = typeof input === "string" ? input : input.toString();
          console.warn(
            `[fetch-patch] ${url.slice(-60)} → ${res.status}, retry через ${delay}мс (${attempt + 1}/${RETRIES})`,
          );
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        // Сетевая ошибка — пробрасываем, retry бессмыслен (оффлайн).
        throw err;
      }
    }
    // Все попытки израсходованы — возвращаем последний Response,
    // jsonOrThrow покажет понятный текст «прокси не отвечает».
    return lastResponse ?? originalFetch(input, init);
  };

  (window as Window & { __mrFetchPatched?: boolean }).__mrFetchPatched = true;
  console.info("[fetch-patch] глобальный fetch обёрнут с авто-retry для 502/503/504/524");
}
