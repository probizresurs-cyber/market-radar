import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedData, AnalysisResult, CategoryScore, Recommendation, Insight, CopyImprovement, KeywordGap, PracticalAdvice, AiPerception } from "./types";
import type { BusinessType } from "./business-types";
import { buildBusinessTypePromptHint } from "./business-types";
import { ANTI_HALLUCINATION_SHORT } from "./ai-rules";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");

  // Try full parse first
  const end = stripped.lastIndexOf("}");
  if (end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* fall through */ }
  }

  // ── Попытка 2: fix самые частые ошибки от Claude ───────────────────
  // 1) Внутри значений строк бывают одиночные неэкранированные кавычки —
  //    например `"name": "ГК "Орлинк""` — JSON.parse сразу падает.
  // 2) Иногда Claude вставляет «умные» юникод-кавычки (″ ‟ « »).
  // 3) Trailing commas перед }/] (валидно в JS, нет в JSON).
  const candidate = end > start ? stripped.slice(start, end + 1) : stripped.slice(start);
  const cleaned = candidate
    // умные кавычки → обычные двойные
    .replace(/[«»"„‟]/g, '"')
    // trailing comma перед закрывающей скобкой
    .replace(/,(\s*[}\]])/g, "$1")
    // Экранируем неэкранированные кавычки ВНУТРИ значений (consequetive double-quotes
    // часто = "name": "ГК "Орлинк"". Заменяем `""` на `"\"` если они НЕ в начале/конце).
    .replace(/([^,{[:\s])"([^,}\]:\s])/g, '$1\\"$2');
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // ── Попытка 3: truncated — ищем последнюю валидную } с конца ──────
  const partial = stripped.slice(start);
  for (let i = partial.length - 1; i > 0; i--) {
    if (partial[i] === "}") {
      try { return JSON.parse(partial.slice(0, i + 1)); } catch { /* continue */ }
    }
  }

  // Логируем превью в server-side console — поможем будущему дебагу.
  console.error("[analyzer.extractJson] failed, first 400 chars:", stripped.slice(0, 400));
  throw new Error(`Failed to parse AI response as JSON. Превью: ${stripped.slice(0, 120)}...`);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeStr(v: unknown, fallback = "—"): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// ─── Personal Brand Analysis ──────────────────────────────────────────────────

export async function analyzePersonalBrand(data: {
  name: string;
  position: string;
  scrapedSite?: ScrapedData;
  parentCompanyContext?: string;
}): Promise<AnalysisResult & { _usage?: { inputTokens: number; outputTokens: number } }> {
  const siteInfo = data.scrapedSite
    ? `=== ЛИЧНЫЙ САЙТ: ${data.scrapedSite.url} ===
HTTPS: ${data.scrapedSite.isHttps ? "да" : "нет"}
Title: ${data.scrapedSite.title || "(нет)"}
Meta description: ${data.scrapedSite.metaDescription || "(нет)"}
H1: ${data.scrapedSite.h1.join(" | ") || "(нет)"}
H2 (первые 6): ${data.scrapedSite.h2.slice(0, 6).join(" | ") || "(нет)"}
Соцсети: ${Object.keys(data.scrapedSite.socialLinks).join(", ") || "нет"}
Текст (фрагмент): ${data.scrapedSite.rawTextSample || "(пусто)"}`
    : "(личный сайт не предоставлен)";

  const companyCtx = data.parentCompanyContext
    ? `=== КОНТЕКСТ КОМПАНИИ (использовать как фон, не как предмет анализа) ===\n${data.parentCompanyContext}`
    : "";

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты эксперт по персональному брендингу и digital-маркетингу для российского рынка.
Проанализируй личный бренд человека по предоставленным данным и верни ТОЛЬКО валидный JSON без markdown и пояснений.
Если данных не хватает — не выдумывай, ставь null или «—».

=== ДАННЫЕ ПЕРСОНЫ ===
Имя: ${data.name}
Должность / экспертиза: ${data.position}

${companyCtx}

${siteInfo}

=== ИНСТРУКЦИИ ДЛЯ ЛИЧНОГО БРЕНДА ===
🔴 ГЛАВНОЕ ПРАВИЛО: предмет анализа — ЧЕЛОВЕК (личный бренд персоны), а НЕ компания.
Если выше дан сайт компании — это ТОЛЬКО ФОН/контекст ниши. Категорически НЕЛЬЗЯ
описывать услуги компании, цены, продукты, акции, «имплантация под ключ» и т.п.
Любой блок — про ЛИЧНОСТЬ: её экспертизу, позиционирование, голос, аудиторию.

- НЕ выдумывай цифры подписчиков, охваты, доходы, количество клиентов.
- Для business (employees, revenue, founded, legalForm) — ВСЕГДА «—» (неприменимо к персоне).
- Для hiring — нули и «—» (неприменимо).
- Для seo.positions — пустой массив (неприменимо).
- Для social.yandexRating / gisRating / yandexReviews / gisReviews — нули.
- Scores интерпретируй СТРОГО для личного бренда персоны (НЕ для компании):
  * seo = УЗНАВАЕМОСТЬ: находят ли персону по имени онлайн, размер цифрового следа
  * social = СОЦСЕТИ: личная активность, регулярность постинга, вовлечённость аудитории
  * content = КОНТЕНТ: качество и системность личного экспертного контента
  * hrBrand = ЭКСПЕРТНОСТЬ (E-E-A-T): экспертный вес, авторитет и признание в нише
  * technology = ДОВЕРИЕ/РЕПУТАЦИЯ: репутация, отзывы и упоминания о персоне, надёжность
- insights: 1 niche (позиционирование в нише), 2 action (что делать для роста), 1 battle (vs конкуренты-эксперты), 1 copy (личный голос/тон), 1 seo (онлайн-видимость персоны), 1 offer (личный оффер/УТП).
- practicalAdvice.offerAnalysis → ЛИЧНОЕ УТП и позиционирование ПЕРСОНЫ: за что ценят ИМЕННО
  этого человека как эксперта (его метод, точка зрения, опыт, экспертная роль). КАТЕГОРИЧЕСКИ
  НЕ услуги компании и не продукты — только личное позиционирование специалиста.
- practicalAdvice.contentIdeas → 4 идеи контента конкретно для личного бренда (от первого лица эксперта).
- practicalAdvice.copyImprovements → улучшения личного bio, описания в соцсетях, персональный оффер.
- aiPerception.persona → каким видят ЭТОГО ЧЕЛОВЕКА AI-системы.
- aiPerception.sampleAnswer → симуляция ответа ChatGPT на вопрос «Кто такой(ая) ${data.name}?».
${data.parentCompanyContext ? "- Учитывай контекст компании: личный бренд должен дополнять корпоративный, а не дублировать его." : ""}

=== ТРЕБУЕМЫЙ JSON (СТРОГО такая же структура как для компании) ===
{
  "companyName": "${data.name}",
  "description": "string (2-3 предложения о личном позиционировании и экспертизе)",
  "scores": { "seo": 0-100, "social": 0-100, "content": 0-100, "hrBrand": 0-100, "technology": 0-100 },
  "avgNiche": 0-100,
  "top10": 0-100,
  "recommendations": [
    { "priority": "high|medium|low", "text": "string", "effect": "string", "category": "string" }
  ],
  "insights": [
    { "type": "niche|action|battle|copy|seo|offer", "title": "string", "text": "string" }
  ],
  "practicalAdvice": {
    "copyImprovements": [
      { "element": "string (напр: Bio ВКонтакте, Описание Telegram, Личный оффер)", "current": "string", "suggested": "string", "reason": "string" }
    ],
    "keywordGaps": [],
    "offerAnalysis": {
      "currentOffer": "string (текущее позиционирование/УТП персоны)",
      "weaknesses": ["string", "string"],
      "differentiators": ["string", "string", "string"],
      "suggestedOffer": "string (готовый личный оффер, 1-2 предложения)"
    },
    "contentIdeas": ["string", "string", "string", "string"],
    "seoActions": ["string", "string", "string", "string"]
  },
  "seo": {
    "title": "string (как персона представлена онлайн)",
    "metaDescription": "string",
    "keywords": ["string"],
    "pageCount": 0,
    "domainAge": "—",
    "estimatedTraffic": "—",
    "positions": [],
    "issues": ["string"]
  },
  "techStack": { "cms": "—", "analytics": [], "chat": "—", "hosting": "—", "other": [] },
  "social": {
    "vk": null,
    "telegram": null,
    "yandexRating": 0,
    "yandexReviews": 0,
    "gisRating": 0,
    "gisReviews": 0
  },
  "hiring": { "openVacancies": 0, "avgSalary": "—", "topRoles": [], "trend": "stable", "salaryRange": "—" },
  "business": { "employees": "—", "revenue": "—", "founded": "—", "legalForm": "—" },
  "nicheForecast": {
    "trend": "growing|stable|declining",
    "trendPercent": 0,
    "forecast": "string (прогноз для ниши экспертности персоны)",
    "opportunities": ["string", "string", "string"],
    "threats": ["string", "string", "string"],
    "direction": "string",
    "timeframe": "string"
  },
  "aiPerception": {
    "knowledgePresence": "strong|moderate|weak|minimal",
    "persona": "string",
    "sampleAnswer": "string",
    "associatedKeywords": ["string", "string", "string", "string", "string"],
    "eeat": { "expertise": 0-100, "authority": 0-100, "trust": 0-100, "experience": 0-100 },
    "contentSignals": ["string", "string", "string"],
    "improvementTips": ["string", "string", "string", "string"]
  }
}

Важно:
- ровно 5 рекомендаций (2 high, 2 medium, 1 low)
- ровно 7 инсайтов: 1 niche, 2 action, 1 battle, 1 copy, 1 seo, 1 offer
- ровно 3 copyImprovements
- seoActions: 4 конкретных шага для роста онлайн-видимости персоны
- ровно 4 contentIdeas
- ровно 5 associatedKeywords в aiPerception`;

  const streamResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 10000,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let responseText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const event of streamResponse) {
    if (event.type === "message_start") {
      inputTokens = event.message.usage?.input_tokens ?? 0;
    } else if (event.type === "message_delta") {
      outputTokens = event.usage?.output_tokens ?? 0;
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      responseText += event.delta.text;
    }
  }
  if (!responseText) throw new Error("Empty response from AI model");
  const p = extractJson(responseText);

  // ── Parsing — identical to analyzeWithClaude ──────────────────────────────
  const scores = {
    seo: clamp(safeNum(p.scores?.seo, 0)),
    social: clamp(safeNum(p.scores?.social, 0)),
    content: clamp(safeNum(p.scores?.content, 0)),
    hrBrand: clamp(safeNum(p.scores?.hrBrand, 0)),
    technology: clamp(safeNum(p.scores?.technology, 0)),
  };
  // Веса осей для личного бренда: экспертность весит наравне с узнаваемостью —
  // для персоны авторитет в нише важнее «техничности».
  const overallScore = clamp(
    scores.seo * 0.25 + scores.social * 0.2 + scores.content * 0.2 + scores.hrBrand * 0.2 + scores.technology * 0.15
  );
  // Оси переименованы под личный бренд (ключи scores те же — маппинг семантический):
  //   seo→Узнаваемость, hrBrand→Экспертность, technology→Доверие/Репутация.
  const categories: CategoryScore[] = [
    { name: "Узнаваемость", weight: 25, score: scores.seo, icon: "🔍", delta: 0 },
    { name: "Соцсети", weight: 20, score: scores.social, icon: "📱", delta: 0 },
    { name: "Контент", weight: 20, score: scores.content, icon: "✏️", delta: 0 },
    { name: "Экспертность", weight: 20, score: scores.hrBrand, icon: "🎓", delta: 0 },
    { name: "Доверие", weight: 15, score: scores.technology, icon: "🤝", delta: 0 },
  ];

  // URL для хранения — домен личного сайта или транслитерация имени
  const personalDomain = data.scrapedSite
    ? new URL(data.scrapedSite.url).hostname.replace(/^www\./, "")
    : data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const recommendations: Recommendation[] = (Array.isArray(p.recommendations) ? p.recommendations : []).slice(0, 5).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      priority: (["high", "medium", "low"].includes(r.priority) ? r.priority : "medium") as "high" | "medium" | "low",
      text: safeStr(r.text),
      effect: safeStr(r.effect),
      category: safeStr(r.category),
    })
  );

  const VALID_INSIGHT_TYPES = ["niche", "action", "battle", "copy", "seo", "offer"];
  const insights: Insight[] = (Array.isArray(p.insights) ? p.insights : []).slice(0, 7).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ins: any) => ({
      type: (VALID_INSIGHT_TYPES.includes(ins.type) ? ins.type : "action") as Insight["type"],
      title: safeStr(ins.title),
      text: safeStr(ins.text),
    })
  );

  const paRaw = p.practicalAdvice ?? {};
  const copyImprovements: CopyImprovement[] = (Array.isArray(paRaw.copyImprovements) ? paRaw.copyImprovements : []).slice(0, 3).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ci: any) => ({
      element: safeStr(ci.element, "Элемент"),
      current: safeStr(ci.current, "—"),
      suggested: safeStr(ci.suggested, "—"),
      reason: safeStr(ci.reason, "—"),
    })
  );
  const keywordGaps: KeywordGap[] = [];
  const ofRaw = paRaw.offerAnalysis ?? {};
  const offerAnalysis = {
    currentOffer: safeStr(ofRaw.currentOffer, "—"),
    weaknesses: Array.isArray(ofRaw.weaknesses) ? ofRaw.weaknesses.slice(0, 3).map((w: unknown) => String(w)) : [],
    differentiators: Array.isArray(ofRaw.differentiators) ? ofRaw.differentiators.slice(0, 4).map((d: unknown) => String(d)) : [],
    suggestedOffer: safeStr(ofRaw.suggestedOffer, "—"),
  };
  const practicalAdvice: PracticalAdvice = {
    copyImprovements,
    keywordGaps,
    offerAnalysis,
    contentIdeas: Array.isArray(paRaw.contentIdeas) ? paRaw.contentIdeas.slice(0, 4).map((i: unknown) => String(i)) : [],
    seoActions: Array.isArray(paRaw.seoActions) ? paRaw.seoActions.slice(0, 4).map((i: unknown) => String(i)) : [],
  };

  const seoRaw = p.seo ?? {};
  const seo = {
    title: safeStr(seoRaw.title, data.name),
    metaDescription: safeStr(seoRaw.metaDescription, ""),
    keywords: Array.isArray(seoRaw.keywords) ? seoRaw.keywords.slice(0, 10).map((k: unknown) => String(k)) : [],
    pageCount: 0,
    domainAge: "—",
    estimatedTraffic: "—",
    positions: [],
    issues: Array.isArray(seoRaw.issues) ? seoRaw.issues.slice(0, 5).map((i: unknown) => String(i)) : [],
  };

  const nfRaw = p.nicheForecast ?? {};
  const nicheForecast = {
    trend: (["growing", "stable", "declining"].includes(nfRaw.trend) ? nfRaw.trend : "stable") as "growing" | "stable" | "declining",
    trendPercent: safeNum(nfRaw.trendPercent, 0),
    forecast: safeStr(nfRaw.forecast, "—"),
    opportunities: Array.isArray(nfRaw.opportunities) ? nfRaw.opportunities.slice(0, 3).map((o: unknown) => String(o)) : [],
    threats: Array.isArray(nfRaw.threats) ? nfRaw.threats.slice(0, 3).map((t: unknown) => String(t)) : [],
    direction: safeStr(nfRaw.direction, "—"),
    timeframe: safeStr(nfRaw.timeframe, "—"),
  };

  const apRaw = p.aiPerception ?? {};
  const eeatRaw = apRaw.eeat ?? {};
  const aiPerception: AiPerception = {
    knowledgePresence: (["strong", "moderate", "weak", "minimal"].includes(apRaw.knowledgePresence)
      ? apRaw.knowledgePresence : "weak") as AiPerception["knowledgePresence"],
    persona: safeStr(apRaw.persona, "—"),
    sampleAnswer: safeStr(apRaw.sampleAnswer, "—"),
    associatedKeywords: Array.isArray(apRaw.associatedKeywords) ? apRaw.associatedKeywords.slice(0, 5).map((k: unknown) => String(k)) : [],
    eeat: {
      expertise: clamp(safeNum(eeatRaw.expertise, 0)),
      authority: clamp(safeNum(eeatRaw.authority, 0)),
      trust: clamp(safeNum(eeatRaw.trust, 0)),
      experience: clamp(safeNum(eeatRaw.experience, 0)),
    },
    contentSignals: Array.isArray(apRaw.contentSignals) ? apRaw.contentSignals.slice(0, 3).map((s: unknown) => String(s)) : [],
    improvementTips: Array.isArray(apRaw.improvementTips) ? apRaw.improvementTips.slice(0, 4).map((t: unknown) => String(t)) : [],
  };

  return {
    company: {
      name: safeStr(p.companyName, data.name),
      url: personalDomain,
      score: overallScore,
      avgNiche: clamp(safeNum(p.avgNiche, 0)),
      top10: clamp(safeNum(p.top10, 0)),
      categories,
      description: safeStr(p.description, ""),
    },
    recommendations,
    insights,
    practicalAdvice,
    seo,
    techStack: { cms: "—", analytics: [], chat: "—", hosting: "—", other: [] },
    social: { vk: null, telegram: null, yandexRating: 0, yandexReviews: 0, gisRating: 0, gisReviews: 0 },
    hiring: { openVacancies: 0, avgSalary: "—", topRoles: [], trend: "stable", salaryRange: "—" },
    business: { employees: "—", revenue: "—", founded: "—", legalForm: "—" },
    nicheForecast,
    aiPerception,
    _usage: { inputTokens, outputTokens },
  };
}

// ─── Company Analysis ─────────────────────────────────────────────────────────

export async function analyzeWithClaude(data: ScrapedData, businessType?: BusinessType): Promise<AnalysisResult & { _usage?: { inputTokens: number; outputTokens: number } }> {
  const socialList = Object.keys(data.socialLinks);
  const altCoverage = data.imageCount > 0 ? Math.round((data.imagesWithAlt / data.imageCount) * 100) : 0;

  const businessTypeHint = buildBusinessTypePromptHint(businessType);

  const prompt = `${ANTI_HALLUCINATION_SHORT}

Ты эксперт по цифровому маркетингу, SEO и конкурентному анализу для российского рынка.
Проанализируй сайт по собранным данным и верни ТОЛЬКО валидный JSON без markdown и без пояснений.
Если данных не хватает — НЕ выдумывай, ставь null или «недостаточно данных» в соответствующих полях.
${businessTypeHint}

=== ДАННЫЕ САЙТА: ${data.url} ===
HTTPS: ${data.isHttps ? "да" : "нет"}
Title: ${data.title || "(нет)"}
Meta description: ${data.metaDescription || "(нет)"}
Meta keywords: ${data.metaKeywords || "(нет)"}
H1: ${data.h1.join(" | ") || "(нет)"}
H2 (первые 8): ${data.h2.join(" | ") || "(нет)"}
Изображения: ${data.imageCount} шт., alt у ${data.imagesWithAlt} (${altCoverage}%)
Schema.org: ${data.hasSchemaMarkup ? "есть" : "нет"} | Canonical: ${data.hasCanonical ? "есть" : "нет"}
Sitemap: ${data.hasSitemap ? "есть" : "нет"} | Robots.txt: ${data.hasRobotsTxt ? "есть" : "нет"}
Соцсети: ${socialList.length > 0 ? socialList.join(", ") : "нет"}
Вакансии: ${data.hasVacanciesLink ? "да" : "нет"} | Блог/кейсы: ${data.hasBlogOrCases ? "да" : "нет"}
Технологии: ${data.techStack.join(", ") || "нет"}
JS-heavy: ${data.jsHeavy ? "да" : "нет"}
Текст (фрагмент): ${data.rawTextSample || "(пусто)"}

=== ИНСТРУКЦИИ (СТРОГО: не выдумывай конкретику если нет источника) ===
- ВАЖНО: ты НЕ имеешь доступа к Keys.so / SimilarWeb / DaData. Любые конкретные SEO-позиции, объёмы поиска, число сотрудников, оборот, число клиентов, рейтинги Я.К/2GIS — выдумывать ЗАПРЕЩЕНО.
- Для SEO: верни ПУСТОЙ массив positions: []. Реальные позиции подтягиваются из Keys.so на сервере. Если данных нет — лучше пусто, чем выдуманно.
- Для соцсетей: возвращай null для подписчиков/постов. Реальные цифры подтягиваются getRealVKStats / getRealTelegramStats на сервере.
- Для бизнеса (employees, founded, taxRegime): ВСЕГДА верни строку «—». Реальные данные тянутся из DaData на сервере, твои догадки будут перезаписаны.
- Для найма: vacancies верни 0, salaryAvg верни 0 если не уверен. HH.ru-data подтягивается отдельно.
- Для прогноза ниши — общая качественная оценка («рост умеренный», «зрелый рынок») БЕЗ конкретных процентов.
- Для copyImprovements: анализируй РЕАЛЬНЫЙ текст сайта (title, h1, h2, фрагмент) и давай конкретные переформулировки. Если текста сайта мало — верни пустой массив, не выдумывай.
- Для keywordGaps: верни пустой массив. Реальные ключи берутся из Keys.so/SpyWords конкурентов.
- Для offerAnalysis: опиши то что РЕАЛЬНО видишь на сайте; не выдумывай несуществующие услуги.
- Для aiPerception: качественная оценка с явными гипотезами («скорее всего», «вероятно»). E-E-A-T-баллы — диапазоны (low/medium/high), не конкретные числа.
- Все текстовые поля — на русском.

=== ТРЕБУЕМЫЙ JSON (строго такая структура) ===
{
  "companyName": "string",
  "description": "string (2-3 предложения о компании)",
  "scores": { "seo": 0-100, "social": 0-100, "content": 0-100, "hrBrand": 0-100, "technology": 0-100 },
  "avgNiche": 0-100,
  "top10": 0-100,
  "recommendations": [
    { "priority": "high|medium|low", "text": "string", "effect": "string", "category": "string" }
  ],
  "insights": [
    { "type": "niche|action|battle|copy|seo|offer", "title": "string", "text": "string" }
  ],
  "practicalAdvice": {
    "copyImprovements": [
      {
        "element": "string (например: H1, Meta Description, Заголовок услуги, CTA-кнопка, Блок About)",
        "current": "string (текущий текст или описание проблемы)",
        "suggested": "string (конкретный новый вариант текста — готовый к использованию)",
        "reason": "string (почему это важно для SEO и конверсии)"
      }
    ],
    "keywordGaps": [
      { "keyword": "string", "volume": 0, "difficulty": "low|medium|high", "opportunity": "string (почему стоит продвигаться)" }
    ],
    "offerAnalysis": {
      "currentOffer": "string (как звучит оффер сейчас — по тексту сайта)",
      "weaknesses": ["string", "string"],
      "differentiators": ["string", "string", "string"],
      "suggestedOffer": "string (готовое переформулированное УТП, 1-2 предложения)"
    },
    "contentIdeas": ["string", "string", "string", "string"],
    "seoActions": ["string", "string", "string", "string"]
  },
  "seo": {
    "title": "string",
    "metaDescription": "string",
    "keywords": ["string", "string", "string"],
    "pageCount": 0,
    "domainAge": "string (например: 5 лет)",
    "estimatedTraffic": "string (например: 2 000–8 000 визитов/мес)",
    "positions": [],
    "issues": ["string", "string", "string"]
  },
  "techStack": {
    "cms": "string (WordPress/Bitrix/Tilda/1C-Bitrix/Custom/Unknown)",
    "analytics": ["string"],
    "chat": "string (JivoSite/Bitrix24/None/Unknown)",
    "hosting": "string",
    "other": ["string"]
  },
  "social": {
    "vk": { "subscribers": 0, "posts30d": 0, "engagement": "string", "trend": "growing|stable|declining" },
    "telegram": { "subscribers": 0, "posts30d": 0 },
    "yandexRating": 0.0,
    "yandexReviews": 0,
    "gisRating": 0.0,
    "gisReviews": 0
  },
  "hiring": {
    "openVacancies": 0,
    "avgSalary": "string",
    "topRoles": ["string", "string"],
    "trend": "growing|stable|declining",
    "salaryRange": "string"
  },
  "business": {
    "employees": "ВСЕГДА '—'. Эти данные подтягиваются из DaData (ФНС), AI выдумывать не должен.",
    "revenue": "ВСЕГДА '—'. Подтягивается из DaData/Rusprofile, не выдумывай.",
    "founded": "ВСЕГДА '—'. Берётся из DaData (дата регистрации в ФНС).",
    "legalForm": "ВСЕГДА '—'. Берётся из DaData (ОПФ)."
  },
  "nicheForecast": {
    "trend": "growing|stable|declining",
    "trendPercent": 0,
    "forecast": "string (3-4 предложения о перспективах ниши)",
    "opportunities": ["string", "string", "string"],
    "threats": ["string", "string", "string"],
    "direction": "string (1-2 предложения куда движется рынок)",
    "timeframe": "string (например: 2025–2027)"
  },
  "aiPerception": {
    "knowledgePresence": "strong|moderate|weak|minimal",
    "persona": "string (1 предложение — каким видят компанию нейросети: 'Региональный производитель металлоконструкций среднего размера без выраженного цифрового присутствия')",
    "sampleAnswer": "string (3-5 предложений — симуляция того, что ответит ChatGPT/Claude на вопрос 'Что такое [компания]?' — реалистично, на основе доступных данных)",
    "associatedKeywords": ["string", "string", "string", "string", "string"],
    "eeat": { "expertise": 0-100, "authority": 0-100, "trust": 0-100, "experience": 0-100 },
    "contentSignals": ["string (сигнал, который формирует мнение нейросети)", "string", "string"],
    "improvementTips": ["string (конкретный совет по улучшению AI-видимости)", "string", "string", "string"]
  }
}

Важно:
- ровно 5 рекомендаций (2 high, 2 medium, 1 low)
- ровно 7 инсайтов: 1 niche, 2 action, 1 battle, 1 copy, 1 seo, 1 offer
- seo.positions ВСЕГДА пустой массив []. Реальные позиции по ключевым словам подтягиваются на сервере из Keys.so/SpyWords. Любые сгенерированные тобой позиции/объёмы будут перезаписаны или отфильтрованы как «нулевые». НЕ заполняй positions.
- ровно 3 copyImprovements (H1/title, meta description, и ещё один элемент страницы)
- ровно 4 keywordGaps — реальные незанятые запросы в нише
- ровно 4 contentIdeas и 4 seoActions
- ровно 3 contentSignals и 4 improvementTips в aiPerception
- ровно 5 associatedKeywords в aiPerception
- Если VK не найден — vk должен быть null (не объект). Если Telegram не найден — telegram должен быть null.`;

  // Use streaming so Cloudflare Worker sees the first byte within ~2s (avoiding the 30s subrequest timeout)
  const streamResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    // 16000 — комфортный запас. На сложных нишах (металл, B2B, длинные
    // описания категорий) 10000 обрывало JSON и extractJson падал даже на
    // partial-парсинге. Sonnet 4.6 поддерживает до 64K output, не лимит.
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let responseText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const event of streamResponse) {
    if (event.type === "message_start") {
      inputTokens = event.message.usage?.input_tokens ?? 0;
    } else if (event.type === "message_delta") {
      outputTokens = event.usage?.output_tokens ?? 0;
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      responseText += event.delta.text;
    }
  }
  if (!responseText) throw new Error("Empty response from AI model");
  const p = extractJson(responseText);

  // Раньше тут были fallback'ы с правдоподобными числами (seo: 50, social: 30
   // и т.п.) — это означало что при пустом/мусорном ответе AI пользователь
   // видел «оценка SEO 50/100» как реальную оценку. Теперь 0 — явный признак
   // «оценка не получена», UI это рендерит как «—».
  const scores = {
    seo: clamp(safeNum(p.scores?.seo, 0)),
    social: clamp(safeNum(p.scores?.social, 0)),
    content: clamp(safeNum(p.scores?.content, 0)),
    hrBrand: clamp(safeNum(p.scores?.hrBrand, 0)),
    technology: clamp(safeNum(p.scores?.technology, 0)),
  };

  const overallScore = clamp(
    scores.seo * 0.25 + scores.social * 0.25 + scores.content * 0.2 + scores.hrBrand * 0.15 + scores.technology * 0.15
  );

  const categories: CategoryScore[] = [
    { name: "SEO", weight: 25, score: scores.seo, icon: "🔍", delta: 0 },
    { name: "Соцсети", weight: 25, score: scores.social, icon: "📱", delta: 0 },
    { name: "Контент", weight: 20, score: scores.content, icon: "✏️", delta: 0 },
    { name: "HR-бренд", weight: 15, score: scores.hrBrand, icon: "👥", delta: 0 },
    { name: "Технологии", weight: 15, score: scores.technology, icon: "⚙️", delta: 0 },
  ];

  const domain = new URL(data.url).hostname.replace(/^www\./, "");
  const companyName = safeStr(p.companyName, domain);

  const recommendations: Recommendation[] = (Array.isArray(p.recommendations) ? p.recommendations : []).slice(0, 5).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      priority: (["high", "medium", "low"].includes(r.priority) ? r.priority : "medium") as "high" | "medium" | "low",
      text: safeStr(r.text),
      effect: safeStr(r.effect),
      category: safeStr(r.category),
    })
  );

  const VALID_INSIGHT_TYPES = ["niche", "action", "battle", "copy", "seo", "offer"];
  const insights: Insight[] = (Array.isArray(p.insights) ? p.insights : []).slice(0, 7).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ins: any) => ({
      type: (VALID_INSIGHT_TYPES.includes(ins.type) ? ins.type : "action") as Insight["type"],
      title: safeStr(ins.title),
      text: safeStr(ins.text),
    })
  );

  // Practical advice
  const paRaw = p.practicalAdvice ?? {};

  const copyImprovements: CopyImprovement[] = (Array.isArray(paRaw.copyImprovements) ? paRaw.copyImprovements : []).slice(0, 3).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ci: any) => ({
      element: safeStr(ci.element, "Элемент страницы"),
      current: safeStr(ci.current, "—"),
      suggested: safeStr(ci.suggested, "—"),
      reason: safeStr(ci.reason, "—"),
    })
  );

  const keywordGaps: KeywordGap[] = (Array.isArray(paRaw.keywordGaps) ? paRaw.keywordGaps : []).slice(0, 4).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (kg: any) => ({
      keyword: safeStr(kg.keyword, "—"),
      volume: safeNum(kg.volume, 0),
      difficulty: (["low", "medium", "high"].includes(kg.difficulty) ? kg.difficulty : "medium") as "low" | "medium" | "high",
      opportunity: safeStr(kg.opportunity, "—"),
    })
  );

  const ofRaw = paRaw.offerAnalysis ?? {};
  const offerAnalysis = {
    currentOffer: safeStr(ofRaw.currentOffer, "—"),
    weaknesses: Array.isArray(ofRaw.weaknesses) ? ofRaw.weaknesses.slice(0, 3).map((w: unknown) => String(w)) : [],
    differentiators: Array.isArray(ofRaw.differentiators) ? ofRaw.differentiators.slice(0, 4).map((d: unknown) => String(d)) : [],
    suggestedOffer: safeStr(ofRaw.suggestedOffer, "—"),
  };

  const practicalAdvice: PracticalAdvice = {
    copyImprovements,
    keywordGaps,
    offerAnalysis,
    contentIdeas: Array.isArray(paRaw.contentIdeas) ? paRaw.contentIdeas.slice(0, 4).map((i: unknown) => String(i)) : [],
    seoActions: Array.isArray(paRaw.seoActions) ? paRaw.seoActions.slice(0, 4).map((i: unknown) => String(i)) : [],
  };

  // SEO block
  const seoRaw = p.seo ?? {};
  const seo = {
    title: safeStr(seoRaw.title, data.title),
    metaDescription: safeStr(seoRaw.metaDescription, data.metaDescription),
    keywords: Array.isArray(seoRaw.keywords) ? seoRaw.keywords.slice(0, 10).map((k: unknown) => String(k)) : [],
    pageCount: safeNum(seoRaw.pageCount, 0),
    domainAge: safeStr(seoRaw.domainAge, "—"),
    estimatedTraffic: safeStr(seoRaw.estimatedTraffic, "—"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    positions: Array.isArray(seoRaw.positions)
      ? seoRaw.positions
          .slice(0, 50)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((pos: any) => ({
            keyword: safeStr(pos.keyword, ""),
            position: safeNum(pos.position, 0),
            volume: safeNum(pos.volume, 0),
          }))
          // Жёсткий анти-выдумки фильтр: убираем строки с position=0 или volume=0
          // (это признак того что AI всё-таки заполнил массив, нарушив инструкцию).
          // Реальные позиции/объёмы подтянет Keys.so отдельно через site-insights.
          // position=0 — признак AI-выдумки. volume=0 НЕ фильтруем:
          // Keys.so для нишевых сайтов реально возвращает позиции без частотности.
          .filter((p: { keyword: string; position: number; volume: number }) => p.keyword && p.position > 0)
      : [],
    issues: Array.isArray(seoRaw.issues) ? seoRaw.issues.slice(0, 5).map((i: unknown) => String(i)) : [],
  };

  // Tech stack
  const tsRaw = p.techStack ?? {};
  const techStack = {
    cms: safeStr(tsRaw.cms, "Unknown"),
    analytics: Array.isArray(tsRaw.analytics) ? tsRaw.analytics.map((a: unknown) => String(a)) : [],
    chat: safeStr(tsRaw.chat, "Unknown"),
    hosting: safeStr(tsRaw.hosting, "—"),
    other: Array.isArray(tsRaw.other) ? tsRaw.other.map((o: unknown) => String(o)) : [],
  };

  // Social
  const socRaw = p.social ?? {};
  const hasVk = socialList.some(s => s.toLowerCase().includes("vk"));
  const hasTg = socialList.some(s => s.toLowerCase().includes("telegram") || s.toLowerCase().includes("tg"));

  const social = {
    vk: (hasVk && socRaw.vk && typeof socRaw.vk === "object") ? {
      subscribers: safeNum(socRaw.vk.subscribers, 0),
      posts30d: safeNum(socRaw.vk.posts30d, 0),
      engagement: safeStr(socRaw.vk.engagement, "—"),
      trend: ["growing", "stable", "declining"].includes(socRaw.vk.trend) ? socRaw.vk.trend : "stable",
    } : null,
    telegram: (hasTg && socRaw.telegram && typeof socRaw.telegram === "object") ? {
      subscribers: safeNum(socRaw.telegram.subscribers, 0),
      posts30d: safeNum(socRaw.telegram.posts30d, 0),
    } : null,
    yandexRating: Math.min(5, Math.max(0, safeNum(socRaw.yandexRating, 0))),
    yandexReviews: safeNum(socRaw.yandexReviews, 0),
    gisRating: Math.min(5, Math.max(0, safeNum(socRaw.gisRating, 0))),
    gisReviews: safeNum(socRaw.gisReviews, 0),
  };

  // Hiring
  const hrRaw = p.hiring ?? {};
  const hiring = {
    openVacancies: safeNum(hrRaw.openVacancies, 0),
    avgSalary: safeStr(hrRaw.avgSalary, "—"),
    topRoles: Array.isArray(hrRaw.topRoles) ? hrRaw.topRoles.slice(0, 5).map((r: unknown) => String(r)) : [],
    trend: (["growing", "stable", "declining"].includes(hrRaw.trend) ? hrRaw.trend : "stable") as "growing" | "stable" | "declining",
    salaryRange: safeStr(hrRaw.salaryRange, "—"),
  };

  // Business
  const bizRaw = p.business ?? {};
  const business = {
    employees: safeStr(bizRaw.employees, "—"),
    revenue: safeStr(bizRaw.revenue, "—"),
    founded: safeStr(bizRaw.founded, "—"),
    legalForm: safeStr(bizRaw.legalForm, "Неизвестно"),
  };

  // Niche forecast — fallback'и убраны (раньше trendPercent: 5, timeframe: "2025-2027"
  // подставлялись даже если AI вернул мусор, и пользователь видел «правдоподобный»
  // выдуманный прогноз). Теперь нулевые/«—» значения = «недостаточно данных».
  const nfRaw = p.nicheForecast ?? {};
  const nicheForecast = {
    trend: (["growing", "stable", "declining"].includes(nfRaw.trend) ? nfRaw.trend : "stable") as "growing" | "stable" | "declining",
    trendPercent: safeNum(nfRaw.trendPercent, 0),
    forecast: safeStr(nfRaw.forecast, "—"),
    opportunities: Array.isArray(nfRaw.opportunities) ? nfRaw.opportunities.slice(0, 3).map((o: unknown) => String(o)) : [],
    threats: Array.isArray(nfRaw.threats) ? nfRaw.threats.slice(0, 3).map((t: unknown) => String(t)) : [],
    direction: safeStr(nfRaw.direction, "—"),
    timeframe: safeStr(nfRaw.timeframe, "—"),
  };

  // AI Perception
  const apRaw = p.aiPerception ?? {};
  const eeatRaw = apRaw.eeat ?? {};
  const aiPerception: AiPerception = {
    knowledgePresence: (["strong", "moderate", "weak", "minimal"].includes(apRaw.knowledgePresence)
      ? apRaw.knowledgePresence : "weak") as AiPerception["knowledgePresence"],
    persona: safeStr(apRaw.persona, "—"),
    sampleAnswer: safeStr(apRaw.sampleAnswer, "—"),
    associatedKeywords: Array.isArray(apRaw.associatedKeywords)
      ? apRaw.associatedKeywords.slice(0, 5).map((k: unknown) => String(k)) : [],
    eeat: {
      // Fallback на 0 (не правдоподобные 40/30/40/35). 0 = «оценка не получена».
      expertise: clamp(safeNum(eeatRaw.expertise, 0)),
      authority: clamp(safeNum(eeatRaw.authority, 0)),
      trust: clamp(safeNum(eeatRaw.trust, 0)),
      experience: clamp(safeNum(eeatRaw.experience, 0)),
    },
    contentSignals: Array.isArray(apRaw.contentSignals)
      ? apRaw.contentSignals.slice(0, 3).map((s: unknown) => String(s)) : [],
    improvementTips: Array.isArray(apRaw.improvementTips)
      ? apRaw.improvementTips.slice(0, 4).map((t: unknown) => String(t)) : [],
  };

  return {
    company: {
      name: companyName,
      url: domain,
      score: overallScore,
      // avgNiche / top10 — раньше 50/80 псевдо-числа. Теперь 0 если AI промолчал
      // (UI рендерит как «—»). Реальные отраслевые медианы должны приходить
      // из niche-benchmark с пометкой «оценка».
      avgNiche: clamp(safeNum(p.avgNiche, 0)),
      top10: clamp(safeNum(p.top10, 0)),
      categories,
      description: safeStr(p.description, ""),
    },
    recommendations,
    insights,
    practicalAdvice,
    seo,
    techStack,
    social,
    hiring,
    business,
    nicheForecast,
    aiPerception,
    _usage: { inputTokens, outputTokens },
  };
}
