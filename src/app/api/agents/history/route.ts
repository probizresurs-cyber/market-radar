/**
 * GET /api/agents/history?name=<agent_name>&limit=10
 *
 * Возвращает последние N запусков агента из `agent_runs`. Используется
 * в личном кабинете агента (вкладка «История»).
 *
 * Только для авторизованного пользователя — каждый видит только свои запуски.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: string | null;
  duration_ms: number | null;
  needs_approval: boolean;
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10) || 10, 100);

  if (!name) return NextResponse.json({ ok: false, error: "name обязателен" }, { status: 400 });

  const runs = await query<RunRow>(
    `SELECT id, started_at, finished_at, status, summary, duration_ms, needs_approval
       FROM agent_runs
      WHERE user_id = $1 AND agent_name = $2
      ORDER BY started_at DESC
      LIMIT $3`,
    [session.userId, name, limit],
  );

  return NextResponse.json({ ok: true, runs });
}
