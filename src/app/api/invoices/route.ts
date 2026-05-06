/**
 * GET  /api/invoices               — список счетов текущего пользователя
 * POST /api/invoices                — создать счёт по выбранному тарифу
 *
 * Тело POST: {
 *   pricingItemId?: string,    // если задано — берём цену из pricing_items
 *   amount?: number,           // иначе передаём сумму вручную (рубли)
 *   service_description?: string,
 *   due_days?: number,         // срок оплаты (по умолчанию 5 дней)
 *   service_period_start?: string (YYYY-MM-DD),
 *   service_period_end?: string,
 * }
 *
 * Перед созданием: проверяем что у клиента заполнены все юр.реквизиты
 * (тип ≠ individual, ИНН, банк, директор) — иначе 400 + missing.
 *
 * Создаёт `invoices` (status=draft). Сохраняет snapshot реквизитов с обеих
 * сторон, чтобы при изменении профиля старый счёт не «протух».
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";
import {
  getVendorRequisites,
  getMissingClientFields,
  type ClientRequisites,
} from "@/lib/requisites";
import { allocateDocNumber } from "@/lib/doc-numbering";

export const runtime = "nodejs";

interface UserRow {
  id: string;
  email: string;
  client_type: string | null;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legal_address: string | null;
  bank_name: string | null;
  bank_bik: string | null;
  bank_account: string | null;
  bank_corr_account: string | null;
  director_name: string | null;
  director_position: string | null;
  contact_email: string | null;
}

function rowToClient(u: UserRow): ClientRequisites {
  return {
    client_type: (u.client_type as ClientRequisites["client_type"]) ?? "individual",
    legal_name: u.legal_name ?? "",
    inn: u.inn ?? "",
    kpp: u.kpp ?? "",
    ogrn: u.ogrn ?? "",
    legal_address: u.legal_address ?? "",
    bank_name: u.bank_name ?? "",
    bank_bik: u.bank_bik ?? "",
    bank_account: u.bank_account ?? "",
    bank_corr_account: u.bank_corr_account ?? "",
    director_name: u.director_name ?? "",
    director_position: u.director_position ?? "",
    contact_email: u.contact_email ?? u.email,
  };
}

// ─── GET — список счетов пользователя ──────────────────────────────────────
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const rows = await query<{
    id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    status: string;
    service_description: string;
    due_date: string;
    paid_at: string | null;
    created_at: string;
  }>(
    `SELECT id, invoice_number, amount, currency, status,
            service_description, due_date, paid_at, created_at
       FROM invoices
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
    [session.userId],
  );

  return NextResponse.json({ ok: true, invoices: rows });
}

// ─── POST — создать новый счёт ─────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const body = await req.json().catch(() => ({}));

  // Берём текущие реквизиты клиента
  const userRows = await query<UserRow>(
    `SELECT id, email, client_type, legal_name, inn, kpp, ogrn, legal_address,
            bank_name, bank_bik, bank_account, bank_corr_account,
            director_name, director_position, contact_email
       FROM users WHERE id = $1`,
    [session.userId],
  );
  const u = userRows[0];
  if (!u) return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 404 });

  const client = rowToClient(u);
  const missing = getMissingClientFields(client);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: client.client_type === "individual"
          ? "Счёт можно выставить только юрлицу или ИП. Перейдите в Настройки → Реквизиты и выберите тип клиента."
          : "Заполните недостающие реквизиты в Настройках → Реквизиты, прежде чем формировать счёт.",
        missing,
        action: "open_requisites",
      },
      { status: 400 },
    );
  }

  // Резолвим тариф / сумму
  let amount = Number(body.amount);
  let serviceDescription: string = String(body.service_description ?? "").trim();
  let pricingItemId: string | null = body.pricingItemId ? String(body.pricingItemId) : null;

  if (pricingItemId) {
    const pi = await query<{ id: string; name: string; price_amount: number }>(
      `SELECT id, name, price_amount FROM pricing_items WHERE id = $1 AND is_active = true`,
      [pricingItemId],
    );
    if (pi.length === 0) {
      return NextResponse.json({ ok: false, error: "Тариф не найден" }, { status: 404 });
    }
    amount = Number(pi[0].price_amount);
    if (!serviceDescription) {
      serviceDescription = `Услуги доступа к платформе MarketRadar — тариф «${pi[0].name}»`;
    }
  } else {
    pricingItemId = null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Не указана сумма счёта" }, { status: 400 });
  }
  if (!serviceDescription) {
    serviceDescription = "Услуги доступа к платформе MarketRadar";
  }

  // Срок оплаты
  const dueDays = Math.max(1, Math.min(30, Number(body.due_days) || 5));
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const periodStart = body.service_period_start ? new Date(body.service_period_start) : null;
  const periodEnd = body.service_period_end ? new Date(body.service_period_end) : null;

  const vendor = getVendorRequisites();
  const invoiceId = randomUUID();
  const invoiceNumber = await allocateDocNumber("invoice");

  await query(
    `INSERT INTO invoices (
       id, invoice_number, user_id, pricing_item_id, amount, currency,
       vat_mode, status, client_snapshot, vendor_snapshot,
       service_description, service_period_start, service_period_end,
       due_date
     ) VALUES (
       $1, $2, $3, $4, $5, 'RUB',
       $6, 'sent', $7::jsonb, $8::jsonb,
       $9, $10, $11, $12
     )`,
    [
      invoiceId, invoiceNumber, session.userId, pricingItemId, Math.round(amount),
      vendor.vat_mode,
      JSON.stringify(client),
      JSON.stringify(vendor),
      serviceDescription,
      periodStart, periodEnd,
      dueDate.toISOString().slice(0, 10),
    ],
  );

  return NextResponse.json({
    ok: true,
    invoice: {
      id: invoiceId,
      invoice_number: invoiceNumber,
      amount: Math.round(amount),
      due_date: dueDate.toISOString().slice(0, 10),
      pdf_url: `/api/invoices/${invoiceId}/pdf`,
      view_url: `/api/invoices/${invoiceId}/view`,
    },
  });
}
