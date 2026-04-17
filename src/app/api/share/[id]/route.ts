import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface ShareRow {
  snapshot: Record<string, unknown>;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

// Публичный GET: возвращает snapshot по id без авторизации.
// Инкрементит view_count.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await ctx.params;
    if (!id || id.length < 8) {
      return NextResponse.json({ ok: false, error: "Некорректный id" }, { status: 400 });
    }

    const rows = await query<ShareRow>(
      `SELECT snapshot, is_active, expires_at, created_at
       FROM public_shares WHERE id = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: false, error: "Ссылка не найдена" }, { status: 404 });
    }
    if (!row.is_active) {
      return NextResponse.json({ ok: false, error: "Ссылка отозвана" }, { status: 403 });
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Срок действия ссылки истёк" }, { status: 410 });
    }

    // fire-and-forget инкремент счётчика просмотров
    query(`UPDATE public_shares SET view_count = view_count + 1 WHERE id = $1`, [id]).catch(
      () => {/* ignore */}
    );

    return NextResponse.json({
      ok: true,
      snapshot: row.snapshot,
      createdAt: row.created_at,
    });
  } catch (e) {
    console.error("share GET error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
