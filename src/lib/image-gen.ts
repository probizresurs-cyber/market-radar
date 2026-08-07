/**
 * Общий провайдер-чейн генерации картинок — вынесен из
 * /api/generate-image-anthropic (посты/сторис/карусели), чтобы тем же
 * путём (и тем же фолбэком) пользовались и другие места, например
 * /api/presentation-slide-image.
 *
 * Цепочка: Gemini (быстро, бесплатно, если есть квота) → OpenAI gpt-image-2
 * (если нужен текст в картинке, либо Gemini не сработал) → Gemini ещё раз
 * как фолбэк на инфраструктурные сбои OpenAI → Pollinations.ai (бесплатно,
 * без ключа, последний резерв). До сегодняшнего рефакторинга
 * presentation-slide-image звал только Gemini/OpenAI напрямую и падал
 * целиком, когда у Gemini кончалась бесплатная квота, а OpenAI недоступен
 * с российского VPS («Country, region, or territory not supported») —
 * Pollinations не завязан ни на то, ни на другое.
 */
import { generateOpenAIImage } from "@/lib/openai-image";
import { GEMINI_API_KEY, generateGeminiImage } from "@/lib/gemini";
import { generatePollinationsImage } from "@/lib/pollinations-image";
import { persistImageDataUri } from "@/lib/image-store";

export type ImageGenFormat = "square" | "portrait" | "landscape";

export interface GenerateImageOpts {
  /** Финальный (уже готовый) промпт на английском. */
  prompt: string;
  format: ImageGenFormat;
  /** Если задан — просим модель нарисовать этот текст прямо в картинке. */
  embedText?: string;
  userId: string | null;
}

export interface GenerateImageResult {
  ok: boolean;
  imageUrl?: string;
  provider?: "gemini-fast" | "openai" | "gemini" | "pollinations";
  fallbackReason?: string;
  error?: string;
}

function aspectHint(format: ImageGenFormat): string {
  if (format === "portrait") return " Render in vertical 9:16 aspect ratio (portrait orientation).";
  if (format === "landscape") return " Render in horizontal 16:9 aspect ratio (landscape orientation).";
  return " Render in square 1:1 aspect ratio.";
}

export async function generateImageWithFallback(opts: GenerateImageOpts): Promise<GenerateImageResult> {
  const { prompt, format, embedText, userId } = opts;
  const hint = aspectHint(format);

  // Быстрый путь: без embedText Gemini в 3-5 раз быстрее OpenAI и почти
  // такого же качества для обычных фонов — пробуем его первым.
  if (!embedText && GEMINI_API_KEY) {
    const gemFast = await generateGeminiImage({
      prompt: prompt + hint + " No text, letters, words, or watermarks in the image.",
    });
    if (gemFast.ok) {
      const imageUrl = await persistImageDataUri(gemFast.imageUrl, userId);
      return { ok: true, imageUrl, provider: "gemini-fast" };
    }
    // Gemini упал (например, бесплатная квота исчерпана) — идём в общий фолбэк-чейн ниже.
  }

  // embedText нужен gpt-image-2 (единственный, кто нормально рисует русский
  // текст) — либо это фолбэк после неудачного быстрого пути выше.
  let imgResult = await generateOpenAIImage({
    prompt,
    format,
    embedText: embedText || undefined,
    quality: embedText ? "medium" : undefined,
  });

  if (!imgResult.ok && embedText) {
    const errMsg = imgResult.error ?? "";
    const isTimeout = /timeout|fetch failed|ETIMEDOUT|ECONNRESET|workers\.dev|524/i.test(errMsg);
    if (isTimeout) {
      imgResult = await generateOpenAIImage({
        prompt,
        format,
        embedText: embedText || undefined,
        quality: "low",
      });
    }
  }

  if (imgResult.ok) {
    const imageUrl = await persistImageDataUri(imgResult.imageUrl, userId);
    return { ok: true, imageUrl, provider: "openai" };
  }

  // OpenAI отказал — на РФ-VPS это почти всегда либо квота, либо гео-блок
  // ("Country, region, or territory not supported" — сам api.openai.com
  // стоит за Cloudflare, воркер-прокси тут не спасает). В обоих случаях
  // едем дальше по цепочке, а не сдаёмся.
  const errMsg = imgResult.error ?? "";
  const isQuotaIssue = /Лимит OpenAI|квота OpenAI|rate.?limit|billing|country|region|territory/i.test(errMsg);
  const isInfraIssue = /timeout|fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|502|503|504|workers\.dev/i.test(errMsg);

  if (!isQuotaIssue && !isInfraIssue) {
    return { ok: false, error: imgResult.error };
  }

  const noTextHint = embedText
    ? ` Render this text directly on the image as clean typography (preserve language and spelling): "${embedText}".`
    : " No text, letters, words, or watermarks in the image.";

  if (GEMINI_API_KEY) {
    const gem = await generateGeminiImage({ prompt: prompt + hint + noTextHint });
    if (gem.ok) {
      const imageUrl = await persistImageDataUri(gem.imageUrl, userId);
      return { ok: true, imageUrl, provider: "gemini", fallbackReason: "openai-quota" };
    }
  }

  const poll = await generatePollinationsImage({
    prompt: prompt + noTextHint,
    format,
    model: "flux",
  });
  if (poll.ok) {
    const imageUrl = await persistImageDataUri(poll.imageUrl, userId);
    return { ok: true, imageUrl, provider: "pollinations", fallbackReason: "openai-quota" };
  }

  const why = isQuotaIssue ? "квота/билинг OpenAI" : "OpenAI прокси не отвечает (timeout/network)";
  return {
    ok: false,
    error: `${why}: ${imgResult.error}. Резервные генераторы тоже недоступны (Pollinations: ${poll.error}).`,
  };
}
