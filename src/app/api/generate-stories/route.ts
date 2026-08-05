import { NextResponse } from "next/server";
import type { GeneratedStory, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { TASegment } from "@/lib/ta-types";
import { buildSegmentBlock } from "@/lib/ta-segment-prompt";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — мастер сторителлинга в сторис. Знаешь, что у сторис есть 3 секунды, чтобы зацепить.

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
  taSegment: TASegment | null = null,
): string {
  const smmBlock = smm
    ? `\nБренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}\nТон: ${smm.brandIdentity.toneOfVoice.join(", ")}\n`
    : "";
  const segmentBlock = buildSegmentBlock(taSegment);

  const brandBlock = brandBook
    ? [
        brandBook.toneOfVoice?.length && `ToV: ${brandBook.toneOfVoice.join(", ")}`,
        brandBook.forbiddenWords?.length && `Запрещённые слова: ${brandBook.forbiddenWords.join(", ")}`,
        brandBook.visualStyle && `Визуальный стиль: ${brandBook.visualStyle}`,
        brandBook.colors?.length && `Цвета бренда: ${brandBook.colors.join(", ")}`,
      ].filter(Boolean).join("\n")
    : "";

  return `Создай серию из ${slidesCount} сторис для ${platform} компании «${companyName}».
${smmBlock}${segmentBlock}${brandBlock ? `\nБРЕНДБУК:\n${brandBlock}\n` : ""}
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
      "background": "Image prompt in ENGLISH for AI generator: visual scene, composition, mood, colors, style. 1-2 sentences.",
      "backgroundRu": "То же самое описание, но на РУССКОМ — для показа пользователю. Например: 'Тёплый офисный интерьер с большими окнами, мягкий вечерний свет, женщина смотрит в ноутбук.'",
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
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const platform: "instagram" | "vk" | "telegram" = body.platform ?? "instagram";
    const slidesCount: number = Math.max(2, Math.min(10, Number(body.slidesCount) || 5));
    const goal: string = body.goal ?? "прогрев";
    const brief: string = body.brief ?? "";
    const pillar: string = body.pillar ?? "";
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const taSegment: TASegment | null = body.taSegment ?? null;

    const userMessage = buildStoriesPrompt(
      companyName, platform, slidesCount, goal, brief, pillar, smm, brandBook, taSegment,
    );

    const aiResult = await chatJson<{ title: string; hashtags: string[]; slides: GeneratedStory["slides"] }>({
      system: SYSTEM_PROMPT,
      user: userMessage,
      model: CHAT_MODEL_SMART,
      temperature: 0.85,
      maxTokens: 4500,
    });
    if (!aiResult.data) {
      return NextResponse.json(
        { ok: false, error: `Не удалось получить сторис: ${aiResult.error ?? "нет ответа модели"}` },
        { status: 500 },
      );
    }
    const parsed = aiResult.data;

    const result: GeneratedStory = {
      id: `story-${Date.now()}`,
      pillar,
      platform,
      goal,
      title: parsed.title ?? brief ?? "Серия сторис",
      // Жёстко обрезаем до запрошенного числа — GPT иногда добавляет лишний
      // «бонусный» слайд от себя, особенно при slidesCount=2-3.
      slides: (parsed.slides ?? []).slice(0, slidesCount).map((s, i) => ({ ...s, order: i + 1 })),
      hashtags: parsed.hashtags ?? [],
      generatedAt: new Date().toISOString(),
    };

    await access.log({ endpoint: "generate-stories", model: aiResult.modelUsed });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
