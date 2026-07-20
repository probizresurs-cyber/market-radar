import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { query, initDb } from "@/lib/db";
import { rebuildAssetsRoot } from "@/lib/asset-localizer";
import type { AstroFile } from "../../route";

// GET /api/rebuild-astro/<id>/zip — собирает готовый Astro-проект на сервере:
// текстовые файлы из снапшота + локализованные бинарные ассеты с диска
// (public/assets/). Раньше zip паковался на клиенте из JSON — бинарные
// ассеты туда не влезали, поэтому сборка переехала сюда.
export const runtime = "nodejs";
export const maxDuration = 60;

interface Row {
  source_url: string;
  snapshot: { files?: AstroFile[] };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Bad request", { status: 400 });

  try {
    await initDb();
    const rows = await query<Row>("SELECT source_url, snapshot FROM astro_rebuilds WHERE id = $1", [id]);
    const row = rows[0];
    const files = row?.snapshot?.files;
    if (!files?.length) return new NextResponse("Not found", { status: 404 });

    // В превью ассеты referenced как /api/rebuild-asset/<id>/<имя>;
    // в проекте они лежат в public/assets/ → в вёрстке путь /assets/<имя>.
    const previewPrefix = `/api/rebuild-asset/${id}/`;
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.path, f.content.split(previewPrefix).join("/assets/"));
    }

    // Бинарные ассеты с диска (если локализация проходила и диск жив).
    try {
      const dir = path.join(rebuildAssetsRoot(), id);
      for (const name of await fs.readdir(dir)) {
        if (!/^[A-Za-z0-9._-]+$/.test(name)) continue;
        zip.file(`public/assets/${name}`, await fs.readFile(path.join(dir, name)));
      }
    } catch { /* каталога нет — старая пересборка без локализации, zip без ассетов */ }

    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const host = (() => {
      try { return new URL(row.source_url).hostname.replace(/^www\./, ""); } catch { return "site"; }
    })();

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${host}-astro.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("rebuild-astro zip error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
