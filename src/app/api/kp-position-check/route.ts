/**
 * POST /api/kp-position-check
 *
 * Публичный (без авторизации) авто-триггер живой проверки позиций,
 * который вызывает сама страница интерактивного анализа (KpProposal),
 * когда для домена компании из этого КП ещё нет данных в position_checks.
 * По просьбе владельца продукта — работает всегда, для любого КП,
 * без привязки к тому, залогинен ли зритель как админ.
 *
 * Отличие от /api/check-positions (тот остаётся admin-gated): здесь нет
 * произвольного управления через UI — домен и ключевые слова приходят из
 * уже реально посчитанного анализа компании (company.seo.keywords), а не
 * вводятся вручную.
 *
 * Защита от злоупотребления — НЕ логин, а привязка к реальным данным:
 * домен обязан совпадать с company.url какого-то уже существующего анализа
 * в MarketRadar (user_data, ключ "company"/"company::p_<id>"). Так эндпоинт
 * нельзя использовать как анонимный SERP-скрейпер для произвольных доменов —
 * работает только для сайтов, которые реально анализировались на платформе.
 * Плюс cooldown 24ч по домену — не даёт задублировать проверку при
 * перезагрузках страницы.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, initDb } from "@/lib/db";
import {
  checkKeywordPosition,
  humanDelayBetweenKeywords,
  isValidDomain,
  launchCheckerBrowser,
  newCheckerPage,
  normalizeDomain,
  type PositionCheckResult,
  type SearchEngine,
} from "@/lib/position-checker";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_KEYWORDS = 10;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ENGINES: SearchEngine[] = ["yandex", "google"];

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(req: Request) {
  let body: { domain?: string; keywords?: string[]; engine?: string; region?: string } = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Некорректное тело запроса");
  }

  const rawDomain = (body.domain ?? "").toString().trim();
  if (!rawDomain) return badRequest("Укажите домен");
  if (!isValidDomain(rawDomain)) return badRequest("Некорректный формат домена");
  const domain = normalizeDomain(rawDomain);

  const engine: SearchEngine = ENGINES.includes(body.engine as SearchEngine)
    ? (body.engine as SearchEngine)
    : "yandex";
  const region = body.region ? String(body.region).trim() || undefined : undefined;

  const keywords = Array.from(
    new Set(
      (body.keywords ?? [])
        .map((k) => String(k ?? "").trim())
        .filter((k) => k.length > 0 && k.length <= 200)
    )
  ).slice(0, MAX_KEYWORDS);
  if (keywords.length === 0) return badRequest("Список ключевых слов пуст");

  await initDb();

  // Домен обязан принадлежать реальному анализу компании в MarketRadar —
  // иначе эндпоинт превращается в открытый анонимный SERP-скрейпер для
  // любого домена. Сканируем company/company::p_<id> у всех пользователей
  // и сравниваем нормализованные домены (в БД url может быть с https:// или
  // www., поэтому сравниваем не сырой строкой, а через normalizeDomain).
  const ownershipRows = await query<{ url: string | null }>(
    `SELECT value->'company'->>'url' AS url FROM user_data WHERE key LIKE 'company%'`
  );
  const knownDomains = new Set(
    ownershipRows.map((r) => (r.url ? normalizeDomain(r.url) : null)).filter((d): d is string => !!d)
  );
  if (!knownDomains.has(domain)) {
    return NextResponse.json(
      { ok: false, error: "Домен не относится ни к одному анализу в MarketRadar" },
      { status: 403 }
    );
  }

  // Cooldown по домену — не по пользователю (запрос анонимный): не даём
  // одному и тому же домену запускать параллельные/повторные живые проверки
  // из-за перезагрузок страницы. Это не авторизация, просто анти-дребезг.
  const last = await query<{ checked_at: string }>(
    `SELECT checked_at FROM position_checks WHERE domain = $1 ORDER BY checked_at DESC LIMIT 1`,
    [domain]
  );
  if (last[0] && Date.now() - new Date(last[0].checked_at).getTime() < COOLDOWN_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Проверка для этого домена уже проводилась недавно" });
  }

  const batchId = randomUUID();
  const results: PositionCheckResult[] = [];

  let browser;
  try {
    browser = await launchCheckerBrowser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `Не удалось запустить браузер для проверки: ${msg.slice(0, 300)}` },
      { status: 500 }
    );
  }

  try {
    const page = await newCheckerPage(browser);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      if (i > 0) await humanDelayBetweenKeywords();

      const result = await checkKeywordPosition(page, { domain, keyword, engine, region });
      results.push(result);

      await query(
        `INSERT INTO position_checks
           (id, batch_id, domain, keyword, engine, region, position, status, error_message, requested_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)`,
        [
          randomUUID(),
          batchId,
          domain,
          keyword,
          engine,
          region ?? null,
          result.position,
          result.status,
          result.errorMessage ?? null,
        ]
      ).catch(() => { /* не роняем батч из-за сбоя записи одной строки */ });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return NextResponse.json({ ok: true, batchId, domain, engine, region: region ?? null, results });
}
