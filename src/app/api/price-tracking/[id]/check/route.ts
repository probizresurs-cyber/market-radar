/**
 * POST /api/price-tracking/[id]/check
 *
 * Ручной запуск скана для одного товара. Используется из кнопки
 * «Проверить сейчас» в UI. Всегда обновляет last_price + добавляет
 * запись в price_history. Если изменилось — отправляет Telegram-алерт
 * (если у юзера задан telegram_chat_id и notify_telegram=true).
 *
 * Возвращает: { ok, product (свежий), priceChanged, priceDiffPct }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { scrapeProductPrice } from "@/lib/price-scraper";
import { randomUUID } from "crypto";
import { sendPriceAlert } from "@/lib/price-alerts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await params;
  await initDb();
  const rows = await query<{
    user_id: string; product_url: string; product_name: string | null;
    competitor_name: string | null; last_price: number | null;
    threshold_pct: number | null; css_selector: string | null;
    notify_telegram: boolean; currency: string;
  }>(
    `SELECT user_id, product_url, product_name, competitor_name, last_price,
            threshold_pct, css_selector, notify_telegram, currency
       FROM tracked_products WHERE id = $1`,
    [id],
  );
  const p = rows[0];
  if (!p) return NextResponse.json({ ok: false, error: "Не найдено" }, { status: 404 });
  if (p.user_id !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const result = await scrapeProductPrice(p.product_url, p.css_selector);

  if (!result.ok) {
    await query(
      `UPDATE tracked_products SET check_status = 'failed', check_error = $1, last_checked_at = NOW() WHERE id = $2`,
      [result.error, id],
    );
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const lastPrice = p.last_price != null ? Number(p.last_price) : null;
  const priceChanged = lastPrice !== null && Math.abs(result.price - lastPrice) > 0.001;
  const priceDiffPct = lastPrice && lastPrice > 0
    ? Math.round(((result.price - lastPrice) / lastPrice) * 10000) / 100
    : null;

  // Update + write history
  await query(
    `UPDATE tracked_products SET
       product_name = COALESCE($1, product_name),
       currency = $2,
       last_price = $3,
       last_checked_at = NOW(),
       check_status = 'ok',
       check_error = NULL
     WHERE id = $4`,
    [result.productName ?? p.product_name, result.currency, result.price, id],
  );
  await query(
    `INSERT INTO price_history (id, product_id, price, currency) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), id, result.price, result.currency],
  );

  // Send alert if needed
  if (priceChanged && p.notify_telegram) {
    const above = p.threshold_pct == null || (priceDiffPct !== null && Math.abs(priceDiffPct) >= p.threshold_pct);
    if (above) {
      await sendPriceAlert({
        userId: p.user_id,
        productName: result.productName ?? p.product_name ?? p.product_url,
        productUrl: p.product_url,
        competitorName: p.competitor_name,
        oldPrice: lastPrice ?? 0,
        newPrice: result.price,
        currency: result.currency,
        priceDiffPct: priceDiffPct ?? 0,
      });
    }
  }

  const fresh = await query(`SELECT * FROM tracked_products WHERE id = $1`, [id]);
  return NextResponse.json({
    ok: true,
    product: fresh[0],
    priceChanged,
    priceDiffPct,
  });
}
