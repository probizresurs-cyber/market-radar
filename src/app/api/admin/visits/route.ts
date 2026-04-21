import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface VisitRow {
  id: string;
  user_id: string | null;
  entity_type: string | null;   // 'landing' | 'platform'
  metadata: { path?: string; referrer?: string; utm?: Record<string, string> } | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email: string | null;
}

interface StatRow {
  source: string;
  day: string;
  cnt: string;
  unique_ips: string;
}

export async function GET(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const source = url.searchParams.get("source");      // 'landing' | 'platform' | null
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "7", 10)));

    // Последние визиты
    const visits = await query<VisitRow>(
      `SELECT a.id, a.user_id, a.entity_type, a.metadata, a.ip_address, a.user_agent, a.created_at,
              u.email AS user_email
         FROM activity_logs a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE a.action = 'visit'
          AND ($1::text IS NULL OR a.entity_type = $1)
          AND a.created_at > NOW() - ($2 || ' days')::INTERVAL
        ORDER BY a.created_at DESC
        LIMIT 500`,
      [source, String(days)]
    );

    // Агрегированная статистика по дням
    const stats = await query<StatRow>(
      `SELECT entity_type AS source,
              TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::text AS cnt,
              COUNT(DISTINCT ip_address)::text AS unique_ips
         FROM activity_logs
        WHERE action = 'visit'
          AND ($1::text IS NULL OR entity_type = $1)
          AND created_at > NOW() - ($2 || ' days')::INTERVAL
        GROUP BY entity_type, day
        ORDER BY day DESC, source ASC`,
      [source, String(days)]
    );

    return NextResponse.json({ ok: true, visits, stats });
  } catch (e) {
    console.error("admin/visits error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
