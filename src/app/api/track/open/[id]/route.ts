/**
 * GET /api/track/open/{id} — pixel-tracker открытий письма.
 *
 * Возвращает 1×1 прозрачный GIF. При запросе:
 *   • Инкрементит open_count в lead_emails
 *   • Заполняет first_opened_at (если NULL) и last_opened_at
 *
 * Email-клиенты часто прокачивают картинки через свой прокси (Gmail) —
 * это даёт неверный open count и шаткие IP/User-Agent. Поэтому опираемся
 * только на сам факт загрузки картинки + timestamp.
 *
 * `id` — это lead_emails.id (UUID). Если ID невалидный — всё равно
 * отдаём пиксель, чтобы не палить клиенту что мы что-то отслеживаем.
 */

import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

// 1×1 прозрачный GIF, hex → base64.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

function pixelResponse(): NextResponse {
  return new NextResponse(new Uint8Array(PIXEL.buffer, PIXEL.byteOffset, PIXEL.byteLength) as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      // Никакого кеша — иначе повторные открытия не будут трекаться.
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Любой результат — отдаём пиксель. Тихие ошибки в логах, не наружу.
  try {
    const { id } = await params;
    if (id && /^[a-f0-9-]{16,}$/i.test(id)) {
      await initDb();
      // Атомарно: COALESCE для first_opened_at чтобы не перезаписывать.
      await query(
        `UPDATE lead_emails
           SET open_count = open_count + 1,
               first_opened_at = COALESCE(first_opened_at, NOW()),
               last_opened_at = NOW()
         WHERE id = $1`,
        [id],
      );
    }
  } catch (e) {
    console.warn("[track/open] error:", e);
  }
  return pixelResponse();
}
