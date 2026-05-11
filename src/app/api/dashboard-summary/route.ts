/**
 * POST /api/dashboard-summary
 *
 * Принимает компактный JSON-снимок какого-либо дашборда (company / TA /
 * SMM / Reviews) и возвращает короткий AI-вывод в 2-3 предложениях:
 * «что важно прямо сейчас и какое одно действие сделать сегодня».
 *
 * Цель — закрыть проблему «много цифр, юзер не понимает, что делать»,
 * выявленную в P0-аудите платформы.
 *
 * Body: { dashboard: "company"|"ta"|"smm"|"reviews", data: <snapshot> }
 * Returns: { ok, summary: string, priority: "low"|"medium"|"high" }
 *
 * Использует Haiku ради скорости (2-3 предложения, ≤220 токенов).
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 45;

type Dashboard = "company" | "ta" | "smm" | "reviews";

const SYSTEM_PROMPT = `Ты — главный консультант по росту бизнеса, говорящий руководителю компании.

Тебе дают компактный снимок дашборда. Твоя задача — в 2-3 коротких предложениях:
1. Сказать, **что важно прямо сейчас** (одно главное наблюдение).
2. Дать **одно конкретное действие на сегодня** — практическое, выполнимое за час-день.

Стиль: уверенный, дружелюбный, без воды и канцелярита. Без эмодзи. Без markdown-формата.
Прямые цифры из данных приветствуются. Никаких «возможно», «постарайтесь», «рекомендуется рассмотреть».
Пиши как будто говоришь с собственником за чашкой кофе.

Также определи приоритет ситуации:
- "high" — есть критичная проблема (низкий score / падающий тренд / много негатива)
- "medium" — есть зоны роста, но не пожар
- "low" — всё хорошо, можно докручивать детали

Ответ СТРОГО валидным JSON:
{
  "summary": "1-3 предложения максимум, ~150-280 символов",
  "priority": "low" | "medium" | "high"
}`;

function buildUserMessage(dashboard: Dashboard, data: unknown): string {
  const ctx = {
    company: "анализ компании (score, SEO, соцсети, карты)",
    ta: "анализ целевой аудитории (сегменты, страхи, мотивы)",
    smm: "анализ СММ (платформы, контент, стратегия)",
    reviews: "анализ отзывов (тональность, темы, рекомендации)",
  }[dashboard];

  return `Дашборд: ${ctx}.

Снимок данных:
\`\`\`json
${JSON.stringify(data, null, 2).slice(0, 6000)}
\`\`\`

Сформулируй краткий вывод и одно действие на сегодня. Верни JSON.`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const dashboard = body.dashboard as Dashboard;
    const data = body.data;

    if (!dashboard || !data) {
      return NextResponse.json(
        { ok: false, error: "dashboard и data обязательны" },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL
        ? { baseURL: process.env.ANTHROPIC_BASE_URL }
        : {}),
    });

    const userMessage = buildUserMessage(dashboard, data);
    const model = "claude-haiku-4-5";

    const message = await client.messages.create({
      model,
      max_tokens: 350,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw =
      message.content[0]?.type === "text"
        ? message.content[0].text.trim()
        : "";
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    let parsed: { summary: string; priority: "low" | "medium" | "high" };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json(
          { ok: false, error: "AI вернул не-JSON" },
          { status: 500 },
        );
      }
      parsed = JSON.parse(m[0]);
    }

    await access.log({
      endpoint: "dashboard-summary",
      model,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({
      ok: true,
      summary: parsed.summary ?? "",
      priority: parsed.priority ?? "medium",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({
      endpoint: "dashboard-summary",
      model: "claude-haiku-4-5",
      success: false,
      errorMessage: msg.slice(0, 200),
    });
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    );
  }
}
