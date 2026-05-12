/**
 * Site Change Detector агент.
 *
 * Раз в день обходит список URL-конкурентов юзера, сравнивает свежий
 * HTML с прошлой версией, Claude описывает что изменилось → шлёт
 * Telegram-alert + кладёт detailed diff в inbox (опционально).
 *
 * Параметры (params):
 *   urls: string[]           — список страниц для отслеживания
 *   notifyTelegram: boolean  — default true
 *   minChangeChars: number   — порог в символах (мелкие правки игнорируем)
 *
 * Persistence:
 *   - Таблица `site_snapshots(user_id, url, text_content, fetched_at)`
 *     хранит только последний snapshot для каждого URL — diff делается
 *     с ним. История нам пока не нужна.
 *
 * Стратегия:
 *   1. Fetch HTML (стандартные headers, 15s timeout)
 *   2. Cheerio → выдёргиваем text (без скриптов/стилей)
 *   3. Загружаем прошлый snapshot из DB
 *   4. Если нет — сохраняем как baseline, никаких alerts
 *   5. Если есть — сравниваем длину/diff. Если >minChangeChars (default 100)
 *      → Claude пишет 2-3 предложения «что изменилось»
 *   6. Сохраняем новый snapshot в DB (заменяя старый)
 *   7. Telegram alert + inbox card
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query, initDb } from "@/lib/db";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";
import { randomUUID } from "crypto";
import * as cheerio from "cheerio";

/**
 * Локальный отправитель generic-сообщения в Telegram-чат юзера.
 * Аналог sendPriceAlert но без price-specific форматирования.
 */
