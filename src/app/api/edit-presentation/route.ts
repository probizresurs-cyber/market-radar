import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "No API key" }, { status: 500 });

    const { slides, wish, style, brandBook, company } = body;
    if (!slides || !wish) {
      return NextResponse.json({ ok: false, error: "slides and wish are required" }, { status: 400 });
    }

    const contextParts: string[] = [];
    if (company?.name) contextParts.push(`Компания: ${company.name}`);
    if (brandBook?.tagline) contextParts.push(`Слоган: ${brandBook.tagline}`);
    if (style) contextParts.push(`Стиль: ${style.name}, настроение: ${style.mood}`);

    const systemPrompt = `Ты — презентационный дизайнер. Тебе дан массив слайдов бренд-презентации в JSON.
Пользователь просит внести изменения. Верни ПОЛНЫЙ массив слайдов с изменениями.

Правила:
- Слайды с isEdited: true НЕ ТРОГАЙ — пользователь их отредактировал вручную.
- Остальные слайды можешь менять согласно пожеланию.
- Сохраняй структуру: title, subtitle, type, content, bullets, stats, quote, note.
- Допустимые type: cover | bullets | stats | quote | two-column | cta
- Верни JSON: {"slides":[...]}

${contextParts.length > 0 ? `Контекст:\n${contextParts.join("\n")}` : ""}`;

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Слайды:\n${JSON.stringify(slides, null, 2)}\n\nПожелание: ${wish}` },
        ],
        temperature: 0.5,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}");
    return NextResponse.json({ ok: true, slides: parsed.slides ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
