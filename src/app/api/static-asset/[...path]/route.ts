/**
 * GET /api/static-asset/[type]/[filename]
 *
 * Динамический стример файлов из /public/{type}/.
 *
 * Зачем не отдавать /public/screencasts/xxx.mp4 напрямую как статику:
 *   Next 16 агрессивно кеширует 404 для путей, которые мы дёргаем
 *   ПЕРЕД созданием файла (типичный сценарий: orchestrator пишет
 *   файл в /public, потом сразу пытается отдать его клиенту/Remotion'у).
 *   Раз получив 404, Next отвечает `x-nextjs-prerender: 1` и продолжает
 *   отдавать кешированный 404, ИГНОРИРУЯ тот факт что файл теперь есть.
 *   Динамический API-роут (`ƒ Dynamic`) такому кешу не подвержен —
 *   читает диск на каждом запросе.
 *
 * Поддерживает Range-заголовки для частичного скачивания (нужно для
 * `<video>` элементов и Remotion-ассетов).
 *
 * Whitelist через ALLOWED_DIRS — никаких произвольных путей в /public,
 * только то что мы сами туда кладём.
 */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { stat } from "fs/promises";
import path from "path";

/**
 * Node-стрим → веб-ReadableStream ТОЛЬКО через Readable.toWeb.
 *
 * Раньше стрим отдавался голым кастом `as unknown as ReadableStream`, и при
 * обрыве клиента (браузерный аудио/видео-плеер рвёт range-запросы постоянно —
 * это его нормальная работа) push шёл в уже закрытый поток:
 *   uncaughtException: ReadableStream is already closed
 * — падал ВЕСЬ процесс, PM2 рестартовал его каждую минуту, и весь сайт
 * отвечал 502 просто потому, что кто-то открыл mp3.
 *
 * Readable.toWeb — штатная pull-конверсия: отмена корректно закрывает
 * источник, писать после закрытия физически некуда.
 */
function toWeb(stream: import("fs").ReadStream): ReadableStream {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // на всякий — отключаем любое кеширование

// Разрешённые типы ассетов. Любой неперечисленный → 400.
// Это защита от directory traversal и попыток вытащить .env через
// /api/static-asset/../../etc/passwd
const ALLOWED_DIRS = new Set([
  "screencasts",
  "promo-images",
  "voiceovers",
  "music",
  "stock-videos",
  "broll-videos", // AI-сгенерированные video-b-roll через Replicate
  "avatar-clips", // говорящая голова HeyGen — слой видеоряда, см. generate-avatar-clip
  "brand-photos", // фотобанк бренда (/api/brand-photos): подкаталог = userId
]);

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await params;
  if (!pathParts || pathParts.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Expected /api/static-asset/[type]/[filename]" },
      { status: 400 },
    );
  }

  const [type, ...rest] = pathParts;
  const filename = rest.join("/");

  if (!ALLOWED_DIRS.has(type)) {
    return NextResponse.json(
      { ok: false, error: `Unknown asset type: ${type}. Allowed: ${Array.from(ALLOWED_DIRS).join(", ")}` },
      { status: 400 },
    );
  }

  // Защита от directory traversal: запрещаем .. в filename'е
  if (filename.includes("..") || filename.includes("\\")) {
    return NextResponse.json(
      { ok: false, error: "Invalid filename" },
      { status: 400 },
    );
  }

  const publicDir = path.join(process.cwd(), "public", type);
  const filePath = path.join(publicDir, filename);

  // Гарантия что resolved-путь не вышел за пределы publicDir
  if (!filePath.startsWith(publicDir)) {
    return NextResponse.json({ ok: false, error: "Path escape" }, { status: 400 });
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    // no-store обязателен именно на 404. Адреса тут оканчиваются на .mp4/.mp3,
    // а Cloudflare считает такие пути статикой и кэширует ответ по расширению
    // — включая отрицательный. Один промах (запрос пришёл раньше, чем файл
    // дописался) залипал на границе, и уже загруженный файл продолжал отдавать
    // «File not found» мимо нашего сервера.
    return NextResponse.json(
      { ok: false, error: "File not found", path: `${type}/${filename}` },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!fileStat.isFile()) {
    return NextResponse.json({ ok: false, error: "Not a file" }, { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const total = fileStat.size;

  const rangeHeader = req.headers.get("range");

  // Range request — частичное содержимое. Нужно для seekable <video> в Remotion
  // и в браузере при перемотке.
  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (start >= total || end >= total || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunkSize = end - start + 1;
      const stream = createReadStream(filePath, { start, end });
      return new Response(toWeb(stream), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    }
  }

  // Полный файл
  const stream = createReadStream(filePath);
  return new Response(toWeb(stream), {
    status: 200,
    headers: {
      "Content-Length": String(total),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  });
}
