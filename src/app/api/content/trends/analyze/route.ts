/**
 * POST /api/content/trends/analyze
 *
 * Accepts fetched trend items + context (query, company, niche).
 * Uses Claude to analyze trends and return 6 ready-to-use content ideas,
 * each with a detailed prompt for post/carousel/reels/stories generation.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TrendItem {
  title: string;
  source: string;
  publishedAt: string;
  description?: string;
}

export interface TrendContentIdea {
  id: string;
  format: "пост" | "карусель" | "рилс" | "сторис";
  topic: string;
  hook: string;
  prompt: string;
  trendBasis: string;
}

export async function POST(req: Request) {
  // checkAiAccess делает и auth, и rate-limit, и проверку подписки/триала,
  // и token accounting. Раньше был только `getSessionUser` — триальные
  // юзеры могли жечь токены без лимитов.
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const items: TrendItem[] = body.items ?? [];
    const query: string = (body.query ?? "").trim();
    const companyName: string = (body.companyName ?? "").trim();
    const niche: string = (body.niche ?? "").trim();

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "Нет трендов для анализа" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });

    // Build trends digest
    const trendsText = items
      .slice(0, 25)
      .map(
        (item, i) =>
          `${i + 1}. [${item.source}] ${item.title}` +
          (item.description ? `\n   ${item.description.slice(0, 150)}` : ""),
      )
      .join("\n");

    const contextLine = [
      query && `Тема: «${query}»`,
      companyName && `Компания: ${companyName}`,
      niche && `Ниша: ${niche}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const userPrompt = `${ANTI_HALLUCINATION_SHORT}

Ты эксперт по контент-маркетингу. ${contextLine}

Проанализируй свежие публикации и создай 6 конкретных идей для контента. Форматы: пост (текст), карусель (слайды), рилс (короткое видео), сторис.

Актуальные тренды:
${trendsText}

Требования к идеям:
— Каждая идея должна опираться на конкретный тренд из списка
— Prompt должен быть готовым заданием для генерации контента (что писать, структура, тон, CTA)
— Разнообразие форматов: минимум 2 поста, 1 карусель, 1 рилс или сторис

Ответь строго в JSON:
{
  "ideas": [
    {
      "format": "пост",
      "topic": "Конкретная тема до 80 символов",
      "hook": "Цепляющий заголовок или первая фраза до 120 символов",
      "prompt": "Детальный промпт для генерации: ключевые тезисы, структура, tone of voice, призыв к действию. 80-120 слов.",
      "trendBasis": "Какая публикация/тренд лег в основу. Источник + краткое описание."
    }
  ]
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3500,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, error: "Claude не вернул JSON с идеями" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as { ideas: Omit<TrendContentIdea, "id">[] };
    const ideas: TrendContentIdea[] = (parsed.ideas ?? []).map((idea, i) => ({
      id: `trend-idea-${Date.now()}-${i}`,
      ...idea,
    }));

    await access.log({
      endpoint: "content/trends/analyze",
      model: "claude-sonnet-4-5",
      promptTokens: message.usage?.input_tokens,
      completionTokens: message.usage?.output_tokens,
      success: true,
    });
    return NextResponse.json({ ok: true, ideas });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
