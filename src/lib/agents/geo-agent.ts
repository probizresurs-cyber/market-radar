/**
 * GEO Agent — ежемесячный глубокий аудит видимости сайта в ассистентах.
 *
 * В отличие от ai-visibility-monitor.ts (лёгкий еженедельный опрос «упоминают
 * ли бренд») этот агент прогоняет полный src/lib/geo-agent: обход сайта
 * глазами краулера ассистента (парность браузер/GPTBot, robots для 16
 * ботов, llms.txt, sitemap), извлекаемость контента (answer-first,
 * вопросительные H2, факты, FAQ), сущность (Organization/sameAs/реквизиты),
 * свежесть — и только потом опрос реальных ассистентов с разбором, кого они
 * цитируют вместо нас. Результат — скор по пяти опорам + приоритизированный
 * план + готовые артефакты (llms.txt, JSON-LD, FAQ-черновики, список площадок
 * для размещений).
 *
 * Ежемесячно, а не чаще: обход 15+ страниц и вызовы нескольких LLM стоят
 * заметно дороже, чем 5 промптов из ai-visibility-monitor, а GEO-сигналы
 * (индексация, структура контента, внешние упоминания) и так меняются
 * неделями — это следует из собранного исследования (docs/geo/), а не
 * произвольный выбор.
 *
 * Params (agent_configs.params):
 *   - websiteUrl, brandName, niche (опц) — иначе берём из last_analyzed_company
 *   - maxPages (default 15)
 *   - lastScore — сохранённый скор прошлого прогона (для дельты)
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { sendTelegramToUser } from "@/lib/tg-send";
import { runGeoAudit } from "@/lib/geo-agent/run";
import { randomUUID } from "crypto";

const ALERT_DROP_POINTS = 10;

registerAgent({
  name: "geo-agent",
  label: "GEO-агент",
  description: "Раз в месяц проверяет, читают ли сайт краулеры ассистентов, извлекаем ли контент и кого ChatGPT/Gemini/Perplexity цитируют вместо вас. Даёт приоритизированный план и готовые артефакты (llms.txt, JSON-LD, FAQ).",
  icon: "Radar",
  defaultSchedule: "weekly",
  category: "visibility",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const params = ctx.params as {
      websiteUrl?: string;
      brandName?: string;
      niche?: string;
      maxPages?: number;
      lastScore?: number;
    };

    // ── Раз в 30 дней, даже если schedule стоит weekly: обход тяжёлый. ──
    if (ctx.lastRunAt) {
      const daysSince = (Date.now() - ctx.lastRunAt.getTime()) / 86_400_000;
      if (daysSince < 28) {
        return { summary: `Следующий прогон через ${Math.ceil(28 - daysSince)} дн. — GEO-аудит раз в месяц.`, skipped: true };
      }
    }

    let websiteUrl = params.websiteUrl?.trim();
    let brandName = params.brandName?.trim();
    let niche = params.niche?.trim();
    if (!websiteUrl || !brandName) {
      const rows = await query<{
        website: string | null;
        last_analyzed_company: { url?: string; name?: string; niche?: string; description?: string } | null;
      }>(`SELECT website, last_analyzed_company FROM users WHERE id = $1`, [ctx.userId]);
      const lc = rows[0]?.last_analyzed_company;
      websiteUrl = websiteUrl || lc?.url?.trim() || rows[0]?.website?.trim();
      brandName = brandName || lc?.name?.trim();
      niche = niche || lc?.niche?.trim() || lc?.description?.split(/[.,!?]/)?.[0]?.trim();
    }
    if (!websiteUrl) {
      return { summary: "Не нашёл сайт для проверки. Запустите анализ компании или укажите websiteUrl в настройках.", skipped: true };
    }

    const report = await runGeoAudit({
      websiteUrl,
      brandName,
      niche,
      maxPages: params.maxPages ?? 15,
    });

    const score = report.score.total;
    const priority1 = report.plan.filter(p => p.priority === 1).slice(0, 3);
    const gapDomains = report.visibility?.citedDomains.filter(d => !d.isUs).slice(0, 5) ?? [];

    // ── Сравнение с прошлым прогоном ──────────────────────────────
    let trendLine = `первый замер: ${score}/100`;
    let alertText: string | null = null;
    if (typeof params.lastScore === "number") {
      const diff = score - params.lastScore;
      const sign = diff > 0 ? "↑" : diff < 0 ? "↓" : "=";
      trendLine = `${params.lastScore} → ${score} (${sign}${Math.abs(diff)})`;
      if (diff <= -ALERT_DROP_POINTS) {
        alertText =
          `🚨 <b>GEO-скор ${report.crawl.brandName} просел на ${Math.abs(diff)} баллов</b>\n\n` +
          `${params.lastScore} → <b>${score}</b>/100\n\n` +
          `Опоры: ${Object.entries(report.score.pillars).map(([k, v]) => `${k} ${v < 0 ? "н/д" : v}`).join(", ")}\n\n` +
          `Подробности и план — в платформе MarketRadar24.`;
      }
    }

    await query(
      `UPDATE agent_configs
          SET params = jsonb_set(params, '{lastScore}', $1::jsonb), updated_at = NOW()
        WHERE user_id = $2 AND agent_name = 'geo-agent'`,
      [JSON.stringify(score), ctx.userId],
    );

    const summaryLines = [
      `📡 GEO-скор ${report.crawl.brandName}: ${trendLine}`,
      `Опоры: доступность ${fmt(report.score.pillars.access)}, извлекаемость ${fmt(report.score.pillars.extract)}, сущность ${fmt(report.score.pillars.entity)}, свежесть ${fmt(report.score.pillars.freshness)}, внешние сигналы ${fmt(report.score.pillars.external)}`,
    ];
    if (priority1.length) summaryLines.push(`Первым делом: ${priority1.map(p => p.title).join("; ")}`);
    if (gapDomains.length) summaryLines.push(`Вместо вас цитируют: ${gapDomains.map(d => d.domain).join(", ")}`);
    if (report.limitations.length) summaryLines.push(`Не проверено: ${report.limitations.join(" ")}`);

    await query(
      `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status, summary, result, needs_approval)
         VALUES ($1, $2, 'geo-agent', NOW(), NOW(), 'ok', $3, $4::jsonb, false)`,
      [randomUUID(), ctx.userId, summaryLines.join(" · ").slice(0, 500), JSON.stringify(report)],
    );

    if (alertText) await sendTelegramToUser(ctx.userId, alertText);

    return {
      summary: summaryLines.join(" · "),
      result: report as unknown as Record<string, unknown>,
    };
  },
});

function fmt(v: number): string {
  return v < 0 ? "н/д" : `${v}`;
}
