/**
 * image-aspect — определяет рекомендуемый aspect ratio под платформу + формат.
 *
 * DALL-E 3 поддерживает 3 размера:
 *   - 1024×1024 (1:1 square)
 *   - 1024×1792 (~9:16 portrait)
 *   - 1792×1024 (~16:9 landscape)
 *
 * Мы выбираем один из них по контексту:
 *
 *   • portrait — для stories/reels/shorts/TikTok/вертикальный контент
 *   • landscape — LinkedIn/YouTube preview/Twitter card/Facebook share
 *   • square — Instagram feed (1:1), VK (1:1 даёт хорошее превью), default
 *
 * Instagram 4:5 (1080×1350) — нативный формат feed-поста, но DALL-E его не
 * умеет напрямую. Square (1:1) — лучший компромисс: не обрезается в feed,
 * не выглядит слишком высоким.
 */

export type ImageAspect = "square" | "portrait" | "landscape";

/**
 * Возвращает рекомендуемый aspect под комбинацию платформа + формат.
 *
 *   detectImageAspect({ platform: "instagram", format: "сторис" }) → "portrait"
 *   detectImageAspect({ platform: "linkedin", format: "пост" }) → "landscape"
 *   detectImageAspect({ platform: "vk", format: "пост" }) → "square"
 */
export function detectImageAspect(input: {
  platform?: string;
  format?: string;
}): ImageAspect {
  const platform = (input.platform ?? "").toLowerCase();
  const format = (input.format ?? "").toLowerCase();

  // Vertical contexts всегда побеждают остальное
  if (/сторис|stor(y|ies)|рилс|reel|shorts|tiktok|tik.?tok/.test(format + " " + platform)) {
    return "portrait";
  }

  // Карусели — Instagram-карусель это 1:1 square, не vertical.
  // Раньше CarouselsView передавал format="сторис" → portrait 9:16 → обрезание в feed.
  if (/карусель|carousel/.test(format)) {
    return "square";
  }

  // YouTube long-form / LinkedIn / Twitter preview cards / Facebook share preview
  if (/linkedin|youtube|twitter|x-twitter|^x$|facebook/.test(platform) && format !== "сторис") {
    return "landscape";
  }

  // Default — square (Instagram feed, VK, Telegram пост, неизвестное)
  return "square";
}

/**
 * Удобный wrapper для openai-image.ts формат-параметра.
 * Возвращает то же значение что и detectImageAspect.
 */
export function platformImageFormat(platform?: string, format?: string): ImageAspect {
  return detectImageAspect({ platform, format });
}
