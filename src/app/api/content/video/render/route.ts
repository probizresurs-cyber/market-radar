/**
 * POST /api/content/video/render
 *
 * Оркестратор конвейера «разобранный контент → готовое вертикальное видео».
 * Структура и job-store скопированы с generate-promo-reel-full/route.ts
 * (тот же паттерн: setImmediate + promo-jobs.ts + best-effort-ассеты, но
 * обязательный финальный рендер) — просто другие шаги и композиция.
 *
 * Два режима (body.mode, default "broll"):
 *
 *  "broll" — без говорящего аватара, дешевле и быстрее (~1-2 мин):
 *   1) /api/content/video/plan       — Director+QC: hookText/ctaText/
 *      brollQueries/mood
 *   2) /api/generate-promo-voiceover — ElevenLabs озвучка voiceoverScript
 *   3) Whisper-транскрипция СВОЕЙ ЖЕ озвучки с пословными таймингами —
 *      для точной синхронизации субтитров (не оценка по числу слов) и
 *      реальной длительности ролика (не прикидка)
 *   4) /api/generate-broll-videos    — AI-видео (Replicate) по brollQueries
 *   5) lib/music-library             — фоновая музыка по настроению (mood)
 *   6) /api/render-content-reel      — финальный рендер (ContentReel)
 *
 *  "avatar" — говорящий HeyGen-аватар, тот же результат, что даёт отдельная
 *   кнопка «Сгенерировать видео с аватаром» на карточке рилса, но через ЭТОТ
 *   оркестратор и общий с "broll"-режимом job-статус (один UI, один поллинг
 *   вместо двух разных механизмов):
 *   1) /api/generate-reel-video — кикает HeyGen video-agent, возвращает sessionId
 *   2) внутренний поллинг /api/video-status (сервер сам ждёт, клиенту не
 *      нужно опрашивать HeyGen напрямую — тот же promo-job интерфейс)
 *
 * В "broll"-режиме шаги 1-5 — best-effort (провал не рушит пайплайн, только
 * ухудшает результат). Финальный рендер (6) обязателен.
 *
 * Body: { mode?: "broll"|"avatar", title, scenario, voiceoverScript,
 *   companyName?, companyNiche?, brandBook?, brandColor?, accentColor?,
 *   // avatar-режим — те же поля, что шлёт AppShell.handleGenerateReelVideo:
 *   avatarId?, voiceId?, aspect?, brollScenes?, targetDurationSec?,
 *   subtitles?, videoMode?, voiceSpeed?, voicePitch?, voiceEmotion? }
 * Returns: { ok, data: { jobId, statusUrl } } — статус через тот же
 *   /api/promo-job-status/{jobId}, что и у generate-promo-reel-full.
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { createJob, updateJob } from "@/lib/promo-jobs";
import type { PromoStepReport } from "@/lib/promo-jobs";
import { transcribeWithWhisper } from "@/lib/reel-transcribe";
import { pickMusicUrl } from "@/lib/music-library";
import { sanitizeStyleSpec, resolveVideoColors, type StyleSpecInput } from "@/lib/video-style-types";
import { resolveVoicePreset } from "@/lib/voice-presets";

export const runtime = "nodejs";
export const maxDuration = 60;

type StepReport = PromoStepReport;

interface InternalCallResult<T> { ok: boolean; data?: T; error?: string }

async function callLocal<T = unknown>(
  pathName: string, body: Record<string, unknown>, originalReq: Request, timeoutMs: number,
): Promise<InternalCallResult<T>> {
  const origin = new URL(originalReq.url).origin;
  const cookie = originalReq.headers.get("cookie") ?? "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${origin}${pathName}`, {
      method: "POST", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    return (await r.json().catch(() => ({}))) as InternalCallResult<T>;
  } catch (e) {
    return { ok: false, error: `internal-fetch-failed: ${e instanceof Error ? e.message : String(e)}` };
  } finally { clearTimeout(timer); }
}

interface PlanData { hookText: string; ctaText: string; brollQueries: string[]; mood?: string; styleSpec?: Record<string, unknown>; qcNotes: string[] }

/** Запрет любых надписей в AI-сгенерированном кадре — см. шаг b-roll ниже. */
const NO_TEXT_CLAUSE =
  "No text, no letters, no words, no captions, no subtitles, no signage, no logos, no watermarks, no readable writing anywhere in frame.";
