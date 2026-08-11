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
 *  "broll" — наш движок (Remotion + Replicate), дешевле и быстрее (~1-3 мин).
 *   Аватар необязателен — это слой поверх нашего видеоряда (см. шаг 4б), а не
 *   отдельный движок, как в режиме "avatar" ниже:
 *   1) /api/content/video/plan       — Director+QC: hookText/ctaText/
 *      brollQueries/mood
 *   2) /api/generate-promo-voiceover — ElevenLabs озвучка voiceoverScript
 *   3) Whisper-транскрипция СВОЕЙ ЖЕ озвучки с пословными таймингами —
 *      для точной синхронизации субтитров (не оценка по числу слов) и
 *      реальной длительности ролика (не прикидка)
 *   4) /api/generate-broll-videos    — AI-видео (Replicate) по brollQueries
 *   4б) /api/generate-avatar-clip    — говорящая голова HeyGen ПО НАШЕЙ
 *      озвучке (параллельно с 4); ложится слоем в наш же кадр, если
 *      арт-директор заказал её в styleSpec.avatar.placement
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

/** Число из тела запроса или undefined — чтобы 0 не терялся как falsy. */
function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

interface InternalCallResult<T> { ok: boolean; data?: T; error?: string }

/**
 * Loopback-адрес процесса вместо публичного домена — тот же диагноз, что уже
 * чинили для медиа-ассетов в render-content-reel (см. pickAssetsOrigin), но
 * здесь речь про сами внутренние API-вызовы, а не про файлы.
 *
 * Симптом: шаг avatar падал с internal-fetch-failed на границе ~300 сек —
 * ровно там, где промежуточный прокси (nginx/Cloudflare) обрывает долго
 * висящее соединение. Быстрые шаги (план, озвучка, b-roll за 70-80 сек) через
 * публичный домен не успевали упереться в этот порог, поэтому баг не был
 * виден до первого шага, который реально держит соединение минутами
 * (HeyGen-поллинг внутри /api/generate-avatar-clip).
 *
 * Порт — свойство ПРОЦЕССА, а не конкретного запроса, поэтому успешный проб
 * кэшируется на весь его жизненный цикл. Неудачный НЕ кэшируется: если
 * loopback ещё не поднялся (первые секунды после рестарта), следующий вызов
 * попробует снова, а не застрянет с публичным origin навсегда.
 */
let cachedInternalOrigin: string | null = null;
async function resolveInternalOrigin(publicOrigin: string): Promise<string> {
  if (cachedInternalOrigin) return cachedInternalOrigin;
  const candidate = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    // HEAD на реальный POST-роут: код ответа не важен (даже 404/405 значит,
    // что порт живой и это наш процесс) — важен только сам факт соединения.
    await fetch(`${candidate}/api/content/video/plan`, { method: "HEAD", signal: ctrl.signal });
    cachedInternalOrigin = candidate;
    return candidate;
  } catch {
    return publicOrigin;
  } finally {
    clearTimeout(timer);
  }
}

