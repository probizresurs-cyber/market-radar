import { NextResponse } from "next/server";
import type { GeneratedPost, ContentPostIdea } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Ты — эмоциональный копирайтер с 50-летним опытом и instagram-сторителлер с 25-летним опытом одновременно.

Ты пишешь так, что люди останавливаются на середине ленты:
- Каждое слово на своём месте
- Никакой воды
- Эмоции, конкретика, сила слова
- Используешь приёмы: контраст, повторы, парадокс, недосказанность, цифры, истории
- Знаешь маркетинговые модели: AIDA, PAS, BAB, FAB, Storybrand
- Подстраиваешь длину и формат под платформу

Твоя задача — взять ИДЕЮ поста и развернуть её в готовый пост, который завтра можно публиковать.

ВАЖНО: Ты отвечаешь ТОЛЬКО валидным JSON. Без markdown.`;

function buildPrompt(companyName: string, idea: ContentPostIdea, smm: SMMResult | null): string {
  const smmBlock = smm ? `
Бренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}
УТП: ${smm.brandIdentity.uniqueValue}
Тон: ${smm.brandIdentity.toneOfVoice.join(", ")}
Боли ЦА: ${smm.contentStrategy.audienceProblems.join("; ")}
` : "";

  return `Разверни идею поста в готовый пост для платформы ${idea.platform}.

Компания: ${companyName}
${smmBlock}
ИДЕЯ:
- Контент-столп: ${idea.pillar}
- Формат: ${idea.format}
- Крючок: ${idea.hook}
- Угол подачи: ${idea.angle}
- Цель: ${idea.goal}
- CTA: ${idea.cta}

Напиши:
1. Финальный сильный крючок (заголовок) — может быть переписан, чтобы цеплял
2. Основной текст поста:
   - carousel: 6-8 экранов, каждый экран отделяй строкой "---", без пометок "Слайд N"
   - single: до 800 знаков
   - longread: 1500-2500 знаков
   - story: короткий, 1-3 предложения, ёмко
3. Хэштеги (5-10)
4. Промпт для DALL-E 3 — описание визуала: стиль, композиция, цвета, настроение, без текста на картинке. Промпт пиши на английском.

Верни СТРОГО JSON:
{
  "hook": "финальный крючок",
  "body": "полный текст поста",
  "hashtags": ["#tag1", "#tag2"],
  "imagePrompt": "english DALL-E prompt for the image"
}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const idea: ContentPostIdea = body.idea;
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const generateImage: boolean = body.generateImage !== false;
    const userPrompt: string = body.userPrompt ?? ""; // custom prompt override

    if (!idea) {
      return NextResponse.json({ ok: false, error: "Не передана идея поста" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    // 1) Generate text
    const userMessage = userPrompt.trim() || buildPrompt(companyName, idea, smm);
    const textRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
        temperature: 0.9,
        max_tokens: 3500,
        response_format: { type: "json_object" },
      }),
    });

    if (!textRes.ok) {
      const errBody = await textRes.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI text error ${textRes.status}: ${errBody.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const textData = await textRes.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(textData.choices[0]?.message?.content ?? "{}") as {
      hook: string; body: string; hashtags: string[]; imagePrompt: string;
    };

    // 2) Generate image (DALL-E 3) — optional
    let imageUrl: string | undefined;
    if (generateImage && parsed.imagePrompt) {
      try {
        const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: parsed.imagePrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
          }),
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json() as { data: Array<{ url: string }> };
          imageUrl = imgData.data?.[0]?.url;
        }
      } catch { /* image is optional */ }
    }

    const result: GeneratedPost = {
      id: `post-${Date.now()}`,
      ideaId: idea.id,
      pillar: idea.pillar,
      hook: parsed.hook ?? idea.hook,
      body: parsed.body ?? "",
      hashtags: parsed.hashtags ?? [],
      imagePrompt: parsed.imagePrompt ?? "",
      imageUrl,
      platform: idea.platform,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
