/**
 * GET /api/admin/kp-analytics
 * Сводка вовлечённости по страницам интерактивного анализа (/kp, /kp-sozdavaya,
 * /share/[id]) — просмотры, уникальные сессии, до какого раздела долистали,
 * клики по ключевым кнопкам. Источник — kp_events (см. /api/kp-track).
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

interface EventRow {
  id: string;
  path: string;
  share_id: string | null;
  session_id: string;
  event_type: "view" | "section" | "click";
  label: string | null;
  created_at: string;
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10) || 30));

  const pathFilter = path && path !== "all" ? "AND path = $2" : "";
  const params = path && path !== "all" ? [`${days} days`, path] : [`${days} days`];

  const [summary, byPath, byLabel, bySection, recent] = await Promise.all([
    query<{ total_views: string; unique_sessions: string }>(
      `SELECT COUNT(*) FILTER (WHERE event_type = 'view') AS total_views,
              COUNT(DISTINCT session_id) AS unique_sessions
       FROM kp_events WHERE created_at > NOW() - $1::interval ${pathFilter}`,
      params
    ),
    query<{ path: string; views: string }>(
      `SELECT path, COUNT(*) FILTER (WHERE event_type = 'view') AS views
       FROM kp_events WHERE created_at > NOW() - $1::interval ${pathFilter}
       GROUP BY path ORDER BY views DESC`,
      params
    ),
    query<{ label: string; count: string }>(
      `SELECT label, COUNT(*) AS count
       FROM kp_events WHERE event_type = 'click' AND created_at > NOW() - $1::interval ${pathFilter}
       GROUP BY label ORDER BY count DESC`,
      params
    ),
    query<{ label: string; count: string }>(
      `SELECT label, COUNT(*) AS count
       FROM kp_events WHERE event_type = 'section' AND created_at > NOW() - $1::interval ${pathFilter}
       GROUP BY label ORDER BY count DESC`,
      params
    ),
    query<EventRow>(
      `SELECT id, path, share_id, session_id, event_type, label, created_at
       FROM kp_events WHERE created_at > NOW() - $1::interval ${pathFilter}
       ORDER BY created_at DESC LIMIT 200`,
      params
    ),
  ]);

  return NextResponse.json({
    ok: true,
    summary: summary[0] ?? { total_views: "0", unique_sessions: "0" },
    byPath,
    byLabel,
    bySection,
    recent,
  });
}
