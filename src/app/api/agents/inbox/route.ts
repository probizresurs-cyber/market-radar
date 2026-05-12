/**
 * GET /api/agents/inbox
 *
 * Список agent_runs, которые ждут approval (needs_approval=true,
 * approved_at IS NULL). Используется в Agent Hub для inbox-секции
 * и для notification-badge в navbar.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface InboxRow {
  id: string;
  agent_name: string;
  started_at: string;
  summary: string | null;
  result: Record<string, unknown>;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const rows = await query<InboxRow>(
    `SELECT id, agent_name, started_at, summary, result
       FROM agent_runs
       WHERE user_id = $1
         AND needs_approval = true
         AND approved_at IS NULL
       ORDER BY started_at DESC
       LIMIT 50`,
    [session.userId],
  );

  return NextResponse.json({ ok: true, inbox: rows, count: rows.length });
}
