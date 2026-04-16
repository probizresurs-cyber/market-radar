import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

// GET — partner dashboard data
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  await initDb();

  // Get partner record
  const pRows = await query(
    "SELECT * FROM partners WHERE user_id = $1",
    [session.userId]
  );

  if (pRows.length === 0) {
    return NextResponse.json({ ok: true, partner: null });
  }

  const partner = pRows[0] as Record<string, unknown>;
  const partnerId = partner.id as string;

  // Client count
  const clientRows = await query<{ total: string; with_payment: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(CASE WHEN first_payment_at IS NOT NULL THEN 1 END) AS with_payment
     FROM partner_clients WHERE partner_id = $1`,
    [partnerId]
  );

  // Balance breakdown: available (excluding locked reserves) + locked reserve
  const balanceRows = await query<{ available: string; reserved: string; total_earned: string; total_paid: string }>(
    `SELECT
       COALESCE(SUM(CASE
         WHEN type != 'reserve' THEN amount
         WHEN type = 'reserve' AND created_at <= NOW() - INTERVAL '60 days' THEN amount
         ELSE 0 END), 0) AS available,
       COALESCE(SUM(CASE
         WHEN type = 'reserve' AND created_at > NOW() - INTERVAL '60 days' THEN amount
         ELSE 0 END), 0) AS reserved,
       COALESCE(SUM(CASE WHEN type IN ('commission','reserve') THEN amount ELSE 0 END), 0) AS total_earned,
       COALESCE(SUM(CASE WHEN type = 'payout' THEN ABS(amount) ELSE 0 END), 0) AS total_paid
     FROM partner_balances WHERE partner_id = $1`,
    [partnerId]
  );

  // Recent balance entries
  const recentBalances = await query(
    "SELECT * FROM partner_balances WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 20",
    [partnerId]
  );

  return NextResponse.json({
    ok: true,
    partner,
    stats: {
      totalClients: Number(clientRows[0]?.total || 0),
      payingClients: Number(clientRows[0]?.with_payment || 0),
      balance: Number(balanceRows[0]?.available || 0),       // available for payout
      reserved: Number(balanceRows[0]?.reserved || 0),       // locked in reserve (60 days)
      totalEarned: Number(balanceRows[0]?.total_earned || 0),
      totalPaidOut: Number(balanceRows[0]?.total_paid || 0),
    },
    recentBalances,
  });
}
