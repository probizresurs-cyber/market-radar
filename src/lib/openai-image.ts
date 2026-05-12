/**
 * OpenAI image generation (DALL-E 3 / gpt-image-1).
 *
 * Используется как замена Gemini в `/api/generate-image-anthropic` —
 * Claude Haiku пишет промпт, OpenAI рендерит картинку.
 *
 * Особенности:
 * - На российском VPS используем `OPENAI_BASE_URL` (Cloudflare Worker
 *   прокси) — тот же, что для всех остальных GPT-вызовов.
 * - Размеры выбираются по формату контента: пост/карусель = 1:1 (1024x1024),
 *   сторис/рилс = 9:16 (1024x1792).
 * - Возвращаем data URL (base64) — фронт сразу кладёт в <img src>.
 */

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3";

export type OpenAIImageInput = {
  prompt: string;
  /** Format hint: square / portrait / landscape (defaults to square). */
  format?: "square" | "portrait" | "landscape";
  /** Override model: dall-e-3 | gpt-image-1 */
  model?: string;
  /** "standard" or "hd" for dall-e-3 / "low"|"medium"|"high" for gpt-image-1 */
  quality?: string;
};

export type OpenAIImageResult =
  | { ok: true; imageUrl: string; mimeType: string; provider: "openai" }
  | { ok: false; error: string; status?: number };

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  error?: { message: string; type?: string; code?: string };
}

function pickSize(format: OpenAIImageInput["format"], model: string): string {
  // gpt-image-1 supports 1024x1024 / 1024x1536 / 1536x1024 / auto
  if (model === "gpt-image-1") {
    if (format === "portrait") return "1024x1536";
    if (format === "landscape") return "1536x1024";
    return "1024x1024";
  }
  // dall-e-3 supports 1024x1024 / 1792x1024 / 1024x1792
  if (format === "portrait") return "1024x1792";
  if (format === "landscape") return "1792x1024";
  return "1024x1024";
}

export async function generateOpenAIImage(input: OpenAIImageInput): Promise<OpenAIImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY не настроен" };

  const prompt = input.prompt.trim();
  if (!prompt) return { ok: false, error: "Пустой промпт" };

  const model = input.model ?? DEFAULT_MODEL;
  const size = pickSize(input.format, model);
  const isGptImage = model === "gpt-image-1";

  // Тело запроса. dall-e-3 требует response_format=b64_json для отдачи base64;
  // gpt-image-1 всегда возвращает base64 (response_format не нужен).
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
    quality: input.quality ?? (isGptImage ? "medium" : "standard"),
  };
  if (!isGptImage) {
    body.response_format = "b64_json";
  }

  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `OpenAI fetch failed: ${msg}. Проверьте OPENAI_BASE_URL.` };
  }

  const text = await res.text();
  let data: OpenAIImageResponse = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }

  // Распознаём quota / billing ошибки от OpenAI отдельно — пользователю важно
  // понимать что это его лимит, а не наша поломка.
  const detectQuotaError = (msg: string): string | null => {
    const lower = msg.toLowerCase();
    if (lower.includes("billing hard limit") || lower.includes("billing soft limit")) {
      return "Лимит OpenAI достигнут (billing hard limit). Пополните баланс OpenAI или попросите админа платформы.";
    }
    if (lower.includes("insufficient_quota") || lower.includes("you exceeded your current quota")) {
      return "Закончилась квота OpenAI. Пополните баланс на platform.openai.com или попросите админа.";
    }
    if (lower.includes("rate_limit") || lower.includes("rate limit")) {
      return "Превышен rate-limit OpenAI. Подождите минуту и повторите.";
    }
    return null;
  };

  if (!res.ok) {
    const rawMsg = data.error?.message ?? `OpenAI HTTP ${res.status}: ${text.slice(0, 300)}`;
    const friendly = detectQuotaError(rawMsg);
    return {
      ok: false,
      status: res.status,
      error: friendly ?? rawMsg,
    };
  }
  if (data.error) {
    const friendly = detectQuotaError(data.error.message ?? "");
    return { ok: false, error: friendly ?? `OpenAI error: ${data.error.message}` };
  }

  const item = data.data?.[0];
  if (!item) return { ok: false, error: "OpenAI не вернул изображение" };

  // Predominantly base64 path.
  if (item.b64_json) {
    return {
      ok: true,
      provider: "openai",
      mimeType: "image/png",
      imageUrl: `data:image/png;base64,${item.b64_json}`,
    };
  }
  // Fallback: URL response (in case response_format was overridden somehow).
  if (item.url) {
    return {
      ok: true,
      provider: "openai",
      mimeType: "image/png",
      imageUrl: item.url,
    };
  }
  return { ok: false, error: "OpenAI вернул пустой ответ" };
}
