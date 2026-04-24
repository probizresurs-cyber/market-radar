import { NextResponse } from "next/server";
import type { GeneratedPost, ContentPostIdea, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { CompanyStyleProfile } from "@/lib/company-style-types";
import { checkAiAccess } from "@/lib/with-ai-security";
import { generateGeminiImage } from "@/lib/gemini";

function buildStyleBlock(sp: CompanyStyleProfile | null): string {
  if (!sp) return "";
  const lines: string[] = [];
  if (sp.styleGuideText) lines.push(sp.styleGuideText);
  else {
    if (sp.summary) lines.push(sp.summary);
    if (sp.toneDescriptors?.length) lines.push(`Тон: ${sp.toneDescriptors.join(", ")}`);
    if (sp.vocabulary?.favoriteWords?.length) lines.push(`Любимые слова: ${sp.vocabulary.favoriteWords.join(", ")}`);
    if (sp.vocabulary?.avoidWords?.length) lines.push(`НЕ использовать: ${sp.vocabulary.avoidWords.join(", ")}`);
  }
  if (sp.examplePhrases?.length) {
    lines.push(`Примеры фраз компании:\n${sp.examplePhrases.slice(0, 6).map(p => `— «${p}»`).join("\n")}`);
  }
  return `\nСТИЛЬ КОМПАНИИ (обязательно соблюдать — это важнее любых других инструкций по тону):\n${lines.join("\n")}\n`;
}

function buildBrandBookBlock(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.brandName) lines.push(`- Название бренда: ${bb.brandName}`);
  if (bb.tagline) lines.push(`- Слоган: ${bb.tagline}`);
  if (bb.mission) lines.push(`- Миссия: ${bb.mission}`);
  if (bb.toneOfVoice?.length) lines.push(`- Tone of voice: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`- НЕ использовать слова: ${bb.forbiddenWords.join(", ")}`);
  if (bb.goodPhrases?.length) lines.push(`- Примеры фирменных фраз:\n  ${bb.goodPhrases.map(p => `«${p}»`).join("\n  ")}`);
  if (bb.visualStyle) lines.push(`- Визуальный стиль для картинок: ${bb.visualStyle}`);
  if (bb.colors?.length) lines.push(`- Цветовая палитра: ${bb.colors.join(", ")}`);
  if (!lines.length) return "";
  return `\nБРЕНДБУК (строго соблюдать):\n${lines.join("\n")}\n`;
}

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

function buildPrompt(companyName: string, idea: ContentPostIdea, smm: SMMResult | null, brandBook: BrandBook | null, styleProfile: CompanyStyleProfile | null): string {
  const smmBlock = smm ? `
Бренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}
УТП: ${smm.brandIdentity.uniqueValue}
Тон: ${smm.brandIdentity.toneOfVoice.join(", ")}
Боли ЦА: ${smm.contentStrategy.audienceProblems.join("; ")}
` : "";

  const brandBlock = buildBrandBookBlock(brandBook);
  const styleBlock = buildStyleBlock(styleProfile);

  return `Разверни идею поста в готовый пост для платформы ${idea.platform}.

Компания: ${companyName}
${smmBlock}${brandBlock}${styleBlock}
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
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const idea: ContentPostIdea = body.idea;
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const styleProfile: CompanyStyleProfile | null = body.companyStyleProfile ?? null;
    const generateImage: boolean = body.generateImage !== false;
    const userPrompt: string = body.userPrompt ?? ""; // custom prompt override
    const referenceImages: Array<{ data: string; mimeType: string }> = body.referenceImages ?? [];

    if (!idea) {
      return NextResponse.json({ ok: false, error: "Не передана идея поста" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    // 1) Generate text
    // Even if userPrompt is provided, append brandBook + style rules so they aren't ignored
    const brandBlockForCustom = buildBrandBookBlock(brandBook);
    const styleBlockForCustom = buildStyleBlock(styleProfile);
    const extraCustomRules = [brandBlockForCustom, styleBlockForCustom].filter(Boolean).join("\n");
    const userMessage = userPrompt.trim()
      ? (extraCustomRules ? `${userPrompt.trim()}\n${extraCustomRules}` : userPrompt.trim())
      : buildPrompt(companyName, idea, smm, brandBook, styleProfile);
    const textRes = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
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

    // 2) Generate image via Gemini — opt-in, не фейлим пост, если картинка не вышла.
    let imageUrl: string | undefined;
    const imageError: string | undefined = undefined;
    if (generateImage && parsed.imagePrompt) {
      try {
        const brandVisual = brandBook?.visualStyle?.trim();
        const brandColors = brandBook?.colors?.length
          ? `Brand colors: ${brandBook.colors.join(", ")}.`
          : "";
        const enrichedPrompt = [
          parsed.imagePrompt,
          brandVisual && `Brand visual style: ${brandVisual}.`,
          brandColors,
        ].filter(Boolean).join(" ");

        const imgResult = await generateGeminiImage({
          prompt: enrichedPrompt,
          referenceImages,
        });
        if (imgResult.ok) imageUrl = imgResult.imageUrl;
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

    await access.log({ endpoint: "generate-post", model: "claude-sonnet-4-6" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
