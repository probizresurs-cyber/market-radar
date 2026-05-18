/**
 * POST /api/admin/leads/generate-batch
 *
 * Body: { leadIds?: string[], onlyMissing?: boolean, limit?: number }
 *
 * Обрабатывает партию лидов параллельно (concurrency=3). Возвращает
 * массив результатов на каждый лид — UI вызывает endpoint повторно,
 * пока не закончатся pending. Так мы:
 *   • не упираемся в 30-сек таймаут одного HTTP-запроса (одна партия ≤30с),
 *   • контролируем concurrency на сервере (не DDoS-им Anthropic),
 *   • даём UI обновлять прогресс между батчами.
 *
 * Если leadIds не передан — берём `limit` (по умолчанию 5) лидов,
 * у которых нет завершённого отчёта.
 *
 * Реальная генерация делегируется существующему хелперу — чтобы не
 * дублировать prompt/scrape/save логику.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { scrapeWebsite } from "@/lib/scraper";
import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";
import type { LeadReport } from "@/lib/lead-types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
// 3 лида параллельно × 30 сек ≈ 30-60 сек на партию.
export const maxDuration = 90;

const REPORT_MODEL = "claude-haiku-4-5";
// Параметры можно крутить через .env без правок кода.
//   BULK_BATCH_SIZE  — сколько лидов в одной HTTP-партии (cap 20).
//   BULK_CONCURRENCY — одновременных вызовов Anthropic внутри партии.
//                      3 — консервативно, 5 — рабочий режим, 10+ риск 429.
const BATCH_SIZE = Math.min(parseInt(process.env.BULK_BATCH_SIZE ?? "5", 10) || 5, 20);
const CONCURRENCY = Math.min(parseInt(process.env.BULK_CONCURRENCY ?? "5", 10) || 5, 20);

interface LeadRow {
  id: string;
  domain: string;
  niche: string | null;
}

function buildPrompt(scraped: { title: string; metaDescription: string; h1: string[]; h2: string[]; bodyText: string }, domain: string, hintNiche: string | null) {
  return `Ты опытный SEO/маркетинг-аудитор. Дан сайт ${domain}.

ВАЖНО: создай «экспресс-отчёт», который покажет владельцу проблемы и заставит купить полный анализ MarketRadar24.

ВХОДНЫЕ ДАННЫЕ:
- Title: ${scraped.title || "(не задан)"}
- Meta-description: ${scraped.metaDescription || "(не задан)"}
- H1: ${scraped.h1.slice(0, 5).join(" | ") || "(нет H1)"}
- H2: ${scraped.h2.join(" | ") || "(нет H2)"}
- Ниша: ${hintNiche ?? "определи сам"}
- Текст: ${scraped.bodyText.slice(0, 4000)}

Верни СТРОГО валидный JSON (без markdown) по схеме:
{
  "overallScore": number 0-100,
  "nicheAverage": number 0-100,
  "scores": { "seo": 0-100, "social": 0-100, "content": 0-100, "hrBrand": 0-100, "technical": 0-100 },
  "topProblems": [{ "title": "...", "description": "1-2 предложения", "severity": "high"|"medium" }],   // 3 штуки
  "opportunities": [{ "title": "...", "description": "...", "potential": "+X% за Y мес" }],            // 3 штуки
  "recommendations": [{ "title": "...", "description": "...", "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high" }],   // 5 штук
  "competitors": [{ "name": "...", "domain": "...", "advantage": "..." }],                              // 3-5 штук
  "oneLineSummary": "1 цепляющее предложение для email"
}

ВАЖНО:
- Русский язык.
- overallScore на 5-25 баллов ниже nicheAverage.
- topProblems — конкретные и болезненные.
- recommendations: первые 2 — для широкой аудитории, остальные 3 — экспертные.
JSON и только JSON.`;
}

async function generateOne(leadId: string, domain: string, niche: string | null): Promise<{ ok: boolean; error?: string }> {
  // Создаём running-запись отчёта.
  const reportId = randomUUID();
  try {
    await query(
      `INSERT INTO lead_reports (id, lead_id, model, status, data) VALUES ($1, $2, $3, 'running', '{}'::jsonb)`,
      [reportId, leadId, REPORT_MODEL],
    );
  } catch (e) {
    return { ok: false, error: `insert: ${e instanceof Error ? e.message : "error"}` };
  }

  // Скрап.
  let scraped;
  try {
    scraped = await scrapeWebsite(domain);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scrape failed";
    await query(`UPDATE lead_reports SET status='failed', error_message=$1 WHERE id=$2`, [`scrape: ${msg}`, reportId]);
    return { ok: false, error: `scrape: ${msg}` };
  }

  const sc = scraped as unknown as { title?: string; metaDescription?: string; h1?: string[]; h2?: string[]; bodyText?: string; textContent?: string };
  const prompt = buildPrompt({
    title: sc.title ?? "",
    metaDescription: sc.metaDescription ?? "",
    h1: sc.h1 ?? [],
    h2: sc.h2 ?? [],
    bodyText: (sc.bodyText ?? sc.textContent ?? "").slice(0, 5000),
  }, domain, niche);

  // Haiku.
  const { text, error } = await safeAnthropicCreate({
    model: REPORT_MODEL,
    max_tokens: 3500,
    messages: [{ role: "user", content: prompt }],
  });
  if (!text) {
    await query(`UPDATE lead_reports SET status='failed', error_message=$1 WHERE id=$2`, [`anthropic: ${error ?? "no text"}`, reportId]);
    return { ok: false, error: error ?? "AI empty" };
  }

  const parsed = extractJson<LeadReport>(text);
  if (!parsed) {
    await query(`UPDATE lead_reports SET status='failed', error_message=$1 WHERE id=$2`, [`parse: invalid JSON`, reportId]);
    return { ok: false, error: "invalid JSON" };
  }

  parsed.generatedAt = new Date().toISOString();

  await query(
    `UPDATE lead_reports SET status='done', data=$1::jsonb, cost_cents=1.5, generated_at=NOW() WHERE id=$2`,
    [JSON.stringify(parsed), reportId],
  );

  return { ok: true };
}

interface BatchBody {
  leadIds?: string[];
  /** Если true — берём только тех, у кого ещё нет успешного отчёта */
  onlyMissing?: boolean;
  /** Сколько лидов брать (если leadIds не передан). По умолчанию BATCH_SIZE. */
  limit?: number;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as BatchBody;

    // Выбираем кого обработать.
    let targets: LeadRow[];
    if (body.leadIds && body.leadIds.length > 0) {
      const ids = body.leadIds.slice(0, 20); // cap, чтобы не запустить 100 параллельных
      // ANY($1::text[]) — массив-параметр Postgres.
      targets = await query<LeadRow>(
        `SELECT id, domain, niche FROM leads WHERE id = ANY($1::text[])`,
        [ids],
      );
    } else {
      const limit = Math.min(body.limit ?? BATCH_SIZE, 20);
      if (body.onlyMissing !== false) {
        targets = await query<LeadRow>(
          `SELECT l.id, l.domain, l.niche
             FROM leads l
            WHERE NOT EXISTS (
              SELECT 1 FROM lead_reports r WHERE r.lead_id = l.id AND r.status = 'done'
            )
            ORDER BY l.created_at ASC
            LIMIT $1`,
          [limit],
        );
      } else {
        targets = await query<LeadRow>(
          `SELECT id, domain, niche FROM leads ORDER BY created_at ASC LIMIT $1`,
          [limit],
        );
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        results: [],
        message: "Нет лидов без отчёта",
      });
    }

    // Обрабатываем в чанках по CONCURRENCY с Promise.all внутри чанка.
    const results: Array<{ leadId: string; domain: string; ok: boolean; error?: string }> = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const chunk = targets.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async t => {
          const r = await generateOne(t.id, t.domain, t.niche);
          return { leadId: t.id, domain: t.domain, ...r };
        }),
      );
      results.push(...chunkResults);
    }

    // Сколько ещё осталось pending — UI понимает, продолжать ли цикл.
    const remainingRows = await query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM leads l
        WHERE NOT EXISTS (SELECT 1 FROM lead_reports r WHERE r.lead_id = l.id AND r.status = 'done')`,
    );
    const remaining = parseInt(remainingRows[0]?.cnt ?? "0", 10);

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
      remaining,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("admin/leads/generate-batch error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
