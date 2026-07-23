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
 *   4) /api/fetch-stock-videos       — по каждому brollQuery, параллельно
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

interface PlanData { hookText: string; ctaText: string; brollQueries: string[]; mood?: string; qcNotes: string[] }
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
    const brandColor = String(body.brandColor ?? "#0a0e1a").trim();
    const accentColor = String(body.accentColor ?? "#22d3ee").trim();

    // ── Шаг 1: Director + QC ────────────────────────────────────────────
    let hookText = title || "Смотрите до конца";
    let ctaText = "Узнайте подробнее";
    let brollQueries: string[] = [];
    let mood: string | undefined;
    {
      const stepT = Date.now();
      const r = await callLocal<PlanData>("/api/content/video/plan",
        { title, scenario, voiceoverScript, companyName, companyNiche, brandBook }, req, 55_000);
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        hookText = r.data.hookText || hookText;
        ctaText = r.data.ctaText || ctaText;
        brollQueries = r.data.brollQueries ?? [];
        mood = r.data.mood;
        pushStep({ name: "plan", status: "ok", ms, error: r.data.qcNotes?.length ? `QC: ${r.data.qcNotes.join("; ")}` : undefined });
      } else {
        pushStep({ name: "plan", status: "failed", ms, error: r.error });
      }
    }

    // ── Шаг 2: озвучка (ElevenLabs) — best-effort ───────────────────────
    let voiceoverUrl: string | null = null;
    if (voiceoverScript) {
      const stepT = Date.now();
      // hookText/problemText/ctaText обязательны у generate-promo-voiceover
      // валидацией, даже когда голос реально идёт по voiceoverScript-override —
      // подстраховываем problemText, чтобы пустой scenario не завалил шаг.
      const problemText = scenario.slice(0, 300) || voiceoverScript.slice(0, 300) || title || "Видео";
      const r = await callLocal<VoiceoverData>("/api/generate-promo-voiceover",
        { voiceoverScript, hookText, problemText, ctaText }, req, 130_000);
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

    // ── Шаг 4: b-roll с Pexels по каждому запросу, параллельно ──────────
    let brollUrls: string[] = [];
    if (brollQueries.length > 0) {
      const stepT = Date.now();
      const results = await Promise.all(
        brollQueries.slice(0, 4).map((q) =>
          callLocal<StockData>("/api/fetch-stock-videos", { query: q, count: 1 }, req, 60_000)),
      );
      brollUrls = results.flatMap((r) => (r.ok && r.data ? r.data.urls : []));
      const ms = Date.now() - stepT;
      if (brollUrls.length > 0) pushStep({ name: "stock-videos", status: "ok", ms });
      else pushStep({ name: "stock-videos", status: "failed", ms, error: "Pexels не нашёл ни одного клипа ни по одному запросу" });
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

    // ── Шаг 6: финальный рендер (обязательный) ──────────────────────────
    const stepT = Date.now();
    const renderR = await callLocal<RenderData>("/api/render-content-reel", {
      hookText, ctaText, brandName, brandColor, accentColor,
      voiceoverUrl, musicUrl, brollUrls, videoDurationSec,
      captionsEnabled: true,
      captionsScript: voiceoverScript || `${hookText}. ${ctaText}`,
      captionsWords,
    }, req, 310_000);
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
