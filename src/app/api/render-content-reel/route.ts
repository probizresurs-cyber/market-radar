/**
 * POST /api/render-content-reel
 *
 * Рендерит вертикальный ролик из Контент-завода через Remotion-композицию
 * ContentReel (см. remotion/src/ContentReel.tsx) — b-roll клиента вместо
 * промо-мокапов MarketRadar, которые зашиты в PromoReel/ProductDemoScene.
 *
 * Намеренно НЕ переиспользует runRemotion() из render-promo-reel/route.ts —
 * дублирует ~60 строк spawn-boilerplate, чтобы не трогать работающий,
 * уже используемый в проде промо-пайплайн ради рефакторинга. Логика
 * идентична: props через временный файл, npx remotion render, kill on error.
 *
 * Body: { hookText, ctaText, brandName, brandColor?, accentColor?,
 *         voiceoverUrl?, musicUrl?, hookBgImageUrl?, ctaBgImageUrl?,
 *         brollUrls?, videoDurationSec?, captionsEnabled?, captionsScript? }
 * Returns: { ok: true, data: { jobId, url, sizeBytes, durationMs } }
 *   url ведёт на GET /api/promo-reel/{jobId} — тот же стример MP4,
 *   что и у PromoReel (не завязан на композицию, читает по jobId с диска).
 */
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { stat, mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { sanitizeStyleSpec, type StyleSpecInput } from "@/lib/video-style-types";

export const runtime = "nodejs";
export const maxDuration = 900; // 30-сек вертикалка с 4 b-roll на VPS рендерится дольше 5 минут

const REMOTION_PROJECT_DIR =
  process.env.REMOTION_PROJECT_DIR ?? path.join(process.cwd(), "remotion");
const OUTPUT_DIR = path.join(REMOTION_PROJECT_DIR, "out");
const TEMP_DIR = process.env.REMOTION_TEMP_DIR ?? "";

interface CaptionWord { word: string; start: number; end: number }

interface RenderProps {
  hookText: string;
  ctaText: string;
  brandName: string;
  brandColor: string;
  accentColor: string;
  voiceoverUrl: string | null;
  musicUrl: string | null;
  hookBgImageUrl: string | null;
  ctaBgImageUrl: string | null;
  brollUrls: string[];
  statementCards: string[];
  videoDurationSec: number;
  captionsEnabled: boolean;
  captionsScript: string | null;
  captionsWords?: CaptionWord[];
  /** Генеративная спецификация стиля (v3) — приоритетнее styleVariant. */
  styleSpec?: StyleSpecInput;
  /** Легаси-пресеты (v2) — используются, только если styleSpec не задан. */
  styleVariant?: "dynamic" | "clean" | "bold";
}

function resolveMediaUrl(raw: string | null | undefined, assetsOrigin: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("file://")) return s;
  if (s.startsWith("/")) return `${assetsOrigin}${s}`;
  return null;
}

/**
 * Откуда Remotion берёт медиа: loopback или публичный домен.
 *
 * Remotion тянет КАЖДЫЙ кадр каждого b-roll отдельным запросом. Через
 * публичный HTTPS (nginx + Cloudflare) четыре видео в TransitionSeries не
 * укладываются в 30-секундный лимит delayRender, и рендер падал с
 * «Timed out evaluating page function window.remotion_setFrame». Раньше это
 * не проявлялось: b-roll не было вообще, а озвучка — один мелкий файл.
 *
 * Порт loopback'а угадывать нельзя (рядом живёт staging на другом порту),
 * поэтому проверяем его живым HEAD по РЕАЛЬНОМУ ассету этого же рендера и
 * молча откатываемся на публичный origin, если не ответил.
 */
async function pickAssetsOrigin(publicOrigin: string, probePath: string | null): Promise<string> {
  if (!probePath) return publicOrigin;
  const candidate = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(`${candidate}${probePath}`, { method: "HEAD", signal: ctrl.signal });
    if (r.ok) return candidate;
  } catch { /* порт другой или loopback закрыт — уходим на публичный */ }
  finally { clearTimeout(timer); }
  return publicOrigin;
}

/** Первый относительный медиа-путь из body — им и проверяем loopback. */
function firstRelativeAsset(body: Record<string, unknown>): string | null {
  const broll = Array.isArray(body.brollUrls) ? body.brollUrls : [];
  const candidates = [...broll, body.voiceoverUrl, body.hookBgImageUrl, body.ctaBgImageUrl];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("/")) return c;
  }
  return null;
}

