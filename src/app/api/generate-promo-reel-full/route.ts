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
  name: "images" | "screencast" | "voiceover" | "stock-videos" | "animated-broll" | "render";
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
    const includeVoiceover = Boolean(body.includeVoiceover ?? false);
    // stockVideoQuery — если задан, оркестратор скачает портретные видео
    // из Pexels. Английская фраза. Если useStockVideos=true но query пустой —
    // явная ошибка ниже, не silent skip как раньше.
    const stockVideoQuery = String(body.stockVideoQuery ?? "").trim();
    const useStockVideos = Boolean(body.useStockVideos ?? false);

    // useAnimatedBroll — генерим AI-видео b-roll через Replicate
    // (Minimax Hailuo и пр.). Дорого ($0.40-0.50 за клип) и медленно
    // (1-2 мин на клип, параллелим). Тема для промптов берётся из
    // animatedBrollTheme (англ) или fallback из niche.
    const useAnimatedBroll = Boolean(body.useAnimatedBroll ?? false);
    const animatedBrollTheme = String(body.animatedBrollTheme ?? niche ?? "").trim();

    // Валидируем заранее: чекбокс стоков включён без query = очевидный
    // user-error, лучше сразу сказать чем тихо пропустить шаг.
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
    // Режим демо когда есть И screencast И broll-источники:
    //   "corners"   — 3 угла, broll сидит вокруг phone-frame (default)
    //   "alternate" — phone-frame и full-screen broll чередуются по сегментам;
    //                 нужно столько broll'ов сколько фуллскрин-сегментов,
    //                 такая же логика что full-broll режим без скринкаста
    const demoMixMode: "corners" | "alternate" =
      body.demoMixMode === "alternate" ? "alternate" : "corners";

    let brollCount = 0;
    let stockCount = 0;
    let animatedCount = 0;
    if (includeScreencast && demoMixMode === "corners") {
      brollCount = includeBroll ? 3 : 0;
    } else {
      // Считаем сколько источников активно
      const sources: ("animated" | "stock" | "broll")[] = [];
      if (useAnimatedBroll) sources.push("animated");
      if (useStockVideos) sources.push("stock");
      if (includeBroll) sources.push("broll");

      if (sources.length > 0) {
        const baseShare = Math.floor(totalSlots / sources.length);
        const remainder = totalSlots - baseShare * sources.length;

        // Назначаем по очереди в порядке приоритета (animated > stock > broll).
        // Кто первый — получает +1 при остатках.
        sources.forEach((s, i) => {
          const share = baseShare + (i < remainder ? 1 : 0);
          if (s === "animated") animatedCount = share;
          if (s === "stock") stockCount = share;
          if (s === "broll") brollCount = share;
        });
      }
    }
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
        progress.push({ name: "images", status: "ok", ms });
      } else {
        progress.push({ name: "images", status: "failed", ms, error: r.error });
      }
    } else {
      progress.push({ name: "images", status: "skipped", ms: 0 });
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
        310_000, // 5 мин с запасом — generate-broll-videos.maxDuration = 300
      );
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        animatedBrollUrls = r.data.urls ?? [];
        progress.push({ name: "animated-broll", status: "ok", ms });
      } else {
        progress.push({ name: "animated-broll", status: "failed", ms, error: r.error });
      }
    } else {
      progress.push({ name: "animated-broll", status: "skipped", ms: 0 });
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
        progress.push({ name: "stock-videos", status: "ok", ms });
      } else {
        progress.push({ name: "stock-videos", status: "failed", ms, error: r.error });
      }
    } else {
      progress.push({ name: "stock-videos", status: "skipped", ms: 0 });
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
      const r = await callLocal<{ url: string }>(
        "/api/generate-promo-voiceover",
        { hookText, problemText, ctaText, voiceId, voiceoverScript },
        req,
        130_000,
      );
      const ms = Date.now() - stepT2;
      if (r.ok && r.data) {
        voiceoverUrl = r.data.url;
        progress.push({ name: "voiceover", status: "ok", ms });
      } else {
        progress.push({ name: "voiceover", status: "failed", ms, error: r.error });
      }
    } else {
      progress.push({
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
        brollImageUrls: imagesData?.brollImageUrls ?? [],
        // animated-broll-видео идут в тот же массив что стоковые —
        // ProductDemoScene всё равно по расширению определяет видео это
        // или картинка, и при .mp4 рендерит через OffthreadVideo.
        stockVideoUrls: [...animatedBrollUrls, ...stockVideoUrls],
        demoMixMode: body.demoMixMode,
        videoDurationSec: body.videoDurationSec,
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
