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
import { platformImageFormat } from "@/lib/image-aspect";
import { generateImageWithFallback } from "@/lib/image-gen";

export const runtime = "nodejs";
// 180s — даём время на: Claude Haiku промпт (5-10с) + OpenAI gpt-image-2
// medium quality (~30-50с) + fallback на Gemini (10-15с) при таймауте/quota.
// Раньше 60с — успевал только сам OpenAI, fallback не вызывался при таймауте.
export const maxDuration = 180;

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
    // Контекст компании — критически важно для правильного визуала.
    // Без этого на омонимах («Менделеев», «Кристалл», «Восход») AI уезжал
    // в самую частую ассоциацию (например, стоматология для имени, которое
    // на самом деле — стройка).
    const companyName: string = (body.companyName ?? "").trim();
    const companyNiche: string = (body.companyNiche ?? body.niche ?? "").trim();
    const companyDescription: string = (body.companyDescription ?? "").trim().slice(0, 300);
    // userPrompt: если передан — пропускаем шаг 1 (Claude) и рисуем именно его.
    const userPrompt: string = (body.userPrompt ?? "").trim();
    // embedText: если задан — попросим gpt-image-2 нарисовать ЭТОТ текст
    // прямо в картинке (карусели, постеры). Если пусто/undefined — обычная
    // картинка без надписей (поведение по умолчанию).
    const embedText: string = (body.embedText ?? "").trim();
    // referenceImages — массив { data (base64), mimeType }. До 3 штук.
    // Claude Haiku 4.5 умеет в vision: мы шлём референсы как image-блоки,
    // и Haiku пишет промпт уже с учётом их стиля (цвета/композиция/настроение).
    type RefImg = { data: string; mimeType: string };
    const rawRefs: unknown = body.referenceImages;
    const referenceImages: RefImg[] = Array.isArray(rawRefs)
      ? (rawRefs as RefImg[])
          .filter(r => r && typeof r.data === "string" && typeof r.mimeType === "string" && r.mimeType.startsWith("image/"))
          .slice(0, 3)
      : [];

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
        // Компания идёт ПЕРВОЙ — Claude должен в первую очередь понять
        // ЧТО за бизнес, и только потом разбирать конкретный пост.
        companyName && `Компания: ${companyName}`,
        companyNiche && `Ниша: ${companyNiche}`,
        companyDescription && `Описание: ${companyDescription}`,
        `Формат контента: ${format} для ${platform}`,
        hook && `Заголовок: «${hook}»`,
        postText && `Текст: ${postText.slice(0, 400)}`,
        brandColors.length > 0 && `Цвета бренда: ${brandColors.join(", ")}`,
        brandStyle && `Визуальный стиль бренда: ${brandStyle}`,
      ]
        .filter(Boolean)
        .join("\n");

      const refsBlock = referenceImages.length > 0
        ? `\n- Пользователь загрузил ${referenceImages.length} референс-картинк${referenceImages.length === 1 ? "у" : "и"} (см. в начале сообщения). Перенеси их визуальный стиль: цветовую палитру, типографику фона, освещение, композицию, фактуру. Финальная картинка должна выглядеть как из той же серии.`
        : "";

      const claudePrompt = `Ты арт-директор и prompt-инженер для AI-генерации изображений (gpt-image-2 / OpenAI).

Создай детальный промпт на английском языке для генерации изображения к этому контенту:

${contextBlock}

Правила:
- Опиши конкретную визуальную сцену, метафору или объект, который усиливает смысл поста
- Укажи художественный стиль (photorealistic / flat design / 3D render / illustration / minimalist / cinematic etc.)
- Укажи освещение, цветовую палитру, композицию, детали
- Ориентация: ${imageFormat === "portrait" ? "vertical 9:16 (portrait)" : imageFormat === "landscape" ? "horizontal 16:9 (landscape)" : "square 1:1"}
- ${embedText
        ? "Композиция должна оставить место для крупной типографики (текст добавится отдельно). НЕ описывай сам текст — мы вставим его инструкцией ниже."
        : "НЕ включай в изображение текст, надписи, буквы, логотипы, цифры, watermarks"}${refsBlock}
- Длина промпта: 3-5 предложений, конкретные детали

Ответь ТОЛЬКО промптом на английском, без каких-либо пояснений или префикса.`;

      // Vision-content: если есть референсы — отправляем их Haiku как image-блоки.
      // Картинки идут ПЕРЕД текстом — так модель сначала «смотрит», потом читает задачу.
      const visionContent = referenceImages.length > 0
        ? ([
            ...referenceImages.map(r => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: r.mimeType, data: r.data },
            })),
            { type: "text" as const, text: claudePrompt },
          ])
        : claudePrompt;

      const { text } = await safeAnthropicCreate({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: "user", content: visionContent as any }],
      });

      // Если ни Haiku, ни Sonnet не ответили — используем сырой текст поста
      // как fallback-промпт, чтобы DALL-E всё равно нарисовал хоть что-то.
      usedPrompt = text || postText;
    }

    // Если просят встроить текст — НЕ дописываем "no text", иначе gpt-image-2
    // запутается. Если текста нет — наоборот, явно запрещаем буквы.
    if (!embedText && !/no text|without text|no letters/i.test(usedPrompt)) {
      usedPrompt += " No text, letters, words, or watermarks in the image.";
    }

    // — Step 2: Provider routing — вынесен в общий src/lib/image-gen.ts,
    // тем же путём (включая Pollinations-фолбэк) теперь пользуется и
    // /api/presentation-slide-image.
    const result = await generateImageWithFallback({
      prompt: usedPrompt,
      format: imageFormat,
      embedText: embedText || undefined,
      userId: access.userId,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, usedPrompt }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      data: { imageUrl: result.imageUrl },
      usedPrompt,
      provider: result.provider,
      ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
