import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { brandName, niche, region = "Россия" } = await req.json();
    if (!brandName || !niche) {
      return NextResponse.json({ ok: false, error: "brandName and niche required" }, { status: 400 });
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Ты помогаешь с GEO (Generative Engine Optimization) аудитом бренда.

Бренд: ${brandName}
Ниша: ${niche}
Регион: ${region}

Сгенерируй ровно 8 реалистичных поисковых запросов, которые потенциальные клиенты этой компании могли бы задать AI-ассистенту (ChatGPT, Яндекс Нейро, GigaChat).

Запросы должны быть:
- На русском языке
- Разнообразными: информационные ("что такое..."), навигационные ("лучшие..."), коммерческие ("рекомендуй...")
- Такими, чтобы идеально подходящий ответ упоминал ${brandName}

Верни ТОЛЬКО JSON-массив строк, без пояснений:
["запрос 1", "запрос 2", ...]`,
        },
      ],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");
    const queries: string[] = JSON.parse(match[0]);

    return NextResponse.json({ ok: true, queries: queries.slice(0, 8) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
