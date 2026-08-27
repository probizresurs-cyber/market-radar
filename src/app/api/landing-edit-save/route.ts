/**
 * POST /api/landing-edit-save — сохранить правки инлайн-редактора лендинга.
 *
 * Два режима:
 *   { slug, password, check: true }   → только проверить пароль (для входа)
 *   { slug, password, html }          → сохранить новый HTML в shared_landings
 *
 * Доступ — по общему паролю редактирования (env LANDING_EDIT_PASSWORD, по
 * умолчанию «Radar»), а не по сессии владельца: ссылку на редактирование дают
 * человеку, у которого нет аккаунта. Пароль проверяется здесь, на сервере, —
 * клиентская проверка в landing-editor.js только для удобства, ей не доверяем.
 *
 * Пароль слабый намеренно (так попросил владелец). Поэтому правкой нельзя
 * ни удалить лендинг, ни тронуть чужие данные: только перезаписать html_content
 * существующего slug. Больше этот ключ не открывает ничего.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const EDIT_PASSWORD = process.env.LANDING_EDIT_PASSWORD || "Radar";

/** Верхняя граница на размер HTML — от случайного мусора и переполнения. */
const MAX_HTML = 3_000_000;

export async function POST(req: Request) {
  let body: { slug?: string; password?: string; html?: string; check?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const slug = String(body.slug || "");
  const password = String(body.password || "");

  if (!/^[a-f0-9]{6,64}$/i.test(slug)) {
    return NextResponse.json({ ok: false, error: "Лендинг не найден" }, { status: 404 });
  }

  // Пароль сверяем без раннего выхода по длине — не даём подсказок тайминга.
  if (password !== EDIT_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 403 });
  }

  // Лендинг должен существовать: правим только то, что уже есть.
  const rows = await query<{ slug: string }>(
    "SELECT slug FROM shared_landings WHERE slug = $1",
    [slug],
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Лендинг не найден" }, { status: 404 });
  }

  // Режим проверки пароля — для входа в редактор, без записи.
  if (body.check) {
    return NextResponse.json({ ok: true });
  }

  const html = String(body.html || "");
  if (!html || html.length < 50) {
    return NextResponse.json({ ok: false, error: "Пустой документ" }, { status: 400 });
  }
  if (html.length > MAX_HTML) {
    return NextResponse.json({ ok: false, error: "Документ слишком большой" }, { status: 413 });
  }

  await query("UPDATE shared_landings SET html_content = $1 WHERE slug = $2", [html, slug]);

  return NextResponse.json({ ok: true });
}
