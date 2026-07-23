/**
 * Транскрипция роликов для фичи «Разбор ролика» (Контент-завод → Тренды).
 *
 * Два источника транскрипта:
 *  1. YouTube по ссылке — субтитры (ручные или авто) читаем напрямую со
 *     страницы видео, без скачивания самого видео и без API-ключа.
 *  2. Свой файл (видео/аудио) — прогоняем через Whisper (OpenAI), который
 *     сам вытаскивает звуковую дорожку из mp4/mov/webm — нам не нужен ffmpeg.
 *
 * Instagram Reels / VK Клипы по ссылке сознательно НЕ поддержаны — закрытые
 * API, скачать видео легально нельзя. Обходной путь — тот же путь (2):
 * пользователь скачивает ролик сам и загружает как файл.
 */

const YT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Достаёт сбалансированный JSON-объект, начиная с первой `{` после маркера — надёжнее ленивого regex на больших плеерных ответах. */
function extractJsonAfter(html: string, marker: string): Record<string, unknown> | null {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const start = html.indexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export interface YouTubeTranscriptResult {
  title: string;
  channel: string;
  transcript: string; // с грубыми таймкодами: [0:03] текст...
  durationSec: number | null;
}

/** null — видео недоступно / нет субтитров ни на одном языке. */
export async function fetchYouTubeTranscript(url: string): Promise<YouTubeTranscriptResult | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": YT_UA, "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const html = await res.text();

  const player = extractJsonAfter(html, "var ytInitialPlayerResponse");
  if (!player) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = player as any;
  const title: string = p?.videoDetails?.title ?? "";
  const channel: string = p?.videoDetails?.author ?? "";
  const durationSec = p?.videoDetails?.lengthSeconds ? Number(p.videoDetails.lengthSeconds) : null;

  const tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }> =
    p?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) return null;

  // Предпочитаем ручные субтитры (нет kind:"asr") на ru/en, иначе любые ручные, иначе авто.
  const pick =
    tracks.find(t => !t.kind && (t.languageCode === "ru" || t.languageCode === "en")) ??
    tracks.find(t => !t.kind) ??
    tracks.find(t => t.languageCode === "ru" || t.languageCode === "en") ??
    tracks[0];
  if (!pick?.baseUrl) return null;

  const capRes = await fetch(pick.baseUrl, { signal: AbortSignal.timeout(10000) });
  if (!capRes.ok) return null;
  const xml = await capRes.text();

  const lines: string[] = [];
  const re = /<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const start = Math.round(parseFloat(m[1]));
    const text = decodeHtmlEntities(m[2]);
    if (!text) continue;
    const mm = Math.floor(start / 60);
    const ss = String(start % 60).padStart(2, "0");
    lines.push(`[${mm}:${ss}] ${text}`);
  }
  if (!lines.length) return null;

  return { title, channel, transcript: lines.join("\n"), durationSec };
}

/** 24 МБ — под лимитом Whisper API (25 МБ) с запасом на multipart-обвязку. */
export const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

export interface WhisperSegment { start: number; end: number; text: string }
export interface WhisperWord { word: string; start: number; end: number }

/**
 * Транскрибирует видео/аудио файл через Whisper. Видео (mp4/mov/webm) — ОК, звук вытащит сам OpenAI.
 *
 * opts.wordTimestamps — запросить ещё и пословные тайминги (для точной
 * синхронизации субтитров в видео-конвейере Контент-завода — см.
 * ContentReel.tsx/CaptionsLayer.tsx). По умолчанию false — существующий
 * вызов из /api/content/reel-breakdown поведение не меняет.
 */
export async function transcribeWithWhisper(
  file: Blob,
  filename: string,
  opts?: { wordTimestamps?: boolean },
): Promise<{ transcript: string; durationSec: number | null; words?: WhisperWord[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key не настроен");

  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  if (opts?.wordTimestamps) form.append("timestamp_granularities[]", "word");

  const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Whisper error ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json() as { text?: string; duration?: number; segments?: WhisperSegment[]; words?: WhisperWord[] };
  const words = opts?.wordTimestamps && data.words?.length ? data.words : undefined;

  if (data.segments?.length) {
    const lines = data.segments.map(s => {
      const mm = Math.floor(s.start / 60);
      const ss = String(Math.round(s.start % 60)).padStart(2, "0");
      return `[${mm}:${ss}] ${s.text.trim()}`;
    });
    return { transcript: lines.join("\n"), durationSec: data.duration ?? null, words };
  }
  return { transcript: (data.text ?? "").trim(), durationSec: data.duration ?? null, words };
}
