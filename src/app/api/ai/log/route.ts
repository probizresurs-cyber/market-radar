/**
 * POST /api/ai/log — логирование AI-вызова
 * GET  /api/ai/log — история логов (только admin)
 *
 * Вызывай после каждого AI-запроса:
 *   await fetch("/api/ai/log", { method:"POST", body: JSON.stringify({
 *     endpoint: "analyze", model: "claude-sonnet-4-6",
 *     promptTokens: 1200, completionTokens: 800,
 *     durationMs: 4200, success: true
 *   })})
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// POST — log an AI call (called server-side from other routes)
export async function POST(req: Request) {
  const session = await getSessionUser();
  // Allow internal server-side calls (no session) via X-Internal header
  const isInternal = req.headers.get("x-internal-call") === process.env.INTERNAL_SECRET;

  if (!session && !isInternal) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const body = await req.json();
  const {
    endpoint,
    model,
    prompt_tokens,
    completion_tokens,
    duration_ms,
    success = true,
    error_code,
    error_message,
    manipulation_detected = false,
  } = body;

  if (!endpoint || !model) {
    return NextResponse.json({ ok: false, error: "endpoint and model required" }, { status: 400 });
  }

  const totalTokens = (prompt_tokens || 0) + (completion_tokens || 0);

  await query(
    `INSERT INTO ai_logs
       (id, user_id, endpoint, model, prompt_tokens, completion_tokens, total_tokens,
        duration_ms, success, error_code, error_message, manipulation_detected)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      randomUUID(),
      session?.userId ?? null,
      endpoint,
      model,
      prompt_tokens ?? null,
      completion_tokens ?? null,
      totalTokens || null,
      duration_ms ?? null,
      success,
      error_code ?? null,
      error_message ?? null,
      manipulation_detected,
    ]
  );

  return NextResponse.json({ ok: true });
}

// GET — retrieve AI logs (admin only)
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await initDb();

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const endpoint = url.searchParams.get("endpoint");
  const successOnly = url.searchParams.get("success");
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
  const offset = Number(url.searchParams.get("offset") || 0);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (userId) { conditions.push(`l.user_id = $${idx++}`); params.push(userId); }
  if (endpoint) { conditions.push(`l.endpoint = $${idx++}`); params.push(endpoint); }
  if (successOnly === "false") { conditions.push(`l.success = false`); }
  if (successOnly === "true") { conditions.push(`l.success = true`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const rows = await query(
    `SELECT l.*, u.email AS user_email
     FROM ai_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return NextResponse.json({ ok: true, logs: rows });
}