function parseProps(body: Record<string, unknown>, assetsOrigin: string): RenderProps | { error: string } {
  const hookText = String(body.hookText ?? "").trim();
  const ctaText = String(body.ctaText ?? "").trim();
  const brandName = String(body.brandName ?? "MarketRadar").trim();

  if (!hookText) return { error: "hookText обязателен" };
  if (!ctaText) return { error: "ctaText обязателен" };
  if (hookText.length > 200) return { error: "hookText > 200 символов" };
  if (ctaText.length > 150) return { error: "ctaText > 150 символов" };

  const brollRaw = Array.isArray(body.brollUrls) ? body.brollUrls : [];
  const brollUrls = brollRaw
    .map((u) => resolveMediaUrl(typeof u === "string" ? u : null, assetsOrigin))
    .filter((u): u is string => u !== null)
    .slice(0, 10);

  return {
    hookText,
    ctaText,
    brandName,
    brandColor: String(body.brandColor ?? "#0a0e1a"),
    accentColor: String(body.accentColor ?? "#22d3ee"),
    voiceoverUrl: resolveMediaUrl(body.voiceoverUrl as string | null | undefined, assetsOrigin),
    musicUrl: resolveMediaUrl(body.musicUrl as string | null | undefined, assetsOrigin),
    hookBgImageUrl: resolveMediaUrl(body.hookBgImageUrl as string | null | undefined, assetsOrigin),
    ctaBgImageUrl: resolveMediaUrl(body.ctaBgImageUrl as string | null | undefined, assetsOrigin),
    brollUrls,
    statementCards: (Array.isArray(body.statementCards) ? body.statementCards : [])
      .map((c) => String(c).trim()).filter(Boolean).slice(0, 4),
    captionsEnabled: Boolean(body.captionsEnabled ?? false),
    captionsScript: body.captionsScript ? String(body.captionsScript) : null,
    captionsWords: Array.isArray(body.captionsWords)
      ? (body.captionsWords as unknown[]).filter(
          (w): w is CaptionWord => typeof w === "object" && w !== null && "word" in w && "start" in w && "end" in w,
        )
      : undefined,
    styleSpec: sanitizeStyleSpec(body.styleSpec),
    styleVariant: body.styleVariant === "clean" || body.styleVariant === "bold" ? body.styleVariant : "dynamic",
    videoDurationSec: (() => {
      const n = Number(body.videoDurationSec);
      if (!Number.isFinite(n)) return 30;
      return Math.max(10, Math.min(90, Math.round(n)));
    })(),
  };
}

async function runRemotion(jobId: string, props: RenderProps): Promise<void> {
  const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
  const propsFile = path.join(OUTPUT_DIR, `${jobId}.props.json`);
  await writeFile(propsFile, JSON.stringify(props), "utf8");

  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (TEMP_DIR) {
    childEnv.TEMP = TEMP_DIR;
    childEnv.TMP = TEMP_DIR;
    childEnv.TMPDIR = TEMP_DIR;
  }

  let spawnedChild: ReturnType<typeof spawn> | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "npx",
        [
          "remotion", "render", "ContentReel", outputPath, `--props=${propsFile}`,
          // Дефолтный лимит delayRender — 30 сек на кадр. Кадр с двумя
          // перекрывающимися b-roll (момент перехода) на слабом VPS в него
          // не всегда влезает даже по loopback'у, а падение стоит всего
          // ролика. 120 сек — страховка, а не рабочий режим.
          "--timeout=120000",
        ],
        { cwd: REMOTION_PROJECT_DIR, env: childEnv, shell: true, windowsHide: true },
      );
      spawnedChild = child;

      let stderrBuf = "";
      child.stderr.on("data", (d: Buffer) => {
        stderrBuf += d.toString();
        if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
      });

      child.on("error", reject);
      child.on("close", (code) => {
        spawnedChild = null;
        if (code === 0) resolve();
        else {
          // Полный stderr — в лог PM2: обрезанный хвост в job-статусе съедал
          // НАЧАЛО ошибки (само сообщение), оставляя только стек.
          console.error(`[render-content-reel] ${jobId} exited ${code}. Full stderr:\n${stderrBuf}`);
          // В статус отдаём первые 400 (суть ошибки) + хвост стека.
          const head = stderrBuf.slice(0, 400);
          const tail = stderrBuf.length > 400 ? ` … ${stderrBuf.slice(-300)}` : "";
          reject(new Error(`remotion render exited with code ${code}. stderr: ${head}${tail}`));
        }
      });
    });
  } catch (err) {
    if (spawnedChild) {
      try {
        (spawnedChild as ReturnType<typeof spawn>).kill("SIGTERM");
        setTimeout(() => {
          try { (spawnedChild as ReturnType<typeof spawn>)?.kill("SIGKILL"); } catch { /* ignore */ }
        }, 2000);
      } catch { /* ignore */ }
    }
    throw err;
  } finally {
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

    const explicitOrigin = typeof body.assetsOrigin === "string" ? body.assetsOrigin : null;
    const reqUrl = new URL(req.url);
    const assetsOrigin = explicitOrigin
      ?? await pickAssetsOrigin(`${reqUrl.protocol}//${reqUrl.host}`, firstRelativeAsset(body));

    const parsed = parseProps(body, assetsOrigin);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const jobId = `content-reel-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await runRemotion(jobId, parsed);

    const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
    const fileStat = await stat(outputPath);

    await access.log({ endpoint: "render-content-reel", model: "remotion-local", durationMs: Date.now() - t0 });

    return NextResponse.json({
      ok: true,
      data: { jobId, url: `/api/promo-reel/${jobId}`, sizeBytes: fileStat.size, durationMs: Date.now() - t0 },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await access.log({ endpoint: "render-content-reel", model: "remotion-local", durationMs: Date.now() - t0, success: false, errorMessage: msg.slice(0, 500) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