async function callLocal<T = unknown>(
  pathName: string, body: Record<string, unknown>, originalReq: Request, timeoutMs: number,
): Promise<InternalCallResult<T>> {
  const origin = await resolveInternalOrigin(new URL(originalReq.url).origin);
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

interface PlanData { hookText: string; ctaText: string; brollQueries: string[]; keyPoints?: string[]; mood?: string; styleSpec?: Record<string, unknown>; qcNotes: string[] }

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
/**
 * Правила физики для видео-модели.
 *
 * Прежняя версия просила «естественную анатомию и медленное движение», и
 * этого не хватило: на живом ролике рабочий висел В ВОЗДУХЕ у металлокаркаса,
 * ни на что не опираясь. Такой кадр обесценивает весь ролик — зритель видит
 * не стройку, а подделку.
 *
 * Поэтому теперь явно: человек стоит НА ЗЕМЛЕ или на видимой опоре, обе ноги
 * на поверхности, никакого подъёма, лазания и работы на высоте. Модели плохо
 * даётся контакт тела с конструкцией — она честно рисует человека, но забывает
 * приделать его к опоре.
 */
/**
 * Правила физики для видео-модели.
 *
 * Людей в кадре НЕТ ВООБЩЕ — и это не перестраховка, а вывод из двух заходов.
 * Сперва просили «естественную анатомию и медленное движение»: получили
 * рабочего, висящего в воздухе у металлокаркаса. Тогда я добавил прямой
 * запрет на людей в воздухе, на лазание и работу на высоте — следующая же
 * генерация выдала человека на балках и человека БЕЗ ГОЛОВЫ, которому
 * кровельная панель прошла сквозь шею.
 *
 * Вывод: модель не умеет надёжно связывать тело с конструкцией и обрезает
 * анатомию за объектами переднего плана. Запретами это не лечится — каждая
 * новая формулировка ловит один сценарий и пропускает следующий. Пустой
 * кадр с материалами и конструкциями выглядит достойно и ломаться там
 * нечему.
 *
 * Если человек в кадре нужен — для этого есть врезка с аватаром: он
 * синтезируется отдельным движком, который на людях как раз специализируется.
 */
const PHYSICS_CLAUSE =
  "IMPORTANT: absolutely NO people, NO humans, NO human figures, NO body parts, NO hands, NO faces, NO silhouettes anywhere in the frame. The scene must be completely empty of people. "
  + "Show only materials, structures, machinery, interiors, textures and landscapes. "
  + "Calm and slow motion, stable objects that keep their shape. "
  + "Avoid fast action, avoid morphing or warping, avoid objects passing through each other, avoid flickering. "
  + "The scene must look like real documentary footage: plausible lighting, real materials, nothing physically impossible.";
interface VoiceoverData { url: string; words?: Array<{ word: string; start: number; end: number }>; durationSec?: number | null }
interface BrollKickData { jobId: string }
interface BrollStatusData { done: boolean; urls?: string[]; warning?: string | null; durationMs?: number }
interface RenderKickData { jobId: string; url: string }
interface RenderStatusData { done: boolean; url?: string; sizeBytes?: number; durationMs?: number }
interface AvatarKickData { videoId: string; audioSource: "ours" | "heygen" }
interface AvatarStatusData { done: boolean; url?: string; durationSec?: number | null; transientError?: string }
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

    // Логотип берём из брендбука автоматически — так же, как цвета и шрифты.
    // Отдельное поле body.logoUrl оставлено для ручного override (тесты,
    // разовые ролики без заполненного брендбука).
    const logoUrl =
      String(body.logoUrl ?? "").trim() ||
      String((brandBook as { logoDataUrl?: string } | null)?.logoDataUrl ?? "").trim() ||
      null;

    // ── Шаг 1: Director + QC ────────────────────────────────────────────
    let hookText = title || "Смотрите до конца";
    let ctaText = "Узнайте подробнее";
    let brollQueries: string[] = [];
    let keyPoints: string[] = [];
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
        keyPoints = (r.data.keyPoints ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 2);
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

    // Явно выбранный аватар сильнее решения арт-директора.
    //
    // Шаг avatar работает только при spec.avatar.placement != "off", а
    // placement назначает Director по своему усмотрению. Из-за этого запрос
    // «сделай ролик с вот этим аватаром» мог тихо собраться БЕЗ аватара —
    // с пометкой «арт-директор не заказал аватара» в отчёте по шагам.
    //
    // Ставим именно "pip" (круглая врезка), а не просто «включаем»: при
    // placement="full" аватар занимает целые сегменты вместо видеоряда, и
    // маленького кружка в кадре нет — на живом ролике это выглядело как
    // «аватара не добавили». Кружок — то, что подразумевают под «ведущим в
    // углу», и именно его ждут, когда передают avatarId.
    // Переопределяется явным body.avatarPlacement.
    if (spec && String(body.avatarId ?? "").trim()) {
      const wanted = String(body.avatarPlacement ?? "").trim();
      const placement = wanted === "full" || wanted === "off" ? wanted : "pip";
      spec.avatar = { ...(spec.avatar ?? {}), placement };
    }

    // Цвета — из палитры брендбука по выбору арт-директора. Фолбэк на
    // нейтраль, если брендбук пуст (см. resolveVideoColors).
    const { brandColor, accentColor } = resolveVideoColors(
      (brandBook as { colors?: unknown } | null)?.colors,
      spec,
      { brandColor: brandColorFallback, accentColor: accentColorFallback },
    );

    // ── Шаг 2: озвучка (ElevenLabs) — best-effort ───────────────────────
    let voiceoverUrl: string | null = null;
    let voiceWords: Array<{ word: string; start: number; end: number }> | undefined;
    let voiceDurationSec: number | null = null;
    if (voiceoverScript) {
      const stepT = Date.now();
      // hookText/problemText/ctaText обязательны у generate-promo-voiceover
      // валидацией, даже когда голос реально идёт по voiceoverScript-override —
      // подстраховываем problemText, чтобы пустой scenario не завалил шаг.
      const problemText = scenario.slice(0, 300) || voiceoverScript.slice(0, 300) || title || "Видео";
      // Голос — часть стиля: арт-директор выбирает тембр (пресет) и подачу.
      // Раньше голос был жёстко один на все ролики, из-за чего они звучали
      // одинаково независимо от темы и стиля.
      //
      // Приоритет override'ов поверх пресета (не трогают env):
      //  1. body.elevenlabsVoiceId — клонированный голос пользователя из
      //     настроек аватара. Именно это поле связывает «загрузил свой голос»
      //     с реальной озвучкой ролика — раньше клон сохранялся, но сюда
      //     не доезжал, и юзер всегда слышал пресет.
      //  2. body.voiceId — ручной override для тестов, НО с защитой: фронт
      //     исторически кладёт сюда HeyGen voice id (32 hex-символа), а это
      //     поле у нас уходит в ElevenLabs — чужой формат отсеиваем, иначе
      //     озвучка молча падает и ролик выходит немым.
      const elevenlabsOverride = String(body.elevenlabsVoiceId ?? "").trim();
      const rawVoiceId = String(body.voiceId ?? "").trim();
      const legacyOverride = rawVoiceId && !/^[0-9a-f]{32}$/i.test(rawVoiceId) ? rawVoiceId : "";
      const voiceId = elevenlabsOverride || legacyOverride || resolveVoicePreset(spec?.voice?.preset).voiceId;
      const r = await callLocal<VoiceoverData>("/api/generate-promo-voiceover",
        {
          voiceoverScript, hookText, problemText, ctaText,
          voiceId,
          // Подача голоса: ручной override сильнее решения арт-директора.
          // Пресеты звучали ровно и суховато — «дикторски», а не живо. Эти
          // три ручки и отвечают за «быстрее и эмоциональнее»:
          //   speed      — темп речи,
          //   style      — эмоциональная окраска (выше = живее),
          //   stability  — НИЖЕ значит БОЛЬШЕ модуляций (не «стабильнее лучше»).
          // Диапазоны клампятся в generate-promo-voiceover: за их пределами
          // тембр начинает «уплывать» в чужой голос.
          stability: num(body.voiceStability) ?? spec?.voice?.stability,
          style: num(body.voiceStyle) ?? spec?.voice?.expressiveness,
          speed: num(body.voiceSpeed) ?? spec?.voice?.speed,
        }, req, 130_000);
      const ms = Date.now() - stepT;
      if (r.ok && r.data) {
        voiceoverUrl = r.data.url;
        // Тайминги и длительность приходят от самого синтезатора — Whisper
        // после этого нужен только как запасной вариант.
        voiceWords = r.data.words?.length ? r.data.words : undefined;
        voiceDurationSec = typeof r.data.durationSec === "number" ? r.data.durationSec : null;
        pushStep({ name: "voiceover", status: "ok", ms });
      }
      else pushStep({ name: "voiceover", status: "failed", ms, error: r.error });
    } else {
      pushStep({ name: "voiceover", status: "skipped", ms: 0 });
    }

    // ── Шаг 3: транскрипция своей же озвучки — пословные тайминги + реальная
    // длительность. Не оценка по темпу речи, а измерение по факту сгенерённого
    // файла — субтитры идут точно в такт голосу. Best-effort: если Whisper не
    // настроен/упал — откатываемся на оценку по числу слов (как раньше).
    let captionsWords: Array<{ word: string; start: number; end: number }> | undefined = voiceWords;
    let measuredDurationSec: number | null = voiceDurationSec;
    if (captionsWords?.length) {
      // Разметку дал сам синтезатор (/with-timestamps) — Whisper не нужен.
      // Это и точнее (тайминги от того, кто произносил, а не от распознавания),
      // и не зависит от OpenAI, который наш регион не обслуживает.
      pushStep({ name: "captions", status: "ok", ms: 0, error: `тайминги из синтеза, слов: ${captionsWords.length}` });
    } else if (voiceoverUrl) {
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

    /**
     * Свои фото/видео в кадре вместо AI-генерации.
     *
     * Зачем: для стройки, производства, объектов реальный снимок с площадки
     * всегда убедительнее сгенерированного клипа — и бесплатен. Раньше
     * подложить их было нечем: видеоряд собирался ТОЛЬКО из Replicate.
     *
     * Принимаем пути к уже загруженным файлам (/api/static-asset/promo-images/…)
     * или полные http(s)-ссылки. Композиция показывает картинки и видео
     * вперемешку, в порядке передачи, поэтому порядок = раскадровка.
     *
     * Если свои материалы есть, AI-клипы не заказываем совсем: смешивать
     * настоящий объект с синтетикой — заметно и выглядит дёшево.
     */
    const ownAssets: string[] = (Array.isArray(body.brollAssets) ? body.brollAssets : [])
      .map((u: unknown) => String(u ?? "").trim())
      .filter((u: string) => u.startsWith("/") || u.startsWith("http://") || u.startsWith("https://"))
      .slice(0, 10);

    const brollStep = async () => {
    if (ownAssets.length > 0) {
      brollUrls = ownAssets;
      pushStep({
        name: "stock-videos",
        status: "ok",
        ms: 0,
        error: `свои материалы: ${ownAssets.length} шт., AI-генерация не нужна`,
      });
      return;
    }
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
      // Кик + внешний поллинг — тот же приём, что у avatar/render выше: Replicate
      // может очередить клипы на несколько минут, и держать один HTTP-запрос
      // открытым на это время падало с internal-fetch-failed на ~300-й секунде
      // даже по loopback (см. шапку /api/generate-broll-videos).
      const kick = await callLocal<BrollKickData>(
        "/api/generate-broll-videos",
        { prompts, jobId: `content-broll-${jobId}` },
        req,
        55_000,
      );
      if (!kick.ok || !kick.data?.jobId) {
        const ms = Date.now() - stepT;
        pushStep({ name: "stock-videos", status: "failed", ms, error: kick.error ?? "Replicate не запустился" });
      } else {
        const brollJobId = kick.data.jobId;
        const BROLL_POLL_DEADLINE_MS = 600_000; // тот же бюджет, что был у maxDuration generate-broll-videos
        const deadline = Date.now() + BROLL_POLL_DEADLINE_MS;
        let brollResult: BrollStatusData | null = null;
        let brollError: string | undefined;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 5000));
          const poll = await callLocal<BrollStatusData>(
            "/api/generate-broll-videos/status", { jobId: brollJobId }, req, 20_000,
          );
          // Сбой самого опроса (сеть/таймаут) — не вердикт Replicate, пробуем
          // на следующем тике. Фатален только явный ok:false от статус-роута.
          if (!poll.ok) {
            if ((poll.error ?? "").startsWith("internal-fetch-failed")) continue;
            brollError = poll.error ?? "Replicate не сгенерил ни одного клипа"; break;
          }
          if (poll.data?.done) { brollResult = poll.data; break; }
          // done: false — генерируется дальше, пробуем на следующем тике.
        }
        const ms = Date.now() - stepT;
        brollUrls = brollResult?.urls ?? [];
        if (brollUrls.length > 0) pushStep({ name: "stock-videos", status: "ok", ms, error: brollResult?.warning ?? undefined });
        else pushStep({ name: "stock-videos", status: "failed", ms, error: brollError ?? "Таймаут ожидания Replicate (10 мин)" });
      }
      }
    } else {
      pushStep({ name: "stock-videos", status: "skipped", ms: 0 });
    }
    };

    // ── Шаг 4б: говорящий аватар (HeyGen) — СЛОЙ нашего видеоряда ───────
    //
    // Не альтернативный движок, а ещё один ингредиент: HeyGen отдаёт только
    // голову на сплошном фоне, а куда её поставить (целый сегмент или круглая
    // врезка над b-roll) решает спек арт-директора. Клип синтезируется по
    // НАШЕМУ mp3 — клонированный голос бренда сохраняется, а таймлайн клипа
    // совпадает с таймлайном озвучки, поэтому композиции достаточно взять
    // кадр с тем же номером (см. AvatarSegment в ContentReel.tsx).
    //
    // Best-effort: без аватара ролик просто собирается как раньше.
    let avatarClipUrl: string | null = null;
    // Фактическая длительность клипа (сек) — композиция режет врезку по ней,
    // чтобы не просить у компоситора кадры за концом файла.
    let avatarClipDurationSec: number | null = null;
    const avatarStep = async () => {
      const placement = spec?.avatar?.placement ?? "off";
      if (placement === "off") {
        pushStep({ name: "avatar", status: "skipped", ms: 0, error: "арт-директор не заказал аватара" });
        return;
      }
      if (!voiceoverUrl) {
        pushStep({ name: "avatar", status: "skipped", ms: 0, error: "нет озвучки — аватару нечего произносить" });
        return;
      }
      const stepT = Date.now();
      // Кик — секунды (загрузка аудио + один вызов создания видео). Сам рендер
      // HeyGen (1-8 минут) ждём СНАРУЖИ короткими опросами status, а не одним
      // долгим HTTP-запросом — см. шапку generate-avatar-clip про то, почему
      // блокирующий вариант падал на ~300-й секунде даже по loopback.
      const kick = await callLocal<AvatarKickData>("/api/generate-avatar-clip", {
        audioUrl: voiceoverUrl,
        // Фон клипа = фон ролика: в полнокадровом сегменте он становится фоном
        // сцены, во врезке виден вокруг лица — в обоих случаях чужой цвет
        // выдал бы «вклеенное» видео.
        bgColor: brandColor,
        avatarId: body.avatarId,
      }, req, 55_000);

      if (!kick.ok || !kick.data?.videoId) {
        pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: kick.error ?? "HeyGen не вернул videoId" });
        return;
      }
      if (kick.data.audioSource !== "ours") {
        // Клип создан, но озвучен голосом HeyGen. Взять его нельзя: в ролике
        // играет наша дорожка, и губы разошлись бы с тем, что слышно.
        pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: "HeyGen озвучил аватара своим голосом — клип не берём, иначе губы разойдутся с озвучкой" });
        return;
      }

      // 12 минут, не 8: соло-клип HeyGen рендерит ~4-7 минут, но два
      // параллельных джоба замедляют друг друга — живой тест с двумя роликами
      // упёрся в прежний 8-минутный бюджет (клип пришёл бы на ~9-й минуте).
      const POLL_DEADLINE_MS = 720_000;
      const deadline = Date.now() + POLL_DEADLINE_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        // Таймаут 60с, не 20: опрос, на котором HeyGen дорисовал клип, ещё и
        // СКАЧИВАЕТ mp4 (~20 МБ) внутри статус-роута — под нагрузкой двух
        // параллельных джобов это не влезало в 20с, обрыв убивал весь шаг.
        const poll = await callLocal<AvatarStatusData>(
          "/api/generate-avatar-clip/status", { videoId: kick.data.videoId }, req, 60_000,
        );
        if (!poll.ok) {
          // internal-fetch-failed — это сбой/таймаут САМОГО опроса (сеть,
          // занятый event loop), а не вердикт HeyGen: следующий тик спросит
          // снова. Фатальны только явные ответы статус-роута (ok:false).
          if ((poll.error ?? "").startsWith("internal-fetch-failed")) continue;
          pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: poll.error ?? "HeyGen не собрал клип" });
          return;
        }
        if (poll.data?.done && poll.data.url) {
          avatarClipUrl = poll.data.url;
          // Длительность клипа: HeyGen сообщает её не всегда. Раньше в этом
          // случае оставался null, композиция считала врезку «на весь ролик»
          // и просила у компоситора кадр за концом файла:
          //   «No frame found at position … time=30.23» при длине ролика 29.0
          // — врезка падала целиком, и кружка с ведущим в кадре не было.
          //
          // Фолбэк на длительность озвучки корректен: клип синтезирован HeyGen
          // ровно по этому же mp3, его таймлайн совпадает с ним по построению.
          avatarClipDurationSec =
            typeof poll.data.durationSec === "number"
              ? poll.data.durationSec
              : voiceDurationSec;
          pushStep({ name: "avatar", status: "ok", ms: Date.now() - stepT });
          return;
        }
        // done: false (в т.ч. transientError на отдельном опросе) — рендерится
        // дальше, пробуем на следующем тике.
      }
      pushStep({ name: "avatar", status: "failed", ms: Date.now() - stepT, error: "HeyGen не отдал клип за 8 минут" });
    };

    // Оба шага — внешние рендеры на минуты и друг от друга не зависят.
    // Последовательно они складывались бы в ожидание, которого ролик не стоит.
    await Promise.all([brollStep(), avatarStep()]);

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

    // Длительность ролика. Приоритет — измеренная длительность дорожки (от
    // синтезатора либо от Whisper). Фолбэк — оценка по темпу речи.
    //
    // Округляем ВВЕРХ и добавляем хвост: раньше здесь было Math.round, и при
    // длительности вроде 18.6 сек ролик обрезался на 19-й секунде вместе с
    // последним словом озвучки. Хвост нужен ещё и потому, что CTA-сцена
    // доигрывает после конца речи — без него призыв мелькал и обрывался.
    const TAIL_SEC = 1.2;
    const videoDurationSec = measuredDurationSec
      ? Math.max(15, Math.min(75, Math.ceil(measuredDurationSec + TAIL_SEC)))
      : (() => {
          const words = voiceoverScript.split(/\s+/).filter(Boolean).length;
          // Оценка намеренно щедрая (2.4 слова/сек вместо 2.7): недооценка
          // режет звук, переоценка лишь оставляет паузу в конце.
          return Math.max(15, Math.min(75, Math.ceil(words / 2.4) || 30));
        })();

    // Тезисы для текстовых карточек берём из СЦЕНАРИЯ ОЗВУЧКИ, а не отдельным
    // запросом к модели: карточка должна совпадать с тем, что зритель слышит
    // в этот момент, иначе картинка и голос расходятся. Плюс это ноль
    // дополнительной стоимости и ноль новых точек отказа.
    // Приоритет — короткие тезисы от режиссёра (keyPoints, 3-6 слов): целое
    // предложение из озвучки занимало на карточке пол-экрана и не читалось за
    // три секунды. Нарезка по предложениям осталась фолбэком на случай, если
    // режиссёр их не вернул, и там же режем слишком длинные.
    const statementCards = keyPoints.length > 0
      ? keyPoints
      : (voiceoverScript || scenario)
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim().replace(/^[«"']|[»"']$/g, ""))
          .filter((s) => s.length >= 12 && s.length <= 48)
          .slice(0, 2);

    // ── Шаг 6: финальный рендер (обязательный) ──────────────────────────
    // Кик + внешний поллинг — тот же приём, что у шага avatar выше: Remotion
    // рендерит 1-8 минут, и держать один HTTP-запрос открытым на это время
    // падало с internal-fetch-failed на ~300-й секунде даже по loopback
    // (см. шапку /api/render-content-reel).
    const stepT = Date.now();
    const kick = await callLocal<RenderKickData>("/api/render-content-reel", {
      hookText, ctaText, brandName, brandColor, accentColor,
      voiceoverUrl, musicUrl, brollUrls, statementCards, avatarClipUrl, avatarClipDurationSec, videoDurationSec,
      captionsEnabled: true,
      captionsScript: voiceoverScript || `${hookText}. ${ctaText}`,
      captionsWords,
      // Субтитры не гаснут на текстовых карточках: иначе их нет на половине
      // ролика (карточек примерно столько же, сколько AI-клипов).
      captionsOverCards: body.captionsOverCards !== false,
      styleSpec: spec,
      logoUrl,
    }, req, 55_000);

    if (!kick.ok || !kick.data?.jobId) {
      const ms = Date.now() - stepT;
      pushStep({ name: "render", status: "failed", ms, error: kick.error });
      updateJob(jobId, { status: "failed", error: `Финальный рендер не запустился: ${kick.error ?? "unknown"}` });
      return;
    }

    const renderJobId = kick.data.jobId;
    const RENDER_POLL_DEADLINE_MS = 900_000; // тот же бюджет, что был у maxDuration render-content-reel
    const deadline = Date.now() + RENDER_POLL_DEADLINE_MS;
    let renderResult: RenderStatusData | null = null;
    let renderError: string | undefined;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await callLocal<RenderStatusData>(
        "/api/render-content-reel/status", { jobId: renderJobId }, req, 20_000,
      );
      // Сбой самого опроса (сеть/таймаут) — не вердикт Remotion, пробуем на
      // следующем тике. Фатален только явный ok:false от статус-роута.
      if (!poll.ok) {
        if ((poll.error ?? "").startsWith("internal-fetch-failed")) continue;
        renderError = poll.error ?? "Remotion упал без сообщения"; break;
      }
      if (poll.data?.done) { renderResult = poll.data; break; }
      // done: false — рендерится дальше, пробуем на следующем тике.
    }
    const renderMs = Date.now() - stepT;

    if (!renderResult) {
      const error = renderError ?? "Таймаут ожидания рендера (15 мин)";
      pushStep({ name: "render", status: "failed", ms: renderMs, error });
      updateJob(jobId, { status: "failed", error: `Финальный рендер упал: ${error}` });
      return;
    }
    pushStep({ name: "render", status: "ok", ms: renderMs });

    updateJob(jobId, {
      status: "done",
      result: { url: renderResult.url ?? kick.data.url, jobId: renderJobId, sizeBytes: renderResult.sizeBytes ?? 0, totalMs: Date.now() - t0 },
    });
  } catch (e) {
    updateJob(jobId, { status: "failed", error: e instanceof Error ? e.message : String(e) });
  }
}
