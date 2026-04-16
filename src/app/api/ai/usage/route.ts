/**
 * GET /api/ai/usage — статистика использования AI
 *
 * Для пользователя: возвращает его собственную статистику
 * Для admin: ?user_id=... или сводная по всем
 *
 * Параметры:
 *   ?period=today|week|month|all  (default: month)
 *   ?user_id=...                  (только admin)
 *   ?breakdown=endpoint|model     (группировка)
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";
  const reqUserId = url.searchParams.get("user_id");
  const breakdown = url.searchParams.get("breakdown") || "endpoint";

  // Only admin can query other users
  const targetUserId = session.role === "admin" && reqUserId ? reqUserId : session.userId;
  const isAdminGlobal = session.role === "admin" && !reqUserId;

  // Build time filter
  const periodSql: Record<string, string> = {
    today: "created_at >= NOW() - INTERVAL '1 day'",
    week:  "created_at >= NOW() - INTERVAL '7 days'",
    month: "created_at >= NOW() - INTERVAL '30 days'",
    all:   "1=1",
  };
  const timeFilter = periodSql[period] || periodSql.month;
  const userFilter = isAdminGlobal ? "" : `AND user_id = '${targetUserId}'`;

  // Summary totals
  const totals = await query<{
    total_calls: string;
    successful: string;
    failed: string;
    total_tokens: string;
    avg_duration_ms: string;
    manipulation_count: string;
  }>(
    `SELECT
       COUNT(*) AS total_calls,
       COUNT(*) FILTER (WHERE success = true) AS successful,
       COUNT(*) FILTER (WHERE success = false) AS failed,
       COALESCE(SUM(total_tokens), 0) AS total_tokens,
       ROUND(AVG(duration_ms)) AS avg_duration_ms,
       COUNT(*) FILTER (WHERE manipulation_detected = true) AS manipulation_count
     FROM ai_logs
     WHERE ${timeFilter} ${userFilter}`
  );

  // Daily breakdown for chart (last 30 days)
  const daily = await query<{ day: string; calls: string; tokens: string }>(
    `SELECT
       DATE(created_at) AS day,
       COUNT(*) AS calls,
       COALESCE(SUM(total_tokens), 0) AS tokens
     FROM ai_logs
     WHERE created_at >= NOW() - INTERVAL '30 days' ${userFilter}
     GROUP BY DATE(created_at)
     ORDER BY day ASC`
  );

  // Breakdown by endpoint or model
  const groupCol = breakdown === "model" ? "model" : "endpoint";
  const byGroup = await query<{ group_key: string; calls: string; tokens: string; errors: string }>(
    `SELECT
       ${groupCol} AS group_key,
       COUNT(*) AS calls,
       COALESCE(SUM(total_tokens), 0) AS tokens,
       COUNT(*) FILTER (WHERE success = false) AS errors
     FROM ai_logs
     WHERE ${timeFilter} ${userFilter}
     GROUP BY ${groupCol}
     ORDER BY calls DESC
     LIMIT 20`
  );

  // Rate limit status for current user (admin sees global)
  const todayCallsRow = await query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM ai_logs
     WHERE created_at >= NOW() - INTERVAL '1 day'
       AND user_id = $1`,
    [session.userId]
  );
  const todayCalls = Number(todayCallsRow[0]?.cnt || 0);

  return NextResponse.json({
    ok: true,
    period,
    target_user_id: isAdminGlobal ? null : targetUserId,
    totals: {
      total_calls: Number(totals[0]?.total_calls || 0),
      successful: Number(totals[0]?.successful || 0),
      failed: Number(totals[0]?.failed || 0),
      total_tokens: Number(totals[0]?.total_tokens || 0),
      avg_duration_ms: Number(totals[0]?.avg_duration_ms || 0),
      manipulation_count: Number(totals[0]?.manipulation_count || 0),
    },
    daily: daily.map(d => ({
      day: d.day,
      calls: Number(d.calls),
      tokens: Number(d.tokens),
    })),
    by_group: byGroup.map(g => ({
      key: g.group_key,
      calls: Number(g.calls),
      tokens: Number(g.tokens),
      errors: Number(g.errors),
    })),
    rate_limit: {
      today_calls: todayCalls,
      daily_limit: 100,
      remaining: Math.max(0, 100 - todayCalls),
    },
  });
}
