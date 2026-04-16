import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SEOArticleBrief } from "@/lib/seo-types";

// Robust JSON parser: tries multiple strategies to extract valid JSON
function robustJsonParse(text: string): Record<string, unknown> | null {
  // 1. Direct parse
  try { return JSON.parse(text); } catch { /* continue */ }

  // 2. Strip ALL markdown fences anywhere in the text
  const stripped = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }

  // 3. Find every { position and try balanced extraction from each
  for (let start = 0; start < stripped.length; start++) {
    if (stripped[start] !== "{") continue;
    let depth = 0, inString = false, escape = false;
    for (let i = start; i < stripped.length; i++) {
      const ch = stripped[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(stripped.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export async function POST(req: NextRequest) {
  try {
    const { brief, keywords }: { brief: SEOArticleBrief; keywords: string[] } = await req.json();

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

КРИТИЧЕСКИ ВАЖНО: верни ТОЛЬКО валидный JSON без какого-либо текста до или после. Не оборачивай в markdown-блоки. В строковых значениях не используй двойные кавычки — только одинарные или перефразируй. Не используй символы переноса строки внутри строковых значений JSON.
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

Требования к структуре:
- 4-8 разделов H2 в зависимости от объёма
- Можно добавить H3-подразделы внутри H2 (level: 3)
- Ключевой запрос в первом H2 или H1
- Вторичные ключи распределены по разделам
- Сумма wordTarget всех разделов ≈ wordCountTarget
- Для faq-типа: список вопрос-ответ (каждый вопрос — H3)
- Для listicle: каждый пункт — H2 или H3`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text.trim();
    const data = robustJsonParse(rawText);
    if (!data) {
      console.error("[seo-outline] raw response (first 1000 chars):", rawText.slice(0, 1000));
      throw new Error("Не удалось разобрать JSON: " + rawText.slice(0, 200));
    }

    return NextResponse.json({ outline: data });
  } catch (e) {
    console.error("seo-generate-outline error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
