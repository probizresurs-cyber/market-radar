import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SEOArticleBrief } from "@/lib/seo-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

const SYSTEM_PROMPT = "Ты — SEO-редактор. Составляешь детальные структуры (outline) для статей. Отвечаешь ТОЛЬКО валидным JSON без markdown-обёрток. Твой ответ начинается с { и заканчивается }.";

function extractJson(text: string): unknown {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");
  const end = stripped.lastIndexOf("}");
  if (end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* fall through */ }
  }
  const partial = stripped.slice(start);
  for (let i = partial.length - 1; i > 0; i--) {
    if (partial[i] === "}") {
      try { return JSON.parse(partial.slice(0, i + 1)); } catch { /* continue */ }
    }
  }
  throw new Error(`Failed to parse AI response as JSON. Preview: ${stripped.slice(0, 200)}`);
}

export async function POST(req: Request) {
  try {
    const { brief, keywords }: { brief: SEOArticleBrief; keywords: string[] } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const userPrompt = `Составь детальную структуру (outline) для статьи.

БРИФ:
- Тема: ${brief.topic}
- Тип: ${brief.articleType}
- Платформа: ${brief.platform}
- Ключевой запрос: ${brief.focusKeyword}
- Доп. ключи: ${[...brief.secondaryKeywords, ...keywords].join(", ")}
- Целевой объём: ${brief.wordCountTarget} слов
- ЦА: ${brief.audience}
- CTA: ${brief.callToAction}

Верни строго этот JSON:
{"h1":"H1 заголовок (содержит фокус-ключ)","intro":"краткий лид-абзац (2-3 предложения, крючок)","sections":[{"id":"s1","order":1,"heading":"Заголовок H2","level":2,"contentBrief":"О чём этот раздел (1-2 предложения)","wordTarget":300,"keywords":["ключ1","ключ2"],"status":"empty"}],"conclusion":"финальный раздел / CTA (1-2 предложения)"}

Требования: 4-8 разделов H2, ключевой запрос в первом H2 или H1, сумма wordTarget ≈ wordCountTarget.`;

    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    });

    let rawText = "";
    for await (const event of streamResponse) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        rawText += event.delta.text;
      }
    }

    if (!rawText) return NextResponse.json({ error: "Пустой ответ от Claude" }, { status: 500 });

    const outline = extractJson(rawText);
    return NextResponse.json({ outline });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("seo-generate-outline error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
