/**
 * POST /api/agents/runs/<id>/approve
 *
 * Подтверждает результат запуска агента (inbox-card). Используется когда
 * агент сгенерировал что-то требующее approval (драфт ответа на отзыв,
 * email для отправки и т.п.).
 *
 * Body: { action: "approve" | "dismiss" }
 *
 * На approve runner-агента может посмотреть `approved_at` в DB и выполнить
 * финальное действие (например, отправить ответ).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "approve" | "dismiss" | undefined;

  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ ok: false, error: "action должен быть approve или dismiss" }, { status: 400 });
  }

  // Проверяем что run принадлежит юзеру
  const rows = await query<{ user_id: string; needs_approval: boolean }>(
    `SELECT user_id, needs_approval FROM agent_runs WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Запуск не найден" }, { status: 404 });
  }
  if (rows[0].user_id !== session.userId) {
    return NextResponse.json({ ok: false, error: "Нет доступа" }, { status: 403 });
  }

  if (action === "approve") {
    await query(
      `UPDATE agent_runs SET approved_at = NOW(), approved_by = $1 WHERE id = $2`,
      [session.userId, id],
    );
  } else {
    // dismiss = тоже approved_at, но без побочных действий. Маркируем как
    // обработанное, чтобы исчезло из inbox.
    await query(
      `UPDATE agent_runs SET approved_at = NOW(), approved_by = $1, needs_approval = false WHERE id = $2`,
      [session.userId, id],
    );
  }

  return NextResponse.json({ ok: true });
}
