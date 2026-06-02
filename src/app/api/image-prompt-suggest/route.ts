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
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { safeAnthropicCreate, proxyErrorMessage } from "@/lib/anthropic-safe";
import { platformImageFormat } from "@/lib/image-aspect";

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
    // Контекст компании — без этого на омонимах AI уезжает в чужую нишу.
    const companyName: string = (body.companyName ?? "").trim();
    const companyNiche: string = (body.companyNiche ?? body.niche ?? "").trim();
    const companyDescription: string = (body.companyDescription ?? "").trim().slice(0, 300);

    if (!postText && !hook) {
      return NextResponse.json(
        { ok: false, error: "Нет текста для промпта" },
        { status: 400 },
      );
    }

    // Platform-aware aspect: учитываем формат + платформу (LinkedIn → landscape,
    // Instagram feed → square, stories/reels/TikTok → portrait и т.д.)
    const imageFormat = platformImageFormat(platform, format);

    const contextBlock = [
      companyName && `Компания: ${companyName}`,
      companyNiche && `Ниша: ${companyNiche}`,
      companyDescription && `Описание: ${companyDescription}`,
      `Формат контента: ${format} для ${platform}`,
      hook && `Заголовок: «${hook}»`,
      postText && `Текст: ${postText.slice(0, 400)}`,
      brandColors.length > 0 && `Цвета бренда: ${brandColors.join(", ")}`,
      brandStyle && `Визуальный стиль бренда: ${brandStyle}`,
    ].filter(Boolean).join("\n");

    const claudePrompt = `${ANTI_HALLUCINATION_SHORT}

Ты арт-директор и prompt-инженер для AI-генерации изображений (DALL-E / OpenAI).

Создай детальный промпт на английском языке для генерации изображения к этому контенту:

${contextBlock}

Правила:
- Опиши конкретную визуальную сцену, метафору или объект, который усиливает смысл поста
- Укажи художественный стиль (photorealistic / flat design / 3D render / illustration / minimalist / cinematic etc.)
- Укажи освещение, цветовую палитру, композицию, детали
- Ориентация: ${imageFormat === "portrait" ? "vertical 9:16 (portrait)" : imageFormat === "landscape" ? "horizontal 16:9 (landscape)" : "square 1:1"}
- НЕ включай в изображение текст, надписи, буквы, логотипы, цифры
- Длина промпта: 3-5 предложений, конкретные детали

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений или префикса.`;

    const { text, proxyDegraded, error } = await safeAnthropicCreate({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: claudePrompt }],
    });

    if (!text) {
      return NextResponse.json(
        { ok: false, error: proxyDegraded ? proxyErrorMessage() : (error ?? "Не удалось получить промпт") },
        { status: proxyDegraded ? 502 : 500 },
      );
    }

    return NextResponse.json({ ok: true, prompt: text });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: raw }, { status: 500 });
  }
}
