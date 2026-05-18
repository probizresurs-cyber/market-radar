/**
 * GET /api/admin/leads/analytics
 *
 * Сводная аналитика воронки лидов для админа:
 *   • Всего лидов и сколько в каком статусе
 *   • Отчёты: pending / running / done / failed + сумма $ потрачено
 *   • Конверсия в покупателя (% customer от total)
 *   • Среднее время в каждом статусе (по lead_status_history)
 *   • Отправлено сегодня / за неделю (по last_contact_at)
 *
 * Доступ — только админ.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/lead-types";

export const runtime = "nodejs";

interface CountRow { status: string; cnt: string }
interface ReportStatRow { status: string; cnt: string; total_cost: string | null }
interface DurationRow { from_status: string; avg_hours: string }
interface SourceRow { source: string | null; cnt: string }

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    // 1. Статусы — counts с заполнением нулями для отсутствующих.
    const statusRows = await query<CountRow>(
      `SELECT status, COUNT(*)::text AS cnt FROM leads GROUP BY status`,
    );
    const byStatus: Record<LeadStatus, number> = {} as Record<LeadStatus, number>;
    for (const s of LEAD_STATUSES) byStatus[s] = 0;
    for (const r of statusRows) {
      if ((LEAD_STATUSES as readonly string[]).includes(r.status)) {
        byStatus[r.status as LeadStatus] = parseInt(r.cnt, 10);
      }
    }
    const totalLeads = Object.values(byStatus).reduce((s, n) => s + n, 0);
    const customers = byStatus.customer;
    const conversionPct = totalLeads > 0 ? Math.round((customers / totalLeads) * 1000) / 10 : 0;

    // 2. Отчёты — pending/running/done/failed + сумма стоимости (cost_cents в центах).
    const reportStatRows = await query<ReportStatRow>(
      `SELECT status, COUNT(*)::text AS cnt,
              COALESCE(SUM(cost_cents), 0)::text AS total_cost
         FROM lead_reports GROUP BY status`,
    );
    const reportStats: Record<string, { count: number; costCents: number }> = {};
    let totalReportCostCents = 0;
    for (const r of reportStatRows) {
      const cost = parseFloat(r.total_cost ?? "0");
      reportStats[r.status] = { count: parseInt(r.cnt, 10), costCents: cost };
      if (r.status === "done") totalReportCostCents += cost;
    }

    // 3. Среднее время в каждом статусе. Берём из lead_status_history разницу
    //    между последовательными изменениями. Если лид сейчас в статусе X, и
    //    предыдущая запись была изменением из Y → X, то время в Y =
    //    (current_change.at - previous_change.at). Для простоты считаем по
    //    `from_status` — сколько в среднем сидели в нём перед уходом.
    const durationRows = await query<DurationRow>(
      `WITH ordered AS (
         SELECT lead_id, from_status, to_status, created_at,
                LAG(created_at) OVER (PARTITION BY lead_id ORDER BY created_at) AS prev_at
           FROM lead_status_history
       )
       SELECT from_status,
              AVG(EXTRACT(EPOCH FROM (created_at - prev_at)) / 3600.0)::text AS avg_hours
         FROM ordered
        WHERE prev_at IS NOT NULL AND from_status IS NOT NULL
        GROUP BY from_status`,
    );
    const avgHoursByStatus: Record<string, number> = {};
    for (const r of durationRows) {
      avgHoursByStatus[r.from_status] = Math.round(parseFloat(r.avg_hours) * 10) / 10;
    }

    // 4. Активность контактов: сколько было «contacted/replied/meeting» событий
    //    за сегодня / неделю / месяц. Это даёт менеджеру понимание загрузки.
    const activityRows = await query<{ today: string; week: string; month: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::text AS today,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS week,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS month
        FROM lead_status_history
       WHERE to_status IN ('contacted', 'replied', 'meeting')`,
    );
    const activity = activityRows[0] ?? { today: "0", week: "0", month: "0" };

    // 5. Партии импорта (по source). Топ-10 источников.
    const sourceRows = await query<SourceRow>(
      `SELECT source, COUNT(*)::text AS cnt
         FROM leads
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY COUNT(*) DESC
        LIMIT 10`,
    );

    return NextResponse.json({
      ok: true,
      totalLeads,
      byStatus,
      conversionPct,
      customers,
      reports: reportStats,
      totalReportCostCents,
      totalReportCostRub: Math.round((totalReportCostCents / 100) * 95), // ≈ 95 ₽/$
      avgHoursByStatus,
      activity: {
        today: parseInt(activity.today, 10),
        week: parseInt(activity.week, 10),
        month: parseInt(activity.month, 10),
      },
      sources: sourceRows.map(r => ({ source: r.source, count: parseInt(r.cnt, 10) })),
    });
  } catch (e) {
    console.error("admin/leads/analytics error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
