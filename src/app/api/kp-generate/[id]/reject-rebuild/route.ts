import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";

// POST /api/kp-generate/<id>/reject-rebuild — менеджер решил не отправлять
// эту пересборку клиенту (например, что-то сломалось при переносе).
// Клиентская /kp-share кнопка «Да, интересно» после этого снова доступна —
// можно попробовать пересобрать заново.
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const { id } = await ctx.params;

  const rows = await query<{ id: string; rebuild_status: string | null }>(
    "SELECT id, rebuild_status FROM kp_generations WHERE id = $1",
    [id],
  );
  if (!rows[0]) return NextResponse.json({ ok: false, error: "КП не найдено" }, { status: 404 });

  await query("UPDATE kp_generations SET rebuild_status = 'rejected' WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
