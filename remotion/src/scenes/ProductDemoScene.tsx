import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Props {
  problemText: string;
  screencastUrl: string | null;
  accentColor: string;
  brandName: string;
}

const STEPS = [
  { label: "1. Введи URL компании", at: 0 },
  { label: "2. AI-дашборд за 60 секунд", at: 5 },
  { label: "3. Стратегия + контент-план", at: 10 },
  { label: "4. Готовые посты и рилсы", at: 15 },
];

export const ProductDemoScene: React.FC<Props> = ({
  problemText,
  screencastUrl,
  accentColor,
  brandName,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sec = frame / fps;

  const titleEnter = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 15], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitStart = durationInFrames - 15;
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0e1a 0%, #161b2e 100%)",
        padding: 60,
        opacity: exit,
      }}
    >
      <div
        style={{
          opacity: titleEnter,
          transform: `translateY(${titleY}px)`,
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          fontSize: 64,
          textAlign: "center",
          lineHeight: 1.15,
          marginTop: 40,
          marginBottom: 50,
        }}
      >
        {problemText}
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: 32,
          overflow: "hidden",
          background: "#000",
          border: `4px solid ${accentColor}`,
          boxShadow: `0 0 80px ${accentColor}66`,
          position: "relative",
        }}
      >
        {screencastUrl ? (
          <OffthreadVideo src={screencastUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <DemoPlaceholder accentColor={accentColor} brandName={brandName} sec={sec} />
        )}
      </div>

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18 }}>
        {STEPS.map((step, i) => {
          const start = step.at * fps;
          const stepIn = interpolate(frame, [start, start + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const stepX = interpolate(frame, [start, start + 12], [-60, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity: stepIn,
                transform: `translateX(${stepX}px)`,
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 44,
                color: "#fff",
                background: `${accentColor}22`,
                borderLeft: `6px solid ${accentColor}`,
                padding: "18px 28px",
                borderRadius: 12,
              }}
            >
              {step.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const DemoPlaceholder: React.FC<{ accentColor: string; brandName: string; sec: number }> = ({
  accentColor,
  brandName,
  sec,
}) => {
  const bar1 = 30 + Math.sin(sec * 1.2) * 20 + sec * 2;
  const bar2 = 50 + Math.cos(sec * 0.8) * 15 + sec * 1.5;
  const bar3 = 70 + Math.sin(sec * 1.5 + 1) * 10 + sec;
  return (
    <AbsoluteFill style={{ padding: 30, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ color: accentColor, fontFamily: "Inter, sans-serif", fontWeight: 900, fontSize: 36 }}>
        {brandName} · DASHBOARD
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat label="Конкурентов" value={`${Math.min(12, Math.floor(sec * 1.2))}`} accent={accentColor} />
        <Stat label="Score" value={`${Math.min(94, Math.floor(40 + sec * 3.5))}`} accent={accentColor} />
        <Stat label="Постов" value={`${Math.min(28, Math.floor(sec * 1.8))}`} accent={accentColor} />
      </div>
      <Bar value={Math.min(100, bar1)} label="SEO" color={accentColor} />
      <Bar value={Math.min(100, bar2)} label="SMM" color="#a78bfa" />
      <Bar value={Math.min(100, bar3)} label="Бренд" color="#f472b6" />
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div
    style={{
      flex: 1,
      background: "#0d1224",
      borderRadius: 16,
      padding: 20,
      border: `2px solid ${accent}33`,
    }}
  >
    <div style={{ color: "#9ca3af", fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600 }}>{label}</div>
    <div style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 56, fontWeight: 900 }}>{value}</div>
  </div>
);

const Bar: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <div>
    <div style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
      {label} <span style={{ color }}>{Math.round(value)}%</span>
    </div>
    <div style={{ height: 20, background: "#1f2738", borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          transition: "width 0.3s",
        }}
      />
    </div>
  </div>
);
