import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";
import { getCommissionRate } from "@/lib/partner-types";
import type { PartnerType } from "@/lib/partner-types";

export const runtime = "nodejs";

function admin403() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

// GET — list payments with filters
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const userId = url.searchParams.get("user_id");
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
  const offset = Number(url.searchParams.get("offset") || 0);

  let sql = `
    SELECT pay.*,
           u.email AS user_email,
           pi.name AS item_name
    FROM payments pay
    JOIN users u ON u.id = pay.user_id
    LEFT JOIN pricing_items pi ON pi.id = pay.pricing_item_id
  `;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`pay.status = $${idx++}`); params.push(status); }
  if (userId) { conditions.push(`pay.user_id = $${idx++}`); params.push(userId); }

  if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
  sql += ` ORDER BY pay.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const rows = await query(sql, params);

  // Total count for pagination
  let countSql = "SELECT COUNT(*) AS cnt FROM payments pay";
  if (conditions.length > 0) {
    const countParams = params.slice(0, conditions.length);
    countSql += ` WHERE ${conditions.join(" AND ")}`;
    const countRows = await query<{ cnt: string }>(countSql, countParams);
    return NextResponse.json({ ok: true, payments: rows, total: Number(countRows[0]?.cnt || 0) });
  }

  const countRows = await query<{ cnt: string }>(countSql);
  return NextResponse.json({ ok: true, payments: rows, total: Number(countRows[0]?.cnt || 0) });
}

// POST — create a payment (manual or from webhook)
// Body: { user_id, amount, type, pricing_item_id?, status?, promo_code_id?, metadata? }
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return admin403();

  await initDb();
  const body = await req.json();
  const {
    user_id,
    amount,
    type = "one_time",
    pricing_item_id,
    status = "completed",
    promo_code_id,
    metadata,
  } = body;

  if (!user_id || !amount) {
    return NextResponse.json({ ok: false, error: "user_id and amount required" }, { status: 400 });
  }

  const payId = randomUUID();

  // Check if user has a partner
  const pcRows = await query<{ partner_id: string }>(
    "SELECT partner_id FROM partner_clients WHERE client_user_id = $1",
    [user_id]
  );
  const partnerId = pcRows.length > 0 ? pcRows[0].partner_id : null;

  await query(
    `INSERT INTO payments (id, user_id, amount, currency, type, pricing_item_id, status, partner_id, promo_code_id, metadata)
     VALUES ($1,$2,$3,'RUB',$4,$5,$6,$7,$8,$9)`,
    [payId, user_id, amount, type, pricing_item_id || null, status, partnerId, promo_code_id || null, metadata ? JSON.stringify(metadata) : null]
  );

  // If completed and has partner → accrue commission
  if (status === "completed" && partnerId) {
    await accrueCommission(partnerId, payId, amount);
  }

  // If first payment for this partner client — mark first_payment_at
  if (status === "completed" && partnerId) {
    await query(
      `UPDATE partner_clients SET first_payment_at = NOW()
       WHERE client_user_id = $1 AND first_payment_at IS NULL`,
      [user_id]
    );
  }

  return NextResponse.json({ ok: true, id: payId });
}

// Helper: accrue partner commission
async function accrueCommission(partnerId: string, paymentId: string, amount: number) {
  // Get partner type and active client count
  const pRows = await query<{ type: string; commission_rate: number }>(
    "SELECT type, commission_rate FROM partners WHERE id = $1",
    [partnerId]
  );
  if (pRows.length === 0) return;

  const partner = pRows[0];
  const clientCountRows = await query<{ cnt: string }>(
    "SELECT COUNT(*) AS cnt FROM partner_clients WHERE partner_id = $1 AND first_payment_at IS NOT NULL",
    [partnerId]
  );
  const activeClients = Number(clientCountRows[0]?.cnt || 0);

  // Auto-calculate rate from scale
  const rate = getCommissionRate(partner.type as PartnerType, activeClients);

  // Update partner's commission_rate if it changed
  if (rate !== partner.commission_rate) {
    await query("UPDATE partners SET commission_rate = $1 WHERE id = $2", [rate, partnerId]);
  }

  const commissionAmount = Math.round((amount * rate) / 100);
  if (commissionAmount <= 0) return;

  await query(
    `INSERT INTO partner_balances (id, partner_id, amount, type, payment_id, description)
     VALUES ($1, $2, $3, 'commission', $4, $5)`,
    [
      randomUUID(),
      partnerId,
      commissionAmount,
      paymentId,
      `Комиссия ${rate}% от оплаты ${amount / 100} ₽`,
    ]
  );
}
