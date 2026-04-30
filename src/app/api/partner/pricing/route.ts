/**
 * PATCH /api/partner/pricing
 * Integrator updates their custom client price.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

const BASE_PRICE_KOPECKS = 390000; // 3 900 ₽ in kopecks

export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();

  const { client_price_amount } = await req.json() as { client_price_amount: number };

  // Validate: must be >= base price or null (to clear)
  if (client_price_amount !== null && client_price_amount < BASE_PRICE_KOPECKS) {
    return NextResponse.json({
      ok: false,
      error: `Цена не может быть ниже базовой (${BASE_PRICE_KOPECKS / 100} ₽)`,
    }, { status: 400 });
  }

  const rows = await query(
    "SELECT id, type FROM partners WHERE user_id = $1",
    [session.userId]
  ) as { id: string; type: string }[];

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Партнёр не найден" }, { status: 404 });
  }
  if (rows[0].type !== "integrator") {
    return NextResponse.json({ ok: false, error: "Только для интеграторов" }, { status: 403 });
  }

  await query(
    "UPDATE partners SET client_price_amount = $2 WHERE id = $1",
    [rows[0].id, client_price_amount ?? null]
  );

  return NextResponse.json({ ok: true });
}
