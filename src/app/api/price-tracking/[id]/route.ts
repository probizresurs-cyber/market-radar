/**
 * DELETE /api/price-tracking/[id]    — удалить отслеживание
 * GET    /api/price-tracking/[id]    — детали + история цен
 * POST   /api/price-tracking/[id]/check  — ручной запуск скана (см. отдельный route)
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  await initDb();
  const r = await query<{ user_id: string }>(`SELECT user_id FROM tracked_products WHERE id = $1`, [id]);
  if (r.length === 0) return NextResponse.json({ ok: false, error: "Не найдено" }, { status: 404 });
  if (r[0].user_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await query(`DELETE FROM tracked_products WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  await initDb();
  const productRows = await query<{
    id: string; user_id: string; product_url: string; product_name: string | null;
    competitor_name: string | null; currency: string; last_price: number | null;
    last_checked_at: string | null; check_status: string; check_error: string | null;
    notify_telegram: boolean; threshold_pct: number | null; css_selector: string | null;
    created_at: string;
  }>(`SELECT * FROM tracked_products WHERE id = $1`, [id]);
  const p = productRows[0];
  if (!p) return NextResponse.json({ ok: false, error: "Не найдено" }, { status: 404 });
  if (p.user_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const history = await query<{ price: number; currency: string; checked_at: string }>(
    `SELECT price, currency, checked_at FROM price_history WHERE product_id = $1 ORDER BY checked_at DESC LIMIT 90`,
    [id],
  );

  return NextResponse.json({ ok: true, product: p, history });
}
