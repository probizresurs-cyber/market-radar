/**
 * Report Digest агент.
 *
 * Раз в неделю (по умолчанию) шлёт ВЛАДЕЛЬЦУ аккаунта email-сводку «что
 * произошло в его нише и что нашли агенты». В отличие от email-drip-sender
 * (lifecycle-письма про онбординг/триал), это РЕАЛЬНЫЙ отчёт с платформы.
 *
 * Источник данных — только server-side (агент работает по крону, localStorage
 * не видит):
 *   1. users.last_analyzed_company — снимок текущей компании (имя/ниша/url).
 *   2. agent_runs за период — что нашли остальные агенты (отзывы, просадки
 *      позиций, тренды, AI-видимость, изменения у конкурентов).
 *
 * Если за период активности агентов не было и компания не анализировалась —
 * пропускаем (skipped), чтобы не слать пустых писем.
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

interface RunRow {
  agent_name: string;
  status: string;
  summary: string | null;
  finished_at: string | null;
}

// Человекочитаемые названия агентов для письма.
const AGENT_LABELS: Record<string, string> = {
  "auto-publisher": "Авто-постинг",
  "yandex-reviews-watcher": "Отзывы (Яндекс/Google)",
  "site-change-detector": "Изменения у конкурентов",
  "trend-hunter": "Тренды контента",
  "seo-position-tracker": "SEO-позиции",
  "ai-visibility-monitor": "AI-видимость",
  "email-drip-sender": "Email-серии",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

registerAgent({
  name: "report-digest",
  label: "Report Digest",
  description: "Раз в неделю присылает вам на email сводку: снимок компании + что нашли остальные агенты (отзывы, позиции, тренды, конкуренты).",
  icon: "Mail",
  defaultSchedule: "weekly",
  category: "system",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    // Период: дни из настроек (по умолчанию 7).
    const periodDays =
      typeof ctx.params.periodDays === "number" && ctx.params.periodDays >= 1 && ctx.params.periodDays <= 31
        ? Math.floor(ctx.params.periodDays)
        : 7;
    const sendIfEmpty = ctx.params.sendIfEmpty === true; // по умолчанию пустые письма не шлём

    // 1. Юзер + снимок компании
    const users = await query<{
      email: string;
      name: string | null;
      company_name: string | null;
      last_analyzed_company: { name?: string; url?: string; niche?: string } | null;
    }>(
      `SELECT email, name, company_name, last_analyzed_company FROM users WHERE id = $1 AND email LIKE '%@%' LIMIT 1`,
      [ctx.userId],
    );
    if (users.length === 0) {
      return { summary: "У аккаунта нет email — дайджест не отправлен.", skipped: true };
    }
    const user = users[0];
    const companyName = user.last_analyzed_company?.name || user.company_name || "ваша компания";
    const niche = user.last_analyzed_company?.niche || "";

    // 2. Что нашли агенты за период (исключаем сам digest и пустые skip-прогоны)
    const runs = await query<RunRow>(
      `SELECT agent_name, status, summary, finished_at::text
         FROM agent_runs
        WHERE user_id = $1
          AND agent_name <> 'report-digest'
          AND status = 'ok'
          AND summary IS NOT NULL AND summary <> ''
          AND started_at >= NOW() - ($2 || ' days')::interval
        ORDER BY finished_at DESC
        LIMIT 50`,
      [ctx.userId, String(periodDays)],
    );

    // Группируем по агенту → последняя содержательная сводка каждого.
    const byAgent = new Map<string, string>();
    for (const r of runs) {
      if (!byAgent.has(r.agent_name) && r.summary) {
        byAgent.set(r.agent_name, r.summary);
      }
    }

    if (byAgent.size === 0 && !sendIfEmpty) {
      return {
        summary: `За ${periodDays} дн. активности агентов не было — дайджест не отправляли (включите «слать даже пустой» в настройках).`,
        skipped: true,
      };
    }

    // 3. Собираем HTML
    const rows = Array.from(byAgent.entries())
      .map(([name, summary]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#111;white-space:nowrap;vertical-align:top">${esc(AGENT_LABELS[name] ?? name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#444">${esc(summary)}</td>
        </tr>`)
      .join("");

    const html = `
      <p>Здравствуйте${user.name ? `, ${esc(user.name)}` : ""}!</p>
      <p>Ваш еженедельный дайджест по <b>${esc(companyName)}</b>${niche ? ` (${esc(niche)})` : ""} — что произошло за последние ${periodDays} дн.:</p>
      ${
        byAgent.size > 0
          ? `<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px">${rows}</table>`
          : `<p style="color:#666">За этот период агенты ничего нового не нашли.</p>`
      }
      <p><a href="https://marketradar24.ru/?nav=dashboard" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Открыть дашборд</a></p>
      <p style="color:#999;font-size:12px">Вы получаете это письмо, потому что включили агента «Report Digest» в MarketRadar. Отключить можно в разделе «Агенты».</p>
      <p>— Команда MarketRadar</p>
    `.trim();

    const subject = byAgent.size > 0
      ? `Дайджест MarketRadar: ${byAgent.size} обновлен${byAgent.size === 1 ? "ие" : "ий"} по «${companyName}»`
      : `Дайджест MarketRadar по «${companyName}»`;

    const result = await sendMail({ to: user.email, subject, html, from: "hello" });

    if (result.skipped) {
      return { summary: "Email отключён на сервере (EMAIL_ENABLED=false) — дайджест не отправлен.", skipped: true };
    }
    if (!result.ok) {
      return { summary: `Не удалось отправить дайджест: ${result.error ?? "ошибка SMTP"}.`, result: { error: result.error } };
    }

    return {
      summary: `Дайджест отправлен на ${user.email}: ${byAgent.size} раздел(ов) за ${periodDays} дн.`,
      result: { to: user.email, sections: Array.from(byAgent.keys()), periodDays },
    };
  },
});
