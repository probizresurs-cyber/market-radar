import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — парсер отзывов. Из скриншота или текста извлекаешь структурированные отзывы.

Для каждого отзыва определи:
- author: имя автора
- rating: оценка 1-5 (если видно звёзды, число, или определи по тону)
- text: полный текст отзыва
- date: дата (если видна, иначе "")
- reply: ответ компании (если есть, иначе "")

Возвращай СТРОГО валидный JSON без markdown:
{
  "platform": "определённая платформа (yandex_maps / 2gis / otzovik / avito / google / unknown)",
  "reviews": [
    { "author": "...", "rating": 5, "text": "...", "date": "...", "reply": "..." }
  ]
}

Если не можешь разобрать — верни пустой массив reviews.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const screenshot: string | undefined = body.screenshot; // base64 data URL
    const pastedText: string | undefined = body.pastedText;

    if (!screenshot && !pastedText) {
      return NextResponse.json({ ok: false, error: "Нет данных для извлечения" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const messages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (screenshot) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Извлеки все отзывы из этого скриншота. Определи платформу по дизайну." },
          { type: "image_url", image_url: { url: screenshot, detail: "high" } },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Извлеки все отзывы из этого текста. Определи платформу если возможно.\n\n${pastedText}`,
      });
    }

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as {
      platform: string;
      reviews: Array<{ author: string; rating: number; text: string; date: string; reply?: string }>;
    };

    const reviews: Review[] = (parsed.reviews ?? []).map((r, i) => ({
      id: `rev-${Date.now()}-${i}`,
      platform: parsed.platform ?? "unknown",
      author: r.author ?? "Аноним",
      rating: Math.min(5, Math.max(1, Math.round(r.rating ?? 3))),
      text: r.text ?? "",
      date: r.date ?? "",
      reply: r.reply,
    }));

    return NextResponse.json({
      ok: true,
      data: { platform: parsed.platform ?? "unknown", reviews },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
