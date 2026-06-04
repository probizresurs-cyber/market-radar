/**
 * GET /api/swot/[id]
 *
 * Возвращает ПОЛНЫЙ SWOT-отчёт по id (jsonb из swot_reports).
 * Нужен чтобы из «Прошлых отчётов» загрузить отчёт обратно в
 * интерактивный вид (квадранты, TOWS), а не только смотреть PDF.
 *
 * Ownership: отчёт отдаётся только владельцу.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  await initDb();
  const rows = await query<{ user_id: string; report: unknown }>(
    "SELECT user_id, report FROM swot_reports WHERE id = $1",
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Отчёт не найден" }, { status: 404 });
  }
  // Ownership-check — не отдаём чужой отчёт
  if (rows[0].user_id !== session.userId) {
    return NextResponse.json({ ok: false, error: "Нет доступа" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, data: rows[0].report });
}
