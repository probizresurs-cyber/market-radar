/**
 * POST /api/content/video/render
 *
 * Оркестратор конвейера «разобранный контент → готовое вертикальное видео».
 * Структура и job-store скопированы с generate-promo-reel-full/route.ts
 * (тот же паттерн: setImmediate + promo-jobs.ts + best-effort-ассеты, но
 * обязательный финальный рендер) — просто другие шаги и композиция.
 *
 * Шаги:
 *  1) /api/content/video/plan     — Director+QC: hookText/ctaText/brollQueries
 *  2) /api/generate-promo-voiceover — ElevenLabs озвучка полного voiceoverScript
 *  3) /api/fetch-stock-videos      — по каждому brollQuery, параллельно (Pexels)
 *  4) /api/render-content-reel     — финальный рендер (ContentReel-композиция)
 *
 * Шаги 1-3 — best-effort (провал не рушит пайплайн, только ухудшает
 * результат: план получит generic hook/cta, ролик — без озвучки/b-roll).
 * Шаг 4 обязателен — без него нет видео вообще.
 *
 * Длительность ролика оценивается по числу слов в voiceoverScript (~2.7
 * слова/сек — темп ElevenLabs, см. комментарий в CaptionsLayer.tsx),
 * а не измеряется из аудио-файла — экономит отдельный вызов транскрипции
 * ради цифры, которая и так участвует в грубой раскадровке хук/broll/CTA.
 *
 * Body: { title, scenario, voiceoverScript, companyName?, companyNiche?,
 *         brandBook?, brandColor?, accentColor? }
 * Returns: { ok, data: { jobId, statusUrl } } — статус через тот же
 *   /api/promo-job-status/{jobId}, что и у generate-promo-reel-full.
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { createJob, updateJob } from "@/lib/promo-jobs";
import type { PromoStepReport } from "@/lib/promo-jobs";

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

interface PlanData { hookText: string; ctaText: string; brollQueries: string[]; qcNotes: string[] }
interface VoiceoverData { url: string }
interface StockData { urls: string[] }
interface RenderData { url: string; jobId: string; sizeBytes: number; durationMs: number }

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
    runPipeline(job.id, body, req).catch((e) => {
      updateJob(job.id, { status: "failed", error: `Pipeline crash: ${e instanceof Error ? e.message : String(e)}` });
    });
  });

  return NextResponse.json({ ok: true, data: { jobId: job.id, statusUrl: `/api/promo-job-status/${job.id}` } });
}

async function runPipeline(jobId: string, body: Record<string, unknown>, req: Request) {
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
    {
      const stepT = Date.now();
      const r = await callLocal<PlanData>("/api/content/video/plan",
        { title, scenario, voiceoverScript, companyName, companyNiche, brandBook }, req, 55_000);
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        hookText = r.data.hookText || hookText;
        ctaText = r.data.ctaText || ctaText;
        brollQueries = r.data.brollQueries ?? [];
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

    // ── Шаг 3: b-roll с Pexels по каждому запросу, параллельно ──────────
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

    // Длительность — по темпу озвучки ElevenLabs (~2.7 слова/сек), не по
    // измерению файла: экономит отдельный вызов ради приблизительной
    // раскадровки, где точность до секунды не нужна (хук/broll/CTA и так
    // пропорциональны). Клампим в разумных пределах для reels.
    const words = voiceoverScript.split(/\s+/).filter(Boolean).length;
    const videoDurationSec = Math.max(15, Math.min(60, Math.round(words / 2.7) || 30));

    // ── Шаг 4: финальный рендер (обязательный) ──────────────────────────
    const stepT = Date.now();
    const renderR = await callLocal<RenderData>("/api/render-content-reel", {
      hookText, ctaText, brandName, brandColor, accentColor,
      voiceoverUrl, brollUrls, videoDurationSec,
      captionsEnabled: true,
      captionsScript: voiceoverScript || `${hookText}. ${ctaText}`,
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
