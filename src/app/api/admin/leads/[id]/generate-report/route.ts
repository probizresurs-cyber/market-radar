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
  // См. подробный комментарий в generate-batch/route.ts — anti-hallucination
  // промпт. Тут та же логика «не знаешь → не выдумывай».
  return `Ты опытный SEO/маркетинг/AI-аудитор. Дан сайт ${domain}.

ЦЕЛЬ: создать честный экспресс-отчёт. Без галлюцинаций, без выдуманных цифр.

═══ ВХОДНЫЕ ДАННЫЕ (это ВСЁ что у тебя есть) ═══
- <title>: ${scraped.title || "(не задан)"}
- <meta description>: ${scraped.metaDescription || "(не задан)"}
- H1: ${scraped.h1.slice(0, 5).join(" | ") || "(нет H1)"}
- H2: ${scraped.h2.join(" | ") || "(нет H2)"}
- Ниша: ${hintNiche ?? "определи сам"}
- Schema.org: ${scraped.hasSchema ? "есть" : "НЕТ"}
- llms.txt: ${scraped.hasLlmsTxt ? "есть" : "НЕТ"}
- Контент страницы: ${scraped.bodyText.slice(0, 4000)}

═══ АНТИ-ГАЛЛЮЦИНАЦИИ ═══
ЗАПРЕЩЕНО выдумывать факты которых нет:
- НЕ выдумывай статистику ("теряете 30% трафика", "средний CTR в нише")
- НЕ выдумывай конкретные деньги
- НЕ выдумывай конкурентов если не знаешь реальные домены в нише — лучше пустой список
- НЕ выдумывай рейтинги Яндекс.Карт / Google если их нет на странице
- НЕ выдумывай число отзывов, сотрудников, оборот
- Качественная оценка ниши («есть потенциал роста») — ок. Конкретные цифры — НЕТ.

═══ JSON ВЫХОД ═══
{
  "brandName": string,                 // СТРОГО со страницы, без транслитерации.
  "siteTitle": string,
  "overallScore": number 0-100,        // Экспертная оценка по входным данным.
  "nicheAverage": number 0-100,        // Качественная оценка ср. по нише (AI-гипотеза).
                                       // Должна быть выше overallScore на 8-20 баллов.
  "scores": {
    "seo": number 0-100, "social": number 0-100, "content": number 0-100,
    "hrBrand": number 0-100, "technical": number 0-100, "aiVisibility": number 0-100
  },
  "topProblems": [
    { "title": "...", "description": "1-2 предл. по факту со страницы", "severity": "high"|"medium" }
  ],
    // ✓ "H1 отсутствует на главной"
    // ✓ "Schema.org разметки нет"
    // ✗ "Теряете 30% трафика"
  "opportunities": [
    { "title": "...", "description": "...",
      "potential": "качественная характеристика — БЕЗ цифр которых ты не знаешь" }
  ],
    // ВАЖНО: moneyEstimate не возвращаем — источник галлюцинаций.
    // potential: "рост видимости в Алисе" — ОК. "+30% за 2 мес" — НЕТ.
  "recommendations": [
    { "title": "...", "description": "2-3 предл.", "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high" }
  ],
  "competitors": [],
    // ОСТОРОЖНО: выдавай только если знаешь реальные домены в нише.
    // Сомневаешься — пустой массив. Лучше 0 чем 5 выдуманных.
  "aiVisibility": {
    "score": number 0-100,             // На основе фактов: schema, llms.txt, FAQ-разметка, E-E-A-T.
    "status": "invisible" | "weak" | "moderate" | "strong",
    "blockers": [{ "title": "Нет llms.txt", "description": "..." }],
    "sampleQueries": [{ "query": "...", "youArePresent": false, "note": "AI-гипотеза" }]
      // youArePresent: false по умолчанию (без реальной проверки нельзя знать).
  },
  "oneLineSummary": "1 предложение для email — конкретно, без выдумок"
}

ПРАВИЛА:
- Валидный JSON, без markdown.
- Русский, лаконично.
- НЕ ЗНАЕШЬ → НЕ ВЫДУМЫВАЙ.`;
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
