/**
 * GET  /api/price-tracking            — список отслеживаемых товаров текущего юзера
 * POST /api/price-tracking            — добавить URL
 *
 * Body POST: {
 *   product_url: string,           // обязательно
 *   product_name?: string,         // опционально (если пусто — определится при первом скане)
 *   competitor_name?: string,      // тег конкурента
 *   threshold_pct?: number,        // алерт только при изменении больше N%
 *   css_selector?: string,         // кастомный CSS, если автоопределение фейлит
 *   notify_telegram?: boolean,
 * }
 *
 * При создании сразу же запускает первый скан (asynchronously).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { scrapeProductPrice } from "@/lib/price-scraper";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

interface TrackedRow {
  id: string;
  product_url: string;
  product_name: string | null;
  competitor_name: string | null;
  currency: string;
  last_price: number | null;
  last_checked_at: string | null;
  check_status: string;
  check_error: string | null;
  notify_telegram: boolean;
  threshold_pct: number | null;
  css_selector: string | null;
  created_at: string;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const products = await query<TrackedRow>(
    `SELECT * FROM tracked_products WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [session.userId],
  );
  return NextResponse.json({ ok: true, products });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const body = await req.json().catch(() => ({}));
  const product_url = String(body.product_url ?? "").trim();
  if (!/^https?:\/\//i.test(product_url)) {
    return NextResponse.json({ ok: false, error: "URL должен быть полным (https://…)" }, { status: 400 });
  }

  const id = randomUUID();
  const product_name = (body.product_name ?? "").trim() || null;
  const competitor_name = (body.competitor_name ?? "").trim() || null;
  const threshold_pct = body.threshold_pct != null ? Number(body.threshold_pct) : null;
  const css_selector = (body.css_selector ?? "").trim() || null;
  const notify_telegram = body.notify_telegram !== false;

  await query(
    `INSERT INTO tracked_products (
       id, user_id, product_url, product_name, competitor_name, threshold_pct,
       css_selector, notify_telegram, check_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
    [id, session.userId, product_url, product_name, competitor_name, threshold_pct, css_selector, notify_telegram],
  );

  // Первый скан запускаем синхронно, чтобы юзер сразу увидел цену
  try {
    const result = await scrapeProductPrice(product_url, css_selector);
    if (result.ok) {
      await query(
        `UPDATE tracked_products SET
           product_name = COALESCE(product_name, $1),
           currency = $2,
           last_price = $3,
           last_checked_at = NOW(),
           check_status = 'ok',
           check_error = NULL
         WHERE id = $4`,
        [result.productName ?? product_name, result.currency, result.price, id],
      );
      // Пишем в историю
      await query(
        `INSERT INTO price_history (id, product_id, price, currency)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, result.price, result.currency],
      );
    } else {
      await query(
        `UPDATE tracked_products SET check_status = 'failed', check_error = $1, last_checked_at = NOW() WHERE id = $2`,
        [result.error, id],
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    await query(
      `UPDATE tracked_products SET check_status = 'failed', check_error = $1, last_checked_at = NOW() WHERE id = $2`,
      [msg, id],
    );
  }

  // Возвращаем свежее состояние
  const fresh = await query<TrackedRow>(`SELECT * FROM tracked_products WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true, product: fresh[0] });
}
