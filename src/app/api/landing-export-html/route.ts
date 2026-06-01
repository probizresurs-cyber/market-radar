/**
 * GET /api/landing-export-html?slug=<slug>
 *   ИЛИ
 * GET /api/landing-export-html?htmlUrl=<stitch-url>
 *
 * Отдаёт HTML лендинга с Content-Disposition: attachment, чтобы
 * браузер реально скачал файл, а не открыл в новой вкладке.
 *
 * Два режима:
 *   1) slug — берём готовый шарный лендинг из БД (быстро, всегда работает)
 *   2) htmlUrl — fetch'им со Stitch CDN на лету (для свежесгенерированного
 *      лендинга, который юзер ещё не шарил)
 *
 * Раньше в UI был `<a href={htmlUrl} download="landing.html">`, но
 * `download` атрибут НЕ работает для cross-origin URL (Stitch — другой
 * домен) — браузер открывал в новой вкладке вместо скачивания. Этот
 * route фиксит: server-side fetch + правильный Content-Disposition.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_HTML_BYTES = 5 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zа-я0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "landing";
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const htmlUrl = searchParams.get("htmlUrl");
  const filename = sanitizeFilename(searchParams.get("filename") ?? "landing");

  let html: string;
  let suggestedName = filename;

  if (slug) {
    // ─── Режим 1: из БД по slug. Auth НЕ обязателен — это публичный лендинг.
    if (!/^[a-f0-9]{6,64}$/i.test(slug)) {
      return NextResponse.json({ ok: false, error: "Invalid slug" }, { status: 400 });
    }
    const rows = await query<{ html_content: string; title: string | null; expires_at: Date | null }>(
      "SELECT html_content, title, expires_at FROM shared_landings WHERE slug = $1",
      [slug],
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Лендинг не найден" }, { status: 404 });
    }
    const r = rows[0];
    if (r.expires_at && new Date(r.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Срок действия ссылки истёк" }, { status: 410 });
    }
    html = r.html_content;
    if (r.title) suggestedName = sanitizeFilename(r.title);
  } else if (htmlUrl) {
    // ─── Режим 2: fetch со Stitch. Требуем auth (это работа с юзерским лендингом).
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
    }
    // SSRF whitelist
    if (!/^https:\/\/[a-z0-9.-]+\.(stitch\.tech|vercel\.app|marketradar\.ai)\//i.test(htmlUrl)) {
      return NextResponse.json({ ok: false, error: "Допустимы только URL со Stitch/Vercel/marketradar.ai" }, { status: 400 });
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(htmlUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `Не удалось скачать HTML (HTTP ${res.status}). Возможно, ссылка истекла.` },
          { status: 502 },
        );
      }
      html = await res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: `Ошибка скачивания: ${msg}` }, { status: 502 });
    }
    if (html.length > MAX_HTML_BYTES) {
      return NextResponse.json({ ok: false, error: "HTML слишком большой" }, { status: 413 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "Укажите slug или htmlUrl" }, { status: 400 });
  }

  // Отдаём как attachment — браузер скачает как файл
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${suggestedName}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
