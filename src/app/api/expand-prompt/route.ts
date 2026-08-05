import { NextResponse } from "next/server";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import type { BrandBook } from "@/lib/content-types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { chatText, CHAT_MODEL_SMART } from "@/lib/ai-chat";

export const runtime = "nodejs";
export const maxDuration = 30;

function buildBrandBookBlock(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.brandName) lines.push(`Название бренда: ${bb.brandName}`);
  if (bb.tagline) lines.push(`Слоган: ${bb.tagline}`);
  if (bb.mission) lines.push(`Миссия: ${bb.mission}`);
  if (bb.toneOfVoice?.length) lines.push(`Tone of voice: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`Запрещённые слова: ${bb.forbiddenWords.join(", ")}`);
  if (bb.goodPhrases?.length) lines.push(`Фирменные фразы: ${bb.goodPhrases.map(p => `«${p}»`).join("; ")}`);
  if (bb.visualStyle) lines.push(`Визуальный стиль: ${bb.visualStyle}`);
  if (bb.colors?.length) lines.push(`Цвета: ${bb.colors.join(", ")}`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const topic: string = body.topic ?? "";
    const type: "post" | "reel" = body.type ?? "post";
    const companyName: string = body.companyName ?? "";
    const companyUrl: string = body.companyUrl ?? "";
    const companyDescription: string = body.companyDescription ?? "";
    const bigIdea: string = body.bigIdea ?? "";
    const pillars: Array<{ name: string; description: string; share: string }> = body.pillars ?? [];
    const smmContext: string = body.smmContext ?? ""; // brief SMM summary if available
    const brandBook: BrandBook | null = body.brandBook ?? null;

    const pillarsText = pillars.map(p => `• ${p.name} (${p.share}): ${p.description}`).join("\n");

    const brandBookBlock = buildBrandBookBlock(brandBook);

    const companyBlock = [
      companyName && `Компания: ${companyName}`,
      companyUrl && `Сайт: ${companyUrl}`,
      // Description критично — даёт нишу компании, иначе AI может
      // сгенерировать промпт под другую сферу (юзер видела «dentist clinic»
      // для строительной компании из-за стейл-плана).
      companyDescription && `Чем занимается: ${companyDescription.slice(0, 500)}`,
      bigIdea && `Большая идея бренда: ${bigIdea}`,
      pillarsText && `Контент-столпы:\n${pillarsText}`,
      smmContext && `Контекст бренда: ${smmContext}`,
      brandBookBlock && `Брендбук:\n${brandBookBlock}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = type === "post"
      ? `${ANTI_HALLUCINATION_SHORT}

Ты — опытный SMM-копирайтер и контент-стратег с 15-летним опытом.

Твоя задача: написать детальный промпт для генерации готового поста в соцсетях.

ПРАВИЛА — строго обязательны:
1. НИКОГДА не задавай вопросов. Используй весь предоставленный контекст о компании.
2. Если бриф короткий — раскрой его самостоятельно, опираясь на контекст компании.
3. Генерируй промпт прямо сейчас, без уточнений.
4. Промпт должен быть конкретным: формат поста, тон, структура, крюк, CTA.
5. В конце промпта ОБЯЗАТЕЛЬНО добавь строку:
   Верни СТРОГО JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }

Отвечай ТОЛЬКО промптом (текст, без JSON-обёртки и без вопросов).`
      : `${ANTI_HALLUCINATION_SHORT}

Ты — опытный SMM-сценарист вирального видеоконтента.

Твоя задача: написать детальный промпт для генерации сценария рилса/видео.

ПРАВИЛА — строго обязательны:
1. НИКОГДА не задавай вопросов. Используй весь предоставленный контекст о компании.
2. Если бриф короткий — раскрой его самостоятельно, опираясь на контекст компании.
3. Генерируй промпт прямо сейчас, без уточнений.
4. Промпт должен задавать: длительность (15/30/60 сек), структуру (крюк → интрига → проблема → решение → CTA), визуальный стиль, тон голоса.
5. В конце промпта ОБЯЗАТЕЛЬНО добавь строку:
   Верни СТРОГО JSON: { "title": "...", "scenario": "...", "voiceoverScript": "...", "hashtags": [...] }

Отвечай ТОЛЬКО промптом (текст, без JSON-обёртки и без вопросов).`;

    const userMsg = [
      companyBlock && `=== КОНТЕКСТ КОМПАНИИ ===\n${companyBlock}`,
      `=== БРИФ / ТЕМА ===\n${topic || "(без брифа — создай контент на основе компании и её позиционирования)"}`,
      `Тип: ${type === "post" ? "пост" : "рилс"}`,
    ].filter(Boolean).join("\n\n");

    const aiResult = await chatText({
      system: systemPrompt,
      user: userMsg,
      model: CHAT_MODEL_SMART,
      temperature: 0.75,
      maxTokens: 900,
    });
    const prompt = aiResult.text.trim();
    if (!prompt) {
      return NextResponse.json({ ok: false, error: aiResult.error ?? "Модель не ответила" }, { status: 500 });
    }

    await access.log({
      endpoint: "expand-prompt",
      model: aiResult.modelUsed,
      promptTokens: estimateTokens(systemPrompt + userMsg),
      completionTokens: estimateTokens(prompt),
    });
    return NextResponse.json({ ok: true, prompt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "expand-prompt", model: "claude", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
