import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { isKpManager } from "@/lib/kp-manager-auth";
import type { AnalysisResult } from "@/lib/types";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";

export const runtime = "nodejs";

// GET /api/kp-generate/<id> — полная генерация (bundle + company) для рендера
// КП менеджеру. Только менеджер (публичный шеринг — отдельный роут с паролем).
interface Row {
  id: string; locale: string; url: string; company_name: string | null; status: string;
  error: string | null; bundle: PilotBundle | null; company: AnalysisResult | null;
  share_token: string | null; share_password: string | null;
  rebuild_id: string | null; rebuild_status: string | null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isKpManager())) {
    return NextResponse.json({ ok: false, error: "Требуется вход менеджера" }, { status: 401 });
  }
  await initDb();
  const { id } = await ctx.params;
  const rows = await query<Row>("SELECT * FROM kp_generations WHERE id = $1", [id]);
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "КП не найдено" }, { status: 404 });
  return NextResponse.json({ ok: true, generation: r });
}
