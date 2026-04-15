import { NextResponse } from "next/server";
import type { BrandBook } from "@/lib/content-types";

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
  try {
    const body = await req.json();
    const topic: string = body.topic ?? "";
    const type: "post" | "reel" = body.type ?? "post";
    const companyName: string = body.companyName ?? "";
    const bigIdea: string = body.bigIdea ?? "";
    const pillars: Array<{ name: string; description: string; share: string }> = body.pillars ?? [];
    const smmContext: string = body.smmContext ?? ""; // brief SMM summary if available
    const brandBook: BrandBook | null = body.brandBook ?? null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const pillarsText = pillars.map(p => `• ${p.name} (${p.share}): ${p.description}`).join("\n");

    const brandBookBlock = buildBrandBookBlock(brandBook);

    const companyBlock = [
      companyName && `Компания: ${companyName}`,
      bigIdea && `Большая идея бренда: ${bigIdea}`,
      pillarsText && `Контент-столпы:\n${pillarsText}`,
      smmContext && `Контекст бренда: ${smmContext}`,
      brandBookBlock && `Брендбук:\n${brandBookBlock}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = type === "post"
      ? `Ты — опытный SMM-копирайтер и контент-стратег с 15-летним опытом.

Твоя задача: написать детальный промпт для генерации готового поста в соцсетях.

ПРАВИЛА — строго обязательны:
1. НИКОГДА не задавай вопросов. Используй весь предоставленный контекст о компании.
2. Если бриф короткий — раскрой его самостоятельно, опираясь на контекст компании.
3. Генерируй промпт прямо сейчас, без уточнений.
4. Промпт должен быть конкретным: формат поста, тон, структура, крюк, CTA.
5. В конце промпта ОБЯЗАТЕЛЬНО добавь строку:
   Верни СТРОГО JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }

Отвечай ТОЛЬКО промптом (текст, без JSON-обёртки и без вопросов).`
      : `Ты — опытный SMM-сценарист вирального видеоконтента.

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

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
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
