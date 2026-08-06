/**
 * GET/POST /api/telegram/prefs — серверное хранение чекбоксов TG-уведомлений.
 *
 * Раньше tgNotify*-флаги жили только в localStorage → крон-агенты
 * (report-digest и др.) не знали, включил ли юзер дайджест, и настройки
 * терялись при смене браузера. Теперь users.tg_prefs (JSONB, см. db.ts);
 * NULL = юзер ничего не сохранял, действуют дефолты фронта.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

interface TgPrefs {
  analysis: boolean;
  competitors: boolean;
  vacancies: boolean;
  digest: boolean;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  await initDb();
  const rows = await query<{ tg_prefs: TgPrefs | null }>(
    `SELECT tg_prefs FROM users WHERE id = $1`,
    [session.userId],
  );
  return NextResponse.json({ ok: true, prefs: rows[0]?.tg_prefs ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  let body: Partial<TgPrefs>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Приводим к строгим boolean — в JSONB не должно попасть ничего лишнего.
  const prefs: TgPrefs = {
    analysis: body.analysis !== false,
    competitors: body.competitors !== false,
    vacancies: body.vacancies === true,
    digest: body.digest === true,
  };

  await initDb();
  await query(`UPDATE users SET tg_prefs = $1 WHERE id = $2`, [JSON.stringify(prefs), session.userId]);
  return NextResponse.json({ ok: true, prefs });
}
