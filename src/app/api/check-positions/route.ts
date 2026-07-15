/**
 * POST /api/check-positions
 *
 * Проверяет РЕАЛЬНУЮ текущую позицию домена в органической выдаче
 * Yandex/Google по списку ключевых слов — живым Chromium через Playwright
 * (src/lib/position-checker.ts), а не запросом к LLM. LLM не может знать
 * актуальный SERP — это жёсткое продуктовое требование, никогда не
 * подставляем угаданную позицию.
 *
 * Body: { domain: string, keywords: string[], engine: "yandex" | "google", region?: string }
 *
 * Keywords проверяются ПОСЛЕДОВАТЕЛЬНО (не параллельно) с рандомной паузой
 * 3-8с между запросами — параллельные headless-браузеры с одного IP это
 * гарантированный бан/капча в разы быстрее. Каждый результат пишется в БД
 * сразу после проверки (не в конце батча), чтобы при обрыве/таймауте
 * запроса частичный прогресс не терялся.
 *
 * ВАЖНО про длительность: 20 keywords × (запрос ~3-8с + пауза 3-8с,
 * иногда до 3 страниц выдачи на keyword) может занимать 2-4 минуты.
 * maxDuration=300 — это Vercel-специфичная настройка (no-op при
 * самостоятельном хостинге через `next start`/PM2, как здесь). Реальный
 * лимит на проде — таймаут nginx/reverse-proxy перед Node; если он ниже
 * ~5 минут, длинные батчи будут падать в 504 несмотря на то, что сама
 * проверка продолжится и допишет строки в position_checks. См. отчёт
 * агента для рекомендации по chunked/async варианту.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, initDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
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

// Осторожный первый прод-запуск: 10 вместо 20 — держит худший случай
// (10 × до 3 страниц × пауза 3-8с) в районе ~1.5-2 минут вместо 4, снижает
// и риск упереться в таймаут nginx, и заметность паттерна для антибота.
// Можно поднять после недели без жалоб на капчу/таймауты.
const MAX_KEYWORDS = 10;
const ENGINES: SearchEngine[] = ["yandex", "google"];

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(req: Request) {
  // Admin-gated: тяжёлая операция (headless Chrome на VPS), фича пока
  // доступна только через /admin/position-checker — см. src/app/admin/
  // analysis-requests/route.ts для того же 403-паттерна.
  const session = await getSessionUser().catch(() => null);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Отдельный rate-limit поверх обычного AI-лимита: это не AI-вызов, но
  // каждый запрос — это реальный headless Chrome процесс на сервере,
  // который может занимать минуты. 3 батча/день на админа — намеренно
  // консервативный потолок для первого прод-запуска (осторожный rollout),
  // до появления реальных данных по нагрузке и частоте капчи/таймаутов.
  const limit = checkRateLimit(session.userId, {
    keyPrefix: "poscheck",
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    const headers = rateLimitHeaders(limit);
    const minutesLeft = limit.retryAfterMs ? Math.ceil(limit.retryAfterMs / 60000) : 60;
    return NextResponse.json(
      { ok: false, error: `Лимит проверок позиций исчерпан (3/день). Попробуйте через ${minutesLeft} мин.` },
      { status: 429, headers }
    );
  }

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

  const engine = body.engine as SearchEngine;
  if (!ENGINES.includes(engine)) return badRequest('engine должен быть "yandex" или "google"');

  const region = body.region ? String(body.region).trim() || undefined : undefined;

  if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
    return badRequest("Укажите хотя бы одно ключевое слово");
  }
  const keywords = Array.from(
    new Set(
      body.keywords
        .map((k) => String(k ?? "").trim())
        .filter((k) => k.length > 0 && k.length <= 200)
    )
  ).slice(0, MAX_KEYWORDS);
  if (keywords.length === 0) return badRequest("Список ключевых слов пуст после очистки");

  await initDb();

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

      // Пишем сразу, а не в конце батча — если процесс упадёт/обрежется по
      // таймауту на 15-м keyword из 20, первые 14 результатов не потеряются.
      await query(
        `INSERT INTO position_checks
           (id, batch_id, domain, keyword, engine, region, position, status, error_message, requested_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
          session.userId,
        ]
      ).catch(() => {
        // Не роняем весь батч из-за сбоя записи в БД — результат всё равно
        // вернётся клиенту в ответе.
      });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return NextResponse.json({ ok: true, batchId, domain, engine, region: region ?? null, results });
}
