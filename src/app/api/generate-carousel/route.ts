import { NextResponse } from "next/server";
import type { GeneratedCarousel, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — топовый контент-дизайнер Instagram-каруселей.

Принципы хорошей карусели:
1. Первый слайд (cover) — мощный крючок, который заставляет свайпнуть. 3-6 слов, визуально контрастный.
2. Слайды 2..N-1 — каждый одна мысль, раскрывает ценность. Лучше короткие bullets, чем длинный текст.
3. Последний слайд (cta) — чёткий призыв: подписаться, сохранить, перейти в сайт, оставить заявку.
4. Нарратив: проблема → причины → решение → результат → CTA. Или: миф → факт → доказательство → CTA.
5. Карусель — образовательный/вовлекающий формат, а не продающая портянка.

Возвращаешь СТРОГО валидный JSON без markdown и без комментариев.`;

function buildCarouselPrompt(
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

  return `Создай образовательную карусель из ${slidesCount} слайдов для ${platform} компании «${companyName}».
${smmBlock}${brandBlock ? `\nБРЕНДБУК:\n${brandBlock}\n` : ""}
Контент-столп: ${pillar}
Цель: ${goal}
Тема / бриф: ${brief || "На твоё усмотрение по контент-столпу"}

Структура: 1-й слайд = cover (крючок), 2..${slidesCount - 1} = content (ценность), последний = cta.

Верни JSON:
{
  "title": "внутреннее название карусели (4-6 слов)",
  "caption": "ПОЛНЫЙ основной текст поста, публикуется под каруселью. 4-8 абзацев. Раскрывает тему глубже, чем слайды. Заканчивается вопросом или CTA, стимулирующим комментарии. Без хэштегов в конце — они отдельно.",
  "hashtags": ["#тег1", "#тег2", "#тег3", "#тег4", "#тег5", "#тег6", "#тег7"],
  "slides": [
    {
      "order": 1,
      "slideType": "cover",
      "background": "описание картинки для фона слайда (цвет, сцена, настроение)",
      "headlineText": "КРУПНЫЙ ТЕКСТ (3-7 слов)",
      "bodyText": "короткое пояснение под заголовком или null",
      "bulletPoints": null,
      "visualNote": "режиссёрская пометка: шрифт, композиция, акцент"
    },
    {
      "order": 2,
      "slideType": "content",
      "background": "описание картинки/фона",
      "headlineText": "ЗАГОЛОВОК СЛАЙДА",
      "bodyText": "пояснение или null если есть bulletPoints",
      "bulletPoints": ["пункт 1", "пункт 2", "пункт 3"],
      "visualNote": "пометка"
    }
  ]
}

Слайдов ${slidesCount} штук. Первый = cover, последний = cta, остальные = content. На content-слайдах предпочтительно 3-4 bulletPoints ИЛИ один яркий bodyText — без перегрузки.`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const platform: "instagram" | "vk" | "telegram" = body.platform ?? "instagram";
    const slidesCount: number = Math.max(3, Math.min(10, Number(body.slidesCount) || 7));
    const goal: string = body.goal ?? "обучение";
    const brief: string = body.brief ?? "";
    const pillar: string = body.pillar ?? "";
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const userMessage = buildCarouselPrompt(
      companyName, platform, slidesCount, goal, brief, pillar, smm, brandBook,
    );

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
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
        temperature: 0.8,
        max_tokens: 3500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as {
      title?: string;
      caption?: string;
      hashtags?: string[];
      slides?: GeneratedCarousel["slides"];
    };

    const slides = (parsed.slides ?? []).map((s, i, arr) => ({
      ...s,
      order: i + 1,
      slideType: s.slideType ?? (i === 0 ? "cover" : i === arr.length - 1 ? "cta" : "content"),
      bulletPoints: Array.isArray(s.bulletPoints) ? s.bulletPoints : undefined,
    }));

    const result: GeneratedCarousel = {
      id: `carousel-${Date.now()}`,
      pillar,
      platform,
      goal,
      title: parsed.title ?? brief ?? "Карусель",
      caption: parsed.caption ?? "",
      slides,
      hashtags: parsed.hashtags ?? [],
      generatedAt: new Date().toISOString(),
    };

    await access.log({ endpoint: "generate-carousel", model: "gpt-4o" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
