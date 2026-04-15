import type { Colors } from "@/lib/colors";

export function ProgressBar({ value, color, c, height = 8 }: {
  value: number;
  color: string;
  c: Colors;
  height?: number;
}) {
  return (
    <div style={{ height, borderRadius: height / 2, background: "var(--border)", overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, borderRadius: height / 2, background: color, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}
