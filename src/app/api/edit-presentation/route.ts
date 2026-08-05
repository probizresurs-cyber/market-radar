import { NextResponse } from "next/server";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const { slides, wish: wishRaw, style, brandBook, company } = body;
    if (!slides || !wishRaw) {
      return NextResponse.json({ ok: false, error: "slides and wish are required" }, { status: 400 });
    }

    // Sanitize wish — защита от prompt injection (как в generate-presentation).
    const wish = String(wishRaw).slice(0, 1000)
      .replace(/\b(ignore|disregard|forget)\s+(previous|prior|all|above)\s+(instructions?|messages?|prompt)/gi, "[удалено]")
      .replace(/\b(игнорируй|забудь|отмени)\s+(инструкции|правила|систем)/gi, "[удалено]")
      .replace(/system\s*[:|│]/gi, "[удалено]")
      .replace(/<\s*\/?\s*(system|user|assistant)\s*>/gi, "[удалено]")
      .trim();

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

    const aiResult = await chatJson<{ slides?: unknown[] }>({
      system: systemPrompt,
      user: `Слайды:\n${JSON.stringify(slides, null, 2)}\n\nПожелание: ${wish}`,
      model: CHAT_MODEL_SMART,
      temperature: 0.5,
      maxTokens: 4000,
    });
    if (!aiResult.data) {
      return NextResponse.json({ ok: false, error: aiResult.error ?? "Не удалось получить изменённые слайды" }, { status: 500 });
    }
    await access.log({
      endpoint: "edit-presentation",
      model: aiResult.modelUsed,
      promptTokens: estimateTokens(systemPrompt + JSON.stringify(slides) + wish),
      completionTokens: estimateTokens(aiResult.raw),
    });
    // КРИТИЧНО: клиент (PresentationView.tsx) ожидает `json.data.slides`,
    // а раньше мы возвращали `json.slides` — wish-edit «успешно» возвращал
    // null/undefined → setSlides(json.data.slides ?? slides) кладёт обратно
    // старые слайды. Юзер думал «AI не понял» и тратил деньги повторно.
    return NextResponse.json({ ok: true, data: { slides: aiResult.data.slides ?? [] } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    await access.log({ endpoint: "edit-presentation", model: "claude", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
