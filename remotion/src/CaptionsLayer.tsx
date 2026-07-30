/**
 * CaptionsLayer — субтитры внизу кадра в стиле TikTok / Reels.
 *
 * Два режима таймига chunk'ов:
 *  - words (точный): переданы реальные пословные тайминги из Whisper-
 *    транскрипции сгенерированной озвучки (см. content/video/render —
 *    транскрибирует свой же ElevenLabs-файл). Субтитры идут ТОЧНО в такт
 *    голосу, а не оценочно.
 *  - script (fallback, как было): только текст, без таймингов — chunks
 *    распределяются РАВНОМЕРНО по длительности композиции пропорционально
 *    числу слов. Используется когда транскрипция недоступна (упала,
 *    ElevenLabs не настроен) и в PromoReel, который words не передаёт —
 *    это ветка НЕ тронута, чтобы не менять поведение уже работающего
 *    промо-пайплайна.
 *
 * Стиль общий для обоих режимов: белый текст с чёрной тенью +
 * полупрозрачный pill-фон, bold sans-serif, ~58px, зона 1500-1700px по Y.
 */
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface CaptionWord { word: string; start: number; end: number }

interface Props {
  /** Полный текст для субтитров (fallback-режим). Игнорируется если задан words. */
  script: string | null;
  /** Точные пословные тайминги (сек) из Whisper — если заданы, используется точный режим. */
  words?: CaptionWord[];
  /** Размер chunk'а в словах. Default 4 — оптимально читается в 1 кадре. */
  wordsPerChunk?: number;
  /** Акцентный цвет карооке-подсветки активного слова (только точный режим). */
  accentColor?: string;
  /** Оформление: pill (тёмная плашка), bare (без фона, жирная тень), boxed (активное слово в цветном боксе). */
  mode?: "pill" | "bare" | "boxed";
  /** Подсвечивать ли произносимое слово (только точный режим). Default true. */
  karaoke?: boolean;
  /** Высота зоны субтитров: low — стандарт TikTok, middle/high — выше по кадру. */
  position?: "low" | "middle" | "high";
  /** Светлая схема кадра — тёмный текст на светлой плашке. */
  light?: boolean;
}

interface TimedWord { word: string; startFrame: number; endFrame: number }
interface TimedChunk { text: string; startFrame: number; endFrame: number; words?: TimedWord[] }

/** Точный режим: группирует слова по wordsPerChunk, границы — из реальных таймингов Whisper (в секундах → кадры).
 *  Пословные фреймы сохраняются для карооке-подсветки активного слова. */
function buildTimedChunks(words: CaptionWord[], wordsPerChunk: number, fps: number, durationInFrames: number): TimedChunk[] {
  const chunks: TimedChunk[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const group = words.slice(i, i + wordsPerChunk);
    if (group.length === 0) continue;
    const startFrame = Math.max(0, Math.round(group[0].start * fps));
    // Конец chunk'а — начало следующего chunk'а (без "мёртвого" зазора) либо конец композиции для последнего.
    const nextGroup = words[i + wordsPerChunk];
    const endFrame = nextGroup ? Math.round(nextGroup.start * fps) : Math.min(durationInFrames, Math.round(group[group.length - 1].end * fps) + fps);
    chunks.push({
      text: group.map((w) => w.word).join(" ").trim(),
      startFrame,
      endFrame: Math.max(endFrame, startFrame + 1),
      words: group.map((w) => ({
        word: w.word,
        startFrame: Math.max(0, Math.round(w.start * fps)),
        endFrame: Math.max(Math.round(w.end * fps), Math.round(w.start * fps) + 1),
      })),
    });
  }
  return chunks;
}

/** Fallback-режим (как было): равномерное распределение по длительности пропорционально числу слов в chunk'е. */
function buildProportionalChunks(script: string, wordsPerChunk: number, durationInFrames: number): TimedChunk[] {
  const words = script.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const rawChunks: string[] = [];
  let buffer: string[] = [];
  for (let i = 0; i < words.length; i++) {
    buffer.push(words[i]);
    const endsWithPunct = /[.,!?:;—]$/.test(words[i]);
    if (buffer.length >= wordsPerChunk || (endsWithPunct && buffer.length >= 2)) {
      rawChunks.push(buffer.join(" "));
      buffer = [];
    }
  }
  if (buffer.length > 0) rawChunks.push(buffer.join(" "));
  if (rawChunks.length === 0) return [];

  const chunkWordCounts = rawChunks.map((c) => c.split(/\s+/).length);
  const totalWords = chunkWordCounts.reduce((sum, n) => sum + n, 0);

  const starts: number[] = [];
  let acc = 0;
  for (const wc of chunkWordCounts) {
    starts.push(acc);
    acc += (wc / totalWords) * durationInFrames;
  }
  return rawChunks.map((text, i) => ({
    text,
    startFrame: starts[i],
    endFrame: i < starts.length - 1 ? starts[i + 1] : durationInFrames,
  }));
}

