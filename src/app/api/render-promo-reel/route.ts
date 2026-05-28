/**
 * POST /api/render-promo-reel
 *
 * Рендерит 30-секундный вертикальный промо-рилс через Remotion.
 * Остальной пайплайн (Claude → ElevenLabs → HeyGen) уже есть отдельно —
 * этот роут берёт готовые тексты + опциональный screencast/voiceover URL,
 * композирует через Remotion-композицию PromoReel и возвращает MP4.
 *
 * Remotion-проект живёт ОТДЕЛЬНО на D:\market-radar-video\ (не в node_modules
 * этого приложения) — рендер CPU-heavy, не хотим грузить event loop Next-API.
 * Запускаем как subprocess через npx.
 *
 * Body:
 *   hookText      — крючок (0-5 сек, крупный текст)
 *   problemText   — проблема (5-25 сек, заголовок над демо-блоком)
 *   ctaText       — призыв (25-30 сек)
 *   brandName     — имя бренда (в CTA-кнопке)
 *   brandColor?   — основной фон (default #0a0e1a)
 *   accentColor?  — акцент/CTA-цвет (default #22d3ee)
 *   screencastUrl?— URL/file:// видео для центральной сцены (опц)
 *   voiceoverUrl? — URL/file:// аудио для всего рилса (опц)
 *
 * Returns:
 *   { ok: true, data: { jobId, url, sizeBytes, durationMs } }
 *   url ведёт на GET /api/promo-reel/{jobId} — стрим MP4
 */
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { stat, mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 300;

// На локальной машине Windows можно переопределить REMOTION_PROJECT_DIR
// в .env.local (например D:\market-radar-video чтобы не копировать
// node_modules ~500MB на C:). На VPS используется in-repo путь.
const REMOTION_PROJECT_DIR =
  process.env.REMOTION_PROJECT_DIR ?? path.join(process.cwd(), "remotion");
const OUTPUT_DIR = path.join(REMOTION_PROJECT_DIR, "out");
// Если REMOTION_TEMP_DIR задан — Remotion bundler пишет webpack-output туда
// (нужно когда системный %TEMP% переполнен). На Linux обычно не нужно.
const TEMP_DIR = process.env.REMOTION_TEMP_DIR ?? "";

interface RenderProps {
  hookText: string;
  problemText: string;
  ctaText: string;
  brandName: string;
  brandColor: string;
  accentColor: string;
  screencastUrl: string | null;
  voiceoverUrl: string | null;
  // AI-картинки и b-roll — опциональные, если не переданы Remotion
  // покажет градиенты-фолбэки.
  hookBgImageUrl: string | null;
  ctaBgImageUrl: string | null;
  brollImageUrls: string[];
}

/**
 * Превращает URL для медиа-ассета (видео/аудио) в формат, который Remotion
 * сможет прочитать при headless-рендере:
 *  - http(s):// — оставляем как есть, Chrome скачает
 *  - /screencasts/xxx.mp4 или /voiceover/xxx.mp3 — относительный путь
 *    к статике в /public; конвертим в file:// чтобы не гонять HTTP-loopback
 *  - file:// — оставляем как есть
 *  - всё остальное — null (на всякий случай не передаём кривое)
 */
function resolveMediaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("file://")) return s;
  if (s.startsWith("/")) {
    // Относительный к /public — резолвим в абсолютный file://
    const abs = path.join(process.cwd(), "public", s.slice(1));
    return `file://${abs.split(path.sep).join("/")}`;
  }
  return null;
}

function parseProps(body: Record<string, unknown>): RenderProps | { error: string } {
  const hookText = String(body.hookText ?? "").trim();
  const problemText = String(body.problemText ?? "").trim();
  const ctaText = String(body.ctaText ?? "").trim();
  const brandName = String(body.brandName ?? "MarketRadar").trim();

  if (!hookText) return { error: "hookText обязателен" };
  if (!problemText) return { error: "problemText обязателен" };
  if (!ctaText) return { error: "ctaText обязателен" };

  if (hookText.length > 200) return { error: "hookText > 200 символов" };
  if (problemText.length > 300) return { error: "problemText > 300 символов" };
  if (ctaText.length > 150) return { error: "ctaText > 150 символов" };

  // brollImageUrls — массив, прогоняем каждый URL через resolveMediaUrl,
  // отбрасываем null'ы (не показываем кривые ссылки).
  const brollRaw = Array.isArray(body.brollImageUrls) ? body.brollImageUrls : [];
  const brollImageUrls = brollRaw
    .map((u) => resolveMediaUrl(typeof u === "string" ? u : null))
    .filter((u): u is string => u !== null)
    .slice(0, 3); // максимум 3, дальше слоты заняты

  return {
    hookText,
    problemText,
    ctaText,
    brandName,
    brandColor: String(body.brandColor ?? "#0a0e1a"),
    accentColor: String(body.accentColor ?? "#22d3ee"),
    screencastUrl: resolveMediaUrl(body.screencastUrl as string | null | undefined),
    voiceoverUrl: resolveMediaUrl(body.voiceoverUrl as string | null | undefined),
    hookBgImageUrl: resolveMediaUrl(body.hookBgImageUrl as string | null | undefined),
    ctaBgImageUrl: resolveMediaUrl(body.ctaBgImageUrl as string | null | undefined),
    brollImageUrls,
  };
}

async function runRemotion(jobId: string, props: RenderProps): Promise<void> {
  const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
  // Передаём props через FILE — иначе shell ломает кавычки/фигурные
  // скобки в JSON-аргументе, и Remotion получает невалидную строку
  // («You passed --props=... is parseable using JSON.parse»).
  const propsFile = path.join(OUTPUT_DIR, `${jobId}.props.json`);
  await writeFile(propsFile, JSON.stringify(props), "utf8");

  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (TEMP_DIR) {
    childEnv.TEMP = TEMP_DIR;
    childEnv.TMP = TEMP_DIR;
    childEnv.TMPDIR = TEMP_DIR;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "npx",
        [
          "remotion",
          "render",
          "PromoReel",
          outputPath,
          `--props=${propsFile}`,
        ],
        {
          cwd: REMOTION_PROJECT_DIR,
          env: childEnv,
          shell: true,
          windowsHide: true,
        },
      );

      let stderrBuf = "";
      child.stderr.on("data", (d: Buffer) => {
        stderrBuf += d.toString();
        if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`remotion render exited with code ${code}: ${stderrBuf.slice(-2000)}`));
      });
    });
  } finally {
    // Чистим props-файл независимо от исхода
    await unlink(propsFile).catch(() => {});
  }
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    if (TEMP_DIR) await mkdir(TEMP_DIR, { recursive: true });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseProps(body);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const jobId = `reel-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await runRemotion(jobId, parsed);

    const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
    const fileStat = await stat(outputPath);

    await access.log({
      endpoint: "render-promo-reel",
      model: "remotion-local",
      durationMs: Date.now() - t0,
    });

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        url: `/api/promo-reel/${jobId}`,
        sizeBytes: fileStat.size,
        durationMs: Date.now() - t0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await access.log({
      endpoint: "render-promo-reel",
      model: "remotion-local",
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: msg.slice(0, 500),
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
