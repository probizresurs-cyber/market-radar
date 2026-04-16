import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

// GET — list partner's clients
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  await initDb();

  const pRows = await query<{ id: string }>(
    "SELECT id FROM partners WHERE user_id = $1",
    [session.userId]
  );
  if (pRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Вы не партнёр" }, { status: 403 });
  }

  const partnerId = pRows[0].id;
  const clients = await query(
    `SELECT pc.*,
            u.email AS client_email, u.name AS client_name,
            COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.user_id = pc.client_user_id AND pay.status = 'completed'), 0) AS total_paid
     FROM partner_clients pc
     JOIN users u ON u.id = pc.client_user_id
     WHERE pc.partner_id = $1
     ORDER BY pc.attributed_at DESC`,
    [partnerId]
  );

  return NextResponse.json({ ok: true, clients });
}
