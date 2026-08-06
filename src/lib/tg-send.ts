/**
 * Единый отправитель сообщений через бота @market_radar1_bot.
 *
 * Зачем: до этого по коду жили 5 копий отправки в Telegram, и они разъезжались:
 * одна ходила напрямую на api.telegram.org мимо TG_API_BASE-прокси (с RU-VPS
 * это не работает), другая падала из-за non-null assertion на TOKEN при пустом
 * env, и почти никто не читал ответ Telegram — ошибки (`chat not found`,
 * `bot was blocked`) терялись молча. Здесь всё в одном месте: проверка токена,
 * прокси, таймаут, разбор ответа, console.error с префиксом [tg].
 *
 * НЕ покрывает sendPhoto — фото-логика живёт в publishers/telegram.ts.
 */
import { query } from "./db";

export interface TgInlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TgSendOpts {
  chatId: number | string;
  text: string;
  /** По умолчанию HTML — весь бот пишет HTML-разметкой. */
  parseMode?: "HTML" | "MarkdownV2";
  inlineKeyboard?: TgInlineButton[][];
  /** По умолчанию true — превью ссылок отвлекает от текста бота. */
  disableWebPagePreview?: boolean;
  /** Таймаут запроса к Telegram. По умолчанию 15 сек. */
  timeoutMs?: number;
}

export interface TgSendResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

/** Экранирование пользовательского текста для parse_mode: "HTML". */
export function escapeTgHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(opts: TgSendOpts): Promise<TgSendResult> {
  // Токен читаем в момент вызова, без non-null assertion: при пустом env
  // сообщение просто не уйдёт с понятной ошибкой, а не уронит весь роут.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[tg] TELEGRAM_BOT_TOKEN не настроен — сообщение не отправлено");
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  }
  const base = process.env.TG_API_BASE ?? "https://api.telegram.org";

  // Telegram-лимит 4096 символов на сообщение
  const text = opts.text.length > 4096 ? opts.text.slice(0, 4093) + "..." : opts.text;
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text,
    parse_mode: opts.parseMode ?? "HTML",
    disable_web_page_preview: opts.disableWebPagePreview ?? true,
  };
  if (opts.inlineKeyboard) body.reply_markup = { inline_keyboard: opts.inlineKeyboard };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const j = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!j.ok) {
      console.error(`[tg] sendMessage chat=${opts.chatId} отклонён:`, j.description ?? `HTTP ${res.status}`);
      return { ok: false, error: j.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: j.result?.message_id };
  } catch (e) {
    console.error(`[tg] sendMessage chat=${opts.chatId} не отправлен:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Отправка по userId: сам достаёт chat_id из users.telegram_chat_id.
 * Общий случай для крон-агентов (price alerts, SEO tracker, site changes...).
 * Если юзер не привязал Telegram — тихий no-op с ok:false.
 */
export async function sendTelegramToUser(
  userId: string,
  text: string,
  opts?: Omit<TgSendOpts, "chatId" | "text">,
): Promise<TgSendResult> {
  const rows = await query<{ telegram_chat_id: string | null }>(
    `SELECT telegram_chat_id FROM users WHERE id = $1`,
    [userId],
  );
  const chatId = rows[0]?.telegram_chat_id;
  if (!chatId) return { ok: false, error: "Telegram не подключён (users.telegram_chat_id пуст)" };
  return sendTelegramMessage({ chatId, text, ...opts });
}
