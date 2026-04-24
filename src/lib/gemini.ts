// Shared helpers for Google Gemini (image + text generation).
//
// Два важных нюанса для российского VPS:
//
// 1. API-ключ. Читается из env (для ротации без редеплоя), с хардкод-fallback
//    для стейджинга. TODO: после того как GEMINI_API_KEY залит в .env на проде,
//    удалить строку-фоллбек и ротировать ключ в Google AI Studio.
//
// 2. Обход блокировок. Google AI (generativelanguage.googleapis.com) режется
//    с российских IP, поэтому все запросы проходят через базовый URL,
//    переопределяемый переменной GEMINI_BASE_URL — туда ставим Cloudflare
//    Worker-прокси, который переделывает путь и форвардит на Google.
//    По умолчанию — прямой Google endpoint, чтобы локальная разработка
//    работала «из коробки» без прокси.
export const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ??
  "AIzaSyBYkDiFI1cf7OR3_grhyFDM_31PNgpXHh8";

export const GEMINI_BASE_URL = (
  process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"
).replace(/\/+$/, "");

// Default models. `image` — Gemini 2.5 Flash Image (aka Nano Banana, мультимодалка
// с поддержкой reference-изображений). `text` — обычный flash для AI-видимости.
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
    finishReason?: string;
  }>;
  error?: { code: number; message: string; status: string };
  promptFeedback?: { blockReason?: string };
}

function buildUrl(model: string, action: "generateContent" | "streamGenerateContent"): string {
  return `${GEMINI_BASE_URL}/v1beta/models/${model}:${action}?key=${GEMINI_API_KEY}`;
}

export type GeminiImageInput = {
  prompt: string;
  /** Reference images: base64 data (with or without `data:...,` prefix) + mimeType */
  referenceImages?: Array<{ data: string; mimeType: string }>;
  /** Override default image model (e.g. for imagen fallback) */
  model?: string;
};

export type GeminiImageResult =
  | { ok: true; imageUrl: string; mimeType: string }
  | { ok: false; error: string; status?: number };

/**
 * Generate a single image via Gemini 2.5 Flash Image.
 * Returns a data URL suitable for <img src>.
 */
export async function generateGeminiImage(
  input: GeminiImageInput,
): Promise<GeminiImageResult> {
  if (!GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY не настроен" };

  const prompt = input.prompt.trim();
  if (!prompt) return { ok: false, error: "Пустой промпт для генерации изображения" };

  const model = input.model ?? GEMINI_IMAGE_MODEL;
  const parts: GeminiPart[] = [];

  const refs = input.referenceImages ?? [];
  if (refs.length > 0) {
    parts.push({
      text: `Generate an image matching this description: ${prompt}

Use the provided reference images for visual style — color palette, composition, mood, and aesthetic. The result should feel consistent with the references.`,
    });
    for (const ref of refs) {
      const rawData = ref.data.includes(",") ? ref.data.split(",")[1] : ref.data;
      parts.push({ inlineData: { mimeType: ref.mimeType, data: rawData } });
    }
  } else {
    parts.push({ text: prompt });
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(model, "generateContent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
  } catch (err) {
    // Network-level failure (timeout, DNS, блокировка без прокси) — чаще всего
    // это первый симптом, что российский IP режется. Сообщение в UI намекает
    // что нужно проверить GEMINI_BASE_URL (Cloudflare Worker).
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Gemini fetch failed: ${msg}. Возможно, нужен прокси через GEMINI_BASE_URL.`,
    };
  }

  const text = await res.text();
  let data: GeminiContentResponse = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        data.error?.message ??
        `Gemini HTTP ${res.status}: ${text.slice(0, 300)}`,
    };
  }
  if (data.error) {
    return {
      ok: false,
      error: `Gemini error ${data.error.code}: ${data.error.message}`,
    };
  }

  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find(p => p.inlineData?.data);

  if (!imagePart?.inlineData) {
    const blockReason = data.promptFeedback?.blockReason;
    const finishReason = data.candidates?.[0]?.finishReason;
    return {
      ok: false,
      error: blockReason
        ? `Gemini заблокировал промпт: ${blockReason}`
        : finishReason === "SAFETY"
          ? "Gemini отклонил промпт по фильтрам безопасности. Смягчите формулировку."
          : "Gemini не вернул изображение. Попробуйте другой промпт.",
    };
  }

  const mimeType = imagePart.inlineData.mimeType ?? "image/png";
  return {
    ok: true,
    mimeType,
    imageUrl: `data:${mimeType};base64,${imagePart.inlineData.data}`,
  };
}

export type GeminiTextInput = {
  systemInstruction?: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  model?: string;
};

export type GeminiTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status?: number };

/**
 * Generate plain text via Gemini (used e.g. for AI-visibility LLM simulation).
 */
export async function generateGeminiText(
  input: GeminiTextInput,
): Promise<GeminiTextResult> {
  if (!GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY не настроен" };

  const model = input.model ?? GEMINI_TEXT_MODEL;

  let res: Response;
  try {
    res = await fetch(buildUrl(model, "generateContent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        ...(input.systemInstruction
          ? { systemInstruction: { parts: [{ text: input.systemInstruction }] } }
          : {}),
        generationConfig: {
          temperature: input.temperature ?? 0.7,
          maxOutputTokens: input.maxOutputTokens ?? 512,
        },
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Gemini fetch failed: ${msg}. Возможно, нужен прокси через GEMINI_BASE_URL.`,
    };
  }

  const bodyText = await res.text();
  let data: GeminiContentResponse = {};
  try { data = JSON.parse(bodyText); } catch { /* ignore */ }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        data.error?.message ??
        `Gemini HTTP ${res.status}: ${bodyText.slice(0, 300)}`,
    };
  }
  if (data.error) {
    return {
      ok: false,
      error: `Gemini error ${data.error.code}: ${data.error.message}`,
    };
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map(p => p.text ?? "").join("").trim();
  if (!text) {
    return { ok: false, error: "Gemini не вернул текстовый ответ" };
  }
  return { ok: true, text };
}
