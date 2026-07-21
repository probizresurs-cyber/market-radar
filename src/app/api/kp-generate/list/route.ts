import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import { tick } from "@/lib/kp-queue";

export const runtime = "nodejs";

// GET ?locale=ru|de — история генераций КП для менеджера (таб «История»).
// Возвращает лёгкие карточки без тяжёлых bundle/company.
export async function GET(req: Request) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  void tick(); // подтолкнём очередь при каждом опросе истории

  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") === "de" ? "de" : "ru";

  const rows = await query<{
    id: string; url: string; company_name: string | null; status: string; error: string | null;
    share_token: string | null; share_password: string | null; rebuild_status: string | null;
    rebuild_id: string | null; client_email: string | null;
    created_at: string; started_at: string | null; completed_at: string | null;
  }>(
    `SELECT id, url, company_name, status, error, share_token, share_password, rebuild_status,
            rebuild_id, client_email, created_at, started_at, completed_at
       FROM kp_generations WHERE locale = $1 ORDER BY created_at DESC LIMIT 200`,
    [locale],
  );

  return NextResponse.json({ ok: true, items: rows });
}
