/**
 * GET /api/image/[id] — отдаёт картинку, сохранённую через `persistImageDataUri`.
 *
 * Доступ публичный по нескольким причинам:
 *   1) Тег `<img src="/api/image/...">` рендерится в браузере без credentials,
 *      и любая авторизация ломала бы рендер.
 *   2) Картинка может постить наружу (VK / TG публикаторы), где сторонний
 *      сервис скачивает её по URL — там сессии нет.
 *   3) ID — UUID v4 (~122 бита энтропии). Угадать чужой URL невозможно.
 *
 * Картинка кешируется на год (immutable): UUID никогда не переиспользуется.
 */

import { NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";

export const runtime = "nodejs";

interface ImageRow {
  data: Buffer;
  mime_type: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !/^[a-f0-9-]{16,}$/i.test(id)) {
      return new NextResponse("Bad id", { status: 400 });
    }
    await initDb();
    const rows = await query<ImageRow>(
      "SELECT data, mime_type FROM user_images WHERE id = $1",
      [id],
    );
    if (!rows.length) return new NextResponse("Not found", { status: 404 });
    const row = rows[0];
    // pg возвращает BYTEA как Node Buffer. Копируем в чистый ArrayBuffer —
    // строгие типы NextResponse не принимают Uint8Array<ArrayBufferLike>,
    // а ArrayBuffer — валидный BodyInit и работает в Node-runtime.
    const body = row.data instanceof Buffer ? row.data : Buffer.from(row.data);
    const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": row.mime_type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (e) {
    console.error("[/api/image] GET error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
