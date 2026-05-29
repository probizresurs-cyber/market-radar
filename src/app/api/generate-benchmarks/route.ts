import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { friendlyAiError } from "@/lib/ai-error";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

export const runtime = "nodejs";
// 60с не хватало на streaming-генерацию с большим промптом
// (overallBenchmark + N categoryBenchmarks + 5-7 marketMetrics +
// 3-5 growthOpportunities + 4-5 nicheInsights → 8+ КБ JSON).
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com" });

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — ведущий аналитик рынка и бенчмаркинга для российского и СНГ-рынка. Ты специализируешься на конкурентном анализе, отраслевых метриках и стратегическом позиционировании компаний.

Ты обладаешь глубокими знаниями о реальных бенчмарках для разных ниш российского рынка: средний уровень конверсии, CAC, LTV, показатели отказов, органический трафик, рейтинги на картах, активность в соцсетях, SEO-позиции.

Ты никогда не даёшь абстрактные или глобальные цифры — только реалистичные данные для рынка России/СНГ, с учётом специфики ниши.

ВАЖНО: Ты всегда отвечаешь ТОЛЬКО валидным JSON объектом без markdown-обёрток и пояснительного текста. Твой ответ должен начинаться с { и заканчиваться }.`;

interface CategoryInput {
  name: string;
  score: number;
  icon: string;
}

interface SEOData {
  estimatedTraffic: string;
  positions?: Array<{ keyword: string; position: number; volume: number }>;
}

interface CompetitorInput {
  name: string;
  score: number;
  categories: Array<{ name: string; score: number }>;
}

function buildPrompt(
  companyName: string,
  niche: string,
  companyScore: number,
  categories: CategoryInput[],
  seoData?: SEOData,
  competitors?: CompetitorInput[],
): string {
  const categoriesBlock = categories
    .map((c) => `  - ${c.icon} ${c.name}: ${c.score}/100`)
    .join("\n");

  const seoBlock = seoData
    ? `\nSEO-данные:
  - Оценочный трафик: ${seoData.estimatedTraffic}
${
  seoData.positions && seoData.positions.length > 0
    ? `  - Топ ключевые слова:\n${seoData.positions
        .slice(0, 5)
        .map((p) => `    • «${p.keyword}» — позиция ${p.position}, объём ${p.volume}/мес`)
        .join("\n")}`
    : ""
}`
    : "";

  const competitorsBlock =
    competitors && competitors.length > 0
      ? `\nКонкуренты для сравнения:
${competitors
  .map(
    (comp) =>
      `  - ${comp.name} (общий балл: ${comp.score}/100):\n${comp.categories
        .map((cat) => `      • ${cat.name}: ${cat.score}/100`)
        .join("\n")}`,
  )
  .join("\n")}`
      : "";

  return `Проведи глубокий бенчмаркинг-анализ компании на российском рынке.

Компания: «${companyName}»
Ниша: ${niche}
Общий балл компании: ${companyScore}/100

Оценки по категориям:
${categoriesBlock}
${seoBlock}
${competitorsBlock}

Твоя задача — сгенерировать реалистичные отраслевые бенчмарки ИМЕННО для ниши «${niche}» на рынке России/СНГ.

ТРЕБОВАНИЯ К ДАННЫМ:
- Используй реальные средние показатели для российского рынка, а не глобальные
- Учитывай специфику ниши: для e-commerce одни метрики, для B2B другие, для услуг третьи
- Все числовые диапазоны должны быть правдоподобными для России 2024-2025
- Лидеры рынка — это топ-10% игроков в нише
- Аутсайдеры — нижние 20%
- Процентиль компании рассчитывай честно, исходя из её балла ${companyScore}/100

Верни результат строго в JSON формате:
{
  "summary": "2-3 предложения: общая характеристика позиции компании в нише, ключевые выводы о её конкурентоспособности",
  "overallBenchmark": {
    "companyScore": ${companyScore},
    "nicheAverage": <реальное среднее по нише для России, число 0-100>,
    "nicheLeader": <балл лидеров ниши, число 0-100>,
    "nicheBottom": <балл аутсайдеров ниши, число 0-100>,
    "percentile": <где находится компания, число 0-100>,
    "verdict": "Выше среднего | На уровне рынка | Ниже среднего | Лидер | Отстающий"
  },
  "categoryBenchmarks": [
    // По каждой категории из входных данных
    {
      "categoryName": "<название категории>",
      "icon": "<иконка из входных данных>",
      "companyScore": <балл компании из входных данных>,
      "nicheAverage": <реальное среднее по нише для этой категории>,
      "nicheLeader": <балл лидеров ниши по этой категории>,
      "gap": <companyScore минус nicheAverage, может быть отрицательным>,
      "priority": "high | medium | low",
      "insight": "конкретный, actionable инсайт для этой категории в данной нише (1-2 предложения)"
    }
  ],
  "marketMetrics": [
    // 5-7 ключевых метрик именно для этой ниши
    {
      "metric": "название метрики (например: Конверсия сайта, CAC, LTV, Bounce Rate, Avg. Session Duration, CTR в поиске, Рейтинг на картах, NPS, Средний чек)",
      "nicheAverage": "диапазон для среднего игрока рынка России (например: '2-4%', '1 500-3 000 ₽', '45-55%')",
      "topPlayers": "диапазон для топ-игроков ниши в России",
      "yourEstimate": "оценочное значение для данной компании исходя из её баллов",
      "icon": "подходящий эмодзи-иконка"
    }
  ],
  "growthOpportunities": [
    // 3-5 конкретных возможностей роста
    {
      "title": "краткое название возможности",
      "description": "конкретное описание: что делать, почему это важно для данной ниши, какой результат ожидать (2-3 предложения)",
      "potentialImpact": "high | medium | low",
      "effort": "high | medium | low",
      "icon": "подходящий эмодзи"
    }
  ],
  "nicheInsights": [
    // 4-5 ключевых инсайтов о нише
    "инсайт 1 — конкретный факт или тренд по нише «${niche}» в России",
    "инсайт 2",
    "инсайт 3",
    "инсайт 4",
    "инсайт 5"
  ]
}

