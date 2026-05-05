/**
 * POST /api/generate-image-anthropic
 *
 * Two-step image generation:
 *   1. Claude Haiku writes a detailed, creative image prompt from post content
 *   2. Gemini Flash Image renders it
 *
 * Note: Anthropic does not generate images natively. Claude is used here as
 * an intelligent prompt engineer — it transforms post text / context into
 * a rich visual description that Gemini can render much more effectively
 * than a manually written prompt.
 *
 * Body: {
 *   postText: string,        // post body / slide text
 *   hook?: string,           // post headline
 *   format?: string,         // "пост" | "карусель" | "рилс" | "сторис"
 *   platform?: string,       // "instagram" | "vk" | "telegram"
 *   brandColors?: string[],  // from BrandBook
 *   brandStyle?: string,     // BrandBook.visualStyle
 *   referenceImages?: Array<{ data: string; mimeType: string }>,
 * }
 *
 * Returns: { ok, data: { imageUrl, usedPrompt } }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";
import { generateGeminiImage } from "@/lib/gemini";

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
    const referenceImages: Array<{ data: string; mimeType: string }> =
      body.referenceImages ?? [];

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

    const claudePrompt = `Ты арт-директор и prompt-инженер для AI-генерации изображений.

Создай детальный промпт на английском языке для генерации изображения к этому контенту:

${contextBlock}

Правила:
- Опиши конкретную визуальную сцену, метафору или объект, который усиливает смысл поста
- Укажи художественный стиль (фотореализм / flat design / 3D render / illustration / etc.)
- Укажи освещение, цветовую палитру, композицию
- Формат: square 1:1 для поста/карусели, vertical 9:16 для сторис/рилс
- Без текста, надписей, букв в изображении
- Длина: 2-4 предложения

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: claudePrompt }],
    });

    const usedPrompt =
      message.content[0]?.type === "text"
        ? message.content[0].text.trim()
        : postText; // fallback to raw text if Claude fails

    // — Step 2: Gemini renders the prompt —
    const imgResult = await generateGeminiImage({
      prompt: usedPrompt,
      referenceImages,
    });

    if (!imgResult.ok) {
      return NextResponse.json({ ok: false, error: imgResult.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: { imageUrl: imgResult.imageUrl },
      usedPrompt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
