import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const MIN_PAYOUT = 500_00; // 500 RUB minimum payout (in kopecks)

// POST — request payout
// Body: { amount } (kopecks)
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  await initDb();

  const pRows = await query<{ id: string; status: string }>(
    "SELECT id, status FROM partners WHERE user_id = $1",
    [session.userId]
  );
  if (pRows.length === 0 || pRows[0].status !== "active") {
    return NextResponse.json({ ok: false, error: "Партнёрский аккаунт неактивен" }, { status: 403 });
  }

  const partnerId = pRows[0].id;
  const body = await req.json();
  const amount = Math.round(Number(body.amount) || 0);

  if (amount < MIN_PAYOUT) {
    return NextResponse.json({
      ok: false,
      error: `Минимальная сумма вывода: ${MIN_PAYOUT / 100} ₽`,
    }, { status: 400 });
  }

  // Check balance
  const balRows = await query<{ total: string }>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM partner_balances WHERE partner_id = $1",
    [partnerId]
  );
  const balance = Number(balRows[0]?.total || 0);

  if (amount > balance) {
    return NextResponse.json({ ok: false, error: "Недостаточно средств" }, { status: 400 });
  }

  // Create payout entry (negative amount)
  await query(
    `INSERT INTO partner_balances (id, partner_id, amount, type, description)
     VALUES ($1, $2, $3, 'payout', $4)`,
    [
      randomUUID(),
      partnerId,
      -amount,
      `Запрос на вывод ${amount / 100} ₽`,
    ]
  );

  return NextResponse.json({ ok: true, message: "Запрос на вывод создан" });
}
