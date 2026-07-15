/**
 * GET   /api/admin/analysis-requests — список заявок на полноценный анализ
 * PATCH /api/admin/analysis-requests — обновить статус/заметки
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const rows = await query(
    `SELECT * FROM analysis_requests
     ${status && status !== "all" ? "WHERE status = $1" : ""}
     ORDER BY created_at DESC`,
    status && status !== "all" ? [status] : []
  );

  return NextResponse.json({ ok: true, requests: rows });
}

export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  let body: { id?: string; status?: string; admin_notes?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const { id, status, admin_notes } = body;

  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  await query(
    `UPDATE analysis_requests
     SET status = COALESCE($2, status),
         admin_notes = COALESCE($3, admin_notes)
     WHERE id = $1`,
    [id, status ?? null, admin_notes ?? null]
  );

  return NextResponse.json({ ok: true });
}
