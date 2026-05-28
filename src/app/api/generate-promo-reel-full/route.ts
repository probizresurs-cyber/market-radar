/**
 * POST /api/generate-promo-reel-full
 *
 * Большой оркестратор. Принимает тексты + опции, делает за тебя всё:
 *  1) (опц) generate-promo-images → AI-фоны для hook/CTA + b-roll
 *  2) (опц) record-screencast → mobile-запись платформы для ProductDemoScene
 *  3) render-promo-reel → финальный MP4 со всеми ассетами вместе
 *
 * Результат — URL готового MP4 + breakdown по шагам (сколько каждый занял,
 * что сгенерилось / что упало). Если картинки или скринкаст не сделались,
 * рендер всё равно идёт — просто без них, с фолбэк-градиентами.
 *
 * Зачем: чтобы юзеру (или UI) не пришлось знать про 3 разных эндпоинта
 * и порядок их вызова. Одна кнопка → готовое видео.
 *
 * Тайминг (худший случай при всех включённых опциях на staging-VPS):
 *   images:     30-60 сек (3-5 картинок Gemini)
 *   screencast: 25-40 сек
 *   render:     150-180 сек
 *   ──────────────────
 *   итого:      ~4-5 минут
 *
 * maxDuration = 600 (10 мин) с большим запасом. Юзер видит «висящий»
 * запрос всё это время — это нужно лечить переходом на job-queue с
 * polling-статусом, но для PoC синхронный вариант ок.
 *
 * Body:
 *   hookText      — обязательно
 *   problemText   — обязательно
 *   ctaText       — обязательно
 *   brandName?    — default "MarketRadar"
 *   niche?        — для контекста картинок
 *   accentColor?  — hex, default "#22d3ee"
 *   brandColor?   — hex фон, default "#0a0e1a"
 *   scenarioId?   — id скринкаст-сценария, default "marketing-tour"
 *   includeImages?     — default true
 *   includeScreencast? — default true
 *   includeBroll?      — default false (3 доп. картинки в б-ролл)
 *   voiceoverUrl?      — если уже есть готовый MP3, прокинется в рендер
 *
 * Returns:
 *   { ok: true, data: { url, jobId, progress, assets, totalMs } }
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 600;

interface StepReport {
  name: "images" | "screencast" | "render";
  status: "ok" | "failed" | "skipped";
  ms: number;
  error?: string;
}

interface InternalCallResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Вызывает локальный API-роут на том же origin с пробросом cookie
 * (нужно для auth — checkAiAccess проверяет сессию по cookie).
 * Тяжёлые роуты дольше fetch-default-timeout, ставим явный таймаут
 * через AbortController.
 */
async function callLocal<T = unknown>(
  pathName: string,
  body: Record<string, unknown>,
  originalReq: Request,
  timeoutMs: number,
): Promise<InternalCallResult<T>> {
  const origin = new URL(originalReq.url).origin;
  const cookie = originalReq.headers.get("cookie") ?? "";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(`${origin}${pathName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = (await r.json().catch(() => ({}))) as InternalCallResult<T>;
    return json;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `internal-fetch-failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

interface ImagesData {
  hookBgImageUrl: string | null;
  ctaBgImageUrl: string | null;
  brollImageUrls: string[];
  generatedInMs: number;
}

interface ScreencastData {
  url: string;
  totalMs: number;
}

interface RenderData {
  url: string;
  jobId: string;
  sizeBytes: number;
  durationMs: number;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  const progress: StepReport[] = [];

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const hookText = String(body.hookText ?? "").trim();
    const problemText = String(body.problemText ?? "").trim();
    const ctaText = String(body.ctaText ?? "").trim();
    if (!hookText || !problemText || !ctaText) {
      return NextResponse.json(
        { ok: false, error: "hookText/problemText/ctaText обязательны" },
        { status: 400 },
      );
    }

    const brandName = String(body.brandName ?? "MarketRadar").trim();
    const niche = body.niche ? String(body.niche).trim() : null;
    const accentColor = String(body.accentColor ?? "#22d3ee").trim();
    const brandColor = String(body.brandColor ?? "#0a0e1a").trim();
    const scenarioId = String(body.scenarioId ?? "marketing-tour").trim();

    const includeImages = body.includeImages !== false; // default true
    const includeScreencast = body.includeScreencast !== false; // default true
    const includeBroll = Boolean(body.includeBroll ?? false);

    const voiceoverUrl = body.voiceoverUrl ? String(body.voiceoverUrl) : null;

    // ──────────────── Шаг 1: AI-картинки ────────────────
    let imagesData: ImagesData | null = null;
    if (includeImages) {
      const stepT = Date.now();
      const r = await callLocal<ImagesData>(
        "/api/generate-promo-images",
        { brandName, niche, accentColor, includeBroll },
        req,
        130_000, // 130 сек — generate-promo-images.maxDuration = 120
      );
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        imagesData = r.data;
        progress.push({ name: "images", status: "ok", ms });
      } else {
        progress.push({ name: "images", status: "failed", ms, error: r.error });
      }
    } else {
      progress.push({ name: "images", status: "skipped", ms: 0 });
    }

    // ──────────────── Шаг 2: скринкаст ────────────────
    let screencastData: ScreencastData | null = null;
    if (includeScreencast) {
      const stepT = Date.now();
      const r = await callLocal<ScreencastData>(
        "/api/record-screencast",
        { scenarioId },
        req,
        130_000, // 130 сек — record-screencast.maxDuration = 120
      );
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        screencastData = r.data;
        progress.push({ name: "screencast", status: "ok", ms });
      } else {
        progress.push({ name: "screencast", status: "failed", ms, error: r.error });
      }
    } else {
      progress.push({ name: "screencast", status: "skipped", ms: 0 });
    }

    // ──────────────── Шаг 3: финальный рендер ────────────────
    const stepT = Date.now();
    const renderR = await callLocal<RenderData>(
      "/api/render-promo-reel",
      {
        hookText,
        problemText,
        ctaText,
        brandName,
        brandColor,
        accentColor,
        screencastUrl: screencastData?.url ?? null,
        voiceoverUrl,
        hookBgImageUrl: imagesData?.hookBgImageUrl ?? null,
        ctaBgImageUrl: imagesData?.ctaBgImageUrl ?? null,
        brollImageUrls: imagesData?.brollImageUrls ?? [],
      },
      req,
      310_000, // 310 сек — render-promo-reel.maxDuration = 300
    );
    const renderMs = Date.now() - stepT;

    if (!renderR.ok || !renderR.data) {
      progress.push({ name: "render", status: "failed", ms: renderMs, error: renderR.error });
      return NextResponse.json(
        {
          ok: false,
          error: `Финальный рендер упал: ${renderR.error ?? "unknown"}`,
          progress,
          totalMs: Date.now() - t0,
        },
        { status: 500 },
      );
    }
    progress.push({ name: "render", status: "ok", ms: renderMs });

    return NextResponse.json({
      ok: true,
      data: {
        url: renderR.data.url,
        jobId: renderR.data.jobId,
        sizeBytes: renderR.data.sizeBytes,
        progress,
        assets: {
          hookBgImageUrl: imagesData?.hookBgImageUrl ?? null,
          ctaBgImageUrl: imagesData?.ctaBgImageUrl ?? null,
          brollImageUrls: imagesData?.brollImageUrls ?? [],
          screencastUrl: screencastData?.url ?? null,
          voiceoverUrl,
        },
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, progress, totalMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}
