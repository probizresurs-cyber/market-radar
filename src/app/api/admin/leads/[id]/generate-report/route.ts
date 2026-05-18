/**
 * POST /api/admin/leads/[id]/generate-report
 *
 * Запускает генерацию экспресс-отчёта для лида:
 *   1) Скрапит сайт (scrapeWebsite — 500KB лимит)
 *   2) Скармливает Claude Haiku 4.5 → структурированный JSON по LeadReport
 *   3) Сохраняет в lead_reports (status='done') или ошибку (status='failed')
 *
 * Стоимость ≈ $0.015 (1.5 ₽) на отчёт. Чтобы не нагружать прод одной
 * долгой генерацией, всё работает синхронно в одном request-handler-е,
 * но клиент сразу видит результат — это норм при объёме 1000-2000 за раз.
 *
 * Возвращает { ok, report } или { ok: false, error }.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { scrapeWebsite } from "@/lib/scraper";
import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";
import type { LeadReport } from "@/lib/lead-types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
// Скрейп может идти 10-15 сек + Haiku 5-10 сек, ставим запас.
export const maxDuration = 60;

interface Params {
  params: Promise<{ id: string }>;
}

interface LeadRow {
  id: string;
  domain: string;
  company_name: string | null;
  niche: string | null;
}

const REPORT_MODEL = "claude-haiku-4-5";

function buildPrompt(scraped: {
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  bodyText: string;
}, domain: string, hintNiche: string | null) {
  return `Ты опытный SEO/маркетинг-аудитор. Дан сайт ${domain}.

Тебе ВАЖНО создать «экспресс-отчёт», который покажет владельцу 1) что у них есть проблемы, и 2) что мы (MarketRadar24) знаем гораздо больше — чтобы он захотел купить полный анализ.

ВХОДНЫЕ ДАННЫЕ САЙТА:
- Title: ${scraped.title || "(не задан)"}
- Meta-description: ${scraped.metaDescription || "(не задан)"}
- H1: ${scraped.h1.slice(0, 5).join(" | ") || "(нет H1)"}
- H2: ${scraped.h2.join(" | ") || "(нет H2)"}
- Ниша (если известна): ${hintNiche ?? "определи сам по контенту"}
- Текст страницы (фрагмент): ${scraped.bodyText.slice(0, 4000)}

ЗАДАЧА — верни СТРОГО валидный JSON (без markdown-обёртки) по схеме:
{
  "overallScore": number 0-100,                // общая оценка сайта
  "nicheAverage": number 0-100,                // среднее по нише (твоя оценка)
  "scores": {
    "seo": number 0-100,
    "social": number 0-100,
    "content": number 0-100,
    "hrBrand": number 0-100,
    "technical": number 0-100
  },
  "topProblems": [                             // 3 ОСТРЫЕ проблемы (что прямо сейчас теряете)
    { "title": "...", "description": "1-2 предложения", "severity": "high" | "medium" }
  ],
  "opportunities": [                           // 3 ВОЗМОЖНОСТИ (что можно отжать)
    { "title": "...", "description": "1-2 предложения", "potential": "конкретная цифра, например '+30% трафика за 2 мес'" }
  ],
  "recommendations": [                         // 5 РЕКОМЕНДАЦИЙ с приоритетом
    { "title": "...", "description": "2-3 предложения", "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high" }
  ],
  "competitors": [                             // 3-5 КОНКУРЕНТОВ по нише
    { "name": "...", "domain": "...", "advantage": "что у них лучше, в 1 предложении" }
  ],
  "oneLineSummary": "1 предложение для email-превью, цепляющее"
}

ВАЖНО:
- Все тексты на русском.
- overallScore должен быть ниже nicheAverage на 5-25 баллов — чтобы было «к чему стремиться».
- topProblems должны звучать конкретно и больно (например, «Schema.org разметки нет — теряете звёздочки в Яндексе»).
- В recommendations первые 2 пункта пиши понятно для не-эксперта, остальные 3 — более экспертно, чтобы было видно «нам есть что ещё рассказать».
- competitors — реальные конкуренты по нише, домены реальные (если знаешь), иначе придумай правдоподобные.
- generatedAt не возвращай, я сам поставлю.

JSON и только JSON.`;
}

export async function POST(_req: Request, { params }: Params) {
  const startedAt = Date.now();
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id: leadId } = await params;
    const leadRows = await query<LeadRow>(
      `SELECT id, domain, company_name, niche FROM leads WHERE id = $1`,
      [leadId],
    );
    if (!leadRows.length) {
      return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
    }
    const lead = leadRows[0];

    // Создаём запись отчёта в статусе running — UI сразу видит прогресс.
    const reportId = randomUUID();
    await query(
      `INSERT INTO lead_reports (id, lead_id, model, status, data)
       VALUES ($1, $2, $3, 'running', '{}'::jsonb)`,
      [reportId, leadId, REPORT_MODEL],
    );

    // Шаг 1 — скрап сайта (с fallback http→https внутри scrapeWebsite).
    let scraped;
    try {
      scraped = await scrapeWebsite(lead.domain);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "scrape failed";
      await query(
        `UPDATE lead_reports SET status = 'failed', error_message = $1 WHERE id = $2`,
        [`scrape: ${msg}`, reportId],
      );
      return NextResponse.json({ ok: false, error: `Не удалось скачать сайт: ${msg}` }, { status: 502 });
    }

    // Из ScrapedData нам нужны заголовки + текст. У типа структуры могут быть
    // разные поля — берём то, что точно есть.
    const sc = scraped as unknown as {
      title?: string;
      metaDescription?: string;
      h1?: string[];
      h2?: string[];
      bodyText?: string;
      textContent?: string;
    };
    const prompt = buildPrompt({
      title: sc.title ?? "",
      metaDescription: sc.metaDescription ?? "",
      h1: sc.h1 ?? [],
      h2: sc.h2 ?? [],
      bodyText: (sc.bodyText ?? sc.textContent ?? "").slice(0, 5000),
    }, lead.domain, lead.niche);

    // Шаг 2 — Haiku.
    const { text, error } = await safeAnthropicCreate({
      model: REPORT_MODEL,
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
    });
    if (!text) {
      await query(
        `UPDATE lead_reports SET status = 'failed', error_message = $1 WHERE id = $2`,
        [`anthropic: ${error ?? "no text"}`, reportId],
      );
      return NextResponse.json({ ok: false, error: error ?? "AI вернул пустой ответ" }, { status: 502 });
    }

    const parsed = extractJson<LeadReport>(text);
    if (!parsed) {
      await query(
        `UPDATE lead_reports SET status = 'failed', error_message = $1 WHERE id = $2`,
        [`parse: invalid JSON`, reportId],
      );
      return NextResponse.json({ ok: false, error: "AI вернул невалидный JSON" }, { status: 502 });
    }

    parsed.generatedAt = new Date().toISOString();

    // Прикинем себестоимость: Haiku 4.5 ≈ $1 in/M + $5 out/M. Грубо считаем
    // input ~5K токенов и output ~1.5K → ~$0.015 = 1.5 цента.
    const costCents = 1.5;

    await query(
      `UPDATE lead_reports
         SET status = 'done',
             data = $1::jsonb,
             cost_cents = $2,
             generated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(parsed), costCents, reportId],
    );

    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      reportId,
      durationMs,
      report: parsed,
    });
  } catch (e) {
    console.error("admin/leads/[id]/generate-report error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
