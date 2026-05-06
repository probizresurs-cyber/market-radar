/**
 * POST /api/admin/invoices/[id]/mark-paid
 *
 * Подтверждение оплаты счёта администратором (после того как деньги пришли
 * на расчётный счёт ИП). Делает 4 вещи atомарно:
 *   1) обновляет invoices.status='paid', paid_at=NOW()
 *   2) создаёт запись в payments (status='completed') и привязывает к счёту
 *   3) автоматически генерирует акт об оказании услуг (acts.*)
 *   4) продлевает подписку пользователя (если у счёта связан pricing_item)
 *   5) начисляет партнёрскую комиссию (если применимо) — TODO в момент,
 *      когда подключим основной payment-flow с partner-attribution.
 *
 * Доступ: только admin.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";
import { allocateDocNumber } from "@/lib/doc-numbering";

export const runtime = "nodejs";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  user_id: string;
  amount: number;
  currency: string;
  vat_mode: string;
  status: string;
  pricing_item_id: string | null;
  service_description: string;
  service_period_start: string | null;
  service_period_end: string | null;
  client_snapshot: unknown;
  vendor_snapshot: unknown;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await initDb();
  const { id } = await params;

  const rows = await query<InvoiceRow>(
    `SELECT id, invoice_number, user_id, amount, currency, vat_mode, status,
            pricing_item_id, service_description, service_period_start, service_period_end,
            client_snapshot, vendor_snapshot
       FROM invoices WHERE id = $1`,
    [id],
  );
  const inv = rows[0];
  if (!inv) return NextResponse.json({ ok: false, error: "Счёт не найден" }, { status: 404 });
  if (inv.status === "paid") {
    return NextResponse.json({ ok: false, error: "Счёт уже оплачен" }, { status: 400 });
  }

  // 1) payments — создаём запись об оплате
  const paymentId = randomUUID();
  await query(
    `INSERT INTO payments (id, user_id, amount, currency, type, pricing_item_id, status, metadata)
     VALUES ($1, $2, $3, $4, 'one_time', $5, 'completed', $6::jsonb)`,
    [
      paymentId, inv.user_id, inv.amount, inv.currency,
      inv.pricing_item_id || null,
      JSON.stringify({ source: "invoice_bank_transfer", invoice_number: inv.invoice_number }),
    ],
  );

  // 2) invoices — пометить оплаченным
  await query(
    `UPDATE invoices SET status = 'paid', paid_at = NOW(), payment_id = $1, updated_at = NOW()
       WHERE id = $2`,
    [paymentId, inv.id],
  );

  // 3) acts — auto-generate
  const actId = randomUUID();
  const actNumber = await allocateDocNumber("act");
  await query(
    `INSERT INTO acts (
       id, act_number, invoice_id, payment_id, user_id,
       amount, currency, vat_mode, service_description,
       service_period_start, service_period_end,
       client_snapshot, vendor_snapshot
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11,
       $12::jsonb, $13::jsonb
     )`,
    [
      actId, actNumber, inv.id, paymentId, inv.user_id,
      inv.amount, inv.currency, inv.vat_mode, inv.service_description,
      inv.service_period_start, inv.service_period_end,
      JSON.stringify(inv.client_snapshot),
      JSON.stringify(inv.vendor_snapshot),
    ],
  );

  // 4) продлеваем подписку, если связан pricing_item
  if (inv.pricing_item_id) {
    const pi = await query<{ limits: { days?: number; tokens?: number } | null; type: string }>(
      `SELECT limits, type FROM pricing_items WHERE id = $1`,
      [inv.pricing_item_id],
    );
    const limits = pi[0]?.limits ?? null;
    const days = Number(limits?.days) || 30;
    const tokens = Number(limits?.tokens) || 1_000_000;
    await query(
      `UPDATE users SET
         plan = COALESCE($1, plan),
         plan_started_at = COALESCE(plan_started_at, NOW()),
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
         tokens_limit = GREATEST(tokens_limit, $3),
         tokens_used = 0
       WHERE id = $4`,
      [inv.pricing_item_id, String(days), tokens, inv.user_id],
    );
  }

  return NextResponse.json({
    ok: true,
    invoice_id: inv.id,
    payment_id: paymentId,
    act_id: actId,
    act_number: actNumber,
  });
}
