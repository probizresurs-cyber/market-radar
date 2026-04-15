import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedData, AnalysisResult, CategoryScore, Recommendation, Insight, CopyImprovement, KeywordGap, PracticalAdvice, AiPerception } from "./types";

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

  // Response was truncated — try to close it by finding the last complete field
  const partial = stripped.slice(start);
  // Walk from end to find last valid closing brace sequence
  for (let i = partial.length - 1; i > 0; i--) {
    if (partial[i] === "}") {
      try { return JSON.parse(partial.slice(0, i + 1)); } catch { /* continue */ }
    }
  }

  throw new Error("Failed to parse AI response as JSON");
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

export async function analyzeWithClaude(data: ScrapedData): Promise<AnalysisResult> {
  const socialList = Object.keys(data.socialLinks);
  const altCoverage = data.imageCount > 0 ? Math.round((data.imagesWithAlt / data.imageCount) * 100) : 0;

  const prompt = `Ты эксперт по цифровому маркетингу, SEO и конкурентному анализу для российского рынка.
Проанализируй сайт по собранным данным и верни ТОЛЬКО валидный JSON без markdown и без пояснений.
Если данных не хватает — делай обоснованные экспертные оценки по типу и нише бизнеса.

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

=== ИНСТРУКЦИИ ===
- Для SEO-позиций: придумай 6 реалистичных ключевых слов для этого сайта с реальными позициями (1-100) и объёмом поиска.
- Для соцсетей: если ссылка есть в списке — дай реалистичные цифры, иначе null.
- Для найма, бизнеса — оцени по типу компании и нише.
- Для прогноза — анализируй рыночные тренды именно в нише этого сайта.
- Для copyImprovements: анализируй реальный текст сайта (title, h1, h2, фрагмент текста) и давай КОНКРЕТНЫЕ переформулировки с примерами.
- Для keywordGaps: давай ключевые слова, которые конкуренты в нише используют, а этот сайт — нет. Реалистичные объёмы.
- Для offerAnalysis: опиши текущий оффер как он есть, найди слабые места, предложи конкретную переформулировку УТП.
- Для aiPerception: представь, что ты ChatGPT/Claude/Gemini, и пользователь спрашивает тебя об этой компании. Как ты ответишь? Что знаешь о ней? Насколько хорошо она представлена в информационном пространстве, которое используют LLM для обучения? E-E-A-T — это Google-стандарт оценки контента (Expertise, Experience, Authority, Trust), оцени по нему.
- Все текстовые поля — на русском языке.

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
    "positions": [
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 },
      { "keyword": "string", "position": 0, "volume": 0 }
    ],
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
    "employees": "string (например: 20–50)",
    "revenue": "string (например: 50–200 млн ₽/год)",
    "founded": "string (например: ~2015)",
    "legalForm": "string (ООО/ИП/АО/Неизвестно)"
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
- ровно 50 позиций в seo.positions (реалистичные ключевые слова для ниши компании, разные позиции от 1 до 100)
- ровно 3 copyImprovements (H1/title, meta description, и ещё один элемент страницы)
- ровно 4 keywordGaps — реальные незанятые запросы в нише
- ровно 4 contentIdeas и 4 seoActions
- ровно 3 contentSignals и 4 improvementTips в aiPerception
- ровно 5 associatedKeywords в aiPerception
- Если VK не найден — vk должен быть null (не объект). Если Telegram не найден — telegram должен быть null.`;

  // Use streaming so Cloudflare Worker sees the first byte within ~2s (avoiding the 30s subrequest timeout)
  const streamResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 10000,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let responseText = "";
  for await (const event of streamResponse) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      responseText += event.delta.text;
    }
  }
  if (!responseText) throw new Error("Empty response from AI model");
  const p = extractJson(responseText);

  const scores = {
    seo: clamp(safeNum(p.scores?.seo, 50)),
    social: clamp(safeNum(p.scores?.social, 30)),
    content: clamp(safeNum(p.scores?.content, 50)),
    hrBrand: clamp(safeNum(p.scores?.hrBrand, 40)),
    technology: clamp(safeNum(p.scores?.technology, 50)),
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
    positions: Array.isArray(seoRaw.positions) ? seoRaw.positions.slice(0, 50).map((pos: any) => ({
      keyword: safeStr(pos.keyword, "—"),
      position: safeNum(pos.position, 50),
      volume: safeNum(pos.volume, 0),
    })) : [],
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

  // Niche forecast
  const nfRaw = p.nicheForecast ?? {};
  const nicheForecast = {
    trend: (["growing", "stable", "declining"].includes(nfRaw.trend) ? nfRaw.trend : "stable") as "growing" | "stable" | "declining",
    trendPercent: safeNum(nfRaw.trendPercent, 5),
    forecast: safeStr(nfRaw.forecast, "Данные по прогнозу ниши отсутствуют."),
    opportunities: Array.isArray(nfRaw.opportunities) ? nfRaw.opportunities.slice(0, 3).map((o: unknown) => String(o)) : [],
    threats: Array.isArray(nfRaw.threats) ? nfRaw.threats.slice(0, 3).map((t: unknown) => String(t)) : [],
    direction: safeStr(nfRaw.direction, "—"),
    timeframe: safeStr(nfRaw.timeframe, "2025–2027"),
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
      expertise: clamp(safeNum(eeatRaw.expertise, 40)),
      authority: clamp(safeNum(eeatRaw.authority, 30)),
      trust: clamp(safeNum(eeatRaw.trust, 40)),
      experience: clamp(safeNum(eeatRaw.experience, 35)),
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
      avgNiche: clamp(safeNum(p.avgNiche, 50)),
      top10: clamp(safeNum(p.top10, 80)),
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
  };
}