КРИТИЧЕСКИ ВАЖНО:
- categoryBenchmarks должен содержать ровно ${categories.length} элементов — по одному для каждой из входных категорий
- Все числовые значения в overallBenchmark и categoryBenchmarks должны быть реалистичными для рынка России
- marketMetrics должны быть специфичны для ниши «${niche}» — не давай одинаковые метрики для всех ниш
- nicheInsights должны содержать реальные тренды и факты о нише, а не банальности
- growthOpportunities должны быть конкретными и применимыми, с учётом текущего положения компании
- Заполни ВСЕ поля. БЕЗ ВОДЫ. БЕЗ ОБЩИХ ФРАЗ.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");

  const candidate = stripped.slice(start);

  // 1. Полный парс
  const end = candidate.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(candidate.slice(0, end + 1)); } catch { /* fall through */ }
  }

  // 2. Walk-back: ищем валидное закрытие
  for (let i = candidate.length - 1; i > 0; i--) {
    if (candidate[i] === "}") {
      try { return JSON.parse(candidate.slice(0, i + 1)); } catch { /* continue */ }
    }
  }

  // 3. Auto-close: проходим по символам, считаем глубину, закрываем скобки
  // на последнем сбалансированном уровне. Если стрим оборвался посреди
  // вложенного массива/объекта — попробуем закрыть его искусственно.
  try {
    let depth = 0;
    let inString = false;
    let escape = false;
    let lastBalancedPos = 0;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{" || ch === "[") depth++;
      if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) lastBalancedPos = i;
      }
    }
    if (lastBalancedPos > 0) {
      try { return JSON.parse(candidate.slice(0, lastBalancedPos + 1)); } catch { /* fall through */ }
    }

    // 4. Force-close: добавляем закрывающие скобки по depth-стеку
    const stack: string[] = [];
    inString = false;
    escape = false;
    let lastValueEnd = -1;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
      // запоминаем позицию после которой можно закрывать (после ", null, цифры, ", true/false)
      if (!inString && (ch === '"' || ch === "}" || ch === "]" || /[\dtruefalsn]/i.test(ch))) {
        lastValueEnd = i;
      }
    }
    if (lastValueEnd > 0 && stack.length > 0) {
      // отрезаем хвост типа `, "key":` если он остался незавершённым,
      // и докидываем закрывашки в LIFO-порядке
      let trimmed = candidate.slice(0, lastValueEnd + 1);
      // убираем висячую запятую если есть
      trimmed = trimmed.replace(/,\s*$/, "");
      const closing = stack.reverse().join("");
      try { return JSON.parse(trimmed + closing); } catch { /* fall through */ }
    }
  } catch { /* fall through */ }

  throw new Error(`Failed to parse AI response as JSON (preview: ${stripped.slice(0, 150)})`);
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();

    const companyName: string = body.companyName ?? "";
    const niche: string = body.niche ?? "";
    const companyScore: number = typeof body.companyScore === "number" ? body.companyScore : 0;
    const categories: CategoryInput[] = Array.isArray(body.categories) ? body.categories : [];
    const seoData: SEOData | undefined = body.seoData ?? undefined;
    const competitors: CompetitorInput[] | undefined = Array.isArray(body.competitors)
      ? body.competitors
      : undefined;

    if (!niche.trim()) {
      return NextResponse.json(
        { ok: false, error: "Укажите нишу компании" },
        { status: 400 },
      );
    }

    if (categories.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Необходимо передать хотя бы одну категорию" },
        { status: 400 },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const userPrompt = buildPrompt(companyName, niche, companyScore, categories, seoData, competitors);

    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      // 4096 не хватало: JSON с N категориями + 5-7 marketMetrics +
      // 3-5 growthOpportunities + 4-5 nicheInsights занимает 6-10к токенов
      // → стрим обрезался → «Failed to parse AI response as JSON».
      max_tokens: 12000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      stream: true,
    });

    let rawText = "";
    for await (const event of streamResponse) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        rawText += event.delta.text;
      }
    }
    if (!rawText) {
      return NextResponse.json(
        { ok: false, error: "Неожиданный тип ответа от Claude" },
        { status: 500 },
      );
    }

    const parsed = extractJson(rawText);

    const result = {
      generatedAt: new Date().toISOString(),
      niche,
      summary: parsed.summary ?? "",
      overallBenchmark: parsed.overallBenchmark ?? {},
      categoryBenchmarks: parsed.categoryBenchmarks ?? [],
      marketMetrics: parsed.marketMetrics ?? [],
      growthOpportunities: parsed.growthOpportunities ?? [],
      nicheInsights: parsed.nicheInsights ?? [],
    };

    await access.log({
      endpoint: "generate-benchmarks",
      model: "claude-sonnet-4-6",
      promptTokens: estimateTokens(SYSTEM_PROMPT + userPrompt),
      completionTokens: estimateTokens(rawText),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "generate-benchmarks", model: "claude-sonnet-4-6", success: false, errorMessage: msg.slice(0, 200) });
    const { message, status } = friendlyAiError(err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
