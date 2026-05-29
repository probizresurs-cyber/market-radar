/**
 * Replicate API wrapper для генерации AI-видео (анимированный b-roll).
 *
 * Replicate — единая платформа для запуска моделей. Через один API-ключ
 * можно дёргать Minimax/Hailuo, Kling, Runway, Luma, Wan и десятки других
 * text-to-video моделей. Это удобно потому что можно менять провайдеров
 * без переписывания клиентского кода — только название модели.
 *
 * Docs: https://replicate.com/docs/reference/http
 *
 * Pricing examples (актуально на 05.2026):
 *  - minimax/hailuo-02       : ~$0.50 за 6-сек видео
 *  - minimax/video-01        : ~$0.50 за 6-сек видео
 *  - kwaivgi/kling-v2.1      : ~$0.50 за 5-сек видео
 *  - runwayml/runway-gen-3-turbo : ~$0.25 за 5-сек видео
 *  - luma/ray-flash-2        : ~$0.20 за 5-сек видео
 *
 * Используем text-to-video (т.е. описываешь сцену → получаешь видео).
 * Image-to-video (где animation на готовой картинке) тоже доступен,
 * но это +1 шаг и +1 API-вызов → откладываем на потом.
 */

const REPLICATE_API_KEY = process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY ?? "";
const REPLICATE_BASE = "https://api.replicate.com/v1";

/**
 * Конфигурация моделей. Ключ — имя модели на Replicate (owner/name).
 * Для каждой описан тип (text-to-video / image-to-video) и дефолтный
 * input. Мы используем ТОЛЬКО text-to-video — для b-roll юзер задаёт
 * только тему, без стартовой картинки.
 *
 * Важно: Kling v2.1 (kwaivgi/kling-v2.1) — IMAGE-TO-VIDEO, требует
 * start_image. Если хочешь Kling, надо сначала генерить картинку
 * через gpt-image-2 и подавать как start_image — двойной API-вызов
 * (отложено).
 */
const MODEL_CONFIGS: Record<string, { type: "t2v" | "i2v"; input: Record<string, unknown> }> = {
  // ⭐ Default — Seedance Pro (ByteDance). Text-to-video, нативно 9:16,
  // отличное качество для short-form вертикали. ~$0.40 за 5-сек клип.
  "bytedance/seedance-1-pro": {
    type: "t2v",
    input: {
      aspect_ratio: "9:16",
      duration: 5,
      resolution: "1080p",
      fps: 24,
      camera_fixed: false,
    },
  },
  // Альтернатива №1 — Minimax Hailuo-02. Text-to-video, портретные кадры
  // через prompt. ~$0.50 за 6-сек клип. Иногда даёт 16:9, надо явно
  // упоминать vertical в промпте.
  "minimax/hailuo-02": {
    type: "t2v",
    input: {
      prompt_optimizer: true,
      duration: 6,
    },
  },
  // Альтернатива №2 — Minimax video-01 (старый, но проверенный).
  "minimax/video-01": {
    type: "t2v",
    input: {
      prompt_optimizer: true,
    },
  },
  // ⚠️ Kling v2.1 — IMAGE-TO-VIDEO. Не использовать как default.
  // Оставляю в конфиге для будущего пайплайна «генерим картинку → Kling».
  "kwaivgi/kling-v2.1": {
    type: "i2v",
    input: {
      aspect_ratio: "9:16",
      duration: 5,
      negative_prompt: "blurry, low quality, distorted, watermark, text",
      // start_image НУЖНО передавать через opts.modelInput
    },
  },
};

const DEFAULT_MODEL = process.env.REPLICATE_VIDEO_MODEL ?? "bytedance/seedance-1-pro";

function getModelInput(model: string): Record<string, unknown> {
  // ENV override имеет приоритет (если задан REPLICATE_VIDEO_INPUT)
  const fromEnv = process.env.REPLICATE_VIDEO_INPUT;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch {
      // ignore, упадём в default
    }
  }
  // Иначе берём из реестра моделей
  return MODEL_CONFIGS[model]?.input ?? { aspect_ratio: "9:16", duration: 5 };
}

interface CreatePredictionResponse {
  id: string;
  status: string; // "starting" | "processing" | "succeeded" | "failed" | "canceled"
  error?: string;
  urls?: { get: string; cancel: string };
}

interface GetPredictionResponse {
  id: string;
  status: string;
  output?: string | string[]; // URL(s) к финальному MP4
  error?: string;
  logs?: string;
  metrics?: { predict_time: number };
}

