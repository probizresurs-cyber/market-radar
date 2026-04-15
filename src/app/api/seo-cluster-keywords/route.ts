import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

const SYSTEM_PROMPT = "Ты — SEO-специалист. Составляешь семантические кластеры ключевых слов. Отвечаешь ТОЛЬКО валидным JSON без markdown-обёрток. Твой ответ начинается с { и заканчивается }.";

function extractJson(text: string): unknown {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found");
  return JSON.parse(stripped.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const { topic, companyName, niche, taContext } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const userPrompt = `Составь семантический кластер ключевых слов.

ТЕМА: ${topic}
КОМПАНИЯ: ${companyName || "—"} | НИША: ${niche || "—"}
${taContext ? `ЦА: ${taContext}` : ""}

Верни строго этот JSON:
{"focusKeyword":"главный ключевой запрос (2-4 слова)","keywords":[{"phrase":"фраза","frequency":"high","isLsi":false,"usedInHeadings":true,"usedInBody":true}]}

Включи: 1 фокус-ключ (frequency:"high"), 5-8 вторичных (frequency:"medium", isLsi:false), 8-12 LSI (frequency:"low", isLsi:true).`;

    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
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

    const cluster = extractJson(rawText);
    return NextResponse.json({ cluster });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("seo-cluster-keywords error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
