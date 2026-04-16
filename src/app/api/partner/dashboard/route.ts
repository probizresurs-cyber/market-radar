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

  // Balance total
  const balanceRows = await query<{ total: string }>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM partner_balances WHERE partner_id = $1",
    [partnerId]
  );

  // Total earned (commissions only)
  const earnedRows = await query<{ total: string }>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM partner_balances WHERE partner_id = $1 AND type = 'commission'",
    [partnerId]
  );

  // Total paid out
  const paidOutRows = await query<{ total: string }>(
    "SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM partner_balances WHERE partner_id = $1 AND type = 'payout'",
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
      balance: Number(balanceRows[0]?.total || 0),
      totalEarned: Number(earnedRows[0]?.total || 0),
      totalPaidOut: Number(paidOutRows[0]?.total || 0),
    },
    recentBalances,
  });
}
