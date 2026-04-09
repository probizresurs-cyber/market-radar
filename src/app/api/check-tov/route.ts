import { NextResponse } from "next/server";
import type { BrandBook, TovCheckResult } from "@/lib/content-types";

export const runtime = "nodejs";
export const maxDuration = 45;

const SYSTEM_PROMPT = `Ты — редактор бренд-голоса. Твоя работа — проверять тексты на соответствие брендбуку и исправлять нарушения.

Ты анализируешь:
1. Запрещённые слова и формулировки — ищи их дотошно, включая синонимы
2. Tone of voice — соответствует ли эмоция, формальность, энергетика текста
3. Стиль фраз — похож ли текст на примеры хороших фраз из брендбука
4. Формат — правильная ли структура для данной платформы

Будь конкретен. Цитируй проблемный фрагмент. Давай чёткое исправление.
Оценка 100 = идеальное соответствие. 0 = полное несоответствие.

Возвращай СТРОГО валидный JSON без markdown.`;

export async function POST(req: Request) {
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
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

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as TovCheckResult;
    parsed.checkedAt = new Date().toISOString();

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
