/**
 * POST /api/landing-share — создать публичную ссылку на лендинг
 *   body: { htmlUrl, title?, projectId? }
 *   → { ok, data: { slug, url } }
 *
 * GET /api/landing-share?slug=<slug>
 *   → { ok, data: { title, html } }
 *
 * Stitch-CDN URLs живут 1-7 дней, поэтому при создании шары мы СРАЗУ
 * fetch'им HTML и сохраняем в БД. Шара работает вечно (пока юзер не
 * удалит). Публичный рендер — на странице /l/[slug].
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5MB — Stitch-лендинги обычно 200-800KB

interface ShareRow {
  slug: string;
  user_id: string;
  title: string | null;
  html_content: string;
  view_count: number;
  expires_at: Date | null;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  let body: { htmlUrl?: string; title?: string; projectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const htmlUrl = (body.htmlUrl ?? "").trim();
  if (!htmlUrl) {
    return NextResponse.json({ ok: false, error: "htmlUrl обязателен" }, { status: 400 });
  }
  // SSRF-защита: разрешаем только Stitch-CDN и Vercel
  if (!/^https:\/\/[a-z0-9.-]+\.(stitch\.tech|vercel\.app|marketradar\.ai)\//i.test(htmlUrl)) {
    return NextResponse.json({ ok: false, error: "Допустимы только URL со Stitch/Vercel/marketradar.ai" }, { status: 400 });
  }

  // Если передан projectId — проверяем ownership (юзер не может шарить
  // чужой лендинг даже зная projectId)
  if (body.projectId) {
    const rows = await query<{ user_id: string }>(
      "SELECT user_id FROM landing_projects WHERE project_id = $1",
      [body.projectId],
    );
    if (rows.length > 0 && rows[0].user_id !== session.userId) {
      return NextResponse.json({ ok: false, error: "Нет доступа к этому лендингу" }, { status: 403 });
    }
  }

  // Тянем HTML со Stitch (server-side, юзер не отдаёт нам htmlContent в body
  // чтобы не было XSS-инжекта произвольного HTML в чужие шары).
  let htmlContent: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(htmlUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Не удалось скачать HTML лендинга (HTTP ${res.status}). Возможно, ссылка истекла.` },
        { status: 502 },
      );
    }
    htmlContent = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `Не удалось скачать HTML лендинга: ${msg}` },
      { status: 502 },
    );
  }

  if (htmlContent.length > MAX_HTML_BYTES) {
    return NextResponse.json(
      { ok: false, error: `HTML слишком большой (${(htmlContent.length / 1024 / 1024).toFixed(1)}МБ, максимум 5МБ)` },
      { status: 413 },
    );
  }
  if (htmlContent.length < 100) {
    return NextResponse.json(
      { ok: false, error: "Скачали пустой/слишком короткий HTML — возможно, ссылка уже не работает" },
      { status: 502 },
    );
  }

  // Генерим случайный 8-байт slug (16 hex chars, шанс коллизии ничтожный).
  // На всякий случай ретраим до 3 раз при unique-conflict.
  let slug = "";
  let inserted = false;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    slug = randomBytes(8).toString("hex");
    try {
      await query(
        `INSERT INTO shared_landings (slug, user_id, project_id, title, html_content)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          slug,
          session.userId,
          body.projectId ?? null,
          (body.title ?? "").slice(0, 200) || null,
          htmlContent,
        ],
      );
      inserted = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate") && !msg.includes("unique")) {
        throw err;
      }
    }
  }
  if (!inserted) {
    return NextResponse.json({ ok: false, error: "Не удалось сгенерировать уникальный slug" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      slug,
      url: `/l/${slug}`,
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
  }

  const rows = await query<ShareRow>(
    "SELECT slug, user_id, title, html_content, view_count, expires_at FROM shared_landings WHERE slug = $1",
    [slug],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Лендинг не найден" }, { status: 404 });
  }
  const r = rows[0];
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Срок действия ссылки истёк" }, { status: 410 });
  }

  // Инкрементируем счётчик async
  void query("UPDATE shared_landings SET view_count = view_count + 1 WHERE slug = $1", [slug]);

  return NextResponse.json({
    ok: true,
    data: {
      slug: r.slug,
      title: r.title,
      html: r.html_content,
    },
  });
}

/** DELETE /api/landing-share?slug=X — удалить шару (только владелец). */
export async function DELETE(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
  }
  const result = await query(
    "DELETE FROM shared_landings WHERE slug = $1 AND user_id = $2 RETURNING slug",
    [slug, session.userId],
  );
  if (result.length === 0) {
    return NextResponse.json({ ok: false, error: "Шара не найдена или не ваша" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
