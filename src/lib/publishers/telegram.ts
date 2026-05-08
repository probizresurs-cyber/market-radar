/**
 * Telegram-publisher.
 *
 * Публикует пост в Telegram-канал/чат через Bot API. Использует существующий
 * `TELEGRAM_BOT_TOKEN`. Целевой chat_id берётся из:
 *   - users.telegram_chat_id (если задан) — тогда юзеру в личку (для теста)
 *   - users.telegram_channel_id (новая колонка) — продакшен-канал
 *   - process.env.TELEGRAM_DEFAULT_CHANNEL — fallback на дефолтный
 *
 * Поддерживает картинку (sendPhoto) и текст с HTML-форматированием.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_BASE = process.env.TG_API_BASE ?? "https://api.telegram.org";

export interface TgPublishParams {
  chatId: string | number;
  /** Текст поста. ≤4096 символов; обрезается. */
  text: string;
  /** URL картинки (data URL или http). Если задан — sendPhoto, иначе sendMessage. */
  imageUrl?: string;
  /** Флаг для preview ссылок. По умолчанию false (чтобы не отвлекать от картинки). */
  disablePreview?: boolean;
}

export interface TgPublishResult {
  ok: boolean;
  messageId?: number;
  messageUrl?: string;
  error?: string;
}

const TG_LIMIT = 4096;
const TG_CAPTION_LIMIT = 1024; // sendPhoto caption — короче чем sendMessage

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Конвертирует MarkdownV2-подобный текст (от Claude `**bold**`, `__italic__`)
 * в HTML-формат, который принимает sendMessage с parse_mode=HTML.
 */
function mdToHtml(text: string): string {
  let s = escapeHtml(text);
  // **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  // __italic__
  s = s.replace(/__([^_]+)__/g, "<i>$1</i>");
  // [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

export async function publishToTelegram(p: TgPublishParams): Promise<TgPublishResult> {
  if (!TOKEN) return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };

  const text = mdToHtml(p.text);

  try {
    if (p.imageUrl) {
      // ─ Mode A: photo + caption.
      // Если caption длиннее 1024 — отправляем text сначала, потом фото отдельно.
      const caption = text.length <= TG_CAPTION_LIMIT ? text : "";
      const overflowText = text.length > TG_CAPTION_LIMIT ? text : "";

      // Шаг 1: отправляем фото (с короткой caption если влезает)
      const photoBody: Record<string, unknown> = {
        chat_id: p.chatId,
        photo: p.imageUrl,
        parse_mode: "HTML",
      };
      if (caption) photoBody.caption = caption;

      // Если imageUrl это data: URL (base64) — Telegram такой не примет.
      // В этом случае нужно загрузить как multipart. Для простоты — сначала
      // упадём с понятной ошибкой; в проде user должен иметь HTTP-URL.
      if (p.imageUrl.startsWith("data:")) {
        return { ok: false, error: "Telegram не принимает data-URL картинки. Картинка должна быть по HTTP-ссылке." };
      }

      const r = await fetch(`${TG_BASE}/bot${TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photoBody),
      });
      const j = await r.json() as { ok: boolean; result?: { message_id: number; chat?: { username?: string } }; description?: string };
      if (!j.ok) return { ok: false, error: j.description ?? "Telegram error" };

      const messageId = j.result?.message_id;
      const username = j.result?.chat?.username;
      const messageUrl = username && messageId ? `https://t.me/${username}/${messageId}` : undefined;

      // Шаг 2 (опц): если caption не влез — досылаем текстом
      if (overflowText) {
        const truncated = overflowText.length > TG_LIMIT ? overflowText.slice(0, TG_LIMIT - 3) + "..." : overflowText;
        await fetch(`${TG_BASE}/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: p.chatId,
            text: truncated,
            parse_mode: "HTML",
            disable_web_page_preview: p.disablePreview ?? true,
          }),
        });
      }

      return { ok: true, messageId, messageUrl };
    } else {
      // ─ Mode B: только текст.
      const truncated = text.length > TG_LIMIT ? text.slice(0, TG_LIMIT - 3) + "..." : text;
      const r = await fetch(`${TG_BASE}/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: p.chatId,
          text: truncated,
          parse_mode: "HTML",
          disable_web_page_preview: p.disablePreview ?? false,
        }),
      });
      const j = await r.json() as { ok: boolean; result?: { message_id: number; chat?: { username?: string } }; description?: string };
      if (!j.ok) return { ok: false, error: j.description ?? "Telegram error" };

      const messageId = j.result?.message_id;
      const username = j.result?.chat?.username;
      const messageUrl = username && messageId ? `https://t.me/${username}/${messageId}` : undefined;
      return { ok: true, messageId, messageUrl };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