async function sendTelegramAlert(userId: string, htmlText: string): Promise<boolean> {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) return false;
  const rows = await query<{ telegram_chat_id: string | null }>(
    `SELECT telegram_chat_id FROM users WHERE id = $1`,
    [userId],
  );
  const chatId = rows[0]?.telegram_chat_id;
  if (!chatId) return false;
  const base = process.env.TG_API_BASE ?? "https://api.telegram.org";
  try {
    const res = await fetch(`${base}/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface ChangeDetected {
  url: string;
  prevLen: number;
  newLen: number;
  diffChars: number;
  aiSummary: string;
  fetchedAt: string;
}

async function ensureSnapshotsTable() {
  await initDb();
  await query(`
    CREATE TABLE IF NOT EXISTS site_snapshots (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      text_content TEXT NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, url)
    )
  `);
}

/**
 * Скачивает страницу и извлекает чистый текст для diff'а.
 * Убираем script/style/nav/footer чтобы не ловить шум.
 */
async function fetchPageText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();

    const $ = cheerio.load(html);
    // Убираем шум — скрипты, стили, навигация, футер, sidebar
    $("script, style, noscript, nav, footer, aside, .nav, .menu, .footer, .sidebar, [class*='cookie']").remove();
    // Текст только из main / body
    const main = $("main").length ? $("main") : $("body");
    const text = main.text().replace(/\s+/g, " ").trim();
    // Лимит ~50KB на сравнение — обычно главная страница умещается
    return text.slice(0, 50_000);
  } catch {
    return null;
  }
}

async function getSnapshot(userId: string, url: string): Promise<string | null> {
  const rows = await query<{ text_content: string }>(
    `SELECT text_content FROM site_snapshots WHERE user_id = $1 AND url = $2`,
    [userId, url],
  );
  return rows[0]?.text_content ?? null;
}

async function saveSnapshot(userId: string, url: string, content: string) {
  await query(
    `INSERT INTO site_snapshots (user_id, url, text_content, fetched_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, url)
       DO UPDATE SET text_content = EXCLUDED.text_content, fetched_at = EXCLUDED.fetched_at`,
    [userId, url, content],
  );
}

/**
 * Грубый character-level diff: считаем добавленные/удалённые куски.
 * Возвращает абсолютное количество изменённых символов.
 */
function diffSize(oldText: string, newText: string): number {
  // Простая эвристика: разница длин + неперекрывающаяся подстрока
  const lenDiff = Math.abs(oldText.length - newText.length);
  // Дополнительный сигнал: количество позиций где символы различаются
  // в первых N символах (анти-shuffle false positives).
  const sample = Math.min(oldText.length, newText.length, 5000);
  let changedInSample = 0;
  for (let i = 0; i < sample; i++) {
    if (oldText[i] !== newText[i]) changedInSample++;
  }
  return Math.max(lenDiff, changedInSample);
}

const AI_SYSTEM_PROMPT = `Ты — конкурентный разведчик. Тебе показывают «было / стало» текста главной страницы конкурента. Опиши что изменилось в 1-3 предложениях по-русски.

Фокус:
- Новые предложения / тарифы / акции
- Изменения цен (если видно)
- Новый позиционинг или слоган
- Новые блоки на странице (кейсы, отзывы, фичи)
- Снятые блоки

Игнорируй: даты, счётчики, мелкие правки опечаток.

Ответь ТОЛЬКО текстом наблюдения, без markdown, без префиксов.`;

async function summarizeChange(url: string, oldText: string, newText: string): Promise<string> {
  // Передаём только первые 4000 chars каждой версии — достаточно для anchor-секций
  const userMessage = `URL: ${url}

БЫЛО (фрагмент):
${oldText.slice(0, 4000)}

СТАЛО (фрагмент):
${newText.slice(0, 4000)}

Что изменилось?`;

  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: AI_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  return text || "Изменения замечены, но AI не смог их описать. Откройте страницу вручную.";
}

// ─── Регистрация ────────────────────────────────────────────────────

registerAgent({
  name: "site-change-detector",
  label: "Site Change Detector",
  description: "Ежедневно отслеживает страницы конкурентов. Когда что-то меняется на сайте — присылает Telegram-алерт с AI-описанием «что произошло».",
  icon: "Globe",
  defaultSchedule: "daily",
  category: "competitors",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    await ensureSnapshotsTable();

    const params = ctx.params as {
      urls?: string[];
      notifyTelegram?: boolean;
      minChangeChars?: number;
    };
    const urls = Array.isArray(params.urls) ? params.urls.filter(u => /^https?:\/\//.test(u)) : [];
    const notify = params.notifyTelegram !== false;
    const threshold = typeof params.minChangeChars === "number" ? params.minChangeChars : 100;

    if (urls.length === 0) {
      return {
        summary: "В настройках агента не указаны URL для отслеживания. Добавьте 1-5 страниц конкурентов в Hub.",
        skipped: true,
      };
    }

    const changes: ChangeDetected[] = [];
    let baselined = 0;
    let unchanged = 0;
    const errors: string[] = [];

    for (const url of urls) {
      try {
        const fresh = await fetchPageText(url);
        if (!fresh) {
          errors.push(`${url}: не удалось загрузить`);
          continue;
        }
        const prev = await getSnapshot(ctx.userId, url);
        if (prev === null) {
          // Первый запуск — baseline без alert
          await saveSnapshot(ctx.userId, url, fresh);
          baselined++;
          continue;
        }
        const diff = diffSize(prev, fresh);
        if (diff < threshold) {
          unchanged++;
          // Обновляем snapshot всё равно — чтобы микро-изменения копились
          await saveSnapshot(ctx.userId, url, fresh);
          continue;
        }

        // Значимое изменение — AI описывает
        const aiSummary = await summarizeChange(url, prev, fresh);
        await saveSnapshot(ctx.userId, url, fresh);
        changes.push({
          url,
          prevLen: prev.length,
          newLen: fresh.length,
          diffChars: diff,
          aiSummary,
          fetchedAt: new Date().toISOString(),
        });
      } catch (e) {
        errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Inbox-card per изменение (для пост-факт обзора) ──────────────
    for (const c of changes) {
      const runId = randomUUID();
      const summary = `🔔 ${c.url.replace(/^https?:\/\/(www\.)?/, "")}: ${c.aiSummary.slice(0, 150)}`;
      await query(
        `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status,
                                 summary, result, needs_approval)
           VALUES ($1, $2, 'site-change-detector', NOW(), NOW(), 'ok', $3, $4::jsonb, false)`,
        [runId, ctx.userId, summary.slice(0, 500), JSON.stringify(c)],
      );
    }

    // ── Telegram-alert: одно письмо со всеми изменениями ─────────────
    if (notify && changes.length > 0) {
      const text =
        `🕵️ <b>Site Change Detector</b>\n\n` +
        changes.map(c =>
          `<b>${c.url.replace(/^https?:\/\/(www\.)?/, "")}</b>\n` +
          `${c.aiSummary}\n` +
          `<i>Δ ${c.diffChars.toLocaleString("ru-RU")} символов</i>`,
        ).join("\n\n");
      await sendTelegramAlert(ctx.userId, text);
    }

    const summary =
      changes.length > 0
        ? `${changes.length} изменени${changes.length === 1 ? "е" : "й"}, ${unchanged} без изменений, ${baselined} в baseline.`
        : baselined > 0
        ? `${baselined} страниц записано в baseline. Следующая проверка покажет изменения.`
        : unchanged > 0
        ? `Все ${unchanged} страниц без изменений.`
        : errors.length > 0
        ? `Ошибки: ${errors.slice(0, 3).join("; ")}`
        : "Ничего нового.";

    return {
      summary,
      result: { changes, baselined, unchanged, errors },
    };
  },
});
