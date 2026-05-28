/**
 * CTAScene — финал рилса (25..30 сек). Призыв к действию.
 *
 * Композиция:
 *  - фон: AI-картинка (опц) с тёмным оверлеем ИЛИ radial-gradient
 *  - центр: крупный текст призыва + пилюля-кнопка с именем бренда и стрелкой
 *
 * Анимации:
 *  - Spring-вход текста (translateY)
 *  - Кнопка появляется через 20 кадров с задержкой
 *  - Pulse на кнопке (1 ± 0.03) + shimmer-проход (металлический блик)
 *  - Стрелка циклически двигается ±12px
 *  - Confetti-частицы в последние 1.5 сек — финальная точка
 *  - Ken-burns на фоне для динамики
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
  brandName: string;
  accentColor: string;
  bgImageUrl: string | null;
}

export const CTAScene: React.FC<Props> = ({ text, brandName, accentColor, bgImageUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const buttonEnter = spring({
    frame: frame - 20,
    fps,
    config: { damping: 10, stiffness: 140 },
  });
  const buttonPulse = 1 + Math.sin(frame / 4) * 0.03;
  const arrowX = interpolate(frame % 30, [0, 15, 30], [0, 12, 0]);

  // Shimmer: блик медленно идёт по кнопке слева→направо, цикл 90 кадров
  const shimmerCycle = 90;
  const shimmerPos = ((frame % shimmerCycle) / shimmerCycle) * 200 - 50; // -50..150%

  // Ken-burns
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.05, 1.0]);

  // Конфетти запускаем в последние 45 кадров (1.5 сек)
  const confettiStart = Math.max(0, durationInFrames - 45);
  const confettiActive = frame >= confettiStart;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Фон: картинка или градиент */}
      {bgImageUrl ? (
        <AbsoluteFill style={{ transform: `scale(${bgZoom})` }}>
          <Img
            src={bgImageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, ${accentColor}22 0%, #0a0e1a 70%)`,
          }}
        />
      )}

      {/* Затемнение */}
      <AbsoluteFill
        style={{
          background: bgImageUrl
            ? `linear-gradient(180deg, rgba(10,14,26,0.55) 0%, rgba(10,14,26,0.9) 100%)`
            : "transparent",
        }}
      />

      {/* Подсветка по центру */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentColor}33 0%, transparent 50%)`,
        }}
      />

      {/* Контент */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            opacity: enter,
            transform: `translateY(${(1 - enter) * 40}px)`,
            textAlign: "center",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div
            style={{
              color: "#fff",
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              marginBottom: 40,
              textShadow: "0 4px 30px rgba(0,0,0,0.8)",
            }}
          >
            {text}
          </div>

          {/* Кнопка с shimmer-бликом */}
          <div
            style={{
              opacity: Math.max(0, buttonEnter),
              transform: `scale(${Math.max(0, buttonEnter) * buttonPulse})`,
              display: "inline-flex",
              alignItems: "center",
              gap: 20,
              background: accentColor,
              color: "#0a0e1a",
              padding: "28px 56px",
              borderRadius: 999,
              fontSize: 56,
              fontWeight: 900,
              boxShadow: `0 0 60px ${accentColor}99, 0 10px 40px rgba(0,0,0,0.4)`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Shimmer-overlay — белый градиентный блик ездит по кнопке */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${shimmerPos}%`,
                width: "40%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                pointerEvents: "none",
              }}
            />
            <span style={{ position: "relative", zIndex: 1 }}>{brandName}</span>
            <span
              style={{
                transform: `translateX(${arrowX}px)`,
                display: "inline-block",
                position: "relative",
                zIndex: 1,
              }}
            >
              →
            </span>
          </div>
        </div>
      </AbsoluteFill>

      {/* Конфетти */}
      {confettiActive ? (
        <ConfettiBurst frame={frame - confettiStart} accentColor={accentColor} />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Конфетти — 60 частиц, разлетаются из центра, гравитация тянет вниз.
 * Цикл рассчитан так, чтобы за 45 кадров (1.5 сек при 30fps) частицы
 * успели улететь к краям и опуститься.
 */
const ConfettiBurst: React.FC<{ frame: number; accentColor: string }> = ({
  frame,
  accentColor,
}) => {
  const colors = [accentColor, "#fff", "#a78bfa", "#f472b6", "#fbbf24"];
  const particles = Array.from({ length: 60 }, (_, i) => {
    const seed = i * 23.7;
    const angle = (seed % 360) * (Math.PI / 180);
    const speed = 8 + (i % 7) * 1.5;
    const baseX = 540 + Math.cos(angle) * speed * frame * 0.7;
    const baseY = 960 + Math.sin(angle) * speed * frame * 0.5 + frame * frame * 0.06;
    const rot = frame * (i % 2 === 0 ? 8 : -6);
    const size = 8 + (i % 4) * 4;
    const color = colors[i % colors.length];
    // Затухание в самом конце
    const op = interpolate(frame, [0, 30, 45], [1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: baseX,
          top: baseY,
          width: size,
          height: size * 0.6,
          background: color,
          transform: `rotate(${rot}deg)`,
          opacity: op,
          borderRadius: 2,
        }}
      />
    );
  });
  return <>{particles}</>;
};
