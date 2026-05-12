/**
 * GET /api/agents/<name>/runs
 *
 * История последних запусков агента для текущего юзера (для UI Hub).
 * Limit 20, по времени убывания.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface RunRow {
  id: string;
  agent_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: string | null;
  result: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number | null;
  needs_approval: boolean;
  approved_at: string | null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { name } = await ctx.params;
  await initDb();

  const rows = await query<RunRow>(
    `SELECT id, agent_name, started_at, finished_at, status, summary, result,
            error_message, duration_ms, needs_approval, approved_at
       FROM agent_runs
       WHERE user_id = $1 AND agent_name = $2
       ORDER BY started_at DESC
       LIMIT 20`,
    [session.userId, name],
  );

  return NextResponse.json({ ok: true, runs: rows });
}
