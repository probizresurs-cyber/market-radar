import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPENAI_URL = `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`;

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, taContext } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не настроен" }, { status: 500 });

    const prompt = `Ты — SEO-специалист. Составь семантический кластер ключевых слов для статьи.

ТЕМА: ${topic}
КОМПАНИЯ: ${companyName || "—"}
НИША: ${niche || "—"}
${taContext ? `ЦА: ${taContext}` : ""}

Верни ТОЛЬКО валидный JSON:
{
  "focusKeyword": "главный ключевой запрос (2-4 слова)",
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
- 1 фокус-ключ (frequency: "high", isLsi: false)
- 5-8 вторичных ключей (frequency: "medium", isLsi: false)
- 8-12 LSI-ключей (frequency: "low", isLsi: true)`;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI ${res.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }

    const json = await res.json();
    const data = JSON.parse(json.choices[0].message.content);

    return NextResponse.json({ cluster: data });
  } catch (e) {
    console.error("seo-cluster-keywords error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
