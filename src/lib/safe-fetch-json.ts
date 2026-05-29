/**
 * Безопасный парсер ответа fetch как JSON с понятным fallback.
 *
 * Проблема: `await res.json()` падает «Unexpected token '<', "<html>..."»
 * когда сервер вернул HTML вместо JSON. Это случается часто:
 *   - Cloudflare-прокси 502/504 → HTML error page
 *   - Nginx 413 Payload Too Large → HTML
 *   - Next.js crash / OOM → HTML
 *   - Robot.txt blocker возвращает HTML challenge
 *
 * Этот хелпер:
 *   1. Читает тело как text() — не падает на любом контенте
 *   2. Пытается parse JSON
 *   3. На неудаче извлекает <title> из HTML или формирует осмысленную
 *      ошибку из HTTP-статуса (413 → "файл слишком большой", 502 →
 *      "прокси не отвечает", 504 → "таймаут")
 *
 * Возвращает либо { ok: true, data: T } либо { ok: false, error: string }.
 *
 * Использование (replaces `await res.json()`):
 *   const res = await fetch(url, opts);
 *   const parsed = await safeFetchJson<MyResponseType>(res);
 *   if (!parsed.ok) {
 *     toast({ kind: "error", title: parsed.error });
 *     return;
 *   }
 *   // parsed.data — твой типизированный response
 */

export type SafeFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export async function safeFetchJson<T = unknown>(res: Response): Promise<SafeFetchResult<T>> {
  let rawText = "";
  try {
    rawText = await res.text();
  } catch {
    return { ok: false, error: "Не удалось прочитать ответ сервера", status: res.status };
  }

  // Пустой ответ при 204/нет body
  if (!rawText.trim()) {
    return res.ok
      ? { ok: true, data: {} as T }
      : { ok: false, error: `HTTP ${res.status}: пустой ответ`, status: res.status };
  }

  // Пытаемся распарсить
  try {
    const parsed = JSON.parse(rawText) as T;
    return { ok: true, data: parsed };
  } catch {
    // Не JSON — извлекаем причину
    return { ok: false, error: extractErrorFromHtml(rawText, res.status), status: res.status };
  }
}

/**
 * Извлекает понятную ошибку из не-JSON ответа.
 * Приоритет:
 *   1. <title> из HTML — обычно содержит «502 Bad Gateway», «413 Payload» и т.п.
 *   2. Текст ошибки по HTTP-статусу (413/502/504/...)
 *   3. Первые 100 символов тела
 */
function extractErrorFromHtml(rawText: string, status: number): string {
  // Извлекаем <title>
  const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = titleMatch[1].trim();
    if (title && title.length < 200) return title;
  }

  // По коду статуса
  if (status === 413) return "Файл слишком большой — сервер не принял запрос";
  if (status === 502) return "Прокси-сервер не отвечает (502 Bad Gateway)";
  if (status === 503) return "Сервер временно недоступен (503)";
  if (status === 504) return "Таймаут upstream-сервера (504 Gateway Timeout)";
  if (status === 524) return "Cloudflare таймаут (524) — backend не успел ответить";
  if (status >= 500) return `Серверная ошибка ${status} — сервер вернул HTML вместо JSON`;
  if (status === 401) return "Сессия истекла — войдите заново";
  if (status === 403) return "Доступ запрещён (403)";
  if (status === 404) return "Эндпоинт не найден (404)";
  if (status === 429) return "Слишком много запросов — подождите минуту";

  // Fallback — первые 100 символов
  const snippet = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return snippet ? `HTTP ${status}: ${snippet}…` : `HTTP ${status}: ответ не является JSON`;
}

/**
 * Drop-in replacement для `await res.json()`. Возвращает типизированный
 * объект, но при HTML/невалидном JSON throw'ит Error с понятным текстом
 * (вместо «Unexpected token '<'»).
 *
 * Минимальное изменение существующего кода:
 *   const json = await res.json() as MyType;       // OLD
 *   const json = await jsonOrThrow<MyType>(res);   // NEW
 *
 * Все catch'и продолжат работать, но юзер увидит понятную причину.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function jsonOrThrow<T = any>(res: Response): Promise<T> {
  const r = await safeFetchJson<T>(res);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/**
 * Удобный комбо-хелпер: fetch + safeFetchJson в одном вызове.
 *
 * Использование:
 *   const r = await fetchJson<{ ok: boolean; data: Foo }>("/api/foo", { method: "POST", body });
 *   if (!r.ok) return toast.error(r.error);
 *   if (!r.data.ok) return toast.error(r.data.error ?? "Ошибка");
 *   doSomething(r.data.data);
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<SafeFetchResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Сеть недоступна: ${msg}`, status: 0 };
  }
  return safeFetchJson<T>(res);
}
