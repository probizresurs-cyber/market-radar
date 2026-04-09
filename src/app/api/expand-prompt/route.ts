import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic: string = body.topic ?? "";
    const type: "post" | "reel" = body.type ?? "post";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const systemPrompt = type === "post"
      ? `Ты — опытный SMM-копирайтер. Пользователь даёт тему или бриф, ты разворачиваешь его в детальный промпт для GPT-4o, который затем сгенерирует готовый пост.

Требования к промпту:
- Чётко описывает формат (single / carousel / story / longread), платформу, тон
- Содержит конкретные инструкции по структуре, крючку, CTA
- В конце обязательно: Верни СТРОГО JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }

Отвечай ТОЛЬКО промптом (текст, не JSON).`
      : `Ты — опытный SMM-сценарист. Пользователь даёт тему или бриф, ты разворачиваешь его в детальный промпт для GPT-4o, который затем напишет сценарий рилса.

Требования к промпту:
- Указывает длительность (15/30/60 сек), визуальный стиль, структуру (крюк → интрига → проблема → решение → результат → CTA)
- Содержит конкретные инструкции по тону, подаче, хэштегам
- В конце обязательно: Верни СТРОГО JSON: { "title": "...", "scenario": "...", "voiceoverScript": "...", "hashtags": [...] }

Отвечай ТОЛЬКО промптом (текст, не JSON).`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Тема/бриф: ${topic}\nТип: ${type === "post" ? "пост" : "рилс"}` },
        ],
        temperature: 0.75,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const prompt = data.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ ok: true, prompt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
