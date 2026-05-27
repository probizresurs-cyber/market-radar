import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  text: string;
  brandName: string;
  accentColor: string;
}

export const CTAScene: React.FC<Props> = ({ text, brandName, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const buttonEnter = spring({
    frame: frame - 20,
    fps,
    config: { damping: 10, stiffness: 140 },
  });
  const buttonPulse = 1 + Math.sin(frame / 4) * 0.03;
  const arrowX = interpolate(frame % 30, [0, 15, 30], [0, 12, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${accentColor}22 0%, #0a0e1a 70%)`,
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
          }}
        >
          {text}
        </div>

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
            boxShadow: `0 0 60px ${accentColor}99`,
          }}
        >
          {brandName}
          <span style={{ transform: `translateX(${arrowX}px)`, display: "inline-block" }}>→</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
