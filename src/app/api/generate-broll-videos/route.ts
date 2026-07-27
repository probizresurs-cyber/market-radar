/**
 * POST /api/generate-broll-videos
 *
 * AI-видео b-roll через Replicate (Minimax Hailuo-02 по умолчанию).
 * 5-6 сек клипы с реальной анимацией: люди, движения, кинематичность.
 *
 * Дороже чем AI-картинки или стоки:
 *  - $0.40-0.50 за клип
 *  - 1-2 минуты на генерацию каждого
 *  - Параллелим до 4 одновременно (Replicate-лимит дефолтный)
 *
 * Зачем: визуально мощнее статичных AI-картинок и универсальнее чем стоки
 * (стоки часто не подходят под конкретную нишу, а AI-видео генерим под
 * любую тему).
 *
 * Body:
 *   query     — английский промпт для модели (одна строка типа сцены)
 *   count     — сколько клипов (1-8). Default 4.
 *   model?    — replicate-модель override (default из env / minimax/hailuo-02)
 *   prompts?  — массив ГОТОВЫХ английских промптов, по одному на клип (1-8). Если
 *               передан — используется НАПРЯМУЮ вместо шаблонов
 *               brollVideoPrompts(theme) ниже (которые заточены под
 *               собственный fintech/dashboard b-roll МаркетРадара и не
 *               подходят для контента произвольной ниши клиента). count
 *               в этом случае игнорируется — берём prompts.length.
 *
 * Returns:
 *   { ok, data: { urls: [/api/static-asset/broll-videos/...], generationsMs } }
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { generateVideo, downloadGeneratedVideo } from "@/lib/replicate-video";

export const runtime = "nodejs";
// 10 минут — Replicate на бесплатных/Starter планах часто очередит
// параллельные запросы (1-2 одновременно макс). При 4 параллельных
// клипах: первый ~1-2 мин, второй +2 мин, третий +2 мин, четвёртый +2 мин
// = до 8 мин на самый последний. +запас 2 мин.
export const maxDuration = 600;

const BROLL_VIDEOS_DIR = "broll-videos";

/**
 * Шаблоны промптов для AI-видео b-roll'а под Kling v2.1.
 * Промпты соответствуют best-practice для Kling:
 *   1. Композиция/план: "Cinematic vertical shot of..."
 *   2. Сцена + субъект: "person at laptop in dark office"
 *   3. Движение камеры: "slow dolly in", "tilt up", "tracking shot"
 *   4. Освещение/настроение: "dark moody lighting, premium feel"
 *   5. Style: "9:16 vertical, cinematic, photorealistic"
 *
 * Без 9:16 в самом промпте — это управляется параметром aspect_ratio.
 * Берутся по индексу до нужного count, при count > 8 циклятся.
 */
