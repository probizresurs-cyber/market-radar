/**
 * Общий хелпер для перевода ошибок Anthropic SDK / Cloudflare Worker
 * в дружелюбные сообщения для пользователя.
 *
 * Worker (`ANTHROPIC_BASE_URL=…workers.dev`) часто возвращает 403 с шейпом
 *   {"error":{"type":"forbidden","message":"Request not allowed"}}
 * — это rate-limit или защита Cloudflare. Anthropic-сам возвращает 401 на
 * плохой ключ, 429 на rate-limit. Возможны HTML-страницы 502/504 от прокси.
 *
 * Используется в catch-блоках:
 *
 *   import { friendlyAiError } from "@/lib/ai-error";
 *   ...
 *   } catch (err) {
 *     const { message, status } = friendlyAiError(err);
 *     return NextResponse.json({ ok: false, error: message }, { status });
 *   }
 */

export interface FriendlyAiError {
  /** Текст для UI — без сырого JSON, без stack-traces. */
  message: string;
  /** HTTP-статус ответа. 503 для CF-блокировок, 429 для rate-limit. */
  status: number;
}

const CF_FORBIDDEN_RE = /\b403\b.*(?:forbidden|request not allowed)/i;
const ANTHROPIC_AUTH_RE = /(?:401|authentication|invalid.*api.?key)/i;
const RATE_LIMIT_RE = /\b429\b|rate.?limit/i;
// Anthropic возвращает 400 invalid_request_error с этим текстом, когда на
// аккаунте кончились деньги. Без явной ветки это показывалось как
// бесполезное «Ошибка AI-сервиса: 400».
const BILLING_RE = /credit balance is too low|plans\s*&\s*billing|purchase credits/i;
const NETWORK_RE = /(?:ENOTFOUND|ECONNREFUSED|fetch failed|network error|abort)/i;
const HTML_RE = /<(?:html|!doctype)/i;

export function friendlyAiError(err: unknown): FriendlyAiError {
  const raw = err instanceof Error ? err.message : String(err);

  // Закончились средства на аккаунте Anthropic (400 invalid_request_error).
  // Проверяем ПЕРВЫМ — текст содержит «400», который иначе уйдёт в дефолт.
  if (BILLING_RE.test(raw)) {
    return {
      message:
        "Закончились средства на AI-сервисе (Anthropic). Пополните баланс в Plans & Billing — " +
        "после этого анализы заработают сразу, без изменений в коде.",
      status: 402,
    };
  }

  // Cloudflare Worker блокирует — самый частый случай для VPS в РФ
  if (CF_FORBIDDEN_RE.test(raw)) {
    return {
      message:
        "AI-прокси временно блокирует запросы (rate-limit или защита Cloudflare). " +
        "Подождите 30-60 секунд и повторите. Если ошибка не уходит — пишите в поддержку.",
      status: 503,
    };
  }

  // Rate-limit от самой Anthropic
  if (RATE_LIMIT_RE.test(raw)) {
    return {
      message: "Превышен лимит запросов к AI. Повторите через минуту.",
      status: 429,
    };
  }

  // Проблема с ключом / авторизацией
  if (ANTHROPIC_AUTH_RE.test(raw)) {
    return {
      message: "Ошибка авторизации AI-сервиса. Обратитесь в поддержку.",
      status: 502,
    };
  }

  // Сетевая ошибка (DNS / TCP / timeout)
  if (NETWORK_RE.test(raw)) {
    return {
      message: "Не удалось подключиться к AI-сервису. Проверьте интернет или повторите через минуту.",
      status: 503,
    };
  }

  // HTML вместо JSON (прокси упал)
  if (HTML_RE.test(raw)) {
    return {
      message: "AI-прокси временно вернул HTML вместо JSON — разовый сбой Cloudflare. Повторите через 30 секунд.",
      status: 502,
    };
  }

  // Дефолт — отдаём первые 200 символов оригинала, без сырых JSON-структур.
  // Если в тексте есть { — обрезаем до неё, чтобы не светить кишки.
  const cleaned = raw.split(/[{\n]/)[0].trim() || raw.slice(0, 200);
  return {
    message: `Ошибка AI-сервиса: ${cleaned.slice(0, 200)}`,
    status: 500,
  };
}
