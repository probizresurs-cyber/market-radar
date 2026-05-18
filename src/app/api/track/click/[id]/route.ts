/**
 * GET /api/track/click/{id} — click-tracker для CTA-ссылки в письме.
 *
 * Логируем клик в lead_emails и редиректим на публичный экспресс-отчёт
 * `/r/{slug}` лида. Это даёт нам метрику CTR без сторонних сервисов.
 *
 * Если id невалидный или лид удалён — редиректим на главную, чтобы
 * пользователь хотя бы не упёрся в 404.
 */

import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface LookupRow {
  lead_id: string;
  slug: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !/^[a-f0-9-]{16,}$/i.test(id)) {
      return NextResponse.redirect(new URL("/", _req.url));
    }
    await initDb();

    // Атомарно обновляем счётчик кликов и достаём slug одним запросом —
    // меньше round-trips к Postgres.
    const rows = await query<LookupRow>(
      `UPDATE lead_emails e
          SET click_count = e.click_count + 1,
              first_clicked_at = COALESCE(e.first_clicked_at, NOW()),
              last_clicked_at = NOW()
         WHERE e.id = $1
         RETURNING e.lead_id,
                   (SELECT slug FROM leads WHERE id = e.lead_id) AS slug`,
      [id],
    );
    const slug = rows[0]?.slug;
    if (!slug) {
      return NextResponse.redirect(new URL("/", _req.url));
    }
    return NextResponse.redirect(new URL(`/r/${slug}`, _req.url));
  } catch (e) {
    console.warn("[track/click] error:", e);
    return NextResponse.redirect(new URL("/", _req.url));
  }
}
