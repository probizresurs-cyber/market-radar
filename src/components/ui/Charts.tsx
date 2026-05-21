"use client";

import React from "react";

/**
 * Переиспользуемые SVG-графики без внешних зависимостей.
 * Один файл — все примитивы (Donut, Bar, Sparkline, MetricRing).
 *
 * Цвета/типографика берутся из CSS-переменных темы, кроме series-цветов
 * (передаются вызывающим). Анимация: simple CSS transition, никаких React Spring.
 */

// ─── Donut chart ────────────────────────────────────────────────────────────

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 180,
  ringWidth = 18,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  ringWidth?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = size / 2 - 6;
  const r = R - ringWidth;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;

  const paths = segments.map((s, i) => {
    const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += s.value;
    const a2 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = a2 - a1 > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    const ix1 = cx + r * Math.cos(a2), iy1 = cy + r * Math.sin(a2);
    const ix2 = cx + r * Math.cos(a1), iy2 = cy + r * Math.sin(a1);
    return (
      <path
        key={i}
        d={`M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${r},${r} 0 ${large} 0 ${ix2},${iy2} Z`}
        fill={s.color}
        style={{ transition: "opacity 0.4s ease" }}
      >
        <title>{s.label}: {Math.round((s.value / total) * 100)}%</title>
      </path>
    );
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>{paths}</svg>
        {(centerLabel || centerValue) && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none", textAlign: "center",
          }}>
            {centerValue && <div style={{ fontSize: size / 7, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.1 }}>{centerValue}</div>}
            {centerLabel && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{centerLabel}</div>}
          </div>
        )}
      </div>
      <div style={{ flex: "1 1 200px", minWidth: 180 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: "var(--foreground)" }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar chart ────────────────────────────────────────────────────

export interface BarData {
  label: string;
  value: number;
  color?: string;
  highlight?: boolean;
}

export function HorizontalBarChart({
  data,
  formatValue = (v: number) => v.toLocaleString("ru-RU"),
  maxBars = 10,
}: {
  data: BarData[];
  formatValue?: (v: number) => string;
  maxBars?: number;
}) {
  const slice = data.slice(0, maxBars);
  const max = Math.max(...slice.map(d => d.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {slice.map((d, i) => {
        const pct = (d.value / max) * 100;
        const color = d.highlight ? "var(--primary)" : d.color || "var(--foreground-secondary)";
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{
                fontSize: 12,
                fontWeight: d.highlight ? 800 : 600,
                color: d.highlight ? "var(--primary)" : "var(--foreground)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%",
              }}>
                {d.label}
                {d.highlight && (
                  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 15%, transparent)", padding: "1px 6px", borderRadius: 4, verticalAlign: "middle" }}>
                    ВЫ
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.highlight ? "var(--primary)" : "var(--foreground)" }}>
                {formatValue(d.value)}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: color,
                borderRadius: 3,
                transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

export function Sparkline({
  points,
  color = "var(--primary)",
  width = 100,
  height = 28,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xAt = (i: number) => (i / (points.length - 1)) * width;
  const yAt = (v: number) => height - ((v - min) / range) * (height - 4) - 2;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p)}`).join(" ");
  const fillPath = `${d} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={fillPath} fill={color} opacity={0.15} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Metric Ring (для одного значения 0-100) ────────────────────────────────

export function MetricRing({
  value,
  max = 100,
  label,
  color,
  size = 84,
  suffix = "",
}: {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
  suffix?: string;
}) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const filled = pct * circ;
  // Цвет по умолчанию из шкалы как у PageSpeed:
  const auto = pct >= 0.7 ? "#0cce6b" : pct >= 0.4 ? "#ffa400" : "#ff4e42";
  const c = color ?? auto;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(150,150,150,0.15)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={c} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          style={{ transition: "stroke-dasharray 0.7s ease" }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
          fill={c} fontSize={size < 80 ? 18 : 20} fontWeight={800} fontFamily="inherit">
          {Math.round(value)}{suffix}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Stacked Bar (для распределения по категориям) ──────────────────────────

export function StackedBar({
  segments,
  height = 28,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height, borderRadius: 6, overflow: "hidden", background: "var(--muted)" }}>
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div key={i}
              title={`${s.label}: ${s.value.toLocaleString("ru-RU")} (${pct.toFixed(1)}%)`}
              style={{ width: `${pct}%`, background: s.color, transition: "width 0.6s ease" }} />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted-foreground)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
            <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{s.label}</span>
            <span>{s.value.toLocaleString("ru-RU")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
