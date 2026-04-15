import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

const SYSTEM_PROMPT = "Ты — SEO-специалист. Пишешь мета-теги для статей. Отвечаешь ТОЛЬКО валидным JSON без markdown-обёрток. Твой ответ начинается с { и заканчивается }.";

function toSlug(text: string): string {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"j",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return text.toLowerCase()
    .split("").map(c => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function extractJson(text: string): Record<string, unknown> {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found");
  return JSON.parse(stripped.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const { h1, intro, focusKeyword, platform, topic } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const userPrompt = `Напиши мета-теги для статьи.

ТЕМА: ${topic} | H1: ${h1}
ЛИД: ${(intro || "").slice(0, 300)}
ФОКУС-КЛЮЧ: ${focusKeyword} | ПЛАТФОРМА: ${platform}

Верни строго этот JSON:
{"title":"SEO-заголовок до 60 символов, содержит ключ","metaDescription":"meta-описание до 160 символов с ключом и призывом читать","ogTitle":"OG-заголовок (можно чуть длиннее title)","ogDescription":"OG-описание до 200 символов"}`;

    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
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

    const meta = extractJson(rawText);
    meta.focusKeyword = focusKeyword;
    meta.slug = toSlug(h1 || topic);
    return NextResponse.json({ meta });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("seo-generate-meta error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
