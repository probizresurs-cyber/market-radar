/**
 * SWOT-анализ через Claude.
 *
 * Адаптация n8n-workflow «SWOT Analysis with OpenAI + APITemplate PDF»
 * под нашу инфру:
 *   1) extractSwotItems  — Claude Haiku вытаскивает короткие S/W/O/T-фразы
 *      из контекста компании (имя, ниша, описание, конкуренты, угрозы и т.п.)
 *   2) writeSection      — Claude Sonnet пишет полноценный аналитический
 *      нарратив на одну категорию (5-7 параграфов с подзаголовками)
 *   3) generateSwotReport — оркестратор: parallel-вызывает 4 секции,
 *      потом пишет intro и conclusion. Возвращает SwotReport.
 *
 * Вывод можно отрендерить через `buildSwotReportHTML` (см. swot-html.ts)
 * и скачать как PDF через `htmlToPdfA4`.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "./types";
import type { TAResult } from "./ta-types";
import type { SMMResult } from "./smm-types";

export interface SwotItems {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface SwotSection {
  title: string;        // заголовок раздела ("Сильные стороны")
  intro: string;        // 1-2 параграфа introduction
  subsections: Array<{
    title: string;      // тема ("Технологическое преимущество")
    paragraphs: string[];
  }>;
  synthesis: string;    // финальный синтез-параграф
}

export interface SwotReport {
  id: string;
  companyName: string;
  generatedAt: string;
  introduction: string;       // exec intro (4-6 параграфов)
  strengths: SwotSection;
  weaknesses: SwotSection;
  opportunities: SwotSection;
  threats: SwotSection;
  conclusion: string;         // 2-3 параграфа стратегического вывода
  rawItems: SwotItems;        // исходный extract — чтобы можно было редактировать
}

// ─── Anthropic client (re-used across helpers) ───────────────────────────────
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");
  return new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  });
}

function jsonText(content: Anthropic.Messages.ContentBlock[]): string {
  const block = content[0];
  if (block?.type === "text") return block.text.trim();
  return "";
}

function extractJson<T>(text: string): T | null {
  // Часто Claude оборачивает JSON в ```json блоки — убираем и парсим.
  const cleaned = text.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch { /* fallthrough */ }
  // Попытка вытащить первый JSON-объект из сырого текста
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

// ─── Step 1: Extract S/W/O/T items ───────────────────────────────────────────

export interface CompanyContext {
  companyName: string;
  industry: string;
  region?: string;
  uniqueValue?: string;
  overview?: string;
  customerBase?: string;
  resources?: string;
  financials?: string;
  teamExpertise?: string;
  knownWeaknesses?: string;
  customerFeedback?: string;
  marketTrends?: string;
  competitors?: string;
  legalEnv?: string;
  techDevelopments?: string;
  potentialThreats?: string;
  shortTermGoals?: string;
  longTermGoals?: string;
}

/** Собирает CompanyContext из существующих анализов платформы. */
export function buildContextFromAnalyses(
  company: AnalysisResult,
  competitors: AnalysisResult[],
  ta: TAResult | null,
  smm: SMMResult | null,
): CompanyContext {
  const niche = company.company.niche ?? "";
  return {
    companyName: company.company.name,
    industry: niche,
    region: "Россия",
    uniqueValue: smm?.brandIdentity?.uniqueValue ?? "",
    overview: company.company.description ?? "",
    customerBase: ta?.summary ?? "",
    resources: company.business?.employees ? `Сотрудники: ${company.business.employees}` : "",
    financials: company.business?.revenue ?? "",
    teamExpertise: company.hiring?.topRoles?.slice(0, 5).join(", ") ?? "",
    knownWeaknesses: (company.recommendations ?? [])
      .slice(0, 5).map(r => r.text).join("; "),
    customerFeedback: company.social?.yandexRating
      ? `Yandex Maps: ${company.social.yandexRating}/5 (${company.social.yandexReviews} отзывов). 2GIS: ${company.social.gisRating}/5 (${company.social.gisReviews} отзывов).`
      : "",
    marketTrends: company.nicheForecast?.forecast ?? "",
    competitors: competitors.slice(0, 5)
      .map(c => `${c.company.name} (балл ${c.company.score})`).join(", "),
    legalEnv: company.business?.courtCases
      ? `${company.business.courtCases} открытых судебных дел`
      : "",
    techDevelopments: (company.techStack?.other ?? []).slice(0, 5).join(", "),
    potentialThreats: (company.nicheForecast?.threats ?? []).join("; "),
    shortTermGoals: "Усилить присутствие на ключевых платформах",
    longTermGoals: "Войти в топ-3 ниши по узнаваемости",
  };
}