/**
 * Ограничители физики. Видео-модель разваливается ровно там, где движение
 * быстрое или сложное: пальцы в действии обзаводятся лишними суставами,
 * предметы «перетекают» друг в друга, походка плывёт. Единственное, что
 * реально помогает на стороне промпта, — просить медленный кадр с одним
 * субъектом и явно перечислить артефакты как нежелательные.
 */
const PHYSICS_CLAUSE =
  "Single subject, calm and slow motion, natural anatomy, correct number of fingers and limbs, stable objects that keep their shape. "
  + "Avoid fast action, avoid morphing or warping, avoid extra limbs or distorted hands, avoid objects passing through each other, avoid flickering.";
interface VoiceoverData { url: string }
interface StockData { urls: string[] }
interface RenderData { url: string; jobId: string; sizeBytes: number; durationMs: number }
interface GenerateReelVideoData { videoId: string }
interface VideoStatusData { status: "processing" | "completed" | "failed"; videoUrl?: string; thumbnailUrl?: string; error?: string }

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const scenario = String(body.scenario ?? "").trim();
  const voiceoverScript = String(body.voiceoverScript ?? "").trim();
  if (!scenario && !voiceoverScript) {
    return NextResponse.json({ ok: false, error: "scenario или voiceoverScript обязателен" }, { status: 400 });
  }

  const job = createJob(access.userId ?? null);
  setImmediate(() => {
    const mode = body.mode === "avatar" ? "avatar" : "broll";
    const run = mode === "avatar" ? runAvatarPipeline : runBrollPipeline;
    run(job.id, body, req).catch((e) => {
      updateJob(job.id, { status: "failed", error: `Pipeline crash: ${e instanceof Error ? e.message : String(e)}` });
    });
  });

  return NextResponse.json({ ok: true, data: { jobId: job.id, statusUrl: `/api/promo-job-status/${job.id}` } });
}

