import type { Colors } from "@/lib/colors";

export function ScoreRing({ score, size = 160, strokeWidth = 10, c }: {
  score: number;
  size?: number;
  strokeWidth?: number;
  c: Colors;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  const gradId = `sg-${size}-${strokeWidth}`;
  const scoreColor = score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--destructive)";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor={scoreColor} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={"var(--border)"} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={circ - progress} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 ${strokeWidth}px var(--primary)60)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color: "var(--foreground)", lineHeight: 1, letterSpacing: "-0.02em" }}>{score}</span>
        <span style={{ fontSize: size * 0.085, color: "var(--muted-foreground)", marginTop: 3, letterSpacing: "0.02em" }}>из 100</span>
      </div>
    </div>
  );
}
