/**
 * POST /api/mini-check { url } — поставить бесплатную мини-проверку (без auth:
 * это верх воронки, посетитель ещё аноним). Лимиты обязательны — see ниже.
 * GET  /api/mini-check?id=... — статус и результат (частичный: пробы
 * дорисовываются по мере готовности).
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { initDb, query } from "@/lib/db";
import { startMiniCheck, reviveStuckProbes, type MiniCheckResult } from "@/lib/mini-check";
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

  // Сквозная атрибуция. Без сохранённых меток через месяц открутки нельзя
  // ответить, какая кампания приносит КП и сделки, а какая — только клики.
  // Белый список ключей: пишем ровно то, что нужно Директу, а не весь query.
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"] as const;
  const rawUtm = (body.utm ?? {}) as Record<string, unknown>;
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = rawUtm[k];
    if (typeof v === "string" && v.trim()) utm[k] = v.trim().slice(0, 200);
  }
  const utmJson = Object.keys(utm).length ? JSON.stringify(utm) : null;

  // Дедуп по домену за сутки: F5, повторный клик и второй посетитель с тем же
  // сайтом получают готовый результат, а Букварикс с PageSpeed не дёргаются
  // заново. Заодно это кэш против лимитов бесплатного ключа Букварикса.
  //
  // ВАЖНО: переиспользуется РЕЗУЛЬТАТ, а не сама строка. Раньше второму
  // посетителю отдавался id чужой проверки — вместе с чужим email (страница
  // подставляла его маской как «ваш сохранённый адрес») и чужим kp_id, по
  // которому показывался готовый разбор, заказанный другим человеком.
  // Данные замера публичны и кэшируются законно, контакты — нет, поэтому
  // каждый посетитель получает СВОЮ строку с копией результата.
  const dup = await query<{ id: string; result: MiniCheckResult }>(
    `SELECT id, result FROM mini_checks
      WHERE domain = $1 AND created_at > NOW() - INTERVAL '24 hours'
        AND status = 'done'
      ORDER BY created_at DESC LIMIT 1`,
    [domain],
  );
  if (dup[0]) {
    const copyId = randomUUID();
    // Приведение типов обязательно: без ::text Postgres не выводит тип
    // параметров внутри CASE и падает «could not determine data type».
    await query(
      `INSERT INTO mini_checks (id, url, domain, status, result, client_ip, email, phone, consent_at, utm)
       VALUES ($1, $2, $3, 'done', $4::jsonb, $5, $6::text, $7::text,
               CASE WHEN $6::text IS NULL AND $7::text IS NULL THEN NULL ELSE NOW() END, $8::jsonb)`,
      [copyId, url, domain, JSON.stringify(dup[0].result ?? {}), ip, email, phone, utmJson],
    );
    return NextResponse.json({ ok: true, id: copyId, reused: true });
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
  if (utmJson) {
    await query(`UPDATE mini_checks SET utm = $2::jsonb WHERE id = $1`, [id, utmJson]);
  }
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

  const rows = await query<{ id: string; url: string; domain: string; status: string; result: MiniCheckResult; kp_id: string | null; email: string | null }>(
    `SELECT id, url, domain, status, result, kp_id, email FROM mini_checks WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Проверка не найдена" }, { status: 404 });

  // Контакт мог прийти с формы /geo — тогда /new предлагает разбор в один
  // клик вместо повторного ввода. Наружу уходит только маска: этот GET
  // доступен любому, у кого есть id проверки, и светить чужой email нельзя.
  const emailMasked = r.email
    ? r.email.replace(/^(.{1,2})[^@]*@/, (_m, a) => `${a}***@`)
    : null;

  // Поллинг страницы — заодно и планировщик: если процесс перезапустили на
  // середине замера, пробы возобновятся, а не останутся в вечном «замер…».
  void reviveStuckProbes(id).catch(() => {});

  return NextResponse.json({
    ok: true, id: r.id, url: r.url, domain: r.domain, status: r.status, result: r.result, kpId: r.kp_id,
    hasEmail: !!r.email, emailMasked,
  });
}
