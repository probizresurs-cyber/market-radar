/**
 * POST /api/presentation-share — создать share-link
 *   body: { title, slides, style?, expiresInDays?, password? }
 *   → { ok, data: { slug, url } }
 *
 * GET /api/presentation-share?slug=<slug>&password=<opt>
 *   → { ok, data: { title, slides, style } } или 403/401 если требуется пароль
 *
 * Презентация хранится в БД и доступна по публичному /r/<slug>.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { randomBytes, createHash } from "crypto";

export const runtime = "nodejs";

interface ShareRow {
  slug: string;
  user_id: string;
  title: string;
  slides_json: unknown;
  style_json: unknown;
  expires_at: Date | null;
  password_hash: string | null;
  view_count: number;
}

function hashPassword(p: string): string {
  return createHash("sha256").update(p).digest("hex");
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  let body: { title?: string; slides?: unknown; style?: unknown; expiresInDays?: number; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const title = (body.title ?? "Презентация").slice(0, 200);
  if (!Array.isArray(body.slides) || body.slides.length === 0) {
    return NextResponse.json({ ok: false, error: "slides required" }, { status: 400 });
  }

  const slug = randomBytes(8).toString("hex");
  const expiresAt = typeof body.expiresInDays === "number" && body.expiresInDays > 0
    ? new Date(Date.now() + Math.min(365, body.expiresInDays) * 86400_000)
    : null;
  const passHash = body.password ? hashPassword(body.password) : null;

  await query(
    `INSERT INTO shared_presentations
      (slug, user_id, title, slides_json, style_json, expires_at, password_hash)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
    [
      slug,
      session.userId,
      title,
      JSON.stringify(body.slides),
      JSON.stringify(body.style ?? null),
      expiresAt,
      passHash,
    ],
  );

  return NextResponse.json({
    ok: true,
    data: { slug, url: `/r/${slug}` },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const password = searchParams.get("password") ?? "";
  if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });

  const rows = await query<ShareRow>(
    "SELECT * FROM shared_presentations WHERE slug = $1",
    [slug],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Презентация не найдена" }, { status: 404 });
  }
  const r = rows[0];
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Срок действия ссылки истёк" }, { status: 410 });
  }
  if (r.password_hash) {
    if (!password) {
      return NextResponse.json({ ok: false, error: "Требуется пароль", reason: "password_required" }, { status: 401 });
    }
    if (hashPassword(password) !== r.password_hash) {
      return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 403 });
    }
  }
  // Инкрементируем счётчик asynchronously (не блокируем ответ).
  void query("UPDATE shared_presentations SET view_count = view_count + 1 WHERE slug = $1", [slug]);

  return NextResponse.json({
    ok: true,
    data: {
      slug: r.slug,
      title: r.title,
      slides: r.slides_json,
      style: r.style_json,
    },
  });
}
