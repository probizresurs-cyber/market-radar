import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SEOArticleBrief } from "@/lib/seo-types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { brief, keywords }: { brief: SEOArticleBrief; keywords: string[] } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

    const client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    });

    const prompt = `Ты — SEO-редактор. Составь детальную структуру (outline) для статьи.

БРИФ:
- Тема: ${brief.topic}
- Тип: ${brief.articleType}
- Платформа: ${brief.platform}
- Ключевой запрос: ${brief.focusKeyword}
- Доп. ключи: ${[...brief.secondaryKeywords, ...keywords].join(", ")}
- Целевой объём: ${brief.wordCountTarget} слов
- ЦА: ${brief.audience}
- CTA: ${brief.callToAction}

Верни ТОЛЬКО валидный JSON без markdown-блоков, начинающийся с { и заканчивающийся }:
{
  "h1": "H1 заголовок статьи (содержит фокус-ключ)",
  "intro": "краткий лид-абзац (2-3 предложения, крючок для читателя)",
  "sections": [
    {
      "id": "s1",
      "order": 1,
      "heading": "Заголовок H2",
      "level": 2,
      "contentBrief": "О чём этот раздел (1-2 предложения)",
      "wordTarget": 300,
      "keywords": ["ключ1", "ключ2"],
      "status": "empty"
    }
  ],
  "conclusion": "финальный раздел / CTA (1-2 предложения)"
}

Требования: 4-8 разделов H2, ключевой запрос в первом H2 или H1, сумма wordTarget ≈ wordCountTarget.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Не удалось распарсить JSON из ответа");
    const outline = JSON.parse(match[0]);
    return NextResponse.json({ outline });
  } catch (e) {
    console.error("seo-generate-outline error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
