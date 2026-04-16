import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Per document: minimum payout 3 000 ₽
const MIN_PAYOUT = 300_00; // kopecks
// Per document: first payout available after 30 days from partner registration
const FIRST_PAYOUT_DELAY_DAYS = 30;

// POST — request payout
// Body: { amount } (kopecks)
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  await initDb();

  const pRows = await query<{ id: string; status: string; created_at: string }>(
    "SELECT id, status, created_at FROM partners WHERE user_id = $1",
    [session.userId]
  );
  if (pRows.length === 0 || pRows[0].status !== "active") {
    return NextResponse.json({ ok: false, error: "Партнёрский аккаунт неактивен" }, { status: 403 });
  }

  const partner = pRows[0];
  const partnerId = partner.id;

  // Check 30-day registration delay
  const registeredAt = new Date(partner.created_at);
  const daysSinceRegistration = (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceRegistration < FIRST_PAYOUT_DELAY_DAYS) {
    const daysLeft = Math.ceil(FIRST_PAYOUT_DELAY_DAYS - daysSinceRegistration);
    return NextResponse.json({
      ok: false,
      error: `Первый вывод доступен через ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"} после регистрации в партнёрской программе`,
    }, { status: 400 });
  }

  const body = await req.json();
  const amount = Math.round(Number(body.amount) || 0);

  if (amount < MIN_PAYOUT) {
    return NextResponse.json({
      ok: false,
      error: `Минимальная сумма вывода: ${MIN_PAYOUT / 100} ₽`,
    }, { status: 400 });
  }

  // Available balance = all non-reserve entries + reserve entries older than 60 days (released)
  const balRows = await query<{ available: string; reserved: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type != 'reserve' THEN amount
                         WHEN type = 'reserve' AND created_at <= NOW() - INTERVAL '60 days' THEN amount
                         ELSE 0 END), 0) AS available,
       COALESCE(SUM(CASE WHEN type = 'reserve' AND created_at > NOW() - INTERVAL '60 days' THEN amount ELSE 0 END), 0) AS reserved
     FROM partner_balances WHERE partner_id = $1`,
    [partnerId]
  );
  const available = Number(balRows[0]?.available || 0);

  if (amount > available) {
    return NextResponse.json({
      ok: false,
      error: `Недостаточно средств. Доступно: ${available / 100} ₽`,
    }, { status: 400 });
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

// GET — return partner balance breakdown
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  await initDb();

  const pRows = await query<{ id: string; status: string }>(
    "SELECT id, status FROM partners WHERE user_id = $1",
    [session.userId]
  );
  if (pRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Партнёр не найден" }, { status: 404 });
  }

  const partnerId = pRows[0].id;

  const balRows = await query<{ available: string; reserved: string; total_earned: string; total_paid: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type != 'reserve' AND type != 'payout' THEN amount
                         WHEN type = 'reserve' AND created_at <= NOW() - INTERVAL '60 days' THEN amount
                         ELSE 0 END), 0) AS available,
       COALESCE(SUM(CASE WHEN type = 'reserve' AND created_at > NOW() - INTERVAL '60 days' THEN amount ELSE 0 END), 0) AS reserved,
       COALESCE(SUM(CASE WHEN type = 'commission' OR type = 'reserve' THEN amount ELSE 0 END), 0) AS total_earned,
       COALESCE(SUM(CASE WHEN type = 'payout' THEN ABS(amount) ELSE 0 END), 0) AS total_paid
     FROM partner_balances WHERE partner_id = $1`,
    [partnerId]
  );

  return NextResponse.json({
    ok: true,
    balance: {
      available: Number(balRows[0]?.available || 0),
      reserved: Number(balRows[0]?.reserved || 0),
      total_earned: Number(balRows[0]?.total_earned || 0),
      total_paid: Number(balRows[0]?.total_paid || 0),
    },
    min_payout: MIN_PAYOUT,
    first_payout_delay_days: FIRST_PAYOUT_DELAY_DAYS,
  });
}
