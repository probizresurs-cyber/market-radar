/**
 * GET  /api/admin/partners/applications — список заявок
 * PATCH /api/admin/partners/applications — обновить статус/заметки
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
    `SELECT * FROM partner_applications
     ${status && status !== "all" ? "WHERE status = $1" : ""}
     ORDER BY created_at DESC`,
    status && status !== "all" ? [status] : []
  );

  return NextResponse.json({ ok: true, applications: rows.rows });
}

export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const { id, status, admin_notes } = await req.json() as {
    id: string;
    status?: string;
    admin_notes?: string;
  };

  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  await query(
    `UPDATE partner_applications
     SET status = COALESCE($2, status),
         admin_notes = COALESCE($3, admin_notes)
     WHERE id = $1`,
    [id, status ?? null, admin_notes ?? null]
  );

  return NextResponse.json({ ok: true });
}