function brollVideoPrompts(theme: string): string[] {
  const themeLine = theme ? ` Theme context: ${theme}.` : "";
  // Видео-модели рисуют вместо букв нечитаемый мусор (кириллицу — тем более),
  // поэтому кадр должен быть без надписей: экраны и дашборды показываем
  // расфокусом/абстрактной графикой, а не текстом.
  const noText = " No text, no letters, no words, no captions, no signage, no logos, no watermarks, no readable writing anywhere in frame.";
  const style = "Cinematic vertical 9:16 shot, photorealistic, dark moody lighting, premium fintech feel." + noText;
  return [
    `${style} Professional marketing analyst at sleek modern workstation, monitors glowing with abstract blurred colour gradients out of focus, hands typing focused, slow camera dolly-in.${themeLine}`,
    `${style} Close-up of person holding smartphone, soft coloured screen glow reflecting on face, screen content out of focus, shallow depth of field, slow camera push-in.${themeLine}`,
    `${style} Dramatic shot of abstract glowing upward line and particles flowing up a huge dark LED wall, pure shapes and light, slow camera tilt-up.${themeLine}`,
    `${style} Overhead shot of clean modern desk, laptop screen showing soft defocused colour glow, hands typing, coffee, notebook, slow rotation camera.${themeLine}`,
    `${style} Macro close-up of fingers tapping a smartphone, abstract glowing dots pulsing on the screen, dark background, slow camera dolly.${themeLine}`,
    `${style} Wide shot of business meeting room, professionals gesturing towards a large screen filled with abstract blurred light, insight and discovery, slow tracking shot.${themeLine}`,
    `${style} Abstract data visualization floating in dark space, particles forming charts and graphs, holographic style, slow camera orbit.${themeLine}`,
    `${style} Person walking through modern office at sunset, golden hour light, holding smartphone confidently, cinematic tracking shot.${themeLine}`,
  ];
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const theme = String(body.query ?? body.theme ?? "").trim();
    const model = body.model ? String(body.model) : undefined;
    const jobId = String(body.jobId ?? `broll-vid-${Date.now()}-${randomUUID().slice(0, 8)}`);

    const customPrompts = Array.isArray(body.prompts)
      ? body.prompts.map((p) => String(p).trim()).filter(Boolean).slice(0, 8)
      : [];
    const count = Math.max(1, Math.min(8, Number(body.count ?? 4)));
    // Готовые prompts (по одной сцене за штуку) имеют приоритет над
    // шаблонами brollVideoPrompts — те заточены под fintech-b-roll МР
    // и одинаковы для любой theme, кроме приписанной в конце строки.
    const prompts = customPrompts.length > 0 ? customPrompts : brollVideoPrompts(theme).slice(0, count);

    // Параллельная генерация. Replicate сам очередит если параллелим больше
    // чем разрешает аккаунт — просто будет дольше.
    const publicDir = path.join(process.cwd(), "public", BROLL_VIDEOS_DIR);
    await mkdir(publicDir, { recursive: true });

    const results = await Promise.all(
      prompts.map(async (prompt, i) => {
        // 8 мин на клип — Replicate очередит параллельные запросы
        // на низких тарифах, последние ждут предыдущих.
        const gen = await generateVideo({ prompt, model, timeoutMs: 480_000 });
        if (!gen.ok) {
          return { index: i, url: null, error: gen.error };
        }
        // Качаем готовый MP4 локально — Replicate CDN не вечный (~1 час)
        const buf = await downloadGeneratedVideo(gen.video.videoUrl);
        if (!buf) {
          return { index: i, url: null, error: "Download failed", predictionId: gen.video.predictionId };
        }
        const fileName = `${jobId}-${i + 1}.mp4`;
        await writeFile(path.join(publicDir, fileName), buf);
        return {
          index: i,
          url: `/api/static-asset/${BROLL_VIDEOS_DIR}/${fileName}`,
          predictionId: gen.video.predictionId,
          generationSec: gen.video.generationSec,
          bytes: buf.byteLength,
          model: gen.video.model,
        };
      }),
    );

    const successful = results.filter((r) => r.url !== null);
    const failures = results.filter((r) => r.url === null);

    // Если хоть один упал — добавляем предупреждение в ответе, чтобы UI
    // показал юзеру что НЕ всё сгенерилось (раньше тихо проглатывали).
    const partialFailWarning =
      failures.length > 0 && successful.length > 0
        ? `Replicate сгенерил ${successful.length}/${prompts.length}. Не успели: ${failures
            .map((f) => `#${f.index + 1} (${f.error?.slice(0, 80) ?? "unknown"})`)
            .join("; ")}`
        : null;

    if (successful.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Replicate не сгенерил ни одного видео. Первая ошибка: ${
            failures[0]?.error ?? "unknown"
          }`,
          failures,
        },
        { status: 502 },
      );
    }

    await access.log({
      endpoint: "generate-broll-videos",
      model: model ?? "bytedance/seedance-1-pro",
      success: true,
      durationMs: Date.now() - t0,
    });

    return NextResponse.json({
      ok: true,
      // Включаем warning при partial success — UI/оркестратор может
      // показать сообщение про неудавшиеся клипы.
      warning: partialFailWarning,
      data: {
        jobId,
        urls: successful.map((s) => s.url as string),
        videos: successful,
        failures: failures.length ? failures : undefined,
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, elapsedMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}
