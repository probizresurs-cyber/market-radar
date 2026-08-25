import { NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/kp-public/[id] — статус публичной генерации КП.
 *
 * Отдаёт ссылку шеринга и пароль ТОЛЬКО для source='public': менеджерские
 * КП по этому роуту недоступны принципиально — иначе перебором id можно
 * было бы вытянуть пароли клиентских предложений.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await initDb();
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "Невалидный id" }, { status: 400 });
  }
  const r = await query<{
    status: string; error: string | null; company_name: string | null;
    share_token: string | null; share_password: string | null;
  }>(
    `SELECT status, error, company_name, share_token, share_password
       FROM kp_generations WHERE id=$1 AND source='public'`,
    [id],
  );
  const row = r[0];
  if (!row) return NextResponse.json({ ok: false, error: "Не найдено" }, { status: 404 });

  if (row.status !== "done") {
    return NextResponse.json({
      ok: true,
      data: { status: row.status, error: row.status === "error" ? row.error : null },
    });
  }
  return NextResponse.json({
    ok: true,
    data: {
      status: "done",
      companyName: row.company_name,
      shareUrl: `/kp-share/${row.share_token}?p=${encodeURIComponent(row.share_password ?? "")}`,
    },
  });
}