export const CaptionsLayer: React.FC<Props> = ({ script, words, wordsPerChunk = 4, accentColor = "#22d3ee", mode = "pill", karaoke = true, position = "low", light = false }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const chunks: TimedChunk[] = words?.length
    ? buildTimedChunks(words, wordsPerChunk, fps, durationInFrames)
    : script?.trim()
      ? buildProportionalChunks(script, wordsPerChunk, durationInFrames)
      : [];

  if (chunks.length === 0) return null;

  let activeIndex = -1;
  for (let i = 0; i < chunks.length; i++) {
    if (frame >= chunks[i].startFrame && frame < chunks[i].endFrame) { activeIndex = i; break; }
    if (frame >= chunks[i].startFrame) activeIndex = i;
  }
  if (activeIndex === -1) return null;

  const currentChunk = chunks[activeIndex].text;
  const chunkStart = chunks[activeIndex].startFrame;
  const chunkEnd = chunks[activeIndex].endFrame;
  const localFrame = frame - chunkStart;
  const chunkDuration = Math.max(1, chunkEnd - chunkStart);

  // Появление chunk'а: scale 0.85→1 + fade-in за 8 кадров.
  // Исчезновение: fade-out за последние 5 кадров.
  const enterFrames = Math.min(8, chunkDuration * 0.2);
  const exitFrames = Math.min(5, chunkDuration * 0.15);
  const opacity = interpolate(
    localFrame,
    [0, enterFrames, chunkDuration - exitFrames, chunkDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(localFrame, [0, enterFrames], [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 50,
          right: 50,
          // low — стандарт TikTok/Reels; middle/high поднимают субтитры,
          // когда хук стоит внизу или в кадре важен низ картинки.
          bottom: position === "high" ? 780 : position === "middle" ? 500 : 220,
          textAlign: "center",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: mode === "pill" ? (light ? "rgba(255,255,255,0.9)" : "rgba(0, 0, 0, 0.78)") : "transparent",
            color: light ? "#0b0d14" : "#fff",
            padding: mode === "pill" ? "16px 28px" : "8px 12px",
            borderRadius: 18,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontWeight: mode === "bare" ? 900 : 800,
            fontSize: 56,
            lineHeight: 1.25,
            letterSpacing: -0.5,
            textShadow: light
              ? "none"
              : mode === "bare"
                ? "0 3px 0 rgba(0,0,0,0.9), 0 6px 24px rgba(0,0,0,0.95)"
                : "0 4px 16px rgba(0,0,0,0.8)",
            boxShadow: mode === "pill" ? (light ? "0 12px 40px rgba(0,0,0,0.18)" : "0 12px 40px rgba(0,0,0,0.5)") : "none",
            maxWidth: "92%",
          }}
        >
          {chunks[activeIndex].words && karaoke ? (
            // Карооке-режим (только при точных таймингах): произносимое СЕЙЧАС
            // слово подсвечено акцентом и чуть увеличено — как в нативных
            // капшенах TikTok/CapCut. PromoReel (fallback-режим) не задет.
            chunks[activeIndex].words!.map((w, i) => {
              const active = frame >= w.startFrame && frame < w.endFrame;
              const pop = active
                ? interpolate(frame, [w.startFrame, w.startFrame + 4], [1, 1.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
                : 1;
              const boxed = mode === "boxed";
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: 14,
                    scale: String(pop),
                    color: active ? (boxed ? "#0a0e1a" : accentColor) : (light ? "#0b0d14" : "#fff"),
                    background: active && boxed ? accentColor : "transparent",
                    borderRadius: boxed ? 10 : 0,
                    padding: boxed ? "0px 10px" : 0,
                    textShadow: active && !boxed
                      ? `0 0 24px ${accentColor}aa, 0 4px 16px rgba(0,0,0,0.8)`
                      : boxed && active
                        ? "none"
                        : "0 4px 16px rgba(0,0,0,0.8)",
                  }}
                >
                  {w.word}
                </span>
              );
            })
          ) : (
            currentChunk
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
