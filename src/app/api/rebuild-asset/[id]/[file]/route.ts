import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { rebuildAssetsRoot } from "@/lib/asset-localizer";

// Отдаёт локализованные ассеты пересборки: /api/rebuild-asset/<id>/<file>.
// Публично (превью тоже публичное). Файлы контент-хэшированы в имени —
// можно кэшировать намертво.
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".webp": "image/webp", ".avif": "image/avif",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject",
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;

  // Path-traversal guard: id — UUID, file — плоское имя без слэшей.
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const buf = await fs.readFile(path.join(rebuildAssetsRoot(), id, file));
    const ext = path.extname(file).toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
