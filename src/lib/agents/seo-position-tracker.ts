/**
 * SEO Position Tracker — ежедневный мониторинг позиций сайта в поиске.
 *
 * Использует Keys.so endpoint `lost_keywords` — он отдаёт ключи, по которым
 * сайт за последний месяц выпал из выдачи или просел в позициях. Это самый
 * полезный сигнал для SEO-агентств: «у клиента просели ключи — надо разобраться».
 *
 * Параметры (params в agent_configs):
 *   - domain: string (опц) — если не задано, берём из users.last_analyzed_company
 *   - base: KeysoBase (опц) — регион поиска: msk / spb / ru / goo_ru. По умолчанию msk
 *   - notifyTelegram: boolean (опц, default true) — слать ли TG-алерт
 *   - minOldPosition: number (опц, default 30) — игнорировать ключи которые и так были на 30+ месте
 *
 * Стратегия:
 *   1. Резолвим domain (из params или last_analyzed_company)
 *   2. fetchLostKeywords(domain) — берём до 30 потерянных
 *   3. Фильтруем «было ≥ minOldPosition» — мелочь не интересна
 *   4. Сравниваем с прошлым прогоном (params.lastKeywords) — отбираем только новые
 *   5. Для каждого новой потери — inbox-карточка с approval
 *   6. Если включён notifyTelegram — короткий summary в TG
 */

import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { fetchLostKeywords, type KeysoBase } from "@/lib/keyso-client";
import { randomUUID } from "crypto";

interface LostKeywordSnapshot {
  keyword: string;
  oldPosition: number;
  newPosition: number | null;
  volume: number;
}

/** Telegram-alert. Если chat_id не настроен — тихо пропускаем. */
async function sendTelegram(userId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatRows = await query<{ telegram_chat_id: string | null }>(
    `SELECT telegram_chat_id FROM users WHERE id = $1`,
    [userId],
  );
  const chatId = chatRows[0]?.telegram_chat_id;
  if (!chatId) return;
  try {
    const base = process.env.TG_API_BASE ?? "https://api.telegram.org";
    await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.warn("[seo-tracker] TG send failed:", e);
  }
}

registerAgent({
  name: "seo-position-tracker",
  label: "SEO Position Tracker",
  description: "Ежедневно проверяет позиции сайта в Яндексе через Keys.so и алертит при просадках в топ-30. Заменяет Topvisor / SerpStat.",
  icon: "TrendingDown",
  defaultSchedule: "daily",
  category: "visibility",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const params = ctx.params as {
      domain?: string;
      base?: KeysoBase;
      notifyTelegram?: boolean;
      minOldPosition?: number;
      lastKeywords?: string[];
    };

    // ── Резолвим домен ────────────────────────────────────────────
    let domain = params.domain?.trim();
    if (!domain) {
      const rows = await query<{
        website: string | null;
        last_analyzed_company: { url?: string; name?: string } | null;
      }>(
        `SELECT website, last_analyzed_company FROM users WHERE id = $1`,
        [ctx.userId],
      );
      domain = rows[0]?.last_analyzed_company?.url?.trim() || rows[0]?.website?.trim() || undefined;
    }
    if (!domain) {
      return {
        summary: "Не нашёл домен. Запустите анализ компании или укажите domain в настройках.",
        skipped: true,
      };
    }
    // Нормализуем (без https/www, без путей).
    domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();

    const base: KeysoBase = params.base ?? "msk";
    const minOldPosition = params.minOldPosition ?? 30;
    const notifyTelegram = params.notifyTelegram !== false;

    // ── Тянем потерянные ключи ────────────────────────────────────
    const lost = await fetchLostKeywords(domain, base, 30);
    if (lost.length === 0) {
      // Это может быть из-за пустой подписки Keys.so или потому что реально
      // ничего не упало. Не считаем за ошибку.
      return {
        summary: `${domain}: потерянных ключей за период не найдено (либо Keys.so вернул пусто).`,
        skipped: true,
      };
    }

    // Фильтруем по minOldPosition — если ключ был на 50-100 месте, его «потеря» нам не интересна.
    const significant = lost.filter(k => k.oldPosition > 0 && k.oldPosition <= minOldPosition);
    if (significant.length === 0) {
      return {
        summary: `${domain}: потери только за пределами топ-${minOldPosition}, существенных нет.`,
        skipped: true,
      };
    }

    // ── Дедуп с прошлым прогоном ──────────────────────────────────
    // Храним хэши ключевых слов чтобы не алертить дважды по той же потере.
    const seen = new Set<string>(Array.isArray(params.lastKeywords) ? params.lastKeywords : []);
    const fresh = significant.filter(k => !seen.has(k.keyword));

    if (fresh.length === 0) {
      return {
        summary: `${domain}: ${significant.length} известных потерь, новых нет (уже видели).`,
        skipped: true,
      };
    }

    // Сортируем по важности: чем выше была позиция (меньше число) и больше volume — тем критичнее.
    fresh.sort((a, b) => (a.oldPosition - b.oldPosition) || (b.volume - a.volume));

    // ── Обновляем snapshot keywords ───────────────────────────────
    const allSeen = Array.from(new Set([...seen, ...significant.map(k => k.keyword)])).slice(-500);
    await query(
      `UPDATE agent_configs
          SET params = jsonb_set(params, '{lastKeywords}', $1::jsonb), updated_at = NOW()
        WHERE user_id = $2 AND agent_name = 'seo-position-tracker'`,
      [JSON.stringify(allSeen), ctx.userId],
    );

    // ── Inbox cards для каждой просадки ──────────────────────────
    for (const k of fresh.slice(0, 20)) {
      const newPosStr = k.newPosition ? `→ ${k.newPosition}` : "→ выпал";
      const summary = `📉 «${k.keyword}» — ${k.oldPosition} ${newPosStr} (объём ${k.volume.toLocaleString("ru-RU")}/мес)`;
      await query(
        `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status,
                                 summary, result, needs_approval)
           VALUES ($1, $2, 'seo-position-tracker', NOW(), NOW(), 'ok', $3, $4::jsonb, false)`,
        [randomUUID(), ctx.userId, summary.slice(0, 500), JSON.stringify(k as LostKeywordSnapshot)],
      );
    }

    // ── Telegram-алерт коротким списком top-5 ────────────────────
    if (notifyTelegram && fresh.length > 0) {
      const top5 = fresh.slice(0, 5)
        .map(k => `• <b>${k.keyword}</b> — было ${k.oldPosition}, стало ${k.newPosition ?? "—"} (${k.volume.toLocaleString("ru-RU")}/мес)`)
        .join("\n");
      const tail = fresh.length > 5 ? `\n\n… и ещё ${fresh.length - 5} в Inbox.` : "";
      await sendTelegram(
        ctx.userId,
        `📉 <b>SEO просели позиции на ${domain}</b>\n\n${top5}${tail}\n\nПодробности и план — в платформе MarketRadar24.`,
      );
    }

    return {
      summary: `${domain}: ${fresh.length} новых потерь в топ-${minOldPosition}. Подробности в Inbox.`,
      result: { domain, base, fresh, total: significant.length },
    };
  },
});
