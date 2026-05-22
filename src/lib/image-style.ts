/**
 * Общие пресеты стиля картинки и хелпер concurrency для пакетной генерации.
 * Используется в StoriesView, GeneratedCarouselsView и ContentPlanView, чтобы
 * UI/логика были одинаковыми.
 */

export type ImageStyleKey = "" | "photo" | "illustration" | "minimalist" | "3d" | "anime" | "sketch" | "watercolor";

export const IMAGE_STYLE_OPTIONS: ReadonlyArray<readonly [ImageStyleKey, string]> = [
  ["", "🤖 Авто"],
  ["photo", "📷 Фото"],
  ["illustration", "🎨 Иллюстрация"],
  ["minimalist", "⬜ Минимализм"],
  ["3d", "🧊 3D"],
  ["anime", "🌸 Аниме"],
  ["sketch", "✏️ Скетч"],
  ["watercolor", "🖌 Акварель"],
] as const;

export const IMAGE_STYLE_PHRASES: Record<Exclude<ImageStyleKey, "">, string> = {
  photo:        "Photorealistic photo, natural lighting, professional photography",
  illustration: "Flat vector illustration, modern style, bright colors",
  minimalist:   "Minimalist composition, clean background, single focal subject",
  "3d":         "3D render, soft shadows, modern isometric style",
  anime:        "Anime / manga illustration style, vibrant",
  sketch:       "Hand-drawn pencil sketch style, monochrome",
  watercolor:   "Soft watercolor painting style, pastel palette",
};

export function stylePhraseFor(style: ImageStyleKey): string {
  if (!style) return "";
  return IMAGE_STYLE_PHRASES[style] ?? "";
}

/**
 * Запускает async-задачи с ограничением одновременности.
 * Раньше использовали `Promise.all` для 5-7 параллельных вызовов
 * /api/generate-image-anthropic → OpenAI rate-limit отбивал часть
 * запросов или они улетали в 60-секундный таймаут. В результате
 * из 5 слайдов сериализовалось только 2-3 картинки.
 *
 * Concurrency=2 — оптимальный компромисс: достаточно быстро для UX,
 * но без массового rate-limit при quality=high gpt-image-2.
 */
export async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
