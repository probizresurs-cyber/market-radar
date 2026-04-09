import { NextResponse } from "next/server";
import type { GeneratedStory, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — мастер сторителлинга в сторис. Знаешь, что у сторис есть 3 секунды, чтобы зацепить.

Принципы:
1. Каждый слайд — одна мысль. Никакого многабукв.
2. Заголовок — максимум 5-7 слов. Бьёт в эмоцию или любопытство.
3. Серия должна иметь нарратив: завязка → развитие → кульминация → CTA.
4. Последний слайд всегда с CTA.
5. Стикеры (опрос, вопрос, slider) на 2-4 слайдах — резко поднимают охват.

Возвращаешь СТРОГО валидный JSON без markdown.`;

function buildStoriesPrompt(
  companyName: string,
  platform: string,
  slidesCount: number,
  goal: string,
  brief: string,
  pillar: string,
  smm: SMMResult | null,
  brandBook: BrandBook | null,
): string {
  const smmBlock = smm
    ? `\nБренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}\nТон: ${smm.brandIdentity.toneOfVoice.join(", ")}\n`
    : "";

  const brandBlock = brandBook
    ? [
        brandBook.toneOfVoice?.length && `ToV: ${brandBook.toneOfVoice.join(", ")}`,
        brandBook.forbiddenWords?.length && `Запрещённые слова: ${brandBook.forbiddenWords.join(", ")}`,
        brandBook.visualStyle && `Визуальный стиль: ${brandBook.visualStyle}`,
        brandBook.colors?.length && `Цвета бренда: ${brandBook.colors.join(", ")}`,
      ].filter(Boolean).join("\n")
    : "";

  return `Создай серию из ${slidesCount} сторис для ${platform} компании «${companyName}».
${smmBlock}${brandBlock ? `\nБРЕНДБУК:\n${brandBlock}\n` : ""}
Контент-столп: ${pillar}
Цель серии: ${goal}
Тема / бриф: ${brief || "На твоё усмотрение по контент-столпу"}

Верни JSON:
{
  "title": "внутреннее название серии (4-6 слов)",
  "hashtags": ["#тег1", "#тег2", "#тег3", "#тег4", "#тег5"],
  "slides": [
    {
      "order": 1,
      "background": "описание фона (цвет / фото / градиент / кадр)",
      "headlineText": "КРУПНЫЙ ТЕКСТ НА ЭКРАНЕ (3-6 слов)",
      "bodyText": "маленький поясняющий текст под заголовком (или null)",
      "sticker": "тип стикера и текст — например: 'опрос: Согласен? ДА/НЕТ' или null",
      "cta": "призыв к действию — например: 'Свайп вверх ↑' или null",
      "visualNote": "режиссёрская пометка: шрифт, анимация, акцентный цвет"
    }
  ]
}

Слайды ${slidesCount} штук. Последний — обязательно с CTA. Стикеры на 1-2 промежуточных слайдах.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const platform: "instagram" | "vk" | "telegram" = body.platform ?? "instagram";
    const slidesCount: number = body.slidesCount ?? 5;
    const goal: string = body.goal ?? "прогрев";
    const brief: string = body.brief ?? "";
    const pillar: string = body.pillar ?? "";
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const userMessage = buildStoriesPrompt(
      companyName, platform, slidesCount, goal, brief, pillar, smm, brandBook,
    );

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
          { role: "user", content: userMessage },
        ],
        temperature: 0.85,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as {
      title: string;
      hashtags: string[];
      slides: GeneratedStory["slides"];
    };

    const result: GeneratedStory = {
      id: `story-${Date.now()}`,
      pillar,
      platform,
      goal,
      title: parsed.title ?? brief ?? "Серия сторис",
      slides: (parsed.slides ?? []).map((s, i) => ({ ...s, order: i + 1 })),
      hashtags: parsed.hashtags ?? [],
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
