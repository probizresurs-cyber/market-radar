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
import { enrichLeadContacts, applyEnrichmentToLead } from "@/lib/lead-enricher";
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
  // ВАЖНО — anti-hallucination промпт.
  // Опытно: AI-аудиторы на Sonnet/Haiku ОЧЕНЬ любят выдумывать конкретику
  // (цены, проценты роста, имена конкурентов, метрики Яндекса). Это убивает
  // доверие — пользователь читает отчёт и видит факты, которых нет.
  //
  // Правила в промпте ниже строятся вокруг одного принципа:
  //   «не знаешь — пиши общими словами или null, НИКОГДА не выдумывай число».
  //
  // Конкретики разрешены ТОЛЬКО когда мы можем подтвердить со страницы:
  //   • нет H1 → пишем «H1 отсутствует» (факт со скрапа)
  //   • есть schema.org → пишем «schema.org есть» (факт)
  //   • НЕ пишем «вы теряете 30% трафика» если этого нигде не видно
  return `Ты опытный SEO/маркетинг/AI-аудитор. Дан сайт ${domain}.

ЦЕЛЬ: создать честный экспресс-отчёт. Владелец сайта прочитает его и должен УВАЖАТЬ нашу экспертизу — без галлюцинаций, без выдуманных цифр.

═══ ВХОДНЫЕ ДАННЫЕ САЙТА (это ВСЁ что у тебя есть) ═══
- <title>: ${scraped.title || "(не задан)"}
- <meta description>: ${scraped.metaDescription || "(не задан)"}
- H1: ${scraped.h1.slice(0, 5).join(" | ") || "(нет H1)"}
- H2: ${scraped.h2.join(" | ") || "(нет H2)"}
- Ниша (если указана): ${hintNiche ?? "определи сам по контенту"}
- Schema.org разметка: ${scraped.hasSchema ? "есть" : "НЕТ"}
- llms.txt (инструкция для AI-краулеров): ${scraped.hasLlmsTxt ? "есть" : "НЕТ"}
- Контент страницы (фрагмент, до 4000 символов): ${scraped.bodyText.slice(0, 4000)}

═══ АНТИ-ГАЛЛЮЦИНАЦИИ — КРИТИЧНО ═══
Запрещено выдумывать факты которых нет в исходных данных:
- НЕ выдумывай статистику («теряете 30% трафика», «средний CTR в нише 5%»)
- НЕ выдумывай конкретные деньги («потенциал 150 тыс ₽/мес»)
- НЕ выдумывай конкурентов которые ты не знаешь как реальные домены в этой нише в России
- НЕ выдумывай оценку Яндекс.Карт / Google если её нет во входных данных
- НЕ выдумывай количество отзывов, сотрудников, оборот компании
- Если делаешь оценку «на основе ниши» — формулируй абстрактно («есть потенциал роста органики», а не «+30% за 2 мес»)

═══ JSON ВЫХОД ═══
{
  "brandName": string,
    // СТРОГО из <title> или <h1>. "RuDenta" остаётся "RuDenta" (не "Руденталь").
    // Если в title есть " | Услуги" / " — Сеть клиник" — выкинь, оставь чистый бренд.
  "siteTitle": string,                  // сырой title как пришёл

  "overallScore": number,               // 0-100. Твоя экспертная оценка на основе исходных данных.
                                        // Если данных мало — score ближе к 40-50 (нет основы для уверенности).
  "nicheAverage": number,               // 0-100. Качественная оценка «среднее по нише».
                                        // Это AI-гипотеза, пользователь увидит её как «AI-оценка».
                                        // Должно быть выше overallScore на 8-20 баллов чтобы был мотив расти.
  "scores": {
    "seo": number 0-100,                // На основе title/meta/h1/h2/schema из входных данных.
    "social": number 0-100,             // Если нет ссылок на соцсети в контенте → низкий (15-40).
    "content": number 0-100,            // Качество текста на главной — оцени по фрагменту.
    "hrBrand": number 0-100,            // Если нет страницы «команда»/«о нас»/«вакансии» → низкий.
    "technical": number 0-100,          // schema.org + структура заголовков.
    "aiVisibility": number 0-100        // См. ниже aiVisibility.score
  },

  "topProblems": [                       // 3 проблемы. Только то что РЕАЛЬНО видно во входных данных.
    { "title": "...", "description": "1-2 предложения по факту со страницы", "severity": "high"|"medium" }
  ],
    // Хорошие примеры (фактические):
    //   "title: H1 отсутствует на главной"
    //   "Schema.org разметки нет — невозможно появление звёздочек в выдаче Яндекса"
    //   "Meta description слишком короткий (12 символов) — сниппет в поиске не сформируется"
    // ПЛОХИЕ (галлюцинации, ЗАПРЕЩЕНЫ):
    //   "Теряете 30% органического трафика"  — откуда цифра?
    //   "Сайт грузится 8 секунд"            — мы это не замеряли
    //   "Конкуренты обходят вас по ставкам в Директе" — мы не видим Директ

  "opportunities": [                     // 3 возможности — БЕЗ выдуманных цифр.
    { "title": "...", "description": "что можно улучшить (по фактам со скрапа)",
      "potential": "качественная характеристика — НЕ ВЫДУМЫВАЙ цифры" }
  ],
    // ВАЖНО: поле "potential" — описывает направление эффекта, не число.
    //   ✓ "рост видимости в Яндекс.Картах и Алисе"
    //   ✓ "понятная коммуникация для холодного трафика"
    //   ✗ "+30% трафика за 2 мес" — НЕЛЬЗЯ если не можешь обосновать
    //
    // moneyEstimate — НЕ возвращай это поле. Мы его удалили из схемы как
    //   источник галлюцинаций. Если данных для оценки денег нет — её нет.

  "recommendations": [                   // 5 рекомендаций. Конкретно что делать.
    { "title": "...", "description": "2-3 предложения, понятные владельцу",
      "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high" }
  ],

  "competitors": [],
    // ОПАСНАЯ ЗОНА для галлюцинаций. Выдавай конкурентов ТОЛЬКО если:
    //   а) Точно знаешь домен (реально существует в этой нише в России),
    //   б) Можешь обосновать почему они «обходят» этот сайт по факту.
    // Если нет уверенности — верни ПУСТОЙ массив [].
    // Лучше 0 конкурентов чем 5 выдуманных.

  "aiVisibility": {
    "score": number 0-100,
      // ОСНОВАНО на ФАКТАХ: hasSchema, hasLlmsTxt, есть ли FAQ-разметка в контенте,
      // есть ли упоминания экспертов/авторов (E-E-A-T).
      // У среднего российского сайта без GEO-работы: 10-30. С хорошей schema.org: 40-60.
    "status": "invisible" | "weak" | "moderate" | "strong",
    "blockers": [
      { "title": "...", "description": "..." }
    ],
      // Базируйся НА ФАКТАХ со скрапа:
      //   ✓ "Нет llms.txt"               (мы проверили — нет)
      //   ✓ "Schema.org отсутствует"     (мы проверили)
      //   ✓ "FAQ-секции на странице нет" (видно по контенту)
      //   ✗ "Бренд упоминается в ChatGPT 5%" — мы это не проверяли
    "sampleQueries": [
      { "query": "...", "youArePresent": false, "note": "AI-гипотеза, требует верификации" }
    ]
      // Это AI-гипотезы о вероятных запросах в нише. Юзер увидит их с пометкой «AI».
      // youArePresent: пиши false по умолчанию — без реальной проверки нельзя знать.
      // 3-4 штуки максимум.
  },

  "oneLineSummary": "одно предложение для email-превью. Конкретно и по делу, без выдумок."
}

═══ ПРАВИЛА ВЫХОДА ═══
- Только валидный JSON, без markdown-обёртки.
- Русский язык, лаконично.
- brandName строго со страницы, без транслитерации.
- В polym случаях когда не знаешь — НЕ ВЫДУМЫВАЙ. Лучше короче и честнее.
- Эта рассылка идёт реальным компаниям, любая ложь = потеря доверия и жалоба.`;
}