// ─── Режим "avatar" — HeyGen через уже существующий endpoint ────────────────
// Не собирает видео сам — кикает /api/generate-reel-video (тот же путь, что
// у отдельной кнопки «с аватаром») и поллит /api/video-status ВНУТРИ фонового
// пайплайна, чтобы наружу отдавать один и тот же promo-job интерфейс, каким
// бы движком видео ни собиралось.
async function runAvatarPipeline(jobId: string, body: Record<string, unknown>, req: Request) {
  const t0 = Date.now();
  const progress: StepReport[] = [];
  function pushStep(step: StepReport) { progress.push(step); updateJob(jobId, { progress: [...progress] }); }
  updateJob(jobId, { status: "running" });

  try {
    const stepT = Date.now();
    const kick = await callLocal<GenerateReelVideoData>("/api/generate-reel-video", {
      script: body.voiceoverScript,
      avatarId: body.avatarId,
      voiceId: body.voiceId,
      aspect: body.aspect,
      title: body.title,
      hook: body.title,
      companyName: body.companyName,
      companyNiche: body.companyNiche,
      brollScenes: body.brollScenes ?? [],
      targetDurationSec: body.targetDurationSec ?? 30,
      subtitles: body.subtitles !== false,
      videoMode: body.videoMode ?? "mixed",
      voiceSpeed: body.voiceSpeed,
      voicePitch: body.voicePitch,
      voiceEmotion: body.voiceEmotion,
    }, req, 55_000);

    if (!kick.ok || !kick.data?.videoId) {
      pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: kick.error });
      updateJob(jobId, { status: "failed", error: `HeyGen не запустился: ${kick.error ?? "unknown"}` });
      return;
    }

    const sessionId = kick.data.videoId;
    // Внутренний поллинг — HeyGen рендерит 2-5 мин, но это фоновый setImmediate,
    // не сам HTTP-ответ (тот уже ушёл клиенту с jobId). Таймаут страховки — 8 мин.
    const deadline = Date.now() + 8 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      // /api/video-status — GET, не POST, поэтому обычный fetch, а не callLocal.
      const origin = new URL(req.url).origin;
      const cookie = req.headers.get("cookie") ?? "";
      let statusJson: { ok: boolean; data?: VideoStatusData; error?: string };
      try {
        const r = await fetch(`${origin}/api/video-status?videoId=${encodeURIComponent(sessionId)}`, { headers: { cookie } });
        statusJson = await r.json();
      } catch (e) {
        statusJson = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      if (!statusJson.ok || !statusJson.data) continue; // временный сбой поллинга — пробуем ещё раз

      if (statusJson.data.status === "completed" && statusJson.data.videoUrl) {
        pushStep({ name: "avatar", status: "ok", ms: Date.now() - stepT });
        updateJob(jobId, {
          status: "done",
          result: { url: statusJson.data.videoUrl, jobId: sessionId, sizeBytes: 0, totalMs: Date.now() - t0 },
        });
        return;
      }
      if (statusJson.data.status === "failed") {
        pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: statusJson.data.error });
        updateJob(jobId, { status: "failed", error: statusJson.data.error || "HeyGen не смог собрать видео" });
        return;
      }
      // "processing" — продолжаем ждать.
    }

    pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: "Таймаут ожидания HeyGen (8 мин)" });
    updateJob(jobId, { status: "failed", error: "HeyGen не ответил за 8 минут — попробуйте ещё раз" });
  } catch (e) {
    updateJob(jobId, { status: "failed", error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── Режим "broll" — Director → голос → субтитры-транскрипция → b-roll → музыка → рендер ──
async function runBrollPipeline(jobId: string, body: Record<string, unknown>, req: Request) {
  const t0 = Date.now();
  const progress: StepReport[] = [];
  function pushStep(step: StepReport) { progress.push(step); updateJob(jobId, { progress: [...progress] }); }
  updateJob(jobId, { status: "running" });

  try {
    const title = String(body.title ?? "").trim();
    const scenario = String(body.scenario ?? "").trim();
    const voiceoverScript = String(body.voiceoverScript ?? "").trim();
    const companyName = String(body.companyName ?? "").trim();
    const companyNiche = String(body.companyNiche ?? "").trim();
    const brandBook = body.brandBook ?? null;
    const brandName = String(body.brandName ?? companyName ?? "MarketRadar").trim() || "MarketRadar";
    // Дефолты — нейтральная тёмная база, НЕ фирменные цвета MarketRadar:
    // раньше здесь стояли #0a0e1a/#22d3ee, и ролик любого клиента выходил в
    // наших цветах. Реальные цвета берутся ниже из brandBook.colors по выбору
    // арт-директора (resolveVideoColors), эти значения — только фолбэк, когда
    // брендбук не заполнен.
    const brandColorFallback = String(body.brandColor ?? "#0f1117").trim();
    const accentColorFallback = String(body.accentColor ?? "#e2e8f0").trim();

    // ── Шаг 1: Director + QC ────────────────────────────────────────────
    let hookText = title || "Смотрите до конца";
    let ctaText = "Узнайте подробнее";
    let brollQueries: string[] = [];
    let mood: string | undefined;
    let styleSpec: Record<string, unknown> | undefined;
    {
      const stepT = Date.now();
      // 115 сек, а не 55: у plan-роута maxDuration 120, и после перевода
      // Director'а на стриминг он честно работает дольше минуты (промпт с
      // словарём стилей + QC-ретрай). Старый лимит рубил его на 55-й секунде
      // и весь ролик оставался без плана, стиля и запросов на b-roll.
      const r = await callLocal<PlanData>("/api/content/video/plan",
        { title, scenario, voiceoverScript, companyName, companyNiche, brandBook, stylePrompt: body.stylePrompt }, req, 115_000);
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        hookText = r.data.hookText || hookText;
        ctaText = r.data.ctaText || ctaText;
        brollQueries = r.data.brollQueries ?? [];
        mood = r.data.mood;
        styleSpec = r.data.styleSpec;
        pushStep({ name: "plan", status: "ok", ms, error: r.data.qcNotes?.length ? `QC: ${r.data.qcNotes.join("; ")}` : undefined });
      } else {
        pushStep({ name: "plan", status: "failed", ms, error: r.error });
      }
    }

    // Спек стиля санитайзим ОДИН раз здесь: из него берутся и цвета, и голос,
    // и параметры рендера — важно, чтобы все три шага смотрели на одни и те
    // же провалидированные значения.
    const spec: StyleSpecInput | undefined = sanitizeStyleSpec(styleSpec);

    // Цвета — из палитры брендбука по выбору арт-директора. Фолбэк на
    // нейтраль, если брендбук пуст (см. resolveVideoColors).
    const { brandColor, accentColor } = resolveVideoColors(
      (brandBook as { colors?: unknown } | null)?.colors,
      spec,
      { brandColor: brandColorFallback, accentColor: accentColorFallback },
    );

    // ── Шаг 2: озвучка (ElevenLabs) — best-effort ───────────────────────
    let voiceoverUrl: string | null = null;
    if (voiceoverScript) {
      const stepT = Date.now();
      // hookText/problemText/ctaText обязательны у generate-promo-voiceover
      // валидацией, даже когда голос реально идёт по voiceoverScript-override —
      // подстраховываем problemText, чтобы пустой scenario не завалил шаг.
      const problemText = scenario.slice(0, 300) || voiceoverScript.slice(0, 300) || title || "Видео";
      // Голос — часть стиля: арт-директор выбирает тембр (пресет) и подачу.
      // Раньше голос был жёстко один на все ролики, из-за чего они звучали
      // одинаково независимо от темы и стиля.
      const voice = resolveVoicePreset(spec?.voice?.preset);
      const r = await callLocal<VoiceoverData>("/api/generate-promo-voiceover",
        {
          voiceoverScript, hookText, problemText, ctaText,
          voiceId: voice.voiceId,
          stability: spec?.voice?.stability,
          style: spec?.voice?.expressiveness,
          speed: spec?.voice?.speed,
        }, req, 130_000);
      const ms = Date.now() - stepT;
      if (r.ok && r.data) { voiceoverUrl = r.data.url; pushStep({ name: "voiceover", status: "ok", ms }); }
      else pushStep({ name: "voiceover", status: "failed", ms, error: r.error });
    } else {
      pushStep({ name: "voiceover", status: "skipped", ms: 0 });
    }

    // ── Шаг 3: транскрипция своей же озвучки — пословные тайминги + реальная
    // длительность. Не оценка по темпу речи, а измерение по факту сгенерённого
    // файла — субтитры идут точно в такт голосу. Best-effort: если Whisper не
    // настроен/упал — откатываемся на оценку по числу слов (как раньше).
    let captionsWords: Array<{ word: string; start: number; end: number }> | undefined;
    let measuredDurationSec: number | null = null;
    if (voiceoverUrl) {
      const stepT = Date.now();
      try {
        const origin = new URL(req.url).origin;
        const audioRes = await fetch(`${origin}${voiceoverUrl}`);
        if (!audioRes.ok) throw new Error(`Не удалось скачать озвучку: ${audioRes.status}`);
        const blob = await audioRes.blob();
        const transcribed = await transcribeWithWhisper(blob, "voiceover.mp3", { wordTimestamps: true });
        captionsWords = transcribed.words?.map((w) => ({ word: w.word, start: w.start, end: w.end }));
        measuredDurationSec = transcribed.durationSec;
        pushStep({ name: "captions", status: captionsWords?.length ? "ok" : "skipped", ms: Date.now() - stepT, error: captionsWords?.length ? undefined : "Whisper не вернул пословные тайминги" });
      } catch (e) {
        pushStep({ name: "captions", status: "failed", ms: Date.now() - stepT, error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      pushStep({ name: "captions", status: "skipped", ms: 0 });
    }

    // ── Шаг 4: AI-видео b-roll через Replicate (Seedance), не Pexels —
    // PEXELS_API_KEY на проде невалиден/не настроен (401), и это уже
    // используемый в админке сервис для генерации вертикальных роликов.
    // Каждый brollQuery от Director'а идёт отдельным prompt'ом (в обход
    // фиксированных fintech-шаблонов generate-broll-videos), лёгкая
    // кинематографичная обёртка — чтобы сюжет клипа реально соответствовал
    // теме ролика, а не дефолтным «аналитик за дашбордом».
    let brollUrls: string[] = [];
    if (brollQueries.length > 0) {
      const stepT = Date.now();
      // NO-TEXT — жёсткое требование: видео-модели рисуют на вывесках,
      // экранах и бумагах псевдо-буквы, а кириллицу не умеют вовсе. Любой
      // текст в кадре = мусор, который к тому же конфликтует с нашими
      // субтитрами. Просим чистый кадр без надписей.
      // Число клипов — главный рычаг себестоимости: генерация видео на
      // Replicate это ~97% стоимости ролика (~$0.40 за клип), всё остальное
      // копейки. Четыре клипа на ролик съедали бюджет слишком быстро, поэтому
      // по умолчанию берём два, а оставшиеся сегменты закрываем текстовыми
      // карточками с тезисами — они рисуются нами и бесплатны.
      // Переопределяется per-запрос (brollCount) или глобально через env.
      const brollCount = Math.max(
        0,
        Math.min(4, Number(body.brollCount ?? process.env.CONTENT_BROLL_COUNT ?? 2)),
      );
      if (brollCount === 0) {
        // Важно не звать роут с пустым списком промптов: он в этом случае
        // подставит свои шаблоны про финтех, и мы получим клипы не по теме
        // и по полной цене — ровно то, чего избегаем.
        pushStep({ name: "stock-videos", status: "skipped", ms: 0, error: "brollCount = 0, видеоряд из текстовых карточек" });
      } else {
      const prompts = brollQueries
        .slice(0, brollCount)
        .map((q) => `Cinematic vertical 9:16 shot, photorealistic, natural lighting, shallow depth of field. ${q}, slow deliberate camera movement. ${PHYSICS_CLAUSE} ${NO_TEXT_CLAUSE}`);
      const r = await callLocal<StockData>(
        "/api/generate-broll-videos",
        { prompts, jobId: `content-broll-${jobId}` },
        req,
        620_000, // generate-broll-videos.maxDuration = 600 + запас на HTTP round-trip
      );
      brollUrls = r.ok && r.data ? r.data.urls : [];
      const ms = Date.now() - stepT;
      if (brollUrls.length > 0) pushStep({ name: "stock-videos", status: "ok", ms });
      else pushStep({ name: "stock-videos", status: "failed", ms, error: r.error ?? "Replicate не сгенерил ни одного клипа" });
      }
    } else {
      pushStep({ name: "stock-videos", status: "skipped", ms: 0 });
    }

    // ── Шаг 5: фоновая музыка по настроению — best-effort, null если
    // библиотека пуста (см. public/music/README.md), рендер не страдает.
    let musicUrl: string | null = null;
    {
      const stepT = Date.now();
      try {
        musicUrl = await pickMusicUrl(mood);
        pushStep({ name: "music", status: musicUrl ? "ok" : "skipped", ms: Date.now() - stepT, error: musicUrl ? undefined : "Библиотека музыки пуста (public/music/manifest.json)" });
      } catch (e) {
        pushStep({ name: "music", status: "failed", ms: Date.now() - stepT, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Длительность: приоритет — реально измеренная Whisper'ом длительность
    // сгенерённой озвучки. Фолбэк — оценка по темпу речи ElevenLabs
    // (~2.7 слова/сек), если транскрипция не удалась/озвучки нет вовсе.
    const videoDurationSec = measuredDurationSec
      ? Math.max(15, Math.min(60, Math.round(measuredDurationSec)))
      : (() => {
          const words = voiceoverScript.split(/\s+/).filter(Boolean).length;
          return Math.max(15, Math.min(60, Math.round(words / 2.7) || 30));
        })();

    // Тезисы для текстовых карточек берём из СЦЕНАРИЯ ОЗВУЧКИ, а не отдельным
    // запросом к модели: карточка должна совпадать с тем, что зритель слышит
    // в этот момент, иначе картинка и голос расходятся. Плюс это ноль
    // дополнительной стоимости и ноль новых точек отказа.
    const statementCards = (voiceoverScript || scenario)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim().replace(/^[«"']|[»"']$/g, ""))
      .filter((s) => s.length >= 12 && s.length <= 64)
      .slice(0, 2);

    // ── Шаг 6: финальный рендер (обязательный) ──────────────────────────
    const stepT = Date.now();
    const renderR = await callLocal<RenderData>("/api/render-content-reel", {
      hookText, ctaText, brandName, brandColor, accentColor,
      voiceoverUrl, musicUrl, brollUrls, statementCards, videoDurationSec,
      captionsEnabled: true,
      captionsScript: voiceoverScript || `${hookText}. ${ctaText}`,
      captionsWords,
      styleSpec: spec,
    }, req, 880_000); // см. maxDuration=900 у render-content-reel
    const renderMs = Date.now() - stepT;

    if (!renderR.ok || !renderR.data) {
      pushStep({ name: "render", status: "failed", ms: renderMs, error: renderR.error });
      updateJob(jobId, { status: "failed", error: `Финальный рендер упал: ${renderR.error ?? "unknown"}` });
      return;
    }
    pushStep({ name: "render", status: "ok", ms: renderMs });

    updateJob(jobId, {
      status: "done",
      result: { url: renderR.data.url, jobId: renderR.data.jobId, sizeBytes: renderR.data.sizeBytes, totalMs: Date.now() - t0 },
    });
  } catch (e) {
    updateJob(jobId, { status: "failed", error: e instanceof Error ? e.message : String(e) });
  }
}
