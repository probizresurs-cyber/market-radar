import { NextResponse } from "next/server";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
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

    const systemPrompt = `${ANTI_HALLUCINATION_SHORT}

Ты — презентационный дизайнер. Тебе дан массив слайдов бренд-презентации в JSON.
Пользователь просит внести изменения. Верни ПОЛНЫЙ массив слайдов с изменениями.

Правила:
- Слайды с isEdited: true НЕ ТРОГАЙ — пользователь их отредактировал вручную.
- Остальные слайды можешь менять согласно пожеланию.
- Сохраняй структуру: title, subtitle, type, content, bullets, stats, quote, items, leftContent, rightContent, note.
- Допустимые type: cover | bullets | stats | quote | two-column | grid | cta
  (СИНХРОНИЗИРОВАНО с generate-presentation — раньше grid/two-column терялись,
   потому что в whitelist edit'а их не было, и AI заменял на bullets).
- Для type=grid сохраняй массив items: [{title, description}].
- Для type=two-column сохраняй leftContent + rightContent ИЛИ заполни bullets (6-8 шт).
- Для type=stats массив stats: [{value, label}] — value строка с числом ("87%", "2400", "×3").
- Верни JSON: {"slides":[...]}

${contextParts.length > 0 ? `Контекст:\n${contextParts.join("\n")}` : ""}`;

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
    const rawContent = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawContent);
    await access.log({
      endpoint: "edit-presentation",
      model: "gpt-4o-mini",
      promptTokens: estimateTokens(systemPrompt + JSON.stringify(slides) + wish),
      completionTokens: estimateTokens(rawContent),
    });
    // КРИТИЧНО: клиент (PresentationView.tsx) ожидает `json.data.slides`,
    // а раньше мы возвращали `json.slides` — wish-edit «успешно» возвращал
    // null/undefined → setSlides(json.data.slides ?? slides) кладёт обратно
    // старые слайды. Юзер думал «AI не понял» и тратил деньги повторно.
    return NextResponse.json({ ok: true, data: { slides: parsed.slides ?? [] } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    await access.log({ endpoint: "edit-presentation", model: "gpt-4o-mini", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