export interface GeneratedVideo {
  predictionId: string;
  /** URL к MP4 на Replicate CDN. Время жизни ~1 час, потом нужно скачать. */
  videoUrl: string;
  generationSec: number;
  model: string;
}

export interface ReplicateError {
  ok: false;
  error: string;
  predictionId?: string;
}

export interface ReplicateSuccess {
  ok: true;
  video: GeneratedVideo;
}

export type ReplicateResult = ReplicateError | ReplicateSuccess;

/**
 * Запускает генерацию видео и ждёт пока модель отработает.
 * Polling каждые 5 сек. Максимум `timeoutMs` — после этого
 * возвращаем ошибку (но генерация на стороне Replicate
 * может продолжиться, мы её просто бросаем).
 */
export async function generateVideo(opts: {
  prompt: string;
  model?: string;
  /** Опциональные дополнительные параметры для модели (зависит от модели).
   *  Hailuo принимает {duration, prompt_optimizer, first_frame_image}. */
  modelInput?: Record<string, unknown>;
  /** Сколько ждать максимум, мс. Default 240000 (4 мин). */
  timeoutMs?: number;
}): Promise<ReplicateResult> {
  if (!REPLICATE_API_KEY) {
    return { ok: false, error: "REPLICATE_API_TOKEN не настроен в env" };
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 240_000;

  // 1) Submit prediction. Используем models/{owner}/{name}/predictions
  // эндпоинт чтобы не таскать version-хеши (Replicate сам берёт latest).
  let prediction: CreatePredictionResponse;
  try {
    const submitRes = await fetch(`${REPLICATE_BASE}/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "wait=10", // даём 10 сек на быстрое завершение, потом polling
      },
      body: JSON.stringify({
        input: {
          prompt: opts.prompt,
          // Параметры модели берутся из MODEL_CONFIGS по имени модели,
          // переопределяются env-переменной REPLICATE_VIDEO_INPUT,
          // а финально — per-call через opts.modelInput.
          ...getModelInput(model),
          ...(opts.modelInput ?? {}),
        },
      }),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      return {
        ok: false,
        error: `Replicate submit failed ${submitRes.status}: ${text.slice(0, 300)}`,
      };
    }

    prediction = (await submitRes.json()) as CreatePredictionResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Replicate fetch failed: ${msg}` };
  }

  if (prediction.error) {
    return { ok: false, error: `Replicate error: ${prediction.error}`, predictionId: prediction.id };
  }

  // 2) Polling. 5 сек между запросами.
  const startedAt = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startedAt < timeoutMs) {
    if (prediction.status === "succeeded") break;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return {
        ok: false,
        error: `Replicate prediction ${prediction.status}: ${prediction.error ?? "no error message"}`,
        predictionId: prediction.id,
      };
    }

    await new Promise((r) => setTimeout(r, pollInterval));

    try {
      const pollRes = await fetch(`${REPLICATE_BASE}/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      });
      if (!pollRes.ok) {
        const text = await pollRes.text();
        return {
          ok: false,
          error: `Replicate poll failed ${pollRes.status}: ${text.slice(0, 200)}`,
          predictionId: prediction.id,
        };
      }
      const polled = (await pollRes.json()) as GetPredictionResponse;
      prediction = { ...prediction, status: polled.status, error: polled.error };
      if (polled.status === "succeeded") {
        // output — может быть строка или массив строк (зависит от модели)
        const output = polled.output;
        const videoUrl =
          typeof output === "string" ? output : Array.isArray(output) ? output[0] : null;
        if (!videoUrl) {
          return {
            ok: false,
            error: "Replicate succeeded но нет output URL",
            predictionId: prediction.id,
          };
        }
        return {
          ok: true,
          video: {
            predictionId: prediction.id,
            videoUrl,
            generationSec: polled.metrics?.predict_time ?? 0,
            model,
          },
        };
      }
      if (polled.status === "failed" || polled.status === "canceled") {
        return {
          ok: false,
          error: `Replicate ${polled.status}: ${polled.error ?? polled.logs?.slice(-300) ?? "unknown"}`,
          predictionId: prediction.id,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Replicate poll exception: ${msg}`,
        predictionId: prediction.id,
      };
    }
  }

  return {
    ok: false,
    error: `Replicate timeout after ${timeoutMs}ms`,
    predictionId: prediction.id,
  };
}

/** Скачивает финальный MP4 с Replicate CDN в Buffer. */
export async function downloadGeneratedVideo(videoUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(videoUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
