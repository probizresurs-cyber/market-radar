import type { AnalysisResult } from "@/lib/types";
import type { Colors } from "@/lib/colors";

export function RadarChart({ data, competitors, c, size = 260 }: {
  data: AnalysisResult["company"];
  competitors?: AnalysisResult["company"][];
  c: Colors;
  size?: number;
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const cats = data.categories, n = cats.length;
  const getPoint = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const d = (v / 100) * r;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
  };
  const poly = (vals: number[]) => vals.map((v, i) => getPoint(i, v)).map(p => `${p.x},${p.y}`).join(" ");
  const compColors = ["var(--destructive)", "var(--warning)", "var(--success)", "var(--warning)", "var(--primary)"];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[20, 40, 60, 80, 100].map(v => (
        <polygon key={v} points={Array.from({ length: n }, (_, i) => getPoint(i, v)).map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--border)" strokeWidth={1} />
      ))}
      {cats.map((cat, i) => {
        const p = getPoint(i, 110);
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="var(--muted-foreground)" fontSize={10} fontWeight={500}>{cat.name}</text>;
      })}
      {competitors?.map((comp, ci) => (
        <polygon key={ci} points={poly(comp.categories.map(c2 => c2.score))} fill={compColors[ci % compColors.length] + "15"} stroke={compColors[ci % compColors.length]} strokeWidth={1.5} strokeOpacity={0.6} />
      ))}
      <polygon points={poly(cats.map(c2 => c2.score))} fill={"color-mix(in oklch, var(--primary) 15%, transparent)"} stroke="var(--primary)" strokeWidth={2.5} />
      {cats.map((cat, i) => { const p = getPoint(i, cat.score); return <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />; })}
    </svg>
  );
}