async function generateOne(leadId: string, domain: string, niche: string | null): Promise<{ ok: boolean; error?: string; enrichedFields?: string[] }> {
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

  // ── Параллельно: AI-отчёт + обогащение контактами ─────────────────
  // Оба процесса независимы и работают одновременно — экономит ~3-5 сек.
  // Обогащение идёт без AI (только regex по email/телефонам), бесплатно.
  // Тяжёлый поиск имён через Haiku оставляем для отдельного /enrich-batch.
  const [aiRes, enrichRes] = await Promise.all([
    safeAnthropicCreate({
      model: REPORT_MODEL,
      max_tokens: 5000,
      messages: [{ role: "user", content: prompt }],
    }),
    enrichLeadContacts(domain, { withAI: false }).catch(e => {
      // Падение enrich не должно валить отчёт — это второстепенный апдейт.
      console.warn(`[generate-batch] enrich failed for ${domain}:`, e);
      return null;
    }),
  ]);

  const { text, error } = aiRes;
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

  // ── Применяем обогащение к лиду (только в пустые поля) ───────────
  let enrichedFields: string[] = [];
  if (enrichRes) {
    try {
      // Тянем current contact_* — это лёгкий select по primary key.
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
      console.warn(`[generate-batch] apply enrich failed for ${domain}:`, e);
    }
  }

  return { ok: true, enrichedFields };
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
