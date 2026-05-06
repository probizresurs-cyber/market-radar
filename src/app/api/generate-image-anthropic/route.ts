/**
 * POST /api/generate-image-anthropic
 *
 * Two-step image generation:
 *   1. Claude Haiku writes a detailed, creative image prompt from post content
 *   2. OpenAI (DALL-E 3 / gpt-image-1) renders it
 *
 * Note: Anthropic does not generate images natively. Claude is used here as
 * an intelligent prompt engineer — он превращает текст поста в детальное
 * визуальное описание.
 *
 * Раньше рендеринг шёл через Gemini Flash Image, но бесплатный лимит
 * Google быстро выгорает (free_tier_requests = 0). Переключились на OpenAI:
 * тот же ключ, что и для GPT-4o, без отдельного билинга.
 *
 * Размер картинки выбирается по формату:
 *   - пост / карусель → square 1:1
 *   - сторис / рилс → portrait 9:16 (vertical)
 *
 * Body: {
 *   postText: string,        // post body / slide text
 *   hook?: string,           // post headline
 *   format?: string,         // "пост" | "карусель" | "рилс" | "сторис"
 *   platform?: string,       // "instagram" | "vk" | "telegram"
 *   brandColors?: string[],  // from BrandBook
 *   brandStyle?: string,     // BrandBook.visualStyle
 * }
 *
 * Returns: { ok, data: { imageUrl }, usedPrompt }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";
import { generateOpenAIImage } from "@/lib/openai-image";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const postText: string = (body.postText ?? body.prompt ?? "").trim();
    const hook: string = (body.hook ?? "").trim();
    const format: string = body.format ?? "пост";
    const platform: string = body.platform ?? "instagram";
    const brandColors: string[] = body.brandColors ?? [];
    const brandStyle: string = (body.brandStyle ?? "").trim();

    if (!postText && !hook) {
      return NextResponse.json(
        { ok: false, error: "Нет текста для генерации изображения" },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });

    // Маппинг формата в размер картинки.
    const imageFormat: "square" | "portrait" = (format === "сторис" || format === "рилс")
      ? "portrait"
      : "square";

    // — Step 1: Claude Haiku generates a rich visual prompt —
    const contextBlock = [
      `Формат контента: ${format} для ${platform}`,
      hook && `Заголовок: «${hook}»`,
      postText && `Текст: ${postText.slice(0, 400)}`,
      brandColors.length > 0 && `Цвета бренда: ${brandColors.join(", ")}`,
      brandStyle && `Визуальный стиль бренда: ${brandStyle}`,
    ]
      .filter(Boolean)
      .join("\n");

    const claudePrompt = `Ты арт-директор и prompt-инженер для AI-генерации изображений (DALL-E / OpenAI).

Создай детальный промпт на английском языке для генерации изображения к этому контенту:

${contextBlock}

Правила:
- Опиши конкретную визуальную сцену, метафору или объект, который усиливает смысл поста
- Укажи художественный стиль (photorealistic / flat design / 3D render / illustration / minimalist / cinematic etc.)
- Укажи освещение, цветовую палитру, композицию, детали
- Ориентация: ${imageFormat === "portrait" ? "vertical 9:16 (portrait)" : "square 1:1"}
- НЕ включай в изображение текст, надписи, буквы, логотипы, цифры, watermarks
- Длина промпта: 3-5 предложений, конкретные детали

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений или префикса.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: claudePrompt }],
    });

    let usedPrompt =
      message.content[0]?.type === "text"
        ? message.content[0].text.trim()
        : postText; // fallback to raw text if Claude fails

    // OpenAI отказывается генерировать текст в изображениях; на всякий случай
    // дописываем явный запрет, чтобы Haiku его не упустил.
    if (!/no text|without text|no letters/i.test(usedPrompt)) {
      usedPrompt += " No text, letters, words, or watermarks in the image.";
    }

    // — Step 2: OpenAI renders the prompt —
    const imgResult = await generateOpenAIImage({
      prompt: usedPrompt,
      format: imageFormat,
    });

    if (!imgResult.ok) {
      return NextResponse.json(
        { ok: false, error: imgResult.error, usedPrompt },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: { imageUrl: imgResult.imageUrl },
      usedPrompt,
      provider: "openai",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
