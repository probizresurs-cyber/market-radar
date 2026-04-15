import type { Colors } from "@/lib/colors";

export function PriorityBadge({ priority, c }: { priority: string; c: Colors }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    high: { label: "Высокий", bg: c.accentRed + "18", color: c.accentRed },
    medium: { label: "Средний", bg: c.accentYellow + "18", color: c.accentYellow },
    low: { label: "Низкий", bg: c.accentGreen + "18", color: c.accentGreen },
  };
  const { label, bg, color } = map[priority] ?? map.medium;
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>
  );
}
