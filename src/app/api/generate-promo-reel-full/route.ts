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
import { createJob, updateJob } from "@/lib/promo-jobs";
import type { PromoStepReport } from "@/lib/promo-jobs";

export const runtime = "nodejs";
// 600 сек — нам этого хватает только пока pipeline всё ещё ВЫГЛЯДИТ как
// синхронный (создание job-а в setImmediate). Сам pipeline в фоне может
// крутиться сколько угодно, проксям-таймаутам безразлично.
export const maxDuration = 60;

// Тип PromoStepReport импортируется из lib/promo-jobs.
type StepReport = PromoStepReport;

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

/**
 * Async POST handler: проверяет body, создаёт job в памяти, запускает
 * pipeline в фоне через setImmediate и мгновенно возвращает {jobId}.
 * UI поллит /api/promo-job-status/{jobId} — никаких proxy-таймаутов.
 */
export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Базовая sync-валидация — то что 100% упадёт независимо от пайплайна.
  const hookText = String(body.hookText ?? "").trim();
  const problemText = String(body.problemText ?? "").trim();
  const ctaText = String(body.ctaText ?? "").trim();
  if (!hookText || !problemText || !ctaText) {
    return NextResponse.json(
      { ok: false, error: "hookText/problemText/ctaText обязательны" },
      { status: 400 },
    );
  }

  const useStockVideos = Boolean(body.useStockVideos ?? false);
  const stockVideoQuery = String(body.stockVideoQuery ?? "").trim();
  if (useStockVideos && !stockVideoQuery) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Вы включили «Стоковые видео из Pexels», но не указали поисковый запрос. Заполните поле «Поисковый запрос (английский)» или выключите чекбокс.",
      },
      { status: 400 },
    );
  }

  // Создаём async job и запускаем pipeline в фоне.
  const job = createJob(access.userId ?? null);
  setImmediate(() => {
    runPipeline(job.id, body, req).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      updateJob(job.id, { status: "failed", error: `Pipeline crash: ${msg}` });
    });
  });

  // Мгновенно возвращаем jobId. Клиент поллит /promo-job-status/{jobId}.
  return NextResponse.json({
    ok: true,
    data: {
      jobId: job.id,
      statusUrl: `/api/promo-job-status/${job.id}`,
    },
  });
}

/**
 * Фоновый pipeline. Запускается через setImmediate после возврата HTTP-ответа.
 * Обновляет статус job-а через updateJob() на каждом шаге чтобы UI видел
 * прогресс при poll'ах.
 */
