import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// GET /api/admin/partners/[id] — full partner detail with clients and balance
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const { id } = await params;

  // Partner info with joined user
  const partnerRows = await query(
    `SELECT p.*, u.email, u.name
     FROM partners p JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [id]
  );
  if (partnerRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Partner not found" }, { status: 404 });
  }

  // Clients
  const clients = await query(
    `SELECT pc.*, u.email AS client_email, u.name AS client_name,
            COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.user_id = pc.client_user_id AND pay.status = 'completed'), 0) AS total_paid
     FROM partner_clients pc
     JOIN users u ON u.id = pc.client_user_id
     WHERE pc.partner_id = $1
     ORDER BY pc.attributed_at DESC`,
    [id]
  );

  // Balance entries
  const balances = await query(
    `SELECT * FROM partner_balances WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [id]
  );

  // Total balance
  const balanceTotalRows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM partner_balances WHERE partner_id = $1`,
    [id]
  );
  const balanceTotal = Number(balanceTotalRows[0]?.total || 0);

  return NextResponse.json({
    ok: true,
    partner: partnerRows[0],
    clients,
    balances,
    balanceTotal,
  });
}
