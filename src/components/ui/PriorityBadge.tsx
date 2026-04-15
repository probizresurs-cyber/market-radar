import type { Colors } from "@/lib/colors";

export function PriorityBadge({ priority, c }: { priority: string; c: Colors }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    high: { label: "Высокий", bg: "color-mix(in oklch, var(--destructive) 9%, transparent)", color: "var(--destructive)" },
    medium: { label: "Средний", bg: "color-mix(in oklch, var(--warning) 9%, transparent)", color: "var(--warning)" },
    low: { label: "Низкий", bg: "color-mix(in oklch, var(--success) 9%, transparent)", color: "var(--success)" },
  };
  const { label, bg, color } = map[priority] ?? map.medium;
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>
  );
}
