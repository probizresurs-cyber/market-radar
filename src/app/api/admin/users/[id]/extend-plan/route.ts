/**
 * POST /api/admin/users/[id]/extend-plan { days: number }
 *
 * Точечное продление подписки/триала одному пользователю из его карточки
 * в админке (раньше был только массовый bonus-all-users на +30 всем —
 * для продления одного пилотного клиента приходилось ходить в SQL).
 *
 * Продлевает от max(сейчас, текущий plan_expires_at) — то есть истёкший
 * триал оживает на +days от сегодня, а живой продлевается от своей даты.
 * Заодно сбрасывает tokens_used (продлеваем — значит даём работать).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { days?: number };
    const days = Math.round(Number(body.days));
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return NextResponse.json({ ok: false, error: "days: 1-365" }, { status: 400 });
    }

    const rows = await query<{ email: string; plan_expires_at: string }>(
      `UPDATE users SET
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
         tokens_used = 0
       WHERE id = $1
       RETURNING email, plan_expires_at`,
      [id, String(days)],
    );
    if (!rows.length) return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 404 });

    return NextResponse.json({ ok: true, email: rows[0].email, planExpiresAt: rows[0].plan_expires_at });
  } catch (e) {
    console.error("admin/users/[id]/extend-plan error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
