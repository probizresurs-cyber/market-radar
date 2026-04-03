import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedData, AnalysisResult, CategoryScore, Recommendation, Insight } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in Claude response");
  const jsonStr = stripped.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    const lastComma = jsonStr.lastIndexOf("},");
    if (lastComma > 0) {
      try { return JSON.parse(jsonStr.slice(0, lastComma + 1) + "]}]}"); } catch { /* fall through */ }
    }
    throw new Error("Failed to parse Claude JSON response");
  }
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
    { "type": "niche|action|battle", "title": "string", "text": "string" }
  ],
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
  }
}

Важно: ровно 5 рекомендаций (2 high, 2 medium, 1 low), ровно 3 инсайта, ровно 6 позиций в seo.positions.
Если VK не найден — vk должен быть null (не объект). Если Telegram не найден — telegram должен быть null.`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 5000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
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

  const insights: Insight[] = (Array.isArray(p.insights) ? p.insights : []).slice(0, 3).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ins: any) => ({
      type: (["niche", "action", "battle"].includes(ins.type) ? ins.type : "action") as "niche" | "action" | "battle",
      title: safeStr(ins.title),
      text: safeStr(ins.text),
    })
  );

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
    positions: Array.isArray(seoRaw.positions) ? seoRaw.positions.slice(0, 6).map((pos: any) => ({
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
    seo,
    techStack,
    social,
    hiring,
    business,
    nicheForecast,
  };
}
