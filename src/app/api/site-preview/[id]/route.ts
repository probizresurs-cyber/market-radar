import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";

// Отдаёт живое превью пересобранного сайта по ссылке /api/site-preview/<id>.
// Публично (без авторизации) — чтобы можно было показать клиенту.
// Возвращает готовый HTML-документ (сам сайт), а не JSON.
export const runtime = "nodejs";

interface Row { snapshot: { previewHtml?: string } }

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await initDb();
    const rows = await query<Row>("SELECT snapshot FROM astro_rebuilds WHERE id = $1", [id]);
    const html = rows[0]?.snapshot?.previewHtml;
    if (!html) {
      return new NextResponse("<!doctype html><meta charset=utf-8><body style='font-family:system-ui;padding:40px'>Превью не найдено или устарело.</body>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Разрешаем встраивание в iframe своего же домена (страница /astro-rebuild)
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("site-preview error:", e);
    return new NextResponse("Ошибка сервера", { status: 500 });
  }
}
