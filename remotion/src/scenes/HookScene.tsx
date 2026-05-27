import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  text: string;
  accentColor: string;
}

export const HookScene: React.FC<Props> = ({ text, accentColor }) => {
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

  const words = text.split(" ");

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${accentColor}33 0%, transparent 60%)`,
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
          textShadow: `0 0 60px ${accentColor}80`,
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
  );
};
