/**
 * HookScene — первые 5 секунд рилса. Захватывает внимание.
 *
 * Композиция:
 *  - фон: либо AI-сгенерированная картинка (bgImageUrl), либо radial-gradient
 *  - над фоном: затемнение для читаемости текста
 *  - центр: пословное появление текста с акцентом на последнем слове
 *
 * Анимации:
 *  - Spring-вход всего блока (scale 0.85 → 1)
 *  - Лёгкий пульс через sin (1 ± 0.015)
 *  - Каждое слово — translateY 40→0 + fade с сдвигом по delay
 *  - Ken-burns на фоновой картинке (медленный zoom-in) для динамики
 *  - Exit fade на последних 12 кадрах
 */
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Props {
  text: string;
  accentColor: string;
  bgImageUrl: string | null;
}

export const HookScene: React.FC<Props> = ({ text, accentColor, bgImageUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const pulse = 1 + Math.sin(frame / 6) * 0.015;
  const exitStart = durationInFrames - 12;
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ken-burns: фон медленно зумится и слегка сдвигается для ощущения «жизни»
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.12]);
  const bgShiftY = interpolate(frame, [0, durationInFrames], [0, -20]);

  const words = text.split(" ");

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Фон: либо AI-картинка, либо градиент */}
      {bgImageUrl ? (
        <AbsoluteFill
          style={{
            transform: `scale(${bgZoom}) translateY(${bgShiftY}px)`,
          }}
        >
          <Img
            src={bgImageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 30%, ${accentColor}33 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Затемняющий оверлей — нужен для читаемости текста поверх любой картинки.
          Градиент сверху темнее снизу — типичный приём для текста по центру. */}
      <AbsoluteFill
        style={{
          background: bgImageUrl
            ? `linear-gradient(180deg, rgba(10,14,26,0.5) 0%, rgba(10,14,26,0.85) 100%)`
            : "transparent",
        }}
      />

      {/* Цветовая «вспышка» вокруг текста — добавляет фокус */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentColor}22 0%, transparent 50%)`,
        }}
      />

      {/* Текст */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            opacity: exit,
            transform: `scale(${enter * pulse})`,
            textAlign: "center",
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 110,
            lineHeight: 1.05,
            color: "#fff",
            letterSpacing: -2,
            textShadow: `0 0 60px ${accentColor}cc, 0 4px 30px rgba(0,0,0,0.8)`,
          }}
        >
          {words.map((w, i) => {
            const delay = i * 3;
            const wordEnter = interpolate(frame, [delay, delay + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const wordY = interpolate(frame, [delay, delay + 10], [40, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: 24,
                  opacity: wordEnter,
                  transform: `translateY(${wordY}px)`,
                  color: i === words.length - 1 ? accentColor : "#fff",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
