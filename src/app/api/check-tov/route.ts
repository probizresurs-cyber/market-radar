import { NextResponse } from "next/server";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { chatJson } from "@/lib/ai-chat";
import type { BrandBook, TovCheckResult } from "@/lib/content-types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 45;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — редактор бренд-голоса. Твоя работа — проверять тексты на соответствие брендбуку и исправлять нарушения.

Ты анализируешь:
1. Запрещённые слова и формулировки — ищи их дотошно, включая синонимы
2. Tone of voice — соответствует ли эмоция, формальность, энергетика текста
3. Стиль фраз — похож ли текст на примеры хороших фраз из брендбука
4. Формат — правильная ли структура для данной платформы

Будь конкретен. Цитируй проблемный фрагмент. Давай чёткое исправление.
Оценка 100 = идеальное соответствие. 0 = полное несоответствие.

Возвращай СТРОГО валидный JSON без markdown.`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const hook: string = body.hook ?? "";
    const text: string = body.text ?? "";
    const hashtags: string[] = body.hashtags ?? [];
    const platform: string = body.platform ?? "";
    const brandBook: BrandBook | null = body.brandBook ?? null;

    if (!text && !hook) {
      return NextResponse.json({ ok: false, error: "Нет текста для проверки" }, { status: 400 });
    }
    if (!brandBook || (!brandBook.toneOfVoice?.length && !brandBook.forbiddenWords?.length && !brandBook.goodPhrases?.length)) {
      return NextResponse.json({ ok: false, error: "Брендбук пустой — заполните хотя бы tone of voice, запрещённые слова или примеры фраз" }, { status: 400 });
    }

    const brandLines = [
      brandBook.brandName && `Бренд: ${brandBook.brandName}`,
      brandBook.tagline && `Слоган: ${brandBook.tagline}`,
      brandBook.toneOfVoice?.length && `Tone of voice: ${brandBook.toneOfVoice.join(", ")}`,
      brandBook.forbiddenWords?.length && `Запрещённые слова: ${brandBook.forbiddenWords.join(", ")}`,
      brandBook.goodPhrases?.length && `Примеры фирменных фраз:\n${brandBook.goodPhrases.map(p => `  «${p}»`).join("\n")}`,
    ].filter(Boolean).join("\n");

    const userPrompt = `Проверь пост на соответствие брендбуку.

БРЕНДБУК:
${brandLines}

ПОСТ (платформа: ${platform || "неизвестно"}):
Крючок: «${hook}»
Текст:
${text}
Хэштеги: ${hashtags.join(" ")}

Верни JSON:
{
  "score": число 0-100,
  "verdict": "короткий вердикт (1 предложение)",
  "issues": [
    {
      "type": "forbidden_word|wrong_tone|missing_phrase_style|format",
      "text": "цитата проблемного фрагмента",
      "explanation": "почему нарушение",
      "suggestion": "как исправить"
    }
  ],
  "correctedHook": "исправленный крючок (или тот же, если ok)",
  "correctedBody": "исправленный текст поста"
}

Если issues пустой — score должен быть 85-100. Если issues есть — score ниже соответственно.
correctedHook и correctedBody — всегда готовый к публикации текст, полностью в стиле брендбука.`;

    // Claude вместо gpt-4o-mini: api.openai.com стоит за Cloudflare, поэтому
    // наш воркер для него прокси быть не может (см. lib/ai-chat.ts).
    const { data: parsedRaw, raw: rawContent, modelUsed, error: aiError } = await chatJson<TovCheckResult>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 2000,
      temperature: 0.3,
    });

    if (!parsedRaw) {
      return NextResponse.json(
        { ok: false, error: aiError ?? `Не удалось разобрать ответ AI как JSON: ${rawContent.slice(0, 100)}` },
        { status: 502 },
      );
    }
    const parsed: TovCheckResult = parsedRaw;

    // Гарантируем обязательные поля — AI иногда возвращает {} или обрезанный JSON.
    parsed.checkedAt = new Date().toISOString();
    if (typeof parsed.score !== "number") parsed.score = 50;
    if (!parsed.verdict) parsed.verdict = "neutral";
    if (!Array.isArray(parsed.issues)) parsed.issues = [];
    // matchPercentage не в типе — пропускаем

    await access.log({
      endpoint: "check-tov",
      model: modelUsed,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userPrompt),
      completionTokens: estimateTokens(rawContent),
    });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "check-tov", model: "claude", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
