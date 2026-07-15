/**
 * GET /api/position-checks?domain=example.ru
 * Возвращает последний прогон проверки позиций (см. /api/check-positions,
 * /admin/position-checker) для домена — используется в KpProposal, чтобы
 * показать раздел «Позиции в поиске» в интерактивном анализе, если для
 * этого домена реально проводилась живая проверка. Публичный GET (та же
 * логика, что и у самого /kp — публичная страница без авторизации),
 * данные не приватные (позиции в открытой поисковой выдаче).
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { normalizeDomain } from "@/lib/position-checker";

export const runtime = "nodejs";

interface Row {
  keyword: string;
  engine: "yandex" | "google";
  region: string | null;
  position: number | null;
  status: "done" | "not_found" | "failed";
  checked_at: string;
}

export async function GET(req: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get("domain") ?? "").trim();
    if (!raw) return NextResponse.json({ ok: true, results: [] });
    const domain = normalizeDomain(raw);

    const latestBatch = await query<{ batch_id: string }>(
      `SELECT batch_id FROM position_checks WHERE domain = $1 ORDER BY checked_at DESC LIMIT 1`,
      [domain]
    );
    if (!latestBatch[0]) return NextResponse.json({ ok: true, results: [] });

    const rows = await query<Row>(
      `SELECT keyword, engine, region, position, status, checked_at
       FROM position_checks WHERE batch_id = $1 ORDER BY checked_at ASC`,
      [latestBatch[0].batch_id]
    );
    if (rows.length === 0) return NextResponse.json({ ok: true, results: [] });

    return NextResponse.json({
      ok: true,
      domain,
      engine: rows[0].engine,
      region: rows[0].region,
      checkedAt: rows[0].checked_at,
      results: rows.map((r) => ({ keyword: r.keyword, position: r.position, status: r.status })),
    });
  } catch (err) {
    console.error("[position-checks]", err);
    // Не критично для рендера /kp — молча отдаём пусто вместо 500.
    return NextResponse.json({ ok: true, results: [] });
  }
}
