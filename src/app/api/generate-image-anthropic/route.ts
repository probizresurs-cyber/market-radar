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
 *   userPrompt?: string,     // если задан — пропускаем шаг 1 (Claude),
 *                            // используем эту строку напрямую как промпт DALL-E.
 *                            // Полезно для UI «отредактируй промпт перед генерацией».
 * }
 *
 * Returns: { ok, data: { imageUrl }, usedPrompt }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";
import { generateOpenAIImage } from "@/lib/openai-image";
import { GEMINI_API_KEY, generateGeminiImage } from "@/lib/gemini";
import { generatePollinationsImage } from "@/lib/pollinations-image";
import { platformImageFormat } from "@/lib/image-aspect";

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
    // userPrompt: если передан — пропускаем шаг 1 (Claude) и рисуем именно его.
    const userPrompt: string = (body.userPrompt ?? "").trim();

    if (!postText && !hook && !userPrompt) {
      return NextResponse.json(
        { ok: false, error: "Нет текста для генерации изображения" },
        { status: 400 },
      );
    }

    // Platform-aware aspect: учитываем и формат (сторис/рилс/пост), и платформу
    // (Instagram feed → square, LinkedIn → landscape, TikTok → portrait).
    const imageFormat = platformImageFormat(platform, format);

    let usedPrompt: string;

    if (userPrompt) {
      // — Прямой режим: пользователь сам отредактировал/принял промпт.
      // Не дёргаем Claude — экономим токены и время.
      usedPrompt = userPrompt;
    } else {
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
- Ориентация: ${imageFormat === "portrait" ? "vertical 9:16 (portrait)" : imageFormat === "landscape" ? "horizontal 16:9 (landscape)" : "square 1:1"}
- НЕ включай в изображение текст, надписи, буквы, логотипы, цифры, watermarks
- Длина промпта: 3-5 предложений, конкретные детали

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений или префикса.`;

      const { text } = await safeAnthropicCreate({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        messages: [{ role: "user", content: claudePrompt }],
      });

      // Если ни Haiku, ни Sonnet не ответили — используем сырой текст поста
      // как fallback-промпт, чтобы DALL-E всё равно нарисовал хоть что-то.
      usedPrompt = text || postText;
    }

    // OpenAI отказывается генерировать текст в изображениях; на всякий случай
    // дописываем явный запрет, чтобы Haiku/пользователь его не упустил.
    if (!/no text|without text|no letters/i.test(usedPrompt)) {
      usedPrompt += " No text, letters, words, or watermarks in the image.";
    }

    // — Step 2: OpenAI renders the prompt —
    const imgResult = await generateOpenAIImage({
      prompt: usedPrompt,
      format: imageFormat,
    });

    // Если OpenAI отказал (quota / billing / rate-limit) — пробуем Gemini
    // как fallback, чтобы у пользователя не пропадал контент-завод из-за
    // того что у нас кончился баланс OpenAI.
    if (!imgResult.ok) {
      const isQuotaIssue =
        /Лимит OpenAI|квота OpenAI|rate.?limit|billing/i.test(imgResult.error ?? "");

      if (isQuotaIssue) {
        // Цепочка fallback: Gemini → Pollinations (free, no key)
        const aspectHint = imageFormat === "portrait"
          ? " Render in vertical 9:16 aspect ratio (portrait orientation)."
          : imageFormat === "landscape"
          ? " Render in horizontal 16:9 aspect ratio (landscape orientation)."
          : " Render in square 1:1 aspect ratio.";
        const noTextHint = " No text, letters, words, or watermarks in the image.";

        // Try Gemini if available
        if (GEMINI_API_KEY) {
          const gem = await generateGeminiImage({
            prompt: usedPrompt + aspectHint + noTextHint,
          });
          if (gem.ok) {
            return NextResponse.json({
              ok: true,
              data: { imageUrl: gem.imageUrl },
              usedPrompt,
              provider: "gemini",
              fallbackReason: "openai-quota",
            });
          }
          // Gemini тоже упал — пробуем pollinations
        }

        // Pollinations.ai — free, no API key. Последний резервный вариант.
        const poll = await generatePollinationsImage({
          prompt: usedPrompt + noTextHint,
          format: imageFormat,
          model: "flux",
        });
        if (poll.ok) {
          return NextResponse.json({
            ok: true,
            data: { imageUrl: poll.imageUrl },
            usedPrompt,
            provider: "pollinations",
            fallbackReason: "openai-quota",
          });
        }

        // Все 3 провайдера упали
        return NextResponse.json(
          {
            ok: false,
            error: `${imgResult.error}. Все резервные генераторы тоже недоступны (Pollinations: ${poll.error}).`,
            usedPrompt,
          },
          { status: 502 },
        );
      }

      return NextResponse.json(
        { ok: false, error: imgResult.error, usedPrompt },
        { status: imgResult.status ?? 500 },
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
