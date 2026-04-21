import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface FeatureRow {
  id: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
}

// Публичный эндпоинт — любой авторизованный/неавторизованный клиент читает
// карту включённых модулей (чтобы решить, какие вкладки показывать как
// "Coming soon"). Не возвращает чувствительных данных.
export async function GET() {
  try {
    await initDb();
    const rows = await query<FeatureRow>(
      `SELECT id, label, description, enabled, sort_order FROM features ORDER BY sort_order ASC, id ASC`
    );
    const map: Record<string, boolean> = {};
    rows.forEach(r => { map[r.id] = !!r.enabled; });
    return NextResponse.json({ ok: true, features: rows, map });
  } catch (e) {
    console.error("features route error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
