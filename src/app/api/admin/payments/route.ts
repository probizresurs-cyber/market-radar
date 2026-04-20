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

  // Check if user has a referral attribution
  const pcRows = await query<{ partner_id: string; first_payment_at: string | null }>(
    "SELECT partner_id, first_payment_at FROM partner_clients WHERE client_user_id = $1",
    [user_id]
  );
  const partnerId = pcRows.length > 0 ? pcRows[0].partner_id : null;

  // Per document: -10% referral discount for all payments from referred clients
  // Apply automatically when user was attributed via referral link
  let finalAmount = Math.round(Number(amount));
  let referralDiscountApplied = false;
  if (partnerId && !promo_code_id) {
    // Check if partner type is referral (discount only for referral partners' clients)
    const partnerTypeRows = await query<{ type: string }>(
      "SELECT type FROM partners WHERE id = $1",
      [partnerId]
    );
    if (partnerTypeRows.length > 0 && partnerTypeRows[0].type === "referral") {
      // -10% discount on the payment
      finalAmount = Math.round(finalAmount * 0.90);
      referralDiscountApplied = true;
    }
  }

  const paymentMetadata = {
    ...(metadata || {}),
    ...(referralDiscountApplied ? { referral_discount: 10, original_amount: amount } : {}),
  };

  await query(
    `INSERT INTO payments (id, user_id, amount, currency, type, pricing_item_id, status, partner_id, promo_code_id, metadata)
     VALUES ($1,$2,$3,'RUB',$4,$5,$6,$7,$8,$9)`,
    [payId, user_id, finalAmount, type, pricing_item_id || null, status, partnerId, promo_code_id || null, JSON.stringify(paymentMetadata)]
  );

  // If completed and has partner → accrue commission (on the actual paid amount)
  if (status === "completed" && partnerId) {
    await accrueCommission(partnerId, payId, finalAmount, user_id);
  }

  // If first payment for this partner client — mark first_payment_at
  if (status === "completed" && partnerId) {
    await query(
      `UPDATE partner_clients SET first_payment_at = NOW()
       WHERE client_user_id = $1 AND first_payment_at IS NULL`,
      [user_id]
    );
  }

  return NextResponse.json({
    ok: true,
    id: payId,
    amount: finalAmount,
    ...(referralDiscountApplied ? { referral_discount_applied: true, original_amount: amount } : {}),
  });
}

// Helper: accrue partner commission
// Splits into 90% commission + 10% reserve (released after 60 days)
// For referral partners: only accrues within 12 months of client's first_payment_at
async function accrueCommission(partnerId: string, paymentId: string, amount: number, clientUserId?: string) {
  // Get partner type and active client count
  const pRows = await query<{ type: string; commission_rate: number }>(
    "SELECT type, commission_rate FROM partners WHERE id = $1",
    [partnerId]
  );
  if (pRows.length === 0) return;

  const partner = pRows[0];

  // 12-month referral window: for referral partners, check client's first_payment_at
  if (partner.type === "referral" && clientUserId) {
    const pcRows = await query<{ first_payment_at: string | null }>(
      "SELECT first_payment_at FROM partner_clients WHERE partner_id = $1 AND client_user_id = $2",
      [partnerId, clientUserId]
    );
    if (pcRows.length > 0 && pcRows[0].first_payment_at) {
      const firstPayment = new Date(pcRows[0].first_payment_at);
      const monthsSinceFirst = (Date.now() - firstPayment.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSinceFirst > 12) {
        // Commission window expired for this client
        return;
      }
    }
  }

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

  const totalCommission = Math.round((amount * rate) / 100);
  if (totalCommission <= 0) return;

  // Per document: 10% of commission goes to reserve (for chargebacks, released after 60 days)
  const reserveAmount = Math.round(totalCommission * 0.10);
  const commissionAmount = totalCommission - reserveAmount;

  // Main commission (90%)
  if (commissionAmount > 0) {
    await query(
      `INSERT INTO partner_balances (id, partner_id, amount, type, payment_id, description)
       VALUES ($1, $2, $3, 'commission', $4, $5)`,
      [
        randomUUID(),
        partnerId,
        commissionAmount,
        paymentId,
        `Комиссия ${rate}% от оплаты ${amount / 100} ₽ (90%)`,
      ]
    );
  }

  // Reserve (10%, released after 60 days)
  if (reserveAmount > 0) {
    await query(
      `INSERT INTO partner_balances (id, partner_id, amount, type, payment_id, description)
       VALUES ($1, $2, $3, 'reserve', $4, $5)`,
      [
        randomUUID(),
        partnerId,
        reserveAmount,
        paymentId,
        `Резерв 10% от комиссии — разблокировка через 60 дней`,
      ]
    );
  }
}
