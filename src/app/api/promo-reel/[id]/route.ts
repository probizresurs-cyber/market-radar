/**
 * GET /api/promo-reel/[id]
 *
 * Стрим готового MP4 промо-рилса, отрендеренного через POST /api/render-promo-reel.
 * Файл лежит на D:\market-radar-video\out\{id}.mp4 — отдаём как octet-stream
 * с правильным Content-Type и поддержкой Range-запросов (для seek в плеере).
 */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const OUTPUT_DIR = "D:\\market-radar-video\\out";

// Защита от path traversal — jobId должен быть [a-zA-Z0-9-]
function safeJobId(raw: string): string | null {
  if (!/^[a-zA-Z0-9-]+$/.test(raw)) return null;
  if (raw.length > 80) return null;
  return raw;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const jobId = safeJobId(rawId);
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Невалидный jobId" }, { status: 400 });
  }

  const filePath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json({ ok: false, error: "Видео не найдено" }, { status: 404 });
  }

  const total = fileStat.size;
  const rangeHeader = req.headers.get("range");

  // Range-запрос — отдаём кусок (нужно для <video> seek в Chrome/Safari)
  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });
      // ReadableStream wrap для Next Response
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (c) => controller.enqueue(new Uint8Array(c as Buffer)));
          stream.on("end", () => controller.close());
          stream.on("error", (e) => controller.error(e));
        },
        cancel() { stream.destroy(); },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": "video/mp4",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // Полная отдача
  const stream = createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (c) => controller.enqueue(new Uint8Array(c as Buffer)));
      stream.on("end", () => controller.close());
      stream.on("error", (e) => controller.error(e));
    },
    cancel() { stream.destroy(); },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(total),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
