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
}

interface TimedChunk { text: string; startFrame: number; endFrame: number }

/** Точный режим: группирует слова по wordsPerChunk, границы — из реальных таймингов Whisper (в секундах → кадры). */
function buildTimedChunks(words: CaptionWord[], wordsPerChunk: number, fps: number, durationInFrames: number): TimedChunk[] {
  const chunks: TimedChunk[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const group = words.slice(i, i + wordsPerChunk);
    if (group.length === 0) continue;
    const startFrame = Math.max(0, Math.round(group[0].start * fps));
    // Конец chunk'а — начало следующего chunk'а (без "мёртвого" зазора) либо конец композиции для последнего.
    const nextGroup = words[i + wordsPerChunk];
    const endFrame = nextGroup ? Math.round(nextGroup.start * fps) : Math.min(durationInFrames, Math.round(group[group.length - 1].end * fps) + fps);
    chunks.push({ text: group.map((w) => w.word).join(" ").trim(), startFrame, endFrame: Math.max(endFrame, startFrame + 1) });
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

export const CaptionsLayer: React.FC<Props> = ({ script, words, wordsPerChunk = 4 }) => {
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
          bottom: 220, // ~12% от низа — стандарт TikTok/Reels
          textAlign: "center",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(0, 0, 0, 0.78)",
            color: "#fff",
            padding: "16px 28px",
            borderRadius: 18,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 56,
            lineHeight: 1.2,
            letterSpacing: -0.5,
            textShadow: "0 4px 16px rgba(0,0,0,0.8)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            maxWidth: "92%",
          }}
        >
          {currentChunk}
        </div>
      </div>
    </AbsoluteFill>
  );
};
