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
import { enrichLeadContacts, applyEnrichmentToLead } from "@/lib/lead-enricher";
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

// Модель + цена настраиваются через .env, см. generate-batch/route.ts.
const REPORT_MODEL = process.env.LEAD_REPORT_MODEL ?? "claude-sonnet-4-6";
const REPORT_COST_CENTS = parseFloat(process.env.LEAD_REPORT_COST_CENTS ?? (REPORT_MODEL.includes("haiku") ? "1.5" : "5"));

function buildPrompt(scraped: {
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  bodyText: string;
  hasSchema: boolean;
  hasLlmsTxt: boolean;
}, domain: string, hintNiche: string | null) {
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

Верни СТРОГО валидный JSON (без markdown) по схеме:
{
  "brandName": string,                 // СТРОГО из <title> или <h1>, как написано на сайте.
                                       // НЕ транслитерируй: "RuDenta" остаётся "RuDenta", не "Руденталь".
                                       // Если в title есть приписка "| Услуги" — выкинь её, оставь только бренд.
  "siteTitle": string,                 // сырой title как пришёл
  "overallScore": number 0-100,
  "nicheAverage": number 0-100,
  "scores": {
    "seo": number 0-100,
    "social": number 0-100,
    "content": number 0-100,
    "hrBrand": number 0-100,
    "technical": number 0-100,
    "aiVisibility": number 0-100       // видимость в нейросетях
  },
  "topProblems": [{ "title": "...", "description": "1-2 предл.", "severity": "high"|"medium" }],
  "opportunities": [{ "title": "...", "description": "...", "potential": "+X% за Y мес", "moneyEstimate": "от Z тыс ₽/мес" }],
  "recommendations": [{ "title": "...", "description": "2-3 предл.", "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high" }],
  "competitors": [{ "name": "...", "domain": "...", "advantage": "..." }],
  "aiVisibility": {
    "score": number 0-100,
    "status": "invisible" | "weak" | "moderate" | "strong",
    "blockers": [{ "title": "Нет llms.txt", "description": "..." }],
    "sampleQueries": [{ "query": "...", "youArePresent": false, "note": "..." }]
  },
  "oneLineSummary": "1 цепляющее предложение"
}

КРИТИЧНО:
- brandName ровно как на сайте, без перевода/транслитерации. "СМ-Стоматология | Сеть клиник" → brandName = "СМ-Стоматология".
- overallScore на 10-25 баллов ниже nicheAverage.
- aiVisibility.score обычно 5-35 у среднего сайта без GEO-работы. У большинства нет llms.txt и плохая schema.org → невидимость в нейросетях.
- aiVisibility.blockers — конкретные технические: "Нет llms.txt", "Schema.org только Organization, нет MedicalClinic/LocalBusiness", "FAQ-секция не размечена", "Нет E-E-A-T сигналов".
- sampleQueries — реальные запросы из ниши, youArePresent почти всегда false.
- topProblems — конкретные и БОЛЕЗНЕННЫЕ.
- recommendations: первые 3 понятные владельцу, последние 2 экспертные.
- Весь текст на русском, лаконично.

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
      hasSchemaMarkup?: boolean;
    };
    // Проверяем llms.txt — отдельный файл в корне сайта, не в HTML.
    let hasLlmsTxt = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(`https://${lead.domain}/llms.txt`, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(t);
      hasLlmsTxt = r.ok;
    } catch { /* host недоступен или нет llms.txt */ }

    const prompt = buildPrompt({
      title: sc.title ?? "",
      metaDescription: sc.metaDescription ?? "",
      h1: sc.h1 ?? [],
      h2: sc.h2 ?? [],
      bodyText: (sc.bodyText ?? sc.textContent ?? "").slice(0, 5000),
      hasSchema: !!sc.hasSchemaMarkup,
      hasLlmsTxt,
    }, lead.domain, lead.niche);

    // Шаг 2 — Параллельно: AI + обогащение контактами.
    //   AI — основной отчёт (Sonnet/Haiku, 5-30 сек)
    //   Enrich — regex по email/телефонам на /contacts страницах (3-5 сек)
    // Promise.all экономит wall-time. Enrich-падение не валит отчёт.
    const [aiRes, enrichRes] = await Promise.all([
      safeAnthropicCreate({
        model: REPORT_MODEL,
        max_tokens: 5000,
        messages: [{ role: "user", content: prompt }],
      }),
      enrichLeadContacts(lead.domain, { withAI: false }).catch(e => {
        console.warn(`[generate-report] enrich failed for ${lead.domain}:`, e);
        return null;
      }),
    ]);

    const { text, error } = aiRes;
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

    // Себестоимость из ENV (см. константу REPORT_COST_CENTS). Sonnet 4.6 ≈ 5¢,
    // Haiku 4.5 ≈ 1.5¢. Числа примерные, точное число берётся из ENV если задано.
    const costCents = REPORT_COST_CENTS;

    await query(
      `UPDATE lead_reports
         SET status = 'done',
             data = $1::jsonb,
             cost_cents = $2,
             generated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(parsed), costCents, reportId],
    );

    // Шаг 3 — применяем обогащение к лиду (только в пустые поля).
    let enrichedFields: string[] = [];
    if (enrichRes) {
      try {
        const cur = await query<{
          contact_email: string | null;
          contact_phone: string | null;
          contact_person_name: string | null;
        }>(
          `SELECT contact_email, contact_phone, contact_person_name FROM leads WHERE id = $1`,
          [leadId],
        );
        if (cur[0]) {
          const updates = await applyEnrichmentToLead(leadId, enrichRes, cur[0], query);
          enrichedFields = Object.keys(updates);
        }
      } catch (e) {
        console.warn(`[generate-report] apply enrich failed:`, e);
      }
    }

    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      reportId,
      durationMs,
      report: parsed,
      enrichedFields,        // какие поля контактов заполнились автоматом
    });
  } catch (e) {
    console.error("admin/leads/[id]/generate-report error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
