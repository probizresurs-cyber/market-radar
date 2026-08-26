/**
 * Онбординг: первым делом человеку генерируется КП, а не платный анализ.
 *
 * Почему так: конвейер КП (kp-generate) ВНУТРИ уже прогоняет
 * analyzeWithClaude — тот же движок, что и /api/analyze. То есть КП не
 * дешевле анализа, он его содержит. Поэтому «сначала КП, потом платный
 * дашборд» ничего не пересчитывает: к моменту готовности КП полный
 * AnalysisResult уже лежит в kp_generations.company и просто переезжает в
 * аккаунт (seedCompanyFromKp).
 *
 * Токены НЕ списываются с триала: генерация идёт мимо checkAiAccess — вход
 * в продукт не должен съедать лимит, который человек ещё не начал тратить.
 * Взамен нужен свой предел от злоупотреблений: 3 КП в сутки на аккаунт.
 *
 * POST { url } — поставить генерацию.
 * GET          — статус последней генерации этого пользователя; по готовности
 *                переносит анализ в дашборд и отдаёт ссылку на КП.
 */
import { NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { enqueueKp } from "@/lib/kp-queue";
import { seedCompanyFromKp } from "@/lib/kp-handoff";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

const PER_USER_DAILY = 3;

interface Row {
  id: string;
  status: string;
  url: string;
  company_name: string | null;
  share_token: string | null;
  share_password: string | null;
  company: AnalysisResult | null;
  error: string | null;
}

export async function POST(req: Request) {
  const session = await getSessionUser().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "Нужен вход в аккаунт" }, { status: 401 });
  }
  await initDb();

  const body = await req.json().catch(() => ({}));
  const raw = String(body.url ?? "").trim();
  if (!raw) return NextResponse.json({ ok: false, error: "Укажите ссылку на сайт" }, { status: 400 });
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { new URL(url); } catch {
    return NextResponse.json({ ok: false, error: "Это не похоже на адрес сайта" }, { status: 400 });
  }

  // Дубль: этот же сайт у этого же пользователя за сутки — отдаём как есть,
  // чтобы F5 на экране ожидания не ставил вторую генерацию.
  const dup = await query<{ id: string }>(
    `SELECT id FROM kp_generations
      WHERE source='user' AND platform_user_id=$1 AND url=$2
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status IN ('queued','running','done')
      ORDER BY created_at DESC LIMIT 1`,
    [session.userId, url],
  );
  if (dup[0]) return NextResponse.json({ ok: true, id: dup[0].id, reused: true });

  const used = await query<{ n: string }>(
    `SELECT COUNT(*) n FROM kp_generations
      WHERE source='user' AND platform_user_id=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [session.userId],
  );
  if (Number(used[0]?.n ?? 0) >= PER_USER_DAILY) {
    return NextResponse.json(
      { ok: false, error: `Сегодня можно собрать не больше ${PER_USER_DAILY} предложений. Попробуйте завтра.` },
      { status: 429 },
    );
  }

  const id = await enqueueKp(url, "ru", { source: "user", platformUserId: session.userId });
  return NextResponse.json({ ok: true, id });
}

export async function GET() {
  const session = await getSessionUser().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "Нужен вход в аккаунт" }, { status: 401 });
  }
  await initDb();

  const rows = await query<Row>(
    `SELECT id, status, url, company_name, share_token, share_password, company, error
       FROM kp_generations
      WHERE source='user' AND platform_user_id=$1
      ORDER BY created_at DESC LIMIT 1`,
    [session.userId],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: true, status: "none" });

  if (r.status !== "done") {
    return NextResponse.json({
      ok: true,
      id: r.id,
      status: r.status,
      url: r.url,
      error: r.status === "error" ? (r.error ?? "Не удалось собрать предложение") : null,
    });
  }

  // Готово — переносим анализ в дашборд. Идемпотентно: если у аккаунта уже
  // есть свои данные компании, seedCompanyFromKp их не тронет.
  if (r.company) {
    await seedCompanyFromKp(session.userId, r.id, r.company).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    id: r.id,
    status: "done",
    url: r.url,
    companyName: r.company_name,
    // Клиентская ссылка с паролем в параметре — тот же формат, что отдаёт
    // публичный /api/kp-public/[id]. Владельцу аккаунта незачем вводить
    // пароль от собственного КП руками.
    kpUrl: r.share_token
      ? `/kp-share/${r.share_token}?p=${encodeURIComponent(r.share_password ?? "")}`
      : null,
  });
}
