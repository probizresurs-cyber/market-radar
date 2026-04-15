import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, taContext } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

    const client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    });

    const prompt = `Ты — SEO-специалист. Составь семантический кластер ключевых слов.

ТЕМА: ${topic}
КОМПАНИЯ: ${companyName || "—"} | НИША: ${niche || "—"}
${taContext ? `ЦА: ${taContext}` : ""}

Верни ТОЛЬКО валидный JSON без markdown-блоков, начинающийся с { и заканчивающийся }:
{
  "focusKeyword": "главный ключевой запрос (2-4 слова)",
  "keywords": [
    { "phrase": "фраза", "frequency": "high", "isLsi": false, "usedInHeadings": true, "usedInBody": true }
  ]
}

Включи: 1 фокус-ключ (frequency:"high"), 5-8 вторичных (frequency:"medium", isLsi:false), 8-12 LSI (frequency:"low", isLsi:true).`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Не удалось распарсить JSON из ответа");
    const cluster = JSON.parse(match[0]);
    return NextResponse.json({ cluster });
  } catch (e) {
    console.error("seo-cluster-keywords error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
