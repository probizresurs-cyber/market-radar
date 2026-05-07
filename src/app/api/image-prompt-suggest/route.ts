/**
 * POST /api/image-prompt-suggest
 *
 * Claude Haiku пишет детальный английский промпт для DALL-E из контекста поста,
 * НО НЕ генерирует картинку. Используется в UI: сначала пользователь видит и
 * может отредактировать промпт, потом нажимает «Сгенерировать».
 *
 * Body: same as /api/generate-image-anthropic, минус результат.
 *   { postText, hook, format, platform, brandColors, brandStyle }
 *
 * Returns: { ok, prompt }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

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
        { ok: false, error: "Нет текста для промпта" },
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

    const imageFormat: "square" | "portrait" =
      (format === "сторис" || format === "рилс") ? "portrait" : "square";

    const contextBlock = [
      `Формат контента: ${format} для ${platform}`,
      hook && `Заголовок: «${hook}»`,
      postText && `Текст: ${postText.slice(0, 400)}`,
      brandColors.length > 0 && `Цвета бренда: ${brandColors.join(", ")}`,
      brandStyle && `Визуальный стиль бренда: ${brandStyle}`,
    ].filter(Boolean).join("\n");

    const claudePrompt = `Ты арт-директор и prompt-инженер для AI-генерации изображений (DALL-E / OpenAI).

Создай детальный промпт на английском языке для генерации изображения к этому контенту:

${contextBlock}

Правила:
- Опиши конкретную визуальную сцену, метафору или объект, который усиливает смысл поста
- Укажи художественный стиль (photorealistic / flat design / 3D render / illustration / minimalist / cinematic etc.)
- Укажи освещение, цветовую палитру, композицию, детали
- Ориентация: ${imageFormat === "portrait" ? "vertical 9:16 (portrait)" : "square 1:1"}
- НЕ включай в изображение текст, надписи, буквы, логотипы, цифры
- Длина промпта: 3-5 предложений, конкретные детали

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений или префикса.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: claudePrompt }],
    });

    const prompt =
      message.content[0]?.type === "text"
        ? message.content[0].text.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Claude не вернул промпт. Попробуйте ещё раз." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, prompt });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
