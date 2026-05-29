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
  musicUrl: string | null;
  // AI-картинки и b-roll — опциональные, если не переданы Remotion
  // покажет градиенты-фолбэки.
  hookBgImageUrl: string | null;
  ctaBgImageUrl: string | null;
  // Старое поле — оставляем для backward compat с прямыми вызовами.
  // Оркестратор должен слать новые: brollCornerImageUrls + brollFullscreenImageUrls.
  brollImageUrls: string[];
  brollCornerImageUrls: string[];
  brollFullscreenImageUrls: string[];
  stockVideoUrls: string[];
  videoDurationSec: number;
  demoMixMode: "corners" | "alternate";
  /** Ручной порядок сегментов. Если задан — render идёт строго по нему. */
  customDemoSequence?: ("screencast" | "video" | "image")[];
}

/**
 * Превращает URL для медиа-ассета (видео/аудио/картинка) в формат,
 * который Remotion сможет прочитать при headless-рендере:
 *  - http(s):// — оставляем как есть, Chrome скачает
 *  - file:// — оставляем как есть (legacy, в проде не используется)
 *  - /screencasts/xxx.mp4, /promo-images/xxx.png и т.д. — относительный
 *    путь к статике в /public; конвертим в loopback HTTP
 *    (http://127.0.0.1:PORT/path), потому что:
 *      • Remotion's download-and-map-assets-to-file падает на file:// при
 *        concurrent доступе из множественных subprocess'ов
 *      • Loopback HTTP к localhost быстрее чем file:// в headless Chrome
 *        (file:// триггерит дополнительные security checks)
 *      • Тот же Next-сервер уже отдаёт /public/ как статику — никакой
 *        дополнительной инфры не нужно
 *
 * @param raw — URL или null
 * @param assetsOrigin — `http://127.0.0.1:3003` (или с тем портом на
 *                          котором крутится этот же Next-инстанс)
 */
function resolveMediaUrl(raw: string | null | undefined, assetsOrigin: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("file://")) return s;
  if (s.startsWith("/")) {
    // Loopback HTTP — Remotion fetch'нет файл по обычной HTTP-схеме.
    return `${assetsOrigin}${s}`;
  }
  return null;
}

function parseProps(
  body: Record<string, unknown>,
  assetsOrigin: string,
): RenderProps | { error: string } {
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
  // Раздельные массивы AI-картинок: углы (max 3) и fullscreen (max 8).
  const cornerRaw = Array.isArray(body.brollCornerImageUrls) ? body.brollCornerImageUrls : [];
  const brollCornerImageUrls = cornerRaw
    .map((u) => resolveMediaUrl(typeof u === "string" ? u : null, assetsOrigin))
    .filter((u): u is string => u !== null)
    .slice(0, 3);

  const fsRaw = Array.isArray(body.brollFullscreenImageUrls) ? body.brollFullscreenImageUrls : [];
  const brollFullscreenImageUrls = fsRaw
    .map((u) => resolveMediaUrl(typeof u === "string" ? u : null, assetsOrigin))
    .filter((u): u is string => u !== null)
    .slice(0, 8);

  // Legacy brollImageUrls — старые клиенты могут слать одним массивом.
  // Если новые поля пусты, а legacy полон — раскидываем: первые 3 как углы,
  // остальные как fullscreen.
  const legacyBrollRaw = Array.isArray(body.brollImageUrls) ? body.brollImageUrls : [];
  const brollImageUrls = legacyBrollRaw
    .map((u) => resolveMediaUrl(typeof u === "string" ? u : null, assetsOrigin))
    .filter((u): u is string => u !== null)
    .slice(0, 8);
  if (brollImageUrls.length > 0 && brollCornerImageUrls.length === 0 && brollFullscreenImageUrls.length === 0) {
    brollCornerImageUrls.push(...brollImageUrls.slice(0, 3));
    brollFullscreenImageUrls.push(...brollImageUrls.slice(3));
  }

  // stockVideoUrls (Pexels). В full-broll режиме приоритетно над b-roll'ом.
  const stockRaw = Array.isArray(body.stockVideoUrls) ? body.stockVideoUrls : [];
  const stockVideoUrls = stockRaw
    .map((u) => resolveMediaUrl(typeof u === "string" ? u : null, assetsOrigin))
    .filter((u): u is string => u !== null)
    .slice(0, 8);

  return {
    hookText,
    problemText,
    ctaText,
    brandName,
    brandColor: String(body.brandColor ?? "#0a0e1a"),
    accentColor: String(body.accentColor ?? "#22d3ee"),
    screencastUrl: resolveMediaUrl(body.screencastUrl as string | null | undefined, assetsOrigin),
    voiceoverUrl: resolveMediaUrl(body.voiceoverUrl as string | null | undefined, assetsOrigin),
    musicUrl: resolveMediaUrl(body.musicUrl as string | null | undefined, assetsOrigin),
    hookBgImageUrl: resolveMediaUrl(body.hookBgImageUrl as string | null | undefined, assetsOrigin),
    ctaBgImageUrl: resolveMediaUrl(body.ctaBgImageUrl as string | null | undefined, assetsOrigin),
    brollImageUrls,
    brollCornerImageUrls,
    brollFullscreenImageUrls,
    stockVideoUrls,
    // Режим демо когда есть и screencast и broll: "corners" или "alternate".
    // Дефолт "corners" — обратная совместимость.
    demoMixMode: body.demoMixMode === "alternate" ? "alternate" : "corners",
    // Ручной порядок сегментов — если задан, переопределяет demoMixMode
    customDemoSequence: Array.isArray(body.customDemoSequence)
      ? (body.customDemoSequence.filter(
          (s: unknown): s is "screencast" | "video" | "image" =>
            s === "screencast" || s === "video" || s === "image",
        ) as ("screencast" | "video" | "image")[])
      : undefined,
    // Длительность ролика. Клампим 10..90, дефолт 30.
    videoDurationSec: (() => {
      const n = Number(body.videoDurationSec);
      if (!Number.isFinite(n)) return 30;
      return Math.max(10, Math.min(90, Math.round(n)));
    })(),
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

    // Определяем origin для ассетов. Возможные сценарии:
    //  1. Клиент дёргает по HTTPS → req.url = https://staging.marketradar24.ru/...
    //     Используем staging-домен — Remotion fetch'нет через nginx + Cloudflare.
    //     Работает, но медленнее loopback'а.
    //  2. Внутренний вызов через fetch на 127.0.0.1:3003 (например из
    //     orchestrator-роута на той же машине) → port уже есть, используем его.
    //  3. Можно явно передать assetsOrigin в body (для оркестраторов).
    //
    // Резюме: предпочитаем явный assetsOrigin из body, иначе строим из req.url.
    const explicitOrigin = typeof body.assetsOrigin === "string" ? body.assetsOrigin : null;
    const reqUrl = new URL(req.url);
    const assetsOrigin = explicitOrigin ?? `${reqUrl.protocol}//${reqUrl.host}`;

    const parsed = parseProps(body, assetsOrigin);
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
