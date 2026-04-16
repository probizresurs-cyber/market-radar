import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, taContext } = await req.json();

    const prompt = `Ты — SEO-специалист. Составь семантический кластер ключевых слов для статьи.

ТЕМА: ${topic}
КОМПАНИЯ: ${companyName || "—"}
НИША: ${niche || "—"}
${taContext ? `ЦА: ${taContext}` : ""}

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "focusKeyword": "главный ключевой запрос",
  "keywords": [
    {
      "phrase": "ключевая фраза",
      "frequency": "high",
      "isLsi": false,
      "usedInHeadings": true,
      "usedInBody": true
    }
  ]
}

Включи:
- 1 фокус-ключ (высокочастотный, 2-4 слова)
- 5-8 вторичных ключей (среднечастотные)
- 8-12 LSI-ключей (isLsi: true, семантически близкие)
frequency: "high" = основной запрос, "medium" = 2-3 раза в тексте, "low" = 1 раз
Фокус-ключ включи в список keywords с frequency: "high", isLsi: false`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "{" },
      ],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text.trim();
    const fullText = "{" + rawText;
    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(fullText); } catch { /* continue */ }
    if (!data) {
      const m = fullText.match(/\{[\s\S]*\}/);
      if (m) try { data = JSON.parse(m[0]); } catch { /* continue */ }
    }
    if (!data) throw new Error("Не удалось разобрать JSON из ответа модели");

    return NextResponse.json({ cluster: data });
  } catch (e) {
    console.error("seo-cluster-keywords error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