function ctxToText(ctx: CompanyContext): string {
  const lines: string[] = [];
  const push = (label: string, val?: string) => {
    if (val && val.trim()) lines.push(`**${label}:** ${val.trim()}`);
  };
  push("Компания", ctx.companyName);
  push("Отрасль", ctx.industry);
  push("Регион", ctx.region);
  push("Уникальное предложение", ctx.uniqueValue);
  push("Описание", ctx.overview);
  push("Клиентская база", ctx.customerBase);
  push("Ресурсы", ctx.resources);
  push("Финансы", ctx.financials);
  push("Экспертиза команды", ctx.teamExpertise);
  push("Известные слабости", ctx.knownWeaknesses);
  push("Отзывы клиентов", ctx.customerFeedback);
  push("Рыночные тренды", ctx.marketTrends);
  push("Конкуренты", ctx.competitors);
  push("Юр.среда", ctx.legalEnv);
  push("Тех.стек / разработки", ctx.techDevelopments);
  push("Потенциальные угрозы", ctx.potentialThreats);
  push("Краткосрочные цели", ctx.shortTermGoals);
  push("Долгосрочные цели", ctx.longTermGoals);
  return lines.join("\n");
}

/** Шаг 1 — извлечение SWOT-фраз. Не пишем нарратив, только классифицируем. */
export async function extractSwotItems(ctx: CompanyContext): Promise<SwotItems> {
  const client = getClient();
  const userMessage = `${ctxToText(ctx)}

Извлеки из этих данных конкретные пункты для SWOT-анализа компании. Не интерпретируй
и не выдумывай — бери только то, что явно следует из текста.

Категории:
- strengths — внутренние позитивные факторы (что компания умеет хорошо)
- weaknesses — внутренние негативные факторы (где компания отстаёт / слаба)
- opportunities — внешние позитивные факторы (растущие тренды, незанятые ниши, доступная экспансия)
- threats — внешние негативные факторы (конкуренты, регуляторы, риски)

Верни СТРОГО валидный JSON без markdown:
{
  "strengths": ["фраза 1", "фраза 2", ...],
  "weaknesses": [...],
  "opportunities": [...],
  "threats": [...]
}

В каждом массиве 4-8 коротких фраз (по 6-12 слов). Без воды, без рассуждений.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = jsonText(message.content);
  const parsed = extractJson<SwotItems>(raw);
  return parsed ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] };
}

// ─── Step 2: Narrative section per category ──────────────────────────────────

type Category = "strengths" | "weaknesses" | "opportunities" | "threats";

const SECTION_TITLE: Record<Category, string> = {
  strengths: "Сильные стороны",
  weaknesses: "Слабые стороны",
  opportunities: "Возможности",
  threats: "Угрозы",
};

const SECTION_TONE: Record<Category, string> = {
  strengths: `Объясни, какое стратегическое преимущество даёт каждая сильная сторона.
Свяжи её с конкретным бизнес-эффектом (ценообразование, удержание, скорость роста).
Покажи вторичные эффекты и сравни с конкурентами где уместно.`,
  weaknesses: `Объясни почему слабость стратегически важна (риск маржи, потеря клиентов).
Укажи корневую причину и текущие планы по устранению.
Тон — спокойный, профессиональный, не оборонительный.`,
  opportunities: `Объясни почему возможность существует (тренд, регуляторика, изменение поведения).
Свяжи с capabilities компании. Покажи бизнес-impact и временной горизонт.`,
  threats: `Объясни в чём суть риска и почему он специфичен для этой компании.
Покажи что компания делает для митигации.
Тон — спокойный, без паники.`,
};

/** Шаг 2 — нарратив на одну категорию. */
export async function writeSection(
  ctx: CompanyContext,
  category: Category,
  items: string[],
): Promise<SwotSection> {
  const client = getClient();
  if (items.length === 0) {
    return {
      title: SECTION_TITLE[category],
      intro: "По данной категории конкретные пункты не выявлены в текущем анализе. Рекомендуется собрать больше данных в следующем итерации анализа.",
      subsections: [],
      synthesis: "",
    };
  }

  const userMessage = `Контекст компании:
${ctxToText(ctx)}

Категория: **${SECTION_TITLE[category].toUpperCase()}**

Извлечённые пункты по этой категории:
${items.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Задача: написать профессиональный аналитический раздел инвест-отчёта на русском языке.

${SECTION_TONE[category]}

Верни СТРОГО валидный JSON без markdown:
{
  "intro": "1-2 параграфа вводного контекста раздела",
  "subsections": [
    {
      "title": "название группы (например: 'Технологическое преимущество')",
      "paragraphs": ["параграф 1 (3-5 предложений)", "параграф 2 (если нужен)"]
    },
    ...
  ],
  "synthesis": "финальный параграф-синтез: как все пункты вместе образуют систему"
}

Правила:
- Группируй связанные пункты в 3-5 подразделов с осмысленными заголовками
- Не повторяй сами пункты дословно — переформулируй и развивай
- Никогда не упускай ни одного пункта (можно объединять, но все должны быть отражены)
- Параграфы по 3-5 предложений, без bullet-listов внутри
- Тон: уверенный, аналитический, без воды`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = jsonText(message.content);
  const parsed = extractJson<{
    intro: string;
    subsections: Array<{ title: string; paragraphs: string[] }>;
    synthesis: string;
  }>(raw);

  return {
    title: SECTION_TITLE[category],
    intro: parsed?.intro ?? "",
    subsections: parsed?.subsections ?? [],
    synthesis: parsed?.synthesis ?? "",
  };
}

// ─── Step 3: Intro + Conclusion (executive layer) ────────────────────────────

export async function writeIntroduction(ctx: CompanyContext, items: SwotItems): Promise<string> {
  const client = getClient();
  const userMessage = `Контекст:
${ctxToText(ctx)}

Извлечённые SWOT-пункты:
- Strengths (${items.strengths.length}): ${items.strengths.slice(0, 3).join("; ")}…
- Weaknesses (${items.weaknesses.length}): ${items.weaknesses.slice(0, 3).join("; ")}…
- Opportunities (${items.opportunities.length}): ${items.opportunities.slice(0, 3).join("; ")}…
- Threats (${items.threats.length}): ${items.threats.slice(0, 3).join("; ")}…

Напиши вводный executive-раздел SWOT-отчёта на русском языке.

Правила:
- 4-5 параграфов
- Первый параграф — где компания находится сейчас и почему SWOT критичен
- Второй — рыночный контекст (тренды, конкуренция)
- Третий — что покажет анализ (preview ключевых тем)
- Четвёртый — для кого этот документ (руководитель, инвестор, советник)
- Тон: стратегический, уверенный, без воды

Верни ТОЛЬКО текст параграфов, разделённых пустой строкой. Без заголовков и markdown.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: userMessage }],
  });
  return jsonText(message.content);
}

