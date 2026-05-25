import { fetchWithTimeout, LONG_TIMEOUT_MS } from "@/lib/fetch-timeout";

/**
 * OpenAI image generation (DALL-E 3 / gpt-image-1 / gpt-image-2).
 *
 * Используется как замена Gemini в `/api/generate-image-anthropic` —
 * Claude Haiku пишет промпт, OpenAI рендерит картинку.
 *
 * Особенности:
 * - На российском VPS используем `OPENAI_BASE_URL` (Cloudflare Worker
 *   прокси) — тот же, что для всех остальных GPT-вызовов.
 * - Размеры выбираются по формату контента: пост/карусель = 1:1 (1024x1024),
 *   сторис/рилс = 9:16 (1024x1792 / 1024x1536).
 * - Возвращаем data URL (base64) — фронт сразу кладёт в <img src>.
 * - `gpt-image-2` (ChatGPT Images 2.0) поддерживает рендер текста прямо
 *   в картинке. Если передан `embedText`, мы дописываем явную инструкцию
 *   нарисовать этот текст в типографике (карусели, постеры, обложки).
 */

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
// gpt-image-2 — новейшая модель ChatGPT Images 2.0 с отличным рендерингом
// текста. Если на ключе ещё не активирована — берём gpt-image-1 через env.
const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

export type OpenAIImageInput = {
  prompt: string;
  /** Format hint: square / portrait / landscape (defaults to square). */
  format?: "square" | "portrait" | "landscape";
  /** Override model: dall-e-3 | gpt-image-1 | gpt-image-2 */
  model?: string;
  /** "standard" or "hd" for dall-e-3 / "low"|"medium"|"high" for gpt-image-* */
  quality?: string;
  /**
   * Если задано — попросим модель нарисовать ЭТОТ текст прямо на изображении
   * (заголовок + буллеты для карусели, цитата для сторис и т.п.). Работает
   * только с gpt-image-2 / gpt-image-1; DALL-E 3 заслуженно игнорирует.
   */
  embedText?: string;
};

export type OpenAIImageResult =
  | { ok: true; imageUrl: string; mimeType: string; provider: "openai" }
  | { ok: false; error: string; status?: number };

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  error?: { message: string; type?: string; code?: string };
}

function pickSize(format: OpenAIImageInput["format"], model: string): string {
  // gpt-image-2 / gpt-image-1 поддерживают 1024x1024 / 1024x1536 / 1536x1024.
  // gpt-image-2 дополнительно умеет в 2000px, но 1536 хватает и грузится быстрее.
  if (model === "gpt-image-2" || model === "gpt-image-1") {
    if (format === "portrait") return "1024x1536";
    if (format === "landscape") return "1536x1024";
    return "1024x1024";
  }
  // dall-e-3 supports 1024x1024 / 1792x1024 / 1024x1792
  if (format === "portrait") return "1024x1792";
  if (format === "landscape") return "1792x1024";
  return "1024x1024";
}

/** Добавляет в промпт строгую инструкцию нарисовать текст в типографике. */
function withEmbeddedText(basePrompt: string, embedText: string): string {
  const cleaned = embedText.trim();
  if (!cleaned) return basePrompt;
  // gpt-image-2 best-practices для русской типографики:
  //   • Тройные кавычки + явное «Russian language» защищают от транслитерации
  //   • Multi-line preservation — модель часто склеивает строки без «\n on a NEW LINE»
  //   • «Pixel-perfect spelling» — против перепутывания «ё/е», «и/й»
  //   • Реалистичный fallback — лучше потерять предложение чем коверкать буквы
  // Каждая инструкция повторяется 2 раза в разных местах prompt'а — gpt-image-2
  // лучше выполняет requirements, повторённые более одного раза.
  return `${basePrompt}

🎯 КРИТИЧЕСКИ ВАЖНО — ТИПОГРАФИКА:
Нарисуй приведённый ниже текст ПРЯМО НА КАРТИНКЕ как чистую современную типографику.

ЖЁСТКИЕ ТРЕБОВАНИЯ (нельзя нарушать):
1. ЯЗЫК — РУССКИЙ. Не переводи на английский, не транслитерируй ('Privet' вместо 'Привет' — ОШИБКА).
2. ОРФОГРАФИЯ — 100% правильная. Каждое слово целиком, без пропусков букв. Если не уверен в букве — лучше пропусти предложение целиком, чем коверкай ('Свтиильник' вместо 'Светильник' — ОШИБКА).
3. РАЗДЕЛЕНИЕ НА СТРОКИ — переносы как в исходном тексте между \\n. Не склеивай.
4. ШРИФТ — bold sans-serif для заголовка, обычный для подзаголовка/тела.
5. ЧИТАЕМОСТЬ — высокий контраст с фоном (overlay/тень/плашка). Не накладывай поверх ключевых визуальных элементов.

ТЕКСТ ДЛЯ ОТРИСОВКИ (Russian language, preserve exact wording, render with PIXEL-PERFECT SPELLING):
"""
${cleaned}
"""

Финальная проверка перед рендером:
• Все слова — целиком, не обрезаны
• Кириллица, не латиница
• Орфография как в исходнике
• Переносы строк сохранены`;
}

export async function generateOpenAIImage(input: OpenAIImageInput): Promise<OpenAIImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY не настроен" };

  let prompt = input.prompt.trim();
  if (!prompt) return { ok: false, error: "Пустой промпт" };

  const model = input.model ?? DEFAULT_MODEL;
  const size = pickSize(input.format, model);
  const isGptImage = model === "gpt-image-1" || model === "gpt-image-2";

  // Если просят рендер текста на картинке — добавляем подробную инструкцию.
  // dall-e-3 это не умеет, поэтому игнорируем для него.
  if (input.embedText && isGptImage) {
    prompt = withEmbeddedText(prompt, input.embedText);
  }

  // Тело запроса. dall-e-3 требует response_format=b64_json для отдачи base64;
  // gpt-image-1/2 всегда возвращают base64 (response_format не нужен).
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
    // 120 сек — gpt-image-2 quality=high иногда генерирует 60-90 сек.
    // Без таймаута зависший запрос держал бы PM2-воркер до 5 минут.
    res = await fetchWithTimeout(`${OPENAI_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, LONG_TIMEOUT_MS);
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

  // Особый случай: модель не активирована на ключе (gpt-image-2 в раннем
  // доступе). Подскажем понятным языком и попробуем фолбэк-модель.
  const isModelNotAvailable = (msg: string): boolean => {
    const lower = msg.toLowerCase();
    return (
      lower.includes("model_not_found") ||
      lower.includes("does not exist") ||
      lower.includes("not have access to model") ||
      lower.includes("invalid model")
    );
  };

  if (!res.ok) {
    const rawMsg = data.error?.message ?? `OpenAI HTTP ${res.status}: ${text.slice(0, 300)}`;

    // Авто-фолбэк gpt-image-2 → gpt-image-1, если модель ещё не активирована.
    if (model === "gpt-image-2" && isModelNotAvailable(rawMsg)) {
      return generateOpenAIImage({ ...input, model: "gpt-image-1" });
    }

    const friendly = detectQuotaError(rawMsg);
    return {
      ok: false,
      status: res.status,
      error: friendly ?? rawMsg,
    };
  }
  if (data.error) {
    if (model === "gpt-image-2" && isModelNotAvailable(data.error.message ?? "")) {
      return generateOpenAIImage({ ...input, model: "gpt-image-1" });
    }
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
