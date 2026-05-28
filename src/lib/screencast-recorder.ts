/**
 * Mobile screencast recorder для промо-рилсов MarketRadar.
 *
 * Запускает Chromium через Playwright с эмуляцией мобильного устройства,
 * выполняет переданный сценарий (последовательность действий), пишет видео
 * через встроенный recordVideo (WebM), конвертит в MP4 через ffmpeg.
 *
 * Результат — путь к MP4-файлу, готовому для вставки в Remotion-композицию.
 *
 * Зачем mobile, а не desktop:
 * - финальный рилс вертикальный (1080×1920), mobile-запись вписывается
 *   в phone-frame органично; desktop-запись приходится сильно кропать
 * - юзер интуитивно ассоциирует «мобилка в кадре» = «это в руках, юзабельно»
 *
 * Зачем своя обёртка, а не просто playwright API:
 * - изоляция: один общий механизм запуска + cleanup, не дублировать
 *   browser.launch/context.close в каждой ручке
 * - конверсия WebM → MP4 в одном месте (Remotion <Video> работает с MP4
 *   стабильнее чем с WebM, особенно на не-Chromium браузерах при preview)
 * - стандартизация размеров: всегда отдаём 450×800 (×2 deviceScaleFactor
 *   = 900×1600 native pixels), что точно вписывается в phone-frame
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import { spawn } from "child_process";
import { mkdir, rename, unlink, stat } from "fs/promises";
import path from "path";

// Логическое разрешение viewport. deviceScaleFactor=2 даст native 900×1600 в WebM.
// Соотношение 9:16, идеально вписывается в стандартный phone-frame.
const VIEWPORT_WIDTH = 450;
const VIEWPORT_HEIGHT = 800;
const DEVICE_SCALE_FACTOR = 2;

export interface ScreencastContext {
  page: Page;
  /** Базовый URL платформы, например https://staging.marketradar24.ru */
  baseUrl: string;
  /** Удобный sleep — не Bash, не process.nextTick. Использовать между действиями. */
  wait: (ms: number) => Promise<void>;
}

export type ScreencastScenario = (ctx: ScreencastContext) => Promise<void>;

export interface RecordOptions {
  /** Куда сохранить итоговый MP4. Папка должна существовать. */
  outDir: string;
  /** Имя файла без расширения (jobId). */
  fileName: string;
  /** Базовый URL платформы, на которой записываем. */
  baseUrl: string;
  /** Функция-сценарий. */
  scenario: ScreencastScenario;
  /** Максимум сек на сценарий. Default 30. По истечении — context.close(). */
  maxDurationSec?: number;
}

export interface RecordResult {
  mp4Path: string;
  sizeBytes: number;
  durationMs: number;
}

/**
 * Главная точка входа. Запускает headless Chromium, эмулирует mobile,
 * пишет сценарий, конвертит результат в MP4.
 */
export async function recordMobileScreencast(opts: RecordOptions): Promise<RecordResult> {
  const t0 = Date.now();
  await mkdir(opts.outDir, { recursive: true });

  const webmDir = path.join(opts.outDir, ".webm-tmp");
  await mkdir(webmDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // важно для VPS с маленьким /dev/shm
    ],
  });

  let context: BrowserContext | null = null;
  let webmPath: string | null = null;

  try {
    context = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      isMobile: true,
      hasTouch: true,
      // userAgent у Playwright по умолчанию — Chromium. Не подменяем на iPhone,
      // иначе платформа может отдать какой-то другой CSS. Эмулируем только
      // viewport/touch — достаточно чтобы сайт показал mobile-вариант.
      recordVideo: {
        dir: webmDir,
        size: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      },
    });

    const page = await context.newPage();

    const ctx: ScreencastContext = {
      page,
      baseUrl: opts.baseUrl,
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    };

    // Жёсткий таймаут на весь сценарий
    const maxMs = (opts.maxDurationSec ?? 30) * 1000;
    await Promise.race([
      opts.scenario(ctx),
      new Promise<void>((_, rej) =>
        setTimeout(() => rej(new Error(`screencast scenario timeout after ${maxMs}ms`)), maxMs),
      ),
    ]);

    // ВАЖНО: video файлится только когда context закрывается
    const video = page.video();
    await context.close();
    context = null;

    if (!video) throw new Error("page.video() returned null — recordVideo не активирован");
    webmPath = await video.path();
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (!webmPath) throw new Error("WebM-файл не сгенерирован");

  // Конвертация в MP4 через системный ffmpeg
  const mp4Path = path.join(opts.outDir, `${opts.fileName}.mp4`);
  await convertWebmToMp4(webmPath, mp4Path);

  // Чистим WebM-исходник
  await unlink(webmPath).catch(() => {});

  const fileStat = await stat(mp4Path);
  return {
    mp4Path,
    sizeBytes: fileStat.size,
    durationMs: Date.now() - t0,
  };
}

/**
 * Конвертирует WebM (VP8/VP9 от Playwright) в MP4 (H.264) через ffmpeg.
 * Используется системный ffmpeg — на VPS ставится через apt, локально
 * через choco/winget. Если ffmpeg не в PATH, выкинет ENOENT.
 *
 * Параметры кодирования: preset fast (баланс CPU/качество), CRF 23
 * (визуально lossless для UI-записи), pixel format yuv420p (нужен для
 * совместимости с QuickTime/Safari).
 */
function convertWebmToMp4(webmPath: string, mp4Path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y", // overwrite
        "-i", webmPath,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", // для стриминга через Range-запросы
        mp4Path,
      ],
      { windowsHide: true },
    );

    let stderrBuf = "";
    child.stderr.on("data", (d: Buffer) => {
      stderrBuf += d.toString();
      if (stderrBuf.length > 6000) stderrBuf = stderrBuf.slice(-6000);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderrBuf.slice(-1500)}`));
    });
  });
}

/**
 * Хелпер: переместить готовый MP4 из output-dir в /public/screencasts/
 * чтобы он был доступен по статичному URL.
 */
export async function publishScreencast(
  mp4Path: string,
  publicDir: string,
  fileName: string,
): Promise<string> {
  await mkdir(publicDir, { recursive: true });
  const destPath = path.join(publicDir, `${fileName}.mp4`);
  await rename(mp4Path, destPath);
  return destPath;
}