export async function writeConclusion(
  ctx: CompanyContext,
  sections: { strengths: SwotSection; weaknesses: SwotSection; opportunities: SwotSection; threats: SwotSection },
): Promise<string> {
  const client = getClient();
  const userMessage = `Компания: ${ctx.companyName} (${ctx.industry})

Синтезы по 4 разделам SWOT:
- STRENGTHS: ${sections.strengths.synthesis}
- WEAKNESSES: ${sections.weaknesses.synthesis}
- OPPORTUNITIES: ${sections.opportunities.synthesis}
- THREATS: ${sections.threats.synthesis}

Напиши итоговое заключение SWOT-отчёта на русском языке.

Правила:
- 3-4 параграфа
- Первый — общая стратегическая картина (где компания на пересечении SO/WT матрицы)
- Второй — приоритеты на ближайшие 3-6 месяцев (что делать сначала)
- Третий — долгосрочный взгляд (12+ месяцев)
- Четвёртый (опционально) — что даст максимальный leverage за минимальные усилия
- Тон: чёткий, action-oriented

Верни ТОЛЬКО текст. Без заголовков, без markdown.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: userMessage }],
  });
  return jsonText(message.content);
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function generateSwotReport(ctx: CompanyContext): Promise<SwotReport> {
  // Шаг 1
  const items = await extractSwotItems(ctx);

  // Шаг 2 — 4 секции параллельно
  const [strengths, weaknesses, opportunities, threats] = await Promise.all([
    writeSection(ctx, "strengths", items.strengths),
    writeSection(ctx, "weaknesses", items.weaknesses),
    writeSection(ctx, "opportunities", items.opportunities),
    writeSection(ctx, "threats", items.threats),
  ]);

  // Шаг 3 — intro + conclusion (последовательно, conclusion зависит от secций)
  const introduction = await writeIntroduction(ctx, items);
  const conclusion = await writeConclusion(ctx, { strengths, weaknesses, opportunities, threats });

  return {
    id: `swot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyName: ctx.companyName,
    generatedAt: new Date().toISOString(),
    introduction,
    strengths,
    weaknesses,
    opportunities,
    threats,
    conclusion,
    rawItems: items,
  };
}