async function runPipeline(jobId: string, body: Record<string, unknown>, req: Request) {
  const t0 = Date.now();
  const progress: StepReport[] = [];

  // Helper: push step И сразу синхронить с job-store, чтобы UI видел.
  function pushStep(step: StepReport) {
    progress.push(step);
    updateJob(jobId, { progress: [...progress] });
  }

  updateJob(jobId, { status: "running" });

  try {
    // Поля уже валидированы в POST handler — здесь только парсинг.
    const hookText = String(body.hookText ?? "").trim();
    const problemText = String(body.problemText ?? "").trim();
    const ctaText = String(body.ctaText ?? "").trim();

    const brandName = String(body.brandName ?? "MarketRadar").trim();
    const niche = body.niche ? String(body.niche).trim() : null;
    const accentColor = String(body.accentColor ?? "#22d3ee").trim();
    const brandColor = String(body.brandColor ?? "#0a0e1a").trim();
    const scenarioId = String(body.scenarioId ?? "marketing-tour").trim();

    const includeImages = body.includeImages !== false; // default true
    const includeScreencast = body.includeScreencast !== false; // default true
    const includeVoiceover = Boolean(body.includeVoiceover ?? false);

    // includeBroll был раньше одной галкой — теперь две:
    //   includeBrollCorners   — 3 угла-картинки overlay поверх phone-frame
    //                            (имеет смысл только со screencast)
    //   includeBrollFullscreen — N картинок занимают весь кадр в demo
    // Backward compat: если приходит старое поле includeBroll — мапим в
    // включить-всё-что-работает (corners если screencast, иначе fullscreen).
    const legacyIncludeBroll = Boolean(body.includeBroll ?? false);
    const includeBrollCorners =
      Boolean(body.includeBrollCorners ?? false) ||
      (legacyIncludeBroll && includeScreencast);
    const includeBrollFullscreen =
      Boolean(body.includeBrollFullscreen ?? false) ||
      (legacyIncludeBroll && !includeScreencast);
    // stockVideoQuery + useStockVideos уже валидированы в POST handler.
    const stockVideoQuery = String(body.stockVideoQuery ?? "").trim();
    const useStockVideos = Boolean(body.useStockVideos ?? false);

    // useAnimatedBroll — генерим AI-видео b-roll через Replicate
    // (Minimax Hailuo и пр.). Дорого ($0.40-0.50 за клип) и медленно
    // (1-2 мин на клип, параллелим). Тема для промптов берётся из
    // animatedBrollTheme (англ) или fallback из niche.
    const useAnimatedBroll = Boolean(body.useAnimatedBroll ?? false);
    const animatedBrollTheme = String(body.animatedBrollTheme ?? niche ?? "").trim();

    // customDemoSequence — ручной порядок сегментов. Если задан,
    // переопределяет авто-распределение counts: считаем нужное кол-во
    // каждого типа прямо из последовательности.
    const customDemoSequence: ("screencast" | "video" | "image")[] = Array.isArray(body.customDemoSequence)
      ? body.customDemoSequence.filter(
          (s: unknown): s is "screencast" | "video" | "image" =>
            s === "screencast" || s === "video" || s === "image",
        )
      : [];
    const useCustomSequence = customDemoSequence.length > 0;

    // Валидируем заранее: чекбокс стоков включён без query = очевидный
    // user-error — валидация уже сработала в POST handler, до сюда не доходит.

    // Длительность ролика. Клампим 10..90. По умолчанию 30.
    const videoDurationSec = (() => {
      const n = Number(body.videoDurationSec);
      if (!Number.isFinite(n)) return 30;
      return Math.max(10, Math.min(90, Math.round(n)));
    })();

    // Сколько b-roll картинок и/или стоковых видео сгенерировать. Логика
    // зависит от комбинации флагов:
    //
    // Corner-режим (есть screencast):
    //   includeBroll=true → 3 AI-картинки по углам. Stock-видео игнорим
    //   (в углах видео избыточно, гифки в углах = визуальный шум).
    //
    // Full-broll режим (нет screencast'а), сколько слотов всего:
    //   totalSlots = ceil(demoSec / 5), min 1, max 8
    //
    //   Только AI-broll → brollCount = totalSlots, stockCount = 0
    //   Только стоки    → brollCount = 0, stockCount = totalSlots
    //   ОБА включены    → 50/50 микс. Stocks получают +1 при нечётности
    //                     (они задают темп и закрывают сцену лучше)
    const hookSec = Math.max(3, Math.round(videoDurationSec * 0.17));
    const ctaSec = Math.max(3, Math.round(videoDurationSec * 0.17));
    const demoSec = Math.max(5, videoDurationSec - hookSec - ctaSec);
    const totalSlots = Math.max(1, Math.min(8, Math.ceil(demoSec / 5)));

    // Распределение слотов между источниками визуала. Логика по приоритету:
    //  - В corner-режиме (со screencast'ом) только AI-картинки в углах,
    //    максимум 3. Видео и анимации в углах = визуальный шум.
    //  - В full-broll режиме: если включены 2+ источников, делим слоты
    //    как можно равномернее. Animated > stock > images по визуальной
    //    привлекательности, поэтому при нечётности отдаём остатки в этом
    //    порядке.
    // Auto-detect demoMixMode по флагам:
    //   - есть screencast И хотя бы один fullscreen-источник
    //     (broll-fullscreen / stocks / animated) → "alternate"
    //     (phone и fullscreen чередуются)
    //   - иначе "corners" (только углы поверх phone, либо чистый full-broll
    //     без screencast'а)
    const anyFullscreenSource = includeBrollFullscreen || useStockVideos || useAnimatedBroll;
    const demoMixMode: "corners" | "alternate" =
      includeScreencast && anyFullscreenSource ? "alternate" : "corners";

    // Подсчёт количества картинок/видео по каждому источнику:
    //  - cornerCount: 3 если включены углы И есть screencast, иначе 0
    //  - fullscreen-слоты делятся равномерно между активными fullscreen-
    //    источниками (broll-fullscreen, stocks, animated). При нечётности
    //    больше достаётся первым: animated > stock > broll-fullscreen.
    const cornerCount = includeBrollCorners && includeScreencast ? 3 : 0;

    let fullscreenBrollCount = 0;
    let stockCount = 0;
    let animatedCount = 0;
    const fsSources: ("animated" | "stock" | "broll")[] = [];
    if (useAnimatedBroll) fsSources.push("animated");
    if (useStockVideos) fsSources.push("stock");
    if (includeBrollFullscreen) fsSources.push("broll");

    if (fsSources.length > 0) {
      const baseShare = Math.floor(totalSlots / fsSources.length);
      const remainder = totalSlots - baseShare * fsSources.length;
      fsSources.forEach((s, i) => {
        const share = baseShare + (i < remainder ? 1 : 0);
        if (s === "animated") animatedCount = share;
        if (s === "stock") stockCount = share;
        if (s === "broll") fullscreenBrollCount = share;
      });
    }

    // Custom-sequence override: если юзер задал ручной порядок,
    // пересчитываем counts строго по нему. Каждый тип в sequence требует
    // соответствующее количество URL'ов.
    if (useCustomSequence) {
      const videosInSeq = customDemoSequence.filter((s) => s === "video").length;
      const imagesInSeq = customDemoSequence.filter((s) => s === "image").length;
      // Делим video-слоты между animated и stock пропорционально их активным
      // источникам (если оба on — поровну, если только один — всё ему).
      if (videosInSeq > 0) {
        if (useAnimatedBroll && useStockVideos) {
          animatedCount = Math.ceil(videosInSeq / 2);
          stockCount = Math.floor(videosInSeq / 2);
        } else if (useAnimatedBroll) {
          animatedCount = videosInSeq;
          stockCount = 0;
        } else if (useStockVideos) {
          animatedCount = 0;
          stockCount = videosInSeq;
        } else {
          // В sequence есть "video" но ни один видео-источник не активен —
          // юзер ошибся, всё равно генерим хотя бы из animated по дефолту.
          animatedCount = videosInSeq;
        }
      } else {
        animatedCount = 0;
        stockCount = 0;
      }
      fullscreenBrollCount = imagesInSeq;
    }

    // brollCount для generate-promo-images = corners + fullscreen-AI картинок.
    // В возвращаемом brollImageUrls первые cornerCount идут как углы,
    // остальные как fullscreen.
    const brollCount = cornerCount + fullscreenBrollCount;
    const voiceId = body.voiceId ? String(body.voiceId) : null;

    // Внешние ассеты можно передать напрямую если они уже сгенерены
    // или скачаны (например музыка из бесплатной библиотеки).
    let voiceoverUrl = body.voiceoverUrl ? String(body.voiceoverUrl) : null;
    const musicUrl = body.musicUrl ? String(body.musicUrl) : null;

    // ──────────────── Шаг 1: AI-картинки (hook+CTA фоны + b-roll) ─────────
    // generate-promo-images теперь генерит hook+cta И/ИЛИ broll независимо —
    // вызываем endpoint если нужно хотя бы что-то одно из них.
    let imagesData: ImagesData | null = null;
    const needAiImages = includeImages || brollCount > 0;
    if (needAiImages) {
      const stepT = Date.now();
      const r = await callLocal<ImagesData>(
        "/api/generate-promo-images",
        {
          brandName,
          niche,
          accentColor,
          includeHookCta: includeImages, // hook+cta фоны
          includeBroll: brollCount > 0,  // broll картинки
          brollCount,
        },
        req,
        130_000, // 130 сек — generate-promo-images.maxDuration = 120
      );
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        imagesData = r.data;
        pushStep({ name: "images", status: "ok", ms });
      } else {
        pushStep({ name: "images", status: "failed", ms, error: r.error });
      }
    } else {
      pushStep({ name: "images", status: "skipped", ms: 0 });
    }

    // ──────────────── Шаг 1.3 (опц): AI-видео b-roll через Replicate ─────
    // Дорогой и медленный шаг (1-2 мин на клип, $0.40-0.50). Делаем ДО
    // стоков и скринкаста чтобы успели параллельно с ними завершиться
    // (Promise.all в downloadResults сам ждёт самый медленный).
    let animatedBrollUrls: string[] = [];
    if (useAnimatedBroll && animatedCount > 0) {
      const stepT = Date.now();
      const r = await callLocal<{ urls: string[] }>(
        "/api/generate-broll-videos",
        { query: animatedBrollTheme, count: animatedCount },
        req,
        620_000, // 10+ мин — generate-broll-videos.maxDuration = 600,
                 // +запас 20 сек на HTTP round-trip
      );
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        animatedBrollUrls = r.data.urls ?? [];
        pushStep({ name: "animated-broll", status: "ok", ms });
      } else {
        pushStep({ name: "animated-broll", status: "failed", ms, error: r.error });
      }
    } else {
      pushStep({ name: "animated-broll", status: "skipped", ms: 0 });
    }

    // ──────────────── Шаг 1.5 (опц): стоковые видео Pexels ────────────────
    // stockCount вычислили выше — учитывает 50/50 микс если включён и broll.
    let stockVideoUrls: string[] = [];
    if (useStockVideos && stockCount > 0) {
      const stepT = Date.now();
      const r = await callLocal<{ urls: string[] }>(
        "/api/fetch-stock-videos",
        { query: stockVideoQuery, count: stockCount },
        req,
        190_000, // 190 сек — fetch-stock-videos.maxDuration = 180
      );
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        stockVideoUrls = r.data.urls ?? [];
        pushStep({ name: "stock-videos", status: "ok", ms });
      } else {
        pushStep({ name: "stock-videos", status: "failed", ms, error: r.error });
      }
    } else {
      pushStep({ name: "stock-videos", status: "skipped", ms: 0 });
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
        pushStep({ name: "screencast", status: "ok", ms });
      } else {
        pushStep({ name: "screencast", status: "failed", ms, error: r.error });
      }
    } else {
      pushStep({ name: "screencast", status: "skipped", ms: 0 });
    }

    // ──────────────── Шаг 3 (опц): voiceover через ElevenLabs ────────────────
    // Делаем ТРЕТЬИМ — после картинок и скринкаста, чтобы остальные могли
    // рендериться даже если voiceover упадёт (например ключ ElevenLabs
    // протух). Голос можно догенерить отдельно и приклеить.
    if (includeVoiceover && !voiceoverUrl) {
      const stepT2 = Date.now();
      // voiceoverScript (опц) — полный текст для озвучки. Если есть — заменяет
      // авто-сборку из hook/problem/CTA. Нужно когда юзер хочет голос на все
      // 30 сек (auto-build даёт ~7-10 сек из 3 коротких текстов).
      const voiceoverScript = body.voiceoverScript ? String(body.voiceoverScript) : undefined;
      // Пробрасываем ElevenLabs тонкие настройки из UI
      const elevenModel = body.elevenModel ? String(body.elevenModel) : undefined;
      const stability = typeof body.stability === "number" ? body.stability : undefined;
      const similarity = typeof body.similarity === "number" ? body.similarity : undefined;
      const style = typeof body.style === "number" ? body.style : undefined;
      const speakerBoost = typeof body.speakerBoost === "boolean" ? body.speakerBoost : undefined;
      const r = await callLocal<{ url: string }>(
        "/api/generate-promo-voiceover",
        { hookText, problemText, ctaText, voiceId, voiceoverScript,
          elevenModel, stability, similarity, style, speakerBoost },
        req,
        130_000,
      );
      const ms = Date.now() - stepT2;
      if (r.ok && r.data) {
        voiceoverUrl = r.data.url;
        pushStep({ name: "voiceover", status: "ok", ms });
      } else {
        pushStep({ name: "voiceover", status: "failed", ms, error: r.error });
      }
    } else {
      pushStep({
        name: "voiceover",
        status: voiceoverUrl ? "ok" : "skipped",
        ms: 0,
      });
    }

    // ──────────────── Шаг 4: финальный рендер ────────────────
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
        musicUrl,
        hookBgImageUrl: imagesData?.hookBgImageUrl ?? null,
        ctaBgImageUrl: imagesData?.ctaBgImageUrl ?? null,
        // Разделяем broll-картинки: первые cornerCount как углы, остальные
        // как fullscreen. Зеркало логики counts выше.
        brollCornerImageUrls: (imagesData?.brollImageUrls ?? []).slice(0, cornerCount),
        brollFullscreenImageUrls: (imagesData?.brollImageUrls ?? []).slice(cornerCount),
        // animated-broll-видео идут в тот же массив что стоковые —
        // ProductDemoScene по расширению определяет видео это или картинка,
        // и при .mp4 рендерит через OffthreadVideo.
        stockVideoUrls: [...animatedBrollUrls, ...stockVideoUrls],
        demoMixMode,
        customDemoSequence: useCustomSequence ? customDemoSequence : undefined,
        videoDurationSec: body.videoDurationSec,
      },
      req,
      310_000, // 310 сек — render-promo-reel.maxDuration = 300
    );
    const renderMs = Date.now() - stepT;

    if (!renderR.ok || !renderR.data) {
      pushStep({ name: "render", status: "failed", ms: renderMs, error: renderR.error });
      updateJob(jobId, {
        status: "failed",
        error: `Финальный рендер упал: ${renderR.error ?? "unknown"}`,
      });
      return;
    }
    pushStep({ name: "render", status: "ok", ms: renderMs });

    // Success — фиксируем результат в job-store. UI поллит /status и
    // увидит status:"done" + result.url.
    updateJob(jobId, {
      status: "done",
      result: {
        url: renderR.data.url,
        jobId: renderR.data.jobId,
        sizeBytes: renderR.data.sizeBytes,
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateJob(jobId, { status: "failed", error: msg });
  }
}
