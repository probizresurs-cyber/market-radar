import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedData, AnalysisResult, CategoryScore, Recommendation, Insight } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ClaudeResponse {
  companyName: string;
  scores: {
    seo: number;
    social: number;
    content: number;
    hrBrand: number;
    technology: number;
  };
  avgNiche: number;
  top10: number;
  recommendations: Recommendation[];
  insights: Insight[];
}

function extractJson(text: string): ClaudeResponse {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in Claude response");
  return JSON.parse(text.slice(start, end + 1));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function analyzeWithClaude(data: ScrapedData): Promise<AnalysisResult> {
  const socialList = Object.keys(data.socialLinks);
  const altCoverage =
    data.imageCount > 0 ? Math.round((data.imagesWithAlt / data.imageCount) * 100) : 0;

  const prompt = `Ты эксперт по цифровому маркетингу и конкурентному анализу для российского рынка.
Проанализируй сайт по собранным данным и верни ТОЛЬКО валидный JSON (без markdown, без \`\`\`).

=== ДАННЫЕ САЙТА: ${data.url} ===
HTTPS: ${data.isHttps ? "да" : "нет"}
Заголовок страницы: ${data.title || "(отсутствует)"}
Meta description: ${data.metaDescription || "(отсутствует)"}
Meta keywords: ${data.metaKeywords || "(отсутствуют)"}
H1: ${data.h1.length > 0 ? data.h1.join(" | ") : "(отсутствует)"}
H2 (первые 8): ${data.h2.length > 0 ? data.h2.join(" | ") : "(отсутствуют)"}
Изображения: ${data.imageCount} шт., alt у ${data.imagesWithAlt} из них (${altCoverage}%)
Canonical: ${data.hasCanonical ? "есть" : "нет"}
Viewport meta: ${data.hasViewport ? "есть" : "нет"}
Schema.org разметка: ${data.hasSchemaMarkup ? "есть" : "нет"}
Robots.txt: ${data.hasRobotsTxt ? "есть" : "нет"}
Sitemap.xml: ${data.hasSitemap ? "есть" : "нет"}
Соцсети: ${socialList.length > 0 ? socialList.join(", ") : "не найдено ни одной"}
Ссылки на вакансии: ${data.hasVacanciesLink ? "есть" : "нет"}
Блог/кейсы/портфолио: ${data.hasBlogOrCases ? "есть" : "нет"}
Технологии: ${data.techStack.length > 0 ? data.techStack.join(", ") : "не определено"}
JS-heavy (мало текста в HTML): ${data.jsHeavy ? "да — сайт может рендериться на клиенте" : "нет"}
Текст страницы (фрагмент): ${data.rawTextSample || "(пусто)"}

=== ПРАВИЛА ОЦЕНКИ (0–100) ===
SEO: HTTPS (+15), title (+10), meta description (+15), h1 (+10), canonical (+5), sitemap (+10), robots.txt (+5), alt coverage ≥ 80% (+15), schema markup (+10), viewport (+5). Вычитай за отсутствие.
Соцсети: VK (+30), Telegram (+25), Instagram (+15), YouTube (+15), OK (+10), Facebook/Twitter (+5). Максимум 100.
Контент: качество h2-структуры (+20), наличие оффера в тексте (+20), блог/кейсы (+20), объём полезного текста (+20), meta description читаем (+20).
HR-бренд: страница вакансий (+40), упоминания команды/культуры в тексте (+30), отзывы сотрудников (+30).
Технологии: современный стек React/Vue/Next (+20), аналитика Метрика/GA (+20), GTM (+15), schema (+15), HTTPS (+15), viewport (+15).

=== ТРЕБУЕМЫЙ JSON ===
{
  "companyName": "<название из title или домен>",
  "scores": {
    "seo": <целое 0-100>,
    "social": <целое 0-100>,
    "content": <целое 0-100>,
    "hrBrand": <целое 0-100>,
    "technology": <целое 0-100>
  },
  "avgNiche": <целое 0-100, средний score конкурентов в этой нише>,
  "top10": <целое 0-100, порог для топ-10% в этой нише>,
  "recommendations": [
    { "priority": "high", "text": "<конкретная рекомендация на русском>", "effect": "<Категория +X%>", "category": "<SEO|Соцсети|Контент|HR-бренд|Технологии>" },
    { "priority": "high", "text": "...", "effect": "...", "category": "..." },
    { "priority": "medium", "text": "...", "effect": "...", "category": "..." },
    { "priority": "medium", "text": "...", "effect": "...", "category": "..." },
    { "priority": "low", "text": "...", "effect": "...", "category": "..." }
  ],
  "insights": [
    { "type": "niche", "title": "<заголовок>", "text": "<2-3 предложения о незанятой нише или возможности>" },
    { "type": "action", "title": "<заголовок>", "text": "<2-3 предложения о самом важном действии>" },
    { "type": "battle", "title": "<заголовок>", "text": "<2-3 предложения об отличиях от типичных конкурентов в нише>" }
  ]
}

Рекомендации должны быть КОНКРЕТНЫМИ — ссылаться на реальные данные сайта.
Ровно 5 рекомендаций (2 high, 2 medium, 1 low) и ровно 3 инсайта.`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const parsed = extractJson(responseText);

  const scores = {
    seo: clamp(parsed.scores.seo),
    social: clamp(parsed.scores.social),
    content: clamp(parsed.scores.content),
    hrBrand: clamp(parsed.scores.hrBrand),
    technology: clamp(parsed.scores.technology),
  };

  const overallScore = clamp(
    scores.seo * 0.25 +
      scores.social * 0.25 +
      scores.content * 0.2 +
      scores.hrBrand * 0.15 +
      scores.technology * 0.15
  );

  const categories: CategoryScore[] = [
    { name: "SEO", weight: 25, score: scores.seo, icon: "🔍", delta: 0 },
    { name: "Соцсети", weight: 25, score: scores.social, icon: "📱", delta: 0 },
    { name: "Контент", weight: 20, score: scores.content, icon: "✏️", delta: 0 },
    { name: "HR-бренд", weight: 15, score: scores.hrBrand, icon: "👥", delta: 0 },
    { name: "Технологии", weight: 15, score: scores.technology, icon: "⚙️", delta: 0 },
  ];

  // Derive company name from title or domain
  const rawName = parsed.companyName?.trim() || "";
  const domain = new URL(data.url).hostname.replace(/^www\./, "");
  const companyName = rawName.length > 0 ? rawName : domain;

  const recommendations: Recommendation[] = (parsed.recommendations ?? []).slice(0, 5).map(
    (r) => ({
      priority: (["high", "medium", "low"].includes(r.priority) ? r.priority : "medium") as
        | "high"
        | "medium"
        | "low",
      text: r.text ?? "",
      effect: r.effect ?? "",
      category: r.category ?? "",
    })
  );

  const insights: Insight[] = (parsed.insights ?? []).slice(0, 3).map((ins) => ({
    type: (["niche", "action", "battle"].includes(ins.type) ? ins.type : "action") as
      | "niche"
      | "action"
      | "battle",
    title: ins.title ?? "",
    text: ins.text ?? "",
  }));

  return {
    company: {
      name: companyName,
      url: domain,
      score: overallScore,
      avgNiche: clamp(parsed.avgNiche ?? 50),
      top10: clamp(parsed.top10 ?? 80),
      categories,
    },
    recommendations,
    insights,
  };
}
