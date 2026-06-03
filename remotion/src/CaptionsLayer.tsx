/**
 * CaptionsLayer — субтитры внизу кадра в стиле TikTok / Reels.
 *
 * Берёт текст (voiceoverScript или fallback на hook+problem+CTA),
 * разбивает по 3-4 слова на chunk, и показывает их по очереди равномерно
 * распределёнными по длительности композиции. Каждый chunk появляется
 * с лёгкой анимацией (scale + fade).
 *
 * Стиль: белый текст с чёрной тенью + полупрозрачный pill-фон. Bold
 * sans-serif. Размер крупный (~58px). Помещён в зоне 1500-1700px по Y
 * (стандарт reels — не наезжает на главные визуалы и не упирается в
 * нижний край).
 *
 * Sync с voice: если script совпадает с реальной voice-озвучкой
 * (юзер передал тот же текст в voiceoverScript), субтитры будут идти
 * +/- синхронно. ElevenLabs говорит ~3 слова/сек, chunk из 3-4 слов
 * примерно 1.0-1.3 сек. Идеального словесного-таймстемпинга нет, но
 * визуально читается естественно.
 */
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Props {
  /** Полный текст для субтитров. Если null/undefined — слой не рендерится. */
  script: string | null;
  /** Размер chunk'а в словах. Default 4 — оптимально читается в 1 кадре. */
  wordsPerChunk?: number;
}

export const CaptionsLayer: React.FC<Props> = ({ script, wordsPerChunk = 4 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (!script || !script.trim()) return null;

  // Разбиваем по словам + чистим пунктуацию-в-конце для красоты chunk'а.
  const words = script.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Группируем в chunks. Не разрываем фразу посередине знака препинания
  // если возможно — стараемся заканчивать chunk на пунктуации.
  const chunks: string[] = [];
  let buffer: string[] = [];
  for (let i = 0; i < words.length; i++) {
    buffer.push(words[i]);
    const endsWithPunct = /[.,!?:;—]$/.test(words[i]);
    if (buffer.length >= wordsPerChunk || (endsWithPunct && buffer.length >= 2)) {
      chunks.push(buffer.join(" "));
      buffer = [];
    }
  }
  if (buffer.length > 0) chunks.push(buffer.join(" "));

  if (chunks.length === 0) return null;

  // Время каждого chunk'а пропорционально числу слов в нём
  // (длинные chunks показываются дольше). Это даёт более естественный темп.
  const chunkWordCounts = chunks.map((c) => c.split(/\s+/).length);
  const totalWords = chunkWordCounts.reduce((sum, n) => sum + n, 0);

  // Начальные кадры для каждого chunk'а
  const chunkStarts: number[] = [];
  let acc = 0;
  for (const wc of chunkWordCounts) {
    chunkStarts.push(acc);
    acc += (wc / totalWords) * durationInFrames;
  }

  // Какой chunk сейчас активен
  let activeIndex = 0;
  for (let i = 0; i < chunkStarts.length; i++) {
    if (frame >= chunkStarts[i]) activeIndex = i;
    else break;
  }

  const currentChunk = chunks[activeIndex];
  const chunkStart = chunkStarts[activeIndex];
  const chunkEnd =
    activeIndex < chunkStarts.length - 1 ? chunkStarts[activeIndex + 1] : durationInFrames;
  const localFrame = frame - chunkStart;
  const chunkDuration = chunkEnd - chunkStart;

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
