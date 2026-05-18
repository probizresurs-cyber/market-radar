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

// Модель для экспресс-отчёта. Sonnet 4.6 даёт намного лучший «продающий» текст
// и точнее с brandName из <title>. Haiku в 3 раза дешевле (1.5 ₽ vs ~5 ₽),
// но текст более шаблонный. Переключается через .env: REPORT_MODEL=claude-haiku-4-5
const REPORT_MODEL = process.env.LEAD_REPORT_MODEL ?? "claude-sonnet-4-6";
// Себестоимость на 1 отчёт в центах ($ × 100). Используется в analytics
// для подсчёта общей стоимости генерации. ~$0.05 для Sonnet, ~$0.015 для Haiku.
const REPORT_COST_CENTS = parseFloat(process.env.LEAD_REPORT_COST_CENTS ?? (REPORT_MODEL.includes("haiku") ? "1.5" : "5"));
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

function buildPrompt(scraped: { title: string; metaDescription: string; h1: string[]; h2: string[]; bodyText: string; hasSchema: boolean; hasLlmsTxt: boolean }, domain: string, hintNiche: string | null) {
  return `Ты опытный SEO/маркетинг/AI-аудитор. Дан сайт ${domain}.

ЦЕЛЬ: создать «экспресс-отчёт» который покажет владельцу 3-5 серьёзных проблем + видимость в нейросетях, чтобы он захотел купить полный анализ MarketRadar24.

ВХОДНЫЕ ДАННЫЕ САЙТА:
- <title>: ${scraped.title || "(не задан)"}
- <meta description>: ${scraped.metaDescription || "(не задан)"}
- H1: ${scraped.h1.slice(0, 5).join(" | ") || "(нет H1)"}
- H2: ${scraped.h2.join(" | ") || "(нет H2)"}
- Ниша (если указана): ${hintNiche ?? "определи сам"}
- Schema.org разметка: ${scraped.hasSchema ? "есть" : "НЕТ"}
- llms.txt (инструкция для AI-краулеров): ${scraped.hasLlmsTxt ? "есть" : "НЕТ"}
- Контент страницы: ${scraped.bodyText.slice(0, 4000)}

Верни СТРОГО валидный JSON по схеме:

{
  "brandName": string,                 // СТРОГО из <title> или <h1>, как написано на сайте.
                                       // НЕ транслитерируй: "RuDenta" остаётся "RuDenta", не "Руденталь".
                                       // Если в title есть приписка типа "| Услуги" — выкинь её, оставь только бренд.
  "siteTitle": string,                 // сырой title как пришёл
  "overallScore": number,              // 0-100, общий
  "nicheAverage": number,              // 0-100, ср. по нише (твоя оценка)
  "scores": {
    "seo": number 0-100,
    "social": number 0-100,
    "content": number 0-100,
    "hrBrand": number 0-100,
    "technical": number 0-100,
    "aiVisibility": number 0-100       // видимость в нейросетях
  },
  "topProblems": [                      // 3 ОСТРЫЕ проблемы
    { "title": "...", "description": "1-2 предложения", "severity": "high"|"medium" }
  ],
  "opportunities": [                    // 3 ВОЗМОЖНОСТИ
    { "title": "...", "description": "...", "potential": "+X% за Y мес", "moneyEstimate": "от Z тыс ₽/мес" }
  ],
  "recommendations": [                  // 5 РЕКОМЕНДАЦИЙ
    { "title": "...", "description": "2-3 предложения", "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high" }
  ],
  "competitors": [                      // 3-5 КОНКУРЕНТОВ по нише
    { "name": "...", "domain": "...", "advantage": "что у них лучше, в 1 предложении" }
  ],
  "aiVisibility": {
    "score": number 0-100,
    "status": "invisible" | "weak" | "moderate" | "strong",
    "blockers": [                       // 3-4 что мешает попадать в ChatGPT/Claude/YandexGPT
      { "title": "Нет llms.txt", "description": "Файл-инструкция..." }
    ],
    "sampleQueries": [                  // 4-5 реальных запросов из ниши
      { "query": "лучшая стоматология в москве", "youArePresent": false, "note": "упоминают агрегаторы вместо вас" }
    ]
  },
  "oneLineSummary": "цепляющее предложение для email"
}

КРИТИЧНО ВАЖНО:
- brandName ровно как на сайте, без перевода/транслитерации. Если site title = "СМ-Стоматология | Сеть клиник", brandName = "СМ-Стоматология".
- overallScore на 10-25 баллов ниже nicheAverage — должно быть заметное отставание.
- aiVisibility.score обычно 5-35 у среднего сайта без работы над GEO (Generative Engine Optimization). У большинства сайтов нет llms.txt и плохая schema.org разметка → невидимость в нейросетях.
- aiVisibility.blockers — конкретные технические проблемы: "Нет llms.txt", "Schema.org только для Organization, нет MedicalClinic/LocalBusiness", "FAQ-секция не размечена", "Нет E-E-A-T сигналов (авторство, опыт)".
- sampleQueries — реальные запросы из ниши, естественные для пользователя. youArePresent: почти всегда false для сайтов без GEO-работы.
- topProblems — конкретные и БОЛЕЗНЕННЫЕ. "Schema.org разметки нет — теряете звёздочки в Яндексе и попадание в Алису".
- opportunities — с цифрами потенциала И денежной оценкой если возможно.
- recommendations: первые 3 — понятные владельцу, последние 2 — экспертные (нагрузить эффектом «нам есть что ещё рассказать»).
- competitors — реальные домены в нише (если знаешь, иначе правдоподобные).
- Весь текст на русском, лаконично.

JSON и ТОЛЬКО JSON, без markdown-обёртки.`;
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

  const sc = scraped as unknown as {
    title?: string;
    metaDescription?: string;
    h1?: string[];
    h2?: string[];
    bodyText?: string;
    textContent?: string;
    hasSchemaMarkup?: boolean;
  };
  // Проверяем наличие llms.txt отдельным запросом — он в корне сайта, не в HTML.
  // 1.5 сек таймаут, чтобы не блокировать на медленных хостах.
  let hasLlmsTxt = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`https://${domain}/llms.txt`, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    hasLlmsTxt = r.ok;
  } catch { /* host недоступен или нет llms.txt — норма */ }

  const prompt = buildPrompt({
    title: sc.title ?? "",
    metaDescription: sc.metaDescription ?? "",
    h1: sc.h1 ?? [],
    h2: sc.h2 ?? [],
    bodyText: (sc.bodyText ?? sc.textContent ?? "").slice(0, 5000),
    hasSchema: !!sc.hasSchemaMarkup,
    hasLlmsTxt,
  }, domain, niche);

  // Haiku.
  const { text, error } = await safeAnthropicCreate({
    model: REPORT_MODEL,
    max_tokens: 5000,
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
    `UPDATE lead_reports SET status='done', data=$1::jsonb, cost_cents=$2, generated_at=NOW() WHERE id=$3`,
    [JSON.stringify(parsed), REPORT_COST_CENTS, reportId],
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
