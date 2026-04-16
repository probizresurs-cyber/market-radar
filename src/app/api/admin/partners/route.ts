import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// GET — list partners with joined fields
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // optional filter

  let sql = `
    SELECT p.*,
           u.email, u.name,
           (SELECT COUNT(*) FROM partner_clients pc WHERE pc.partner_id = p.id) AS client_count,
           COALESCE((SELECT SUM(pb.amount) FROM partner_balances pb WHERE pb.partner_id = p.id AND pb.type = 'commission'), 0) AS total_earned
    FROM partners p
    JOIN users u ON u.id = p.user_id
  `;
  const params: unknown[] = [];

  if (status) {
    sql += ` WHERE p.status = $1`;
    params.push(status);
  }

  sql += ` ORDER BY p.created_at DESC`;

  const rows = await query(sql, params);
  return NextResponse.json({ ok: true, partners: rows });
}

// PATCH — update partner status / commission_rate / type
// Body: { partnerId, status?, commission_rate?, type? }
export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const body = await req.json();
  const { partnerId, status, commission_rate, type } = body;

  if (!partnerId) {
    return NextResponse.json({ ok: false, error: "partnerId required" }, { status: 400 });
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { sets.push(`status = $${idx++}`); params.push(status); }
  if (commission_rate !== undefined) { sets.push(`commission_rate = $${idx++}`); params.push(commission_rate); }
  if (type) { sets.push(`type = $${idx++}`); params.push(type); }

  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  params.push(partnerId);
  await query(`UPDATE partners SET ${sets.join(", ")} WHERE id = $${idx}`, params);

  return NextResponse.json({ ok: true });
}
