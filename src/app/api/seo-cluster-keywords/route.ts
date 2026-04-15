import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, taContext } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не настроен" }, { status: 500 });

    const prompt = `Ты — SEO-специалист. Составь семантический кластер ключевых слов.

ТЕМА: ${topic}
КОМПАНИЯ: ${companyName || "—"} | НИША: ${niche || "—"}
${taContext ? `ЦА: ${taContext}` : ""}

Верни ТОЛЬКО валидный JSON (без markdown-блоков):
{
  "focusKeyword": "главный ключевой запрос (2-4 слова)",
  "keywords": [
    { "phrase": "фраза", "frequency": "high", "isLsi": false, "usedInHeadings": true, "usedInBody": true }
  ]
}

Включи: 1 фокус-ключ (frequency:"high"), 5-8 вторичных (frequency:"medium", isLsi:false), 8-12 LSI (frequency:"low", isLsi:true).`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 110_000);

    let raw: string;
    try {
      const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `OpenAI ${res.status}: ${err.slice(0, 300)}` }, { status: 500 });
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      raw = data.choices[0]?.message?.content ?? "{}";
    } finally {
      clearTimeout(timeout);
    }

    const cluster = JSON.parse(raw);
    return NextResponse.json({ cluster });
  } catch (e) {
    console.error("seo-cluster-keywords error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
