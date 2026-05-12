/**
 * Pollinations.ai — бесплатный image generation без ключа.
 *
 * Идея взята из n8n-workflow «Automated AI Social Media Content Factory».
 * Public-эндпоинт `image.pollinations.ai/prompt/{prompt}` возвращает PNG
 * напрямую, без авторизации. Используется как **последний** fallback, когда
 * у OpenAI исчерпан billing-лимит и у Gemini нет ключа.
 *
 * Преимущества:
 *   - Полностью бесплатно
 *   - Не требует API ключа (хороший «всегда-работает» fallback)
 *   - Поддерживает несколько моделей под капотом (flux, sdxl, turbo)
 *   - Можно указывать width/height для нужного aspect ratio
 *
 * Недостатки:
 *   - Качество хуже DALL-E 3 (модель flux ~примерно SD3 уровня)
 *   - Иногда таймауты при пиковой нагрузке
 *   - Нет редактирования / reference images
 *
 * Возвращаем data URL (base64), как и другие image-провайдеры.
 */

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

export type PollinationsFormat = "square" | "portrait" | "landscape";

export interface PollinationsImageInput {
  prompt: string;
  format?: PollinationsFormat;
  /** flux (default) / sdxl / turbo. Flux — лучшее качество. */
  model?: "flux" | "sdxl" | "turbo";
  /** Для воспроизводимости — иначе случайный кадр на каждый запрос. */
  seed?: number;
  /** Отключить watermark от Pollinations (по умолчанию true). */
  nologo?: boolean;
  /** Сделать private (изображение не попадает в публичную галерею). */
  private?: boolean;
}

export type PollinationsImageResult =
  | { ok: true; imageUrl: string; mimeType: string; provider: "pollinations" }
  | { ok: false; error: string; status?: number };

function pickSize(format: PollinationsFormat): { width: number; height: number } {
  if (format === "portrait") return { width: 1024, height: 1792 };  // 9:16
  if (format === "landscape") return { width: 1792, height: 1024 }; // 16:9
  return { width: 1024, height: 1024 };                              // 1:1
}

export async function generatePollinationsImage(
  input: PollinationsImageInput,
): Promise<PollinationsImageResult> {
  const prompt = input.prompt.trim();
  if (!prompt) return { ok: false, error: "Пустой промпт для генерации" };

  const { width, height } = pickSize(input.format ?? "square");
  const model = input.model ?? "flux";

  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: String(input.nologo ?? true),
    private: String(input.private ?? true),
    enhance: "true", // позволить Pollinations улучшить промпт сам
  });
  if (input.seed != null) params.set("seed", String(input.seed));

  // Pollinations API: GET /prompt/{prompt}?width=...&height=...&model=...
  // Длинные промпты в URL — нормально (поддерживают до ~2000 chars).
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?${params}`;

  try {
    const ctrl = new AbortController();
    // Pollinations иногда генерирует 30-90 сек — даём 90 сек timeout
    const t = setTimeout(() => ctrl.abort(), 90_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "Accept": "image/png,image/jpeg,image/*",
      },
      redirect: "follow",
    });
    clearTimeout(t);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Pollinations HTTP ${res.status}`,
      };
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) {
      return {
        ok: false,
        error: `Pollinations вернул не картинку (${contentType})`,
      };
    }

    // Конвертим bytes → base64 data URL
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return {
      ok: true,
      provider: "pollinations",
      mimeType: contentType,
      imageUrl: `data:${contentType};base64,${base64}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Pollinations fetch failed: ${msg}` };
  }
}
