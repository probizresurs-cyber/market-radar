import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const { h1, intro, focusKeyword, platform, topic } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

    const client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    });

    const prompt = `Ты — SEO-специалист. Напиши мета-теги для статьи.

ТЕМА: ${topic} | H1: ${h1}
ЛИД: ${(intro || "").slice(0, 300)}
ФОКУС-КЛЮЧ: ${focusKeyword} | ПЛАТФОРМА: ${platform}

Верни ТОЛЬКО валидный JSON без markdown-блоков, начинающийся с { и заканчивающийся }:
{
  "title": "SEO-заголовок до 60 символов, содержит ключ",
  "metaDescription": "meta-описание до 160 символов с ключом и призывом читать",
  "ogTitle": "OG-заголовок (можно чуть длиннее title)",
  "ogDescription": "OG-описание до 200 символов"
}`;

    // Use streaming — Cloudflare Worker requires stream:true to avoid 30s timeout
    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let responseText = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        responseText += event.delta.text;
      }
    }

    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Не удалось распарсить JSON из ответа");
    const meta = JSON.parse(match[0]);
    meta.focusKeyword = focusKeyword;
    meta.slug = toSlug(h1 || topic);
    return NextResponse.json({ meta });
  } catch (e) {
    console.error("seo-generate-meta error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
