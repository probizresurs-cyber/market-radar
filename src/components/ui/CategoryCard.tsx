import type { AnalysisResult } from "@/lib/types";
import type { Colors } from "@/lib/colors";
import { ProgressBar } from "./ProgressBar";

export function CategoryCard({ cat, c }: {
  cat: AnalysisResult["company"]["categories"][number];
  c: Colors;
}) {
  const color = cat.score >= 75 ? "var(--success)" : cat.score >= 50 ? "var(--warning)" : "var(--destructive)";
  return (
    <div style={{ background: "var(--card)", borderRadius: 16, padding: "16px 20px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)` }} />
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--muted-foreground)" }}>{cat.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontWeight: 800, fontSize: 22, color, letterSpacing: "-0.02em" }}>{cat.score}</span>
            {cat.delta !== 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: cat.delta > 0 ? "var(--success)" : "var(--destructive)" }}>
                {cat.delta > 0 ? "↑" : "↓"}{Math.abs(cat.delta)}
              </span>
            )}
          </div>
        </div>
        <ProgressBar value={cat.score} color={color} c={c} height={4} />
      </div>
    </div>
  );
}
