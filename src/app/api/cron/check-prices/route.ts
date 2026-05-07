/**
 * GET /api/cron/check-prices
 *
 * Серверная задача: проходит по всем активным `tracked_products`,
 * скрапит цену, при изменении добавляет запись в `price_history`
 * и отправляет Telegram-алерт владельцу.
 *
 * Защита: требует заголовок `Authorization: Bearer ${CRON_SECRET}` или
 * параметр `?secret=...`. Если CRON_SECRET не задан в env — крон работает
 * без авторизации (для совместимости с локальным тестом).
 *
 * Запуск:
 *   - Внешний cron (cron-job.org / EasyCron / cronicle) бьёт раз в день в 8:00 МСК.
 *   - Или вручную через `curl -H 'Authorization: Bearer XXX' https://.../api/cron/check-prices`
 *
 * Возвращает: { ok, processed, changed, errors }
 *
 * NOTE: Tasks выполняются последовательно с небольшой паузой, чтобы не получить
 * rate-limit от целевых сайтов и не перегрузить наш сервер. На 100 продуктов
 * это ~3-5 минут.
 */

import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { scrapeProductPrice } from "@/lib/price-scraper";
import { sendPriceAlert } from "@/lib/price-alerts";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 600; // до 10 минут на крон

const SLEEP_BETWEEN_REQUESTS_MS = 1500;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface ProductRow {
  id: string;
  user_id: string;
  product_url: string;
  product_name: string | null;
  competitor_name: string | null;
  last_price: number | null;
  threshold_pct: number | null;
  css_selector: string | null;
  notify_telegram: boolean;
  currency: string;
}

export async function GET(req: Request) {
  // ─── Auth ──────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const queryToken = url.searchParams.get("secret");
    if (headerToken !== secret && queryToken !== secret) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  await initDb();
  const products = await query<ProductRow>(
    `SELECT id, user_id, product_url, product_name, competitor_name, last_price,
            threshold_pct, css_selector, notify_telegram, currency
       FROM tracked_products
       WHERE check_status != 'disabled'
       ORDER BY last_checked_at NULLS FIRST, created_at ASC`,
  );

  let processed = 0;
  let changed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const p of products) {
    processed++;
    try {
      const result = await scrapeProductPrice(p.product_url, p.css_selector);
      if (!result.ok) {
        errors.push({ id: p.id, error: result.error });
        await query(
          `UPDATE tracked_products SET check_status = 'failed', check_error = $1, last_checked_at = NOW() WHERE id = $2`,
          [result.error, p.id],
        );
        continue;
      }

      const lastPrice = p.last_price != null ? Number(p.last_price) : null;
      const priceChanged = lastPrice !== null && Math.abs(result.price - lastPrice) > 0.001;
      const priceDiffPct = lastPrice && lastPrice > 0
        ? Math.round(((result.price - lastPrice) / lastPrice) * 10000) / 100
        : null;

      // Update + history
      await query(
        `UPDATE tracked_products SET
           product_name = COALESCE($1, product_name),
           currency = $2,
           last_price = $3,
           last_checked_at = NOW(),
           check_status = 'ok',
           check_error = NULL
         WHERE id = $4`,
        [result.productName ?? p.product_name, result.currency, result.price, p.id],
      );
      await query(
        `INSERT INTO price_history (id, product_id, price, currency) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), p.id, result.price, result.currency],
      );

      // Alert
      if (priceChanged && p.notify_telegram) {
        const above = p.threshold_pct == null || (priceDiffPct !== null && Math.abs(priceDiffPct) >= p.threshold_pct);
        if (above) {
          changed++;
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push({ id: p.id, error: msg });
      await query(
        `UPDATE tracked_products SET check_status = 'failed', check_error = $1, last_checked_at = NOW() WHERE id = $2`,
        [msg, p.id],
      );
    }

    // Пауза, чтобы не дудосить целевые сайты
    if (processed < products.length) {
      await sleep(SLEEP_BETWEEN_REQUESTS_MS);
    }
  }

  return NextResponse.json({ ok: true, processed, changed, errors });
}
