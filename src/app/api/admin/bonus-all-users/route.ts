/**
 * POST /api/admin/bonus-all-users
 *
 * Одноразовая утилита: всем существующим юзерам:
 *   • продлевает подписку на +30 дней (от текущей даты окончания
 *     или, если её нет, от сейчас)
 *   • сбрасывает tokens_used → 0 и tokens_limit → 100000
 *
 * Доступ — только admin. Идемпотентность: можно нажать несколько раз,
 * каждый раз будет прибавлять 30 дней дальше. Возвращает количество
 * обработанных строк.
 *
 * Не трогает:
 *   • роли admin / agency (у них уже неограниченные лимиты)
 *   • заблокированные / удалённые аккаунты
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { initDb, query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  }

  try {
    await initDb();

    // Продлеваем подписку на +30 дней от max(сейчас, plan_expires_at)
    // и обнуляем счётчик токенов
    const result = await query<{ id: string; email: string }>(
      `UPDATE users SET
         plan_expires_at = GREATEST(
           COALESCE(plan_expires_at, NOW()),
           NOW()
         ) + INTERVAL '30 days',
         tokens_used = 0,
         tokens_limit = 100000
       WHERE role NOT IN ('admin', 'agency')
       RETURNING id, email`,
    );

    return NextResponse.json({
      ok: true,
      updated: result.length,
      sampleEmails: result.slice(0, 5).map(r => r.email),
    });
  } catch (err) {
    console.error("[bonus-all-users] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
