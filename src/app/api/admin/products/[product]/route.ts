/**
 * GET /api/admin/products/<product>
 * Сводка по продукту для админ-панели: пользователи с подпиской, тарифы,
 * реф-ссылки и агрегированная статистика. Только для роли admin.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { PRODUCT_LIST, PRODUCT_LABEL } from "@/lib/product-access";
import type { ProductScope } from "@/lib/products";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ product: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ ok: false, error: "Доступ запрещён" }, { status: 403 });

  const { product } = await ctx.params;
  if (!PRODUCT_LIST.includes(product as ProductScope)) {
    return NextResponse.json({ ok: false, error: "Неизвестный продукт" }, { status: 400 });
  }

  await initDb();

  const users = await query(
    `SELECT u.email, u.name, ps.plan, ps.status, ps.tokens_used, ps.tokens_limit,
            ps.expires_at::text AS expires_at, ps.created_at::text AS created_at
       FROM product_subscriptions ps
       JOIN users u ON u.id = ps.user_id
      WHERE ps.product = $1
      ORDER BY ps.created_at DESC
      LIMIT 200`,
    [product],
  );

  const pricing = await query(
    `SELECT id, name, description, type, price_amount, currency, is_active
       FROM pricing_items WHERE product = $1 ORDER BY sort_order, name`,
    [product],
  );

  const referrals = await query(
    `SELECT id, code, name, trial_days, discount_pct, used_count, max_uses, is_active
       FROM referral_links WHERE product = $1 ORDER BY created_at DESC`,
    [product],
  );

  const statsRows = await query<{
    subs_total: number; subs_active: number; tokens_used: number; revenue: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM product_subscriptions WHERE product = $1) AS subs_total,
       (SELECT COUNT(*) FROM product_subscriptions WHERE product = $1 AND status IN ('active','trialing')) AS subs_active,
       (SELECT COALESCE(SUM(tokens_used),0) FROM product_subscriptions WHERE product = $1) AS tokens_used,
       (SELECT COALESCE(SUM(p.amount),0) FROM payments p
          JOIN pricing_items pi ON pi.id = p.pricing_item_id
         WHERE pi.product = $1 AND p.status = 'completed') AS revenue`,
    [product],
  );

  return NextResponse.json({
    ok: true,
    product,
    label: PRODUCT_LABEL[product as ProductScope],
    users,
    pricing,
    referrals,
    stats: statsRows[0] ?? { subs_total: 0, subs_active: 0, tokens_used: 0, revenue: 0 },
  });
}
