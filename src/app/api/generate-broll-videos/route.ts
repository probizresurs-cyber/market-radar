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
// 5 минут — каждое видео ~1-2 мин, 4 параллельно ~= 2 мин, +запас.
// Если нужно больше 4 — Replicate всё равно очередит на их стороне,
// тайм-аут не превысим.
export const maxDuration = 300;

const BROLL_VIDEOS_DIR = "broll-videos";

/**
 * Шаблоны промптов для AI-видео b-roll'а. Каждый — отдельная визуальная
 * сцена с движением. Берутся по индексу до нужного count.
 */
function brollVideoPrompts(theme: string): string[] {
  const themeLine = theme ? ` ${theme}.` : "";
  return [
    `Professional marketing analyst at sleek modern workstation, multiple glowing monitors showing data dashboards, hands typing focused, cinematic camera slow push-in, dark moody office lighting.${themeLine}`,
    `Close-up of person holding smartphone with glowing analytics dashboard, screen reflects on face, dark background, slow camera dolly, premium fintech aesthetic.${themeLine}`,
    `Dramatic shot of growth arrow chart rising on huge LED screen, data particles flowing upward, futuristic boardroom, slow camera tilt up, cinematic.${themeLine}`,
    `Top-down shot of clean modern desk with laptop showing dashboard, hands typing, coffee, notebook, slow rotation camera, premium SaaS atmosphere.${themeLine}`,
    `Macro close-up of fingers tapping smartphone screen with notifications appearing one by one, dark moody lighting, shallow depth of field.${themeLine}`,
    `Wide shot of business meeting room, professionals analyzing data on big screen, gestures of insight and discovery, cinematic slow camera move.${themeLine}`,
    `Abstract data visualization floating in dark space, particles forming charts and graphs, holographic style, slow camera orbit, futuristic tech aesthetic.${themeLine}`,
    `Person walking through modern office at sunset, golden hour light, holding smartphone, looking confident, cinematic tracking shot.${themeLine}`,
  ];
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const theme = String(body.query ?? body.theme ?? "").trim();
    const count = Math.max(1, Math.min(8, Number(body.count ?? 4)));
    const model = body.model ? String(body.model) : undefined;
    const jobId = String(body.jobId ?? `broll-vid-${Date.now()}-${randomUUID().slice(0, 8)}`);

    const prompts = brollVideoPrompts(theme).slice(0, count);

    // Параллельная генерация. Replicate сам очередит если параллелим больше
    // чем разрешает аккаунт — просто будет дольше.
    const publicDir = path.join(process.cwd(), "public", BROLL_VIDEOS_DIR);
    await mkdir(publicDir, { recursive: true });

    const results = await Promise.all(
      prompts.map(async (prompt, i) => {
        const gen = await generateVideo({ prompt, model, timeoutMs: 270_000 });
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
      model: model ?? "minimax/hailuo-02",
      success: true,
      durationMs: Date.now() - t0,
    });

    return NextResponse.json({
      ok: true,
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
