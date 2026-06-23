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
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session) return { error: NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 }) };
  if (session.role !== "admin") return { error: NextResponse.json({ ok: false, error: "Доступ запрещён" }, { status: 403 }) };
  return { session };
}

// POST — управление продуктом: выдать подписку, сидинг, создать/переключить
// тариф и реф-ссылку. Body: { action, ... }.
export async function POST(req: Request, ctx: { params: Promise<{ product: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { product } = await ctx.params;
  if (!PRODUCT_LIST.includes(product as ProductScope)) {
    return NextResponse.json({ ok: false, error: "Неизвестный продукт" }, { status: 400 });
  }
  await initDb();
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  try {
    if (action === "grant") {
      const email = String(body.email ?? "").toLowerCase().trim();
      const plan = String(body.plan ?? "pro");
      const days = Number(body.days) > 0 ? Number(body.days) : 30;
      if (!email) return NextResponse.json({ ok: false, error: "Укажите email" }, { status: 400 });
      const rows = await query<{ id: string }>(
        `INSERT INTO product_subscriptions (id, user_id, product, plan, status, expires_at)
           SELECT 'ps_' || u.id || '_' || $1, u.id, $1, $2, 'active', NOW() + ($3 || ' days')::interval
             FROM users u WHERE LOWER(u.email) = $4
         ON CONFLICT (user_id, product) DO UPDATE
           SET status='active', plan=EXCLUDED.plan, expires_at=EXCLUDED.expires_at, updated_at=NOW()
         RETURNING id`,
        [product, plan, String(days), email],
      );
      if (rows.length === 0) return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (action === "grant-all") {
      // Сидинг: выдать триал-подписку на продукт всем юзерам без неё.
      await query(
        `INSERT INTO product_subscriptions (id, user_id, product, plan, status, expires_at)
           SELECT 'ps_' || u.id || '_' || $1, u.id, $1, 'trial', 'trialing', NOW() + interval '30 days'
             FROM users u
         ON CONFLICT (user_id, product) DO NOTHING`,
        [product],
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "pricing-create") {
      const name = String(body.name ?? "").trim();
      const rub = Number(body.price) || 0;
      const type = ["free", "one_time", "subscription"].includes(body.type) ? body.type : "subscription";
      if (!name) return NextResponse.json({ ok: false, error: "Укажите название тарифа" }, { status: 400 });
      await query(
        `INSERT INTO pricing_items (id, name, description, price_group, type, price_amount, currency, product, is_active, sort_order)
           VALUES ($1, $2, '', 'A', $3, $4, 'RUB', $5, true, 100)`,
        [randomUUID(), name, type, Math.round(rub * 100), product],
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "pricing-toggle") {
      await query(`UPDATE pricing_items SET is_active = NOT is_active WHERE id = $1 AND product = $2`, [body.id, product]);
      return NextResponse.json({ ok: true });
    }

    if (action === "referral-create") {
      const code = String(body.code ?? "").trim();
      const name = String(body.name ?? code).trim();
      const trialDays = Number(body.trialDays) >= 0 ? Number(body.trialDays) : 30;
      const discountPct = Number(body.discountPct) >= 0 ? Number(body.discountPct) : 0;
      if (!code) return NextResponse.json({ ok: false, error: "Укажите код ссылки" }, { status: 400 });
      await query(
        `INSERT INTO referral_links (id, code, name, trial_days, discount_pct, product, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [randomUUID(), code, name, trialDays, discountPct, product],
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "referral-toggle") {
      await query(`UPDATE referral_links SET is_active = NOT is_active WHERE id = $1 AND product = $2`, [body.id, product]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    // Частый случай — дубль кода реф-ссылки (UNIQUE).
    return NextResponse.json({ ok: false, error: msg.includes("duplicate") ? "Такой код уже существует" : msg.slice(0, 200) }, { status: 400 });
  }
}

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
