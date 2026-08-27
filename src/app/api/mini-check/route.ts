/**
 * POST /api/mini-check { url } — поставить бесплатную мини-проверку (без auth:
 * это верх воронки, посетитель ещё аноним). Лимиты обязательны — see ниже.
 * GET  /api/mini-check?id=... — статус и результат (частичный: пробы
 * дорисовываются по мере готовности).
 */
import { NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";
import { startMiniCheck, type MiniCheckResult } from "@/lib/mini-check";
import { normalizeDomain } from "@/lib/bukvarix";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  await initDb();
  const body = await req.json().catch(() => ({}));
  const raw = String(body.url ?? "").trim();
  if (!raw) return NextResponse.json({ ok: false, error: "Укажите адрес сайта" }, { status: 400 });
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { new URL(url); } catch {
    return NextResponse.json({ ok: false, error: "Это не похоже на адрес сайта" }, { status: 400 });
  }
  const domain = normalizeDomain(url);
  if (!domain.includes(".")) {
    return NextResponse.json({ ok: false, error: "Это не похоже на адрес сайта" }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  // Контакты приходят только с формы /geo, где человек оставляет их сразу.
  // Сохраняем ТОЛЬКО при явном согласии — иначе игнорируем, а не пишем
  // персональные данные «на всякий случай». Генерацию КП это не запускает:
  // расход Claude остаётся за отдельным шагом /api/mini-check/lead.
  const consent = body.consent === true;
  const rawEmail = String(body.email ?? "").trim().toLowerCase();
  const email = consent && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  const phone = consent ? (String(body.phone ?? "").trim().slice(0, 32) || null) : null;

  // Дедуп по домену за сутки: F5, повторный клик и второй посетитель с тем же
  // сайтом получают готовый результат, а Букварикс с PageSpeed не дёргаются
  // заново. Заодно это кэш против лимитов бесплатного ключа Букварикса.
  const dup = await query<{ id: string }>(
    `SELECT id FROM mini_checks
      WHERE domain = $1 AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC LIMIT 1`,
    [domain],
  );
  if (dup[0]) {
    // Проверка переиспользуется, но контакты нового человека — новые.
    // COALESCE, чтобы второй посетитель без контактов не стёр первого.
    if (email || phone) {
      await query(
        `UPDATE mini_checks
            SET email = COALESCE($2, email), phone = COALESCE($3, phone),
                consent_at = COALESCE(consent_at, NOW()), updated_at = NOW()
          WHERE id = $1`,
        [dup[0].id, email, phone],
      );
    }
    return NextResponse.json({ ok: true, id: dup[0].id, reused: true });
  }

  // 10 проверок с IP в сутки: щедрее, чем у полного КП (3) — проверка
  // бесплатная по себестоимости, но открытый безлимит превратил бы роут в
  // прокси к Буквариксу и PageSpeed.
  const used = await query<{ n: string }>(
    `SELECT COUNT(*) n FROM mini_checks WHERE client_ip = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [ip],
  );
  if (Number(used[0]?.n ?? 0) >= 10) {
    return NextResponse.json({ ok: false, error: "Лимит проверок на сегодня. Возвращайтесь завтра!" }, { status: 429 });
  }

  const id = await startMiniCheck(url, ip);
  if (email || phone) {
    await query(
      `UPDATE mini_checks SET email = $2, phone = $3, consent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id, email, phone],
    );
  }
  return NextResponse.json({ ok: true, id });
}

export async function GET(req: Request) {
  await initDb();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id обязателен" }, { status: 400 });

  const rows = await query<{ id: string; url: string; domain: string; status: string; result: MiniCheckResult; kp_id: string | null }>(
    `SELECT id, url, domain, status, result, kp_id FROM mini_checks WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Проверка не найдена" }, { status: 404 });
  return NextResponse.json({ ok: true, id: r.id, url: r.url, domain: r.domain, status: r.status, result: r.result, kpId: r.kp_id });
}
