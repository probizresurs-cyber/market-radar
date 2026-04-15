import { NextRequest, NextResponse } from "next/server";
import type { SEOArticleBrief } from "@/lib/seo-types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { brief, keywords }: { brief: SEOArticleBrief; keywords: string[] } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не настроен" }, { status: 500 });

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

Верни ТОЛЬКО валидный JSON:
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

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI ${res.status}: ${err.slice(0, 300)}` }, { status: 500 });
    }

    const json = await res.json();
    const data = JSON.parse(json.choices[0].message.content);
    return NextResponse.json({ outline: data });
  } catch (e) {
    console.error("seo-generate-outline error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
