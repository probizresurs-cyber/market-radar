/**
 * GET /api/acts — список актов выполненных работ текущего пользователя.
 *
 * Акты создаются автоматически в момент перехода счёта в статус 'paid'
 * (это будет в admin-роуте подтверждения оплаты + в webhook ЮКассы).
 * Здесь только чтение.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const rows = await query<{
    id: string;
    act_number: string;
    invoice_id: string | null;
    invoice_number: string | null;
    amount: number;
    currency: string;
    service_description: string;
    signed_at: string;
    created_at: string;
  }>(
    `SELECT a.id, a.act_number, a.invoice_id, i.invoice_number, a.amount,
            a.currency, a.service_description, a.signed_at, a.created_at
       FROM acts a
       LEFT JOIN invoices i ON i.id = a.invoice_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
    [session.userId],
  );

  return NextResponse.json({ ok: true, acts: rows });
}
