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
import { persistImageDataUri } from "@/lib/image-store";

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

    // — Step 2: Provider routing —
    // OPTIMIZATION: gpt-image-2 нужен ТОЛЬКО когда есть embedText (типографика
    // в картинке). Для обычных фонов Gemini в 3-5 раз быстрее и почти такого же
    // качества. Раньше всегда ходили в OpenAI → ждали 10-30s → потом в fallback.
    // Теперь если embedText пустой — пропускаем OpenAI и сразу идём в Gemini.
    const aspectHintEarly = imageFormat === "portrait"
      ? " Render in vertical 9:16 aspect ratio (portrait orientation)."
      : imageFormat === "landscape"
      ? " Render in horizontal 16:9 aspect ratio (landscape orientation)."
      : " Render in square 1:1 aspect ratio.";

    if (!embedText && GEMINI_API_KEY) {
      const gemFast = await generateGeminiImage({
        prompt: usedPrompt + aspectHintEarly + " No text, letters, words, or watermarks in the image.",
      });
      if (gemFast.ok) {
        const safeUrl = await persistImageDataUri(gemFast.imageUrl, access.userId);
        return NextResponse.json({
          ok: true,
          data: { imageUrl: safeUrl },
          usedPrompt,
          provider: "gemini-fast",
        });
      }
      // Gemini упал — продолжаем в обычный fallback chain
    }

    // Если есть embedText — нужен OpenAI gpt-image-2 (единственный кто
    // нормально рисует русский текст). Quality=medium — high занимает 90-120с
    // и упирается в таймаут Cloudflare-воркера-прокси (~100s). Medium даёт
    // ~30-50с и нормальное качество для типографики.
    let imgResult = await generateOpenAIImage({
      prompt: usedPrompt,
      format: imageFormat,
      embedText: embedText || undefined,
      quality: embedText ? "medium" : undefined,
    });

    // RETRY: если упали по таймауту/сети — пробуем ещё раз с quality=low.
    // Часто работает: gpt-image-2 на low отрабатывает за 15-25с, гарантированно
    // укладывается в 70с таймаут. Качество хуже, но фон лучше чем пустой
    // слайд. Делаем только ОДИН retry, чтобы не зацикливаться.
    if (!imgResult.ok && embedText) {
      const errMsg = imgResult.error ?? "";
      const isTimeout = /timeout|fetch failed|ETIMEDOUT|ECONNRESET|workers\.dev|524/i.test(errMsg);
      if (isTimeout) {
        console.warn(`[gen-image] retry с quality=low после таймаута: ${errMsg.slice(0, 80)}`);
        imgResult = await generateOpenAIImage({
          prompt: usedPrompt,
          format: imageFormat,
          embedText: embedText || undefined,
          quality: "low",
        });
      }
    }

    // Если OpenAI отказал — пробуем Gemini/Pollinations как fallback.
    // Раньше fallback срабатывал только на quota/billing, но НЕ на timeout/
    // network — а у нас на российском VPS чаще ложится именно таймаут
    // через Cloudflare-прокси. Теперь fallback тоже триггерится на:
    //   • timeout (Request timeout, ECONNRESET, ETIMEDOUT)
    //   • network (fetch failed, ENOTFOUND, ECONNREFUSED)
    //   • 5xx от прокси (502/503/504)
    if (!imgResult.ok) {
      const errMsg = imgResult.error ?? "";
      const isQuotaIssue =
        /Лимит OpenAI|квота OpenAI|rate.?limit|billing/i.test(errMsg);
      const isInfraIssue =
        /timeout|fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|502|503|504|workers\.dev/i.test(errMsg);

      if (isQuotaIssue || isInfraIssue) {
        // Цепочка fallback: Gemini → Pollinations (free, no key)
        const aspectHint = imageFormat === "portrait"
          ? " Render in vertical 9:16 aspect ratio (portrait orientation)."
          : imageFormat === "landscape"
          ? " Render in horizontal 16:9 aspect ratio (landscape orientation)."
          : " Render in square 1:1 aspect ratio.";
        // Если просили текст в картинке — НЕ запрещаем буквы фолбэкам,
        // наоборот добавляем сам текст в промпт (best-effort, Gemini/Pollinations
        // справляются хуже gpt-image-2, но что-то отрисуют).
        const noTextHint = embedText
          ? ` Render this text directly on the image as clean typography (preserve language and spelling): "${embedText}".`
          : " No text, letters, words, or watermarks in the image.";

        // Try Gemini if available
        if (GEMINI_API_KEY) {
          const gem = await generateGeminiImage({
            prompt: usedPrompt + aspectHint + noTextHint,
          });
          if (gem.ok) {
            const safeUrl = await persistImageDataUri(gem.imageUrl, access.userId);
            return NextResponse.json({
              ok: true,
              data: { imageUrl: safeUrl },
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
          const safeUrl = await persistImageDataUri(poll.imageUrl, access.userId);
          return NextResponse.json({
            ok: true,
            data: { imageUrl: safeUrl },
            usedPrompt,
            provider: "pollinations",
            fallbackReason: "openai-quota",
          });
        }

        // Все 3 провайдера упали
        const why = isQuotaIssue ? "квота/билинг OpenAI" : "OpenAI прокси не отвечает (timeout/network)";
        return NextResponse.json(
          {
            ok: false,
            error: `${why}: ${imgResult.error}. Резервные генераторы тоже недоступны (Pollinations: ${poll.error}).`,
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

    const safeUrl = await persistImageDataUri(imgResult.imageUrl, access.userId);
    return NextResponse.json({
      ok: true,
      data: { imageUrl: safeUrl },
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
