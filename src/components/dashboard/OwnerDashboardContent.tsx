"use client";

/**
 * OwnerDashboardContent — общий tabbed-дашборд руководителя.
 * Используется:
 *   - /owner-dashboard (авторизованный пользователь) — передаётся {mode:"private"}
 *   - /share/[id]       (публичная ссылка, без авторизации) — передаётся {mode:"public"}
 */

import React, { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { ContentPlan, BrandBook } from "@/lib/content-types";

// ─── Structures CJM/Benchmarks (shape повторяет /api/generate-cjm и /api/generate-benchmarks) ─
interface CJMTouchpoint { channel: string; action: string; icon: string }
interface CJMStage {
  id: string; name: string; emoji: string; duration: string;
  goal: string; emotion: string;
  emotionValence: "positive" | "neutral" | "negative" | "mixed";
  touchpoints: CJMTouchpoint[];
  customerThoughts: string[]; painPoints: string[]; opportunities: string[];
  kpi: string;
}
interface CJMResult { generatedAt: string; companyName: string; stages: CJMStage[] }

interface BenchmarkCategory {
  categoryName: string; icon: string;
  companyScore: number; nicheAverage: number; nicheLeader: number;
  gap: number; priority: "high" | "medium" | "low"; insight: string;
}
interface BenchmarkMetric { metric: string; nicheAverage: string; topPlayers: string; yourEstimate: string; icon: string }
interface BenchmarkOpportunity { title: string; description: string; potentialImpact: "high" | "medium" | "low"; effort: "high" | "medium" | "low"; icon: string }
interface BenchmarksResult {
  generatedAt: string; niche: string; summary: string;
  overallBenchmark: {
    companyScore: number; nicheAverage: number; nicheLeader: number;
    nicheBottom: number; percentile: number; verdict: string;
  };
  categoryBenchmarks: BenchmarkCategory[];
  marketMetrics: BenchmarkMetric[];
  growthOpportunities: BenchmarkOpportunity[];
  nicheInsights: string[];
}

// ─── Палитры ──────────────────────────────────────────────────────────────
export type Theme = "light" | "dark";

export interface Palette {
  primary: string;
  primaryLight: string;
  bgPage: string;
  bgCard: string;
  bgSecondary: string;
  bgTabActive: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  borderTertiary: string;
  borderSecondary: string;
  green: string;
  greenBg: string;
  red: string;
  redBg: string;
  orange: string;
  orangeBg: string;
  blue: string;
  blueBg: string;
  gray: string;
  grayBg: string;
}

export const PALETTES: Record<Theme, Palette> = {
  light: {
    primary: "#534AB7",
    primaryLight: "#7C6BE8",
    bgPage: "#F7F7F8",
    bgCard: "#FFFFFF",
    bgSecondary: "#F0F1F5",
    bgTabActive: "#EDEBFB",
    textPrimary: "#0F1123",
    textSecondary: "#55576B",
    textTertiary: "#8A8C9E",
    borderTertiary: "rgba(15,17,35,0.08)",
    borderSecondary: "rgba(15,17,35,0.16)",
    green: "#1D9E5F",
    greenBg: "rgba(29,158,95,0.12)",
    red: "#D64545",
    redBg: "rgba(214,69,69,0.12)",
    orange: "#E58F2A",
    orangeBg: "rgba(229,143,42,0.12)",
    blue: "#3B82F6",
    blueBg: "rgba(59,130,246,0.12)",
    gray: "#8A8C9E",
    grayBg: "rgba(138,140,158,0.12)",
  },
  dark: {
    primary: "#7C6BE8",
    primaryLight: "#9E90F0",
    bgPage: "#0D0E18",
    bgCard: "#161826",
    bgSecondary: "#1F2234",
    bgTabActive: "rgba(124,107,232,0.16)",
    textPrimary: "#F2F3F8",
    textSecondary: "#A8ABC2",
    textTertiary: "#6C6F85",
    borderTertiary: "rgba(255,255,255,0.06)",
    borderSecondary: "rgba(255,255,255,0.14)",
    green: "#4ADE80",
    greenBg: "rgba(74,222,128,0.14)",
    red: "#F87171",
    redBg: "rgba(248,113,113,0.16)",
    orange: "#FBBF24",
    orangeBg: "rgba(251,191,36,0.14)",
    blue: "#60A5FA",
    blueBg: "rgba(96,165,250,0.14)",
    gray: "#6C6F85",
    grayBg: "rgba(108,111,133,0.16)",
  },
};

// ─── Типы ──────────────────────────────────────────────────────────────────
export interface DashboardData {
  company: AnalysisResult | null;
  competitors: AnalysisResult[];
  ta: TAResult | null;
  smm: SMMResult | null;
  content: { plan: ContentPlan | null; posts: unknown[]; reels: unknown[] } | null;
  brandbook: BrandBook | null;
  cjm: CJMResult | null;
  benchmarks: BenchmarksResult | null;
}

type TabId = "overview" | "company" | "competitors" | "ta" | "cjm" | "benchmarks" | "smm" | "content";

type CompetitorStatus = "leader" | "growing" | "stable" | "new" | "declining";

interface Threat { level: "critical" | "warning" | "opportunity"; title: string; description: string }

// ─── Хук countUp ───────────────────────────────────────────────────────────
function useCountUp(target: number, durationMs = 1200, startDelayMs = 0): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || isNaN(target)) { setV(0); return; }
    let raf = 0;
    const t0 = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setV(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, startDelayMs);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [target, durationMs, startDelayMs]);
  return v;
}

function deriveStatus(score: number, myScore: number): CompetitorStatus {
  if (score >= myScore + 5) return "growing";
  if (score >= myScore - 5) return "stable";
  if (score <= myScore - 15) return "declining";
  return "new";
}

// ─── Карточка метрики ──────────────────────────────────────────────────────
function MetricCard({ p, label, value, change, positive, delayMs, suffix, neonColor }: {
  p: Palette; label: string; value: number; change: string;
  positive: boolean; delayMs: number; suffix?: string; neonColor?: string;
}) {
  const animated = useCountUp(value, 1200, delayMs + 100);
  const neonStyle = neonColor ? {
    border: `1px solid ${neonColor}`,
    boxShadow: `0 0 20px ${neonColor}40, 0 0 40px ${neonColor}20`,
    background: "rgba(13, 14, 24, 0.85)",
  } : {};
  return (
    <div className="mr-card mr-metric" style={{ animationDelay: `${delayMs}ms`, ...neonStyle }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: neonColor ?? p.textTertiary, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 800, color: neonColor ?? p.textPrimary, lineHeight: 1, marginBottom: 12, letterSpacing: -0.5 }}>
        {animated}{suffix && <span style={{ fontSize: 22, fontWeight: 700, color: neonColor ? `${neonColor}CC` : p.textTertiary }}>{suffix}</span>}
      </div>
      <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: positive ? p.greenBg : p.redBg, color: positive ? p.green : p.red }}>
        {change}
      </div>
    </div>
  );
}

// ─── Полоса конкурента ─────────────────────────────────────────────────────
function statusColor(p: Palette, s: CompetitorStatus): string {
  switch (s) {
    case "leader": return p.primary;
    case "growing": return p.green;
    case "stable": return p.blue;
    case "new": return p.orange;
    case "declining": return p.gray;
  }
}
function insightColor(p: Palette, type: string): string {
  switch (type) {
    case "niche": return p.primary;
    case "action": return p.green;
    case "battle": return p.red;
    case "copy": return p.orange;
    case "seo": return p.blue;
    case "offer": return p.primaryLight;
    default: return p.textTertiary;
  }
}
function insightLabel(type: string): string {
  switch (type) {
    case "niche": return "Ниша";
    case "action": return "Действие";
    case "battle": return "Конкуренция";
    case "copy": return "Копирайт";
    case "seo": return "SEO";
    case "offer": return "Оффер";
    default: return "Инсайт";
  }
}

function statusLabel(s: CompetitorStatus): string {
  switch (s) {
    case "leader": return "лидер";
    case "growing": return "растёт";
    case "stable": return "стабильно";
    case "new": return "новичок";
    case "declining": return "падает";
  }
}

function CompetitorBar({ p, name, score, status, delayMs }: {
  p: Palette; name: string; score: number; status: CompetitorStatus; delayMs: number;
}) {
  const color = statusColor(p, status);
  return (
    <div className="mr-bar-row" style={{ animationDelay: `${delayMs}ms` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: p.textPrimary }}>{name}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: p.textSecondary }}>{score} / 100</span>
      </div>
      <div style={{ position: "relative", height: 26, background: p.bgSecondary, borderRadius: 6, overflow: "hidden" }}>
        <div className="mr-bar-fill" style={{
          position: "absolute", inset: 0, right: "auto",
          width: `${Math.max(2, Math.min(100, score))}%`,
          background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
          transformOrigin: "left",
          animationDelay: `${delayMs + 80}ms`,
        }} />
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 11, fontWeight: 600, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
          {statusLabel(status)}
        </span>
      </div>
    </div>
  );
}

// ─── Улучшенный trend-chart (SVG с area-gradient) ──────────────────────────
function TrendChart({ p, series }: {
  p: Palette;
  series: Array<{ name: string; color: string; points: number[]; dashed?: boolean }>;
}) {
  const [hoverI, setHoverI] = useState<number | null>(null);
  const W = 700, H = 240, pad = { top: 20, right: 16, bottom: 28, left: 36 };
  const months = ["Ноя", "Дек", "Янв", "Фев", "Мар", "Апр"];
  const yMin = 30, yMax = 100;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const xAt = (i: number) => pad.left + (i / (months.length - 1)) * innerW;
  const yAt = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const primarySeries = series[0];

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 240, display: "block" }}
        onMouseLeave={() => setHoverI(null)}
        onMouseMove={(e) => {
          const rect = (e.target as Element).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((x - pad.left) / innerW) * (months.length - 1));
          if (i >= 0 && i < months.length) setHoverI(i);
        }}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.primary} stopOpacity="0.32" />
            <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y gridlines */}
        {[30, 50, 70, 90].map(v => (
          <g key={v}>
            <line x1={pad.left} y1={yAt(v)} x2={W - pad.right} y2={yAt(v)}
              stroke={p.borderTertiary} strokeWidth={0.5} />
            <text x={pad.left - 10} y={yAt(v) + 4} fontSize={10} fill={p.textTertiary} textAnchor="end">{v}</text>
          </g>
        ))}
        {/* X labels */}
        {months.map((m, i) => (
          <text key={m} x={xAt(i)} y={H - 8} fontSize={11} fill={p.textTertiary} textAnchor="middle">{m}</text>
        ))}

        {/* Area fill под первой (основной) линией */}
        {primarySeries && (
          <path
            d={
              primarySeries.points.map((pt, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(pt)}`).join(" ") +
              ` L${xAt(primarySeries.points.length - 1)},${yAt(yMin)} L${xAt(0)},${yAt(yMin)} Z`
            }
            fill="url(#areaFill)"
            className="mr-chart-area"
          />
        )}

        {/* Линии */}
        {series.map((s) => {
          const d = s.points.map((pt, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(pt)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2.8}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinecap="round" strokeLinejoin="round"
                className="mr-chart-line" />
              {!s.dashed && s.points.map((pt, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(pt)} r={hoverI === i ? 5 : 3.5}
                  fill={p.bgCard} stroke={s.color} strokeWidth={2.5} />
              ))}
            </g>
          );
        })}

        {/* Hover vertical */}
        {hoverI !== null && (
          <line x1={xAt(hoverI)} y1={pad.top} x2={xAt(hoverI)} y2={H - pad.bottom}
            stroke={p.borderSecondary} strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>
      {/* Tooltip */}
      {hoverI !== null && primarySeries && (
        <div style={{
          position: "absolute",
          left: `${(xAt(hoverI) / W) * 100}%`,
          top: 8,
          transform: "translateX(-50%)",
          pointerEvents: "none",
          background: p.bgCard,
          border: `1px solid ${p.borderTertiary}`,
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          color: p.textPrimary,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        }}>
          <span style={{ color: p.textTertiary }}>{months[hoverI]}: </span>
          {series.map(s => <span key={s.name} style={{ color: s.color, marginLeft: 6 }}>{s.points[hoverI]}</span>)}
        </div>
      )}
      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: p.textSecondary }}>
        {series.map(s => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 16, height: 3, background: s.color, borderRadius: 2,
              borderTop: s.dashed ? `1px dashed ${s.color}` : undefined }} />
            {s.name.length > 24 ? s.name.slice(0, 24) + "…" : s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Donut chart для доли рынка ────────────────────────────────────────────
function DonutChart({ p, segments, centerLabel, centerValue }: {
  p: Palette;
  segments: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 70, r = 52, cx = 90, cy = 90;
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
      <path key={i}
        d={`M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${r},${r} 0 ${large} 0 ${ix2},${iy2} Z`}
        fill={s.color}
        className="mr-donut-seg"
        style={{ animationDelay: `${i * 100}ms` }}
      />
    );
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg viewBox="0 0 180 180" width={180} height={180}>{paths}</svg>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: p.textPrimary }}>{centerValue}</div>
        <div style={{ fontSize: 13, color: p.textSecondary, marginBottom: 14 }}>{centerLabel}</div>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            <span style={{ flex: 1, color: p.textPrimary }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: p.textPrimary }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sparkline для строки таблицы конкурентов ──────────────────────────────
function Sparkline({ color, points }: { color: string; points: number[] }) {
  if (points.length < 2) return null;
  const W = 80, H = 24;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const xAt = (i: number) => (i / (points.length - 1)) * W;
  const yAt = (v: number) => H - ((v - min) / range) * (H - 4) - 2;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Threat row ────────────────────────────────────────────────────────────
function ThreatRow({ p, level, title, description, delayMs }: {
  p: Palette; level: "critical" | "warning" | "opportunity"; title: string; description: string; delayMs: number;
}) {
  const color = level === "critical" ? p.red : level === "warning" ? p.orange : p.blue;
  const bg = level === "critical" ? p.redBg : level === "warning" ? p.orangeBg : p.blueBg;
  const badge = level === "critical" ? "критично" : level === "warning" ? "внимание" : "возможность";
  return (
    <div className="mr-threat" style={{ animationDelay: `${delayMs}ms` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div className={level === "critical" ? "mr-pulse-dot" : ""}
          style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 7, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.textPrimary, lineHeight: 1.35 }}>{title}</div>
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: bg, color, textTransform: "uppercase", letterSpacing: 0.4 }}>{badge}</span>
          </div>
          <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.45 }}>{description}</div>
        </div>
      </div>
    </div>
  );
}

function buildThreats(my: AnalysisResult | null, competitors: AnalysisResult[]): Threat[] {
  const threats: Threat[] = [];
  if (!my) return threats;
  competitors.filter(c => c.company.score > my.company.score).slice(0, 2).forEach(c => {
    threats.push({
      level: "critical",
      title: `${c.company.name} опережает по общему баллу`,
      description: `Балл ${c.company.score} против вашего ${my.company.score}. Проверьте в чём они сильнее.`,
    });
  });
  (my.nicheForecast?.threats ?? []).slice(0, 2).forEach(t =>
    threats.push({ level: "warning", title: "Рыночная угроза", description: t }));
  (my.nicheForecast?.opportunities ?? []).slice(0, 3).forEach(o =>
    threats.push({ level: "opportunity", title: "Возможность", description: o }));
  return threats.slice(0, 6);
}

// ─── Tabs component ────────────────────────────────────────────────────────
function TabBar({ p, active, onChange, tabs }: {
  p: Palette; active: TabId; onChange: (t: TabId) => void;
  tabs: Array<{ id: TabId; icon: string; label: string; disabled?: boolean }>;
}) {
  return (
    <div style={{
      display: "flex", gap: 4, overflowX: "auto", background: p.bgCard,
      border: `1px solid ${p.borderTertiary}`, borderRadius: 12, padding: 6, marginBottom: 20,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => !t.disabled && onChange(t.id)}
          disabled={t.disabled}
          style={{
            padding: "8px 14px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: t.disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            background: active === t.id ? p.bgTabActive : "transparent",
            color: t.disabled ? p.textTertiary : active === t.id ? p.primary : p.textSecondary,
            opacity: t.disabled ? 0.5 : 1,
            transition: "background 150ms ease, color 150ms ease",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          <span>{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export function OwnerDashboardContent({
  data,
  mode,
  createdAt,
}: {
  data: DashboardData;
  mode: "private" | "public";
  createdAt?: string;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Detect theme (private mode respects mr_theme)
  useEffect(() => {
    try {
      if (mode === "public") {
        if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
        return;
      }
      const saved = localStorage.getItem("mr_theme");
      if (saved === "dark") setTheme("dark");
      else if (saved === "light" || saved === "warm") setTheme("light");
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
    } catch { /* ignore */ }
  }, [mode]);

  const p = PALETTES[theme];
  const { company: myCompany, competitors, ta: taAnalysis, smm: smmAnalysis, content, brandbook, cjm, benchmarks } = data;

  const tabs = useMemo(() => [
    { id: "overview" as const, icon: "📊", label: "Обзор" },
    { id: "company" as const, icon: "🏢", label: "Компания" },
    { id: "competitors" as const, icon: "🎯", label: "Конкуренты", disabled: competitors.length === 0 },
    { id: "ta" as const, icon: "🧠", label: "Целевая аудитория", disabled: !taAnalysis },
    { id: "cjm" as const, icon: "🗺", label: "CJM", disabled: !cjm },
    { id: "benchmarks" as const, icon: "📈", label: "Бенчмарки", disabled: !benchmarks },
    { id: "smm" as const, icon: "📱", label: "СММ", disabled: !smmAnalysis },
    { id: "content" as const, icon: "🏭", label: "Контент", disabled: !content?.plan },
  ], [competitors.length, taAnalysis, smmAnalysis, content?.plan, cjm, benchmarks]);

  // ─── Metrics ────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const myScore = myCompany?.company.score ?? 0;
    const avgCompScore = competitors.length > 0
      ? Math.round(competitors.reduce((s, c) => s + c.company.score, 0) / competitors.length)
      : 0;
    const marketShare = myScore > 0 && competitors.length > 0
      ? Math.round((myScore / (myScore + avgCompScore * competitors.length)) * 100)
      : 0;
    const threats = buildThreats(myCompany, competitors);
    const activeThreats = threats.filter(t => t.level === "critical" || t.level === "warning").length;
    return {
      competitors: competitors.length,
      threats: activeThreats,
      marketShare,
      score: myScore,
    };
  }, [myCompany, competitors]);

  // ─── Bars ───────────────────────────────────────────────────────────────
  const bars = useMemo(() => {
    const all: Array<{ name: string; score: number; status: CompetitorStatus }> = [];
    if (myCompany) {
      all.push({ name: myCompany.company.name, score: myCompany.company.score, status: "leader" });
    }
    const myScore = myCompany?.company.score ?? 70;
    competitors.slice(0, 5).forEach(c => {
      all.push({
        name: c.company.name,
        score: c.company.score,
        status: deriveStatus(c.company.score, myScore),
      });
    });
    return all;
  }, [myCompany, competitors]);

  // ─── Trend series ───────────────────────────────────────────────────────
  const trendSeries = useMemo(() => {
    if (!myCompany) return [];
    const mk = (final: number, variance: number): number[] => {
      const start = final - variance;
      return Array.from({ length: 6 }, (_, i) => {
        const t = i / 5;
        return Math.round(start + (final - start) * (t * t * (3 - 2 * t)) + (Math.random() - 0.5) * 2);
      });
    };
    const series: Array<{ name: string; color: string; points: number[]; dashed?: boolean }> = [];
    series.push({
      name: myCompany.company.name,
      color: p.primary,
      points: mk(myCompany.company.score, 10),
    });
    competitors.slice(0, 3).forEach(c => {
      series.push({
        name: c.company.name,
        color: statusColor(p, deriveStatus(c.company.score, myCompany.company.score)),
        points: mk(c.company.score, 12),
        dashed: true,
      });
    });
    return series;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCompany?.company.score, competitors.length, theme]);

  const threats = useMemo(() => buildThreats(myCompany, competitors), [myCompany, competitors]);
  const aiRecs = useMemo(() => (myCompany?.recommendations ?? []).slice(0, 3), [myCompany]);
  const keyInsights = useMemo(() => (myCompany?.insights ?? []).slice(0, 4), [myCompany]);

  // ─── Market share для donut ─────────────────────────────────────────────
  const marketDonut = useMemo(() => {
    if (!myCompany || competitors.length === 0) return null;
    const my = myCompany.company.score;
    const comps = competitors.slice(0, 4).map((c, i) => ({
      label: c.company.name.length > 18 ? c.company.name.slice(0, 18) + "…" : c.company.name,
      value: c.company.score,
      color: [p.blue, p.orange, p.green, p.gray][i % 4],
    }));
    const rest = competitors.slice(4).reduce((s, c) => s + c.company.score, 0);
    const segments = [
      { label: myCompany.company.name.length > 18 ? myCompany.company.name.slice(0, 18) + "…" : myCompany.company.name, value: my, color: p.primary },
      ...comps,
      ...(rest > 0 ? [{ label: "Остальные", value: rest, color: p.textTertiary }] : []),
    ];
    return segments;
  }, [myCompany, competitors, p]);

  const period = useMemo(() => {
    const d = createdAt ? new Date(createdAt) : new Date();
    return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }, [createdAt]);

  // ─── Share action ──────────────────────────────────────────────────────
  const handleShare = async () => {
    setSharing(true); setShareError(null);
    try {
      const r = await fetch("/api/share/create", { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка создания ссылки");
      const url = `${window.location.origin}/share/${j.id}`;
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch { /* clipboard denied — ссылку покажем модалкой */ }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSharing(false);
    }
  };

  if (!myCompany) {
    return (
      <div style={{ minHeight: "100vh", background: p.bgPage, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: p.textPrimary, marginBottom: 8 }}>
            {mode === "public" ? "Данных нет" : "Сначала запустите анализ"}
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 24 }}>
            {mode === "public"
              ? "Владелец ссылки ещё не создал анализ."
              : "Дашборд руководителя собирается из ваших анализов компании и конкурентов."}
          </div>
          {mode === "private" && (
            <a href="/" style={{ display: "inline-block", padding: "12px 24px", background: p.primary, color: "#fff",
              borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
              Запустить анализ →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{buildCSS(p)}</style>
      <div style={{ minHeight: "100vh", background: p.bgPage, fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", color: p.textPrimary }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "24px" }}>
          {/* ─── Header ─── */}
          <div className="mr-card" style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, marginBottom: 20, animationDelay: "0ms", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: p.primary,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>🎯</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.textPrimary, lineHeight: 1.2 }}>
                  {myCompany.company.name}
                </div>
                <div style={{ fontSize: 13, color: p.textSecondary, marginTop: 2 }}>
                  Конкурентная разведка · {period}{mode === "public" && " · публичная ссылка"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} className="mr-header-buttons">
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
                style={{ padding: "10px 14px", fontSize: 16, background: p.bgCard, border: `1px solid ${p.borderTertiary}`, borderRadius: 8, cursor: "pointer", lineHeight: 1 }}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              {mode === "private" && (
                <a href="/" style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: p.textSecondary,
                  border: `1px solid ${p.borderTertiary}`, borderRadius: 8, textDecoration: "none", background: p.bgCard }}>
                  ← На платформу
                </a>
              )}
              {mode === "private" && (
                <button onClick={handleShare} disabled={sharing}
                  style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600,
                    color: p.primary, background: p.bgCard, border: `1px solid ${p.primary}`, borderRadius: 8,
                    cursor: sharing ? "wait" : "pointer" }}>
                  {sharing ? "Создаём…" : "🔗 Поделиться ссылкой"}
                </button>
              )}
              <button onClick={() => window.print()}
                style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#fff", background: p.primary,
                  border: "none", borderRadius: 8, cursor: "pointer" }}>
                Скачать отчёт
              </button>
            </div>
          </div>

          {/* Share link banner */}
          {shareLink && (
            <div className="mr-card" style={{ padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center",
              gap: 12, flexWrap: "wrap", background: p.bgTabActive, borderColor: p.primary }}>
              <span style={{ fontSize: 18 }}>🔗</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 2 }}>
                  Публичная ссылка {copied && <span style={{ color: p.green }}>· скопировано ✓</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.textPrimary, wordBreak: "break-all" }}>{shareLink}</div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }); }}
                style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#fff", background: p.primary,
                  border: "none", borderRadius: 8, cursor: "pointer" }}>
                Копировать
              </button>
            </div>
          )}
          {shareError && (
            <div style={{ padding: 12, marginBottom: 16, background: p.redBg, color: p.red, borderRadius: 8, fontSize: 13 }}>
              {shareError}
            </div>
          )}

          {/* Tab bar */}
          <TabBar p={p} active={activeTab} onChange={setActiveTab} tabs={tabs} />

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && (
            <>
              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }} className="mr-metrics-grid">
                <MetricCard p={p} label="Конкуренты" value={metrics.competitors} change={metrics.competitors > 0 ? `${metrics.competitors} отслеживаются` : "нет"} positive delayMs={100} neonColor="#4FC3F7" />
                <MetricCard p={p} label="Угрозы" value={metrics.threats} change={metrics.threats > 0 ? `${metrics.threats} активных` : "всё спокойно"} positive={metrics.threats === 0} delayMs={250} neonColor="#FF5252" />
                <MetricCard p={p} label="Ваша доля" value={metrics.marketShare} change="оценка рынка" positive delayMs={400} suffix="%" neonColor="#69FF47" />
                <MetricCard p={p} label="Ваш балл" value={metrics.score} change={`из 100`} positive delayMs={550} neonColor="#D500F9" />
              </div>

              {/* Main 2-col */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }} className="mr-main-grid">
                <div className="mr-card" style={{ padding: 24, animationDelay: "600ms" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Конкурентный ландшафт</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {bars.map((b, i) => (
                      <CompetitorBar key={i} p={p} name={b.name} score={b.score} status={b.status} delayMs={800 + i * 150} />
                    ))}
                  </div>

                  {trendSeries.length > 0 && (
                    <div className="mr-chart-wrap" style={{ marginTop: 28, animationDelay: "1000ms" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary, marginBottom: 12 }}>Динамика позиций</div>
                      <TrendChart p={p} series={trendSeries} />
                    </div>
                  )}

                  {/* Ключевые инсайты — закрывают пустое место под графиком */}
                  {keyInsights.length > 0 && (
                    <div className="mr-chart-wrap" style={{ marginTop: 28, animationDelay: "1100ms" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary, marginBottom: 12 }}>Ключевые инсайты</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        {keyInsights.map((ins, i) => (
                          <div key={i} className="mr-ai-rec" style={{ animationDelay: `${1150 + i * 120}ms`, padding: 14, background: p.bgSecondary, borderRadius: 10, borderLeft: `3px solid ${insightColor(p, ins.type)}` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: insightColor(p, ins.type), marginBottom: 6 }}>
                              {insightLabel(ins.type)}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: p.textPrimary, marginBottom: 4 }}>{ins.title}</div>
                            <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.45 }}>{ins.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="mr-card" style={{ padding: 20, animationDelay: "700ms" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div className="mr-pulse-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: p.red }} />
                      <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary }}>Угрозы и возможности</div>
                    </div>
                    {threats.length === 0 ? (
                      <div style={{ fontSize: 13, color: p.textTertiary }}>Добавьте конкурентов — здесь появятся угрозы.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {threats.map((t, i) => (
                          <ThreatRow key={i} p={p} level={t.level} title={t.title} description={t.description} delayMs={900 + i * 150} />
                        ))}
                      </div>
                    )}
                  </div>

                  {aiRecs.length > 0 && (
                    <div className="mr-card" style={{ padding: 20, animationDelay: "1600ms" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Рекомендации AI</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {aiRecs.map((r, i) => (
                          <div key={i} className="mr-ai-rec" style={{ animationDelay: `${1600 + i * 150}ms` }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: p.green, minWidth: 20 }}>{i + 1}.</div>
                              <div style={{ flex: 1, fontSize: 13, color: p.textPrimary, lineHeight: 1.45 }}>
                                {r.text}
                                {r.effect && <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 4 }}>→ {r.effect}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Market donut + niche forecast */}
              {marketDonut && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }} className="mr-main-grid">
                  <div className="mr-card" style={{ padding: 24, animationDelay: "1700ms" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 16 }}>Распределение рынка</div>
                    <DonutChart p={p} segments={marketDonut}
                      centerLabel="Ваша доля"
                      centerValue={`${metrics.marketShare}%`} />
                  </div>
                  <div className="mr-card" style={{ padding: 24, animationDelay: "1800ms" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 16 }}>Прогноз ниши</div>
                    <div style={{ fontSize: 13, color: p.textSecondary, marginBottom: 12 }}>{myCompany.nicheForecast?.forecast}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 12, background: p.bgSecondary, borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: p.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                          Тренд
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700,
                          color: myCompany.nicheForecast?.trend === "growing" ? p.green :
                                 myCompany.nicheForecast?.trend === "declining" ? p.red : p.orange }}>
                          {myCompany.nicheForecast?.trend === "growing" ? "↑ Растёт" :
                           myCompany.nicheForecast?.trend === "declining" ? "↓ Падает" : "→ Стабильно"}
                          {myCompany.nicheForecast?.trendPercent ? ` ${myCompany.nicheForecast.trendPercent}%` : ""}
                        </div>
                      </div>
                      <div style={{ padding: 12, background: p.bgSecondary, borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: p.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                          Горизонт
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary }}>
                          {myCompany.nicheForecast?.timeframe ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ COMPANY TAB ═══ */}
          {activeTab === "company" && (
            <CompanyTab p={p} data={myCompany} brandbook={brandbook} />
          )}

          {/* ═══ COMPETITORS TAB ═══ */}
          {activeTab === "competitors" && (
            <CompetitorsTab p={p} myCompany={myCompany} competitors={competitors} />
          )}

          {/* ═══ TA TAB ═══ */}
          {activeTab === "ta" && taAnalysis && <TATab p={p} data={taAnalysis} />}

          {/* ═══ CJM TAB ═══ */}
          {activeTab === "cjm" && cjm && <CJMTab p={p} data={cjm} />}

          {/* ═══ BENCHMARKS TAB ═══ */}
          {activeTab === "benchmarks" && benchmarks && <BenchmarksTab p={p} data={benchmarks} />}

          {/* ═══ SMM TAB ═══ */}
          {activeTab === "smm" && smmAnalysis && <SMMTab p={p} data={smmAnalysis} />}

          {/* ═══ CONTENT TAB ═══ */}
          {activeTab === "content" && content?.plan && <ContentTab p={p} plan={content.plan} />}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 40, fontSize: 12, color: p.textTertiary, paddingBottom: 20 }}>
            {mode === "public" ? (
              <>
                Дашборд создан на <a href="/" style={{ color: p.primary, fontWeight: 600, textDecoration: "none" }}>MarketRadar</a>.
                {" "}Хотите такой же для своей компании? <a href="/" style={{ color: p.primary, fontWeight: 600, textDecoration: "none" }}>Запустить анализ →</a>
              </>
            ) : (
              <>MarketRadar · Дашборд руководителя · Обновлено {new Date().toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CompanyTab ───────────────────────────────────────────────────────────
function CompanyTab({ p, data, brandbook }: { p: Palette; data: AnalysisResult; brandbook: BrandBook | null }) {
  const cats = data.company.categories ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Категории */}
      <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Оценка по категориям</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {cats.map((cat, i) => (
            <div key={cat.name} className="mr-bar-row" style={{ animationDelay: `${200 + i * 100}ms`, background: p.bgSecondary, padding: 14, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.textPrimary }}>{cat.name}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: p.primary }}>{cat.score}</span>
              </div>
              <div style={{ height: 8, background: p.bgCard, borderRadius: 4, overflow: "hidden" }}>
                <div className="mr-bar-fill" style={{
                  width: `${cat.score}%`, height: "100%",
                  background: `linear-gradient(90deg, ${p.primary} 0%, ${p.primaryLight} 100%)`,
                  animationDelay: `${300 + i * 100}ms`,
                }} />
              </div>
              {typeof cat.delta === "number" && cat.delta !== 0 && (
                <div style={{ fontSize: 11, color: cat.delta > 0 ? p.green : p.red, marginTop: 6 }}>
                  {cat.delta > 0 ? "↑" : "↓"} {Math.abs(cat.delta)} vs прошлый анализ
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2 cols: SEO + Соцсети/Карты */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="mr-main-grid">
        <div className="mr-card" style={{ padding: 24, animationDelay: "400ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>SEO и сайт</div>
          <KV p={p} k="Title" v={data.seo?.title ?? "—"} />
          <KV p={p} k="Ключевых слов" v={data.seo?.keywords?.length ?? 0} />
          <KV p={p} k="Страниц" v={data.seo?.pageCount ?? "—"} />
          <KV p={p} k="Возраст домена" v={data.seo?.domainAge ?? "—"} />
          <KV p={p} k="Трафик (оценка)" v={data.seo?.estimatedTraffic ?? "—"} />
          {data.seo?.lighthouseScores && (
            <>
              <KV p={p} k="Performance" v={data.seo.lighthouseScores.performance} />
              <KV p={p} k="SEO" v={data.seo.lighthouseScores.seo} />
              <KV p={p} k="Accessibility" v={data.seo.lighthouseScores.accessibility} />
            </>
          )}
        </div>

        <div className="mr-card" style={{ padding: 24, animationDelay: "500ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Присутствие</div>
          {data.social?.vk && <KV p={p} k="VK подписчики" v={data.social.vk.subscribers.toLocaleString("ru-RU")} />}
          {data.social?.telegram && <KV p={p} k="TG подписчики" v={data.social.telegram.subscribers.toLocaleString("ru-RU")} />}
          {data.social?.yandexRating > 0 && <KV p={p} k="Yandex Maps" v={`★ ${data.social.yandexRating.toFixed(1)} (${data.social.yandexReviews} отз.)`} />}
          {data.social?.gisRating > 0 && <KV p={p} k="2ГИС" v={`★ ${data.social.gisRating.toFixed(1)} (${data.social.gisReviews} отз.)`} />}
          {data.business?.employees && <KV p={p} k="Сотрудники" v={data.business.employees} />}
          {data.business?.founded && <KV p={p} k="Основана" v={data.business.founded} />}
          {data.business?.revenue && <KV p={p} k="Выручка" v={data.business.revenue} />}
        </div>
      </div>

      {/* Brandbook preview if present */}
      {brandbook && brandbook.brandName && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "600ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Брендбук</div>
          {brandbook.tagline && <div style={{ fontSize: 14, fontStyle: "italic", color: p.textSecondary, marginBottom: 10 }}>“{brandbook.tagline}”</div>}
          {brandbook.colors && brandbook.colors.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {brandbook.colors.map((c, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: c, border: `1px solid ${p.borderTertiary}` }} />
                  <span style={{ fontSize: 10, color: p.textTertiary }}>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KV({ p, k, v }: { p: Palette; k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${p.borderTertiary}`, fontSize: 13 }}>
      <span style={{ color: p.textSecondary }}>{k}</span>
      <span style={{ fontWeight: 600, color: p.textPrimary, textAlign: "right" }}>{v}</span>
    </div>
  );
}

// ─── CompetitorsTab ───────────────────────────────────────────────────────
function CompetitorsTab({ p, myCompany, competitors }: { p: Palette; myCompany: AnalysisResult; competitors: AnalysisResult[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Score comparison bar chart */}
      <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Сравнение балла</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CompetitorBar p={p} name={`${myCompany.company.name} (вы)`} score={myCompany.company.score} status="leader" delayMs={200} />
          {competitors.map((c, i) => (
            <CompetitorBar key={i} p={p}
              name={c.company.name}
              score={c.company.score}
              status={deriveStatus(c.company.score, myCompany.company.score)}
              delayMs={350 + i * 120} />
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div className="mr-card" style={{ padding: 24, animationDelay: "600ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Детальная таблица</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Компания", "Балл", "Статус", "Динамика", "Yandex", "2ГИС", "Трафик"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700,
                    letterSpacing: 0.6, textTransform: "uppercase", color: p.textTertiary, borderBottom: `1px solid ${p.borderTertiary}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, i) => {
                const status = deriveStatus(c.company.score, myCompany.company.score);
                const color = statusColor(p, status);
                // Генерируем mock sparkline
                const spark = Array.from({ length: 6 }, (_, j) => {
                  const t = j / 5;
                  const base = c.company.score - 8;
                  return base + (c.company.score - base) * (t * t * (3 - 2 * t)) + (Math.random() - 0.5) * 4;
                });
                return (
                  <tr key={i} className="mr-row">
                    <td style={{ padding: "12px", fontWeight: 600, color: p.textPrimary }}>
                      {c.company.name}
                      <div style={{ fontSize: 11, color: p.textTertiary, marginTop: 2 }}>{c.company.url}</div>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: p.textPrimary, minWidth: 28 }}>{c.company.score}</span>
                        <div style={{ flex: 1, height: 6, background: p.bgSecondary, borderRadius: 6, overflow: "hidden", minWidth: 60 }}>
                          <div style={{ width: `${c.company.score}%`, height: "100%", background: color, borderRadius: 6 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, fontSize: 11,
                        fontWeight: 600, background: `${color}1F`, color }}>{statusLabel(status)}</span>
                    </td>
                    <td style={{ padding: "12px" }}><Sparkline color={color} points={spark} /></td>
                    <td style={{ padding: "12px", color: p.textSecondary }}>
                      {c.social?.yandexRating > 0 ? `★ ${c.social.yandexRating.toFixed(1)}` : "—"}
                    </td>
                    <td style={{ padding: "12px", color: p.textSecondary }}>
                      {c.social?.gisRating > 0 ? `★ ${c.social.gisRating.toFixed(1)}` : "—"}
                    </td>
                    <td style={{ padding: "12px", color: p.textSecondary }}>{c.seo?.estimatedTraffic || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TATab ────────────────────────────────────────────────────────────────
function TATab({ p, data }: { p: Palette; data: TAResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 10 }}>Целевая аудитория</div>
        <div style={{ fontSize: 13, color: p.textSecondary, marginBottom: 16 }}>{data.summary}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {(data.segments ?? []).slice(0, 6).map((seg, i) => (
          <div key={i} className="mr-card" style={{ padding: 20, animationDelay: `${200 + i * 120}ms` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: p.primary }}>{seg.segmentName}</div>
              {seg.isGolden && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: p.orangeBg, color: p.orange }}>★ golden</span>}
            </div>
            <div style={{ fontSize: 12, color: p.textTertiary, marginBottom: 12 }}>
              {seg.demographics?.personaName} · {seg.demographics?.age} · {seg.demographics?.genderRatio}
            </div>
            {seg.worldview?.shortDescription && (
              <div style={{ fontSize: 13, color: p.textPrimary, lineHeight: 1.5, marginBottom: 12 }}>{seg.worldview.shortDescription}</div>
            )}
            {seg.mainProblems && seg.mainProblems.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.red, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Боли</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>
                  {seg.mainProblems.slice(0, 3).map((pain, j) => <li key={j}>{pain}</li>)}
                </ul>
              </div>
            )}
            {seg.topFears && seg.topFears.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.orange, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Страхи</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>
                  {seg.topFears.slice(0, 3).map((f, j) => <li key={j}>{f}</li>)}
                </ul>
              </div>
            )}
            {seg.topObjections && seg.topObjections.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Возражения</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>
                  {seg.topObjections.slice(0, 3).map((m, j) => <li key={j}>{m}</li>)}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SMMTab ───────────────────────────────────────────────────────────────
function SMMTab({ p, data }: { p: Palette; data: SMMResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 10 }}>Архетип бренда</div>
        <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 12 }}>
          {data.brandIdentity?.archetype && <><strong style={{ color: p.primary }}>{data.brandIdentity.archetype}</strong> · </>}
          {data.brandIdentity?.positioning}
        </div>
        {data.brandIdentity?.toneOfVoice && data.brandIdentity.toneOfVoice.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {data.brandIdentity.toneOfVoice.map((a, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px",
                background: p.bgTabActive, color: p.primary, borderRadius: 16 }}>{a}</span>
            ))}
          </div>
        )}
      </div>
      {data.platformStrategies && data.platformStrategies.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "200ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Стратегии по платформам</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {data.platformStrategies.map((ps, i) => (
              <div key={i} style={{ padding: 14, background: p.bgSecondary, borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: p.textPrimary, marginBottom: 6 }}>{ps.platformLabel ?? ps.platform}</div>
                <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>{ps.audienceFit}</div>
                <div style={{ fontSize: 11, color: p.textTertiary }}>
                  <strong>Формат:</strong> {ps.contentFormat}<br />
                  <strong>Частота:</strong> {ps.postingFrequency}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.quickWins && data.quickWins.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "300ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Quick wins</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: p.textPrimary, lineHeight: 1.8 }}>
            {data.quickWins.slice(0, 5).map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── ContentTab ───────────────────────────────────────────────────────────
function ContentTab({ p, plan }: { p: Palette; plan: ContentPlan }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 10 }}>Большая идея</div>
        <div style={{ fontSize: 15, color: p.textPrimary, lineHeight: 1.5, fontStyle: "italic" }}>{plan.bigIdea}</div>
      </div>
      {plan.pillars && plan.pillars.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "200ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Контент-столпы</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {plan.pillars.map((pillar, i) => (
              <div key={i} style={{ padding: 14, background: p.bgSecondary, borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: p.primary, marginBottom: 4 }}>{pillar.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: p.textTertiary, marginBottom: 8 }}>{pillar.share}</div>
                <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>{pillar.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {plan.postIdeas && plan.postIdeas.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "300ms" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Идеи постов</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: p.textPrimary, lineHeight: 1.8 }}>
            {plan.postIdeas.slice(0, 8).map((idea, i) => <li key={i}>{idea.hook}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── CJMTab ───────────────────────────────────────────────────────────────
function CJMTab({ p, data }: { p: Palette; data: CJMResult }) {
  const valenceColor = (v: CJMStage["emotionValence"]): string =>
    v === "positive" ? p.green : v === "negative" ? p.red : v === "mixed" ? p.orange : p.gray;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 8 }}>Customer Journey Map</div>
        <div style={{ fontSize: 13, color: p.textSecondary }}>
          Путь клиента от осознания до лояльности · {data.stages.length} этапов
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.stages.map((st, i) => (
          <div key={i} className="mr-card" style={{ padding: 20, animationDelay: `${200 + i * 100}ms`, borderLeft: `4px solid ${valenceColor(st.emotionValence)}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{st.emoji}</div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary }}>{st.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: p.bgSecondary, color: p.textTertiary }}>{st.duration}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${valenceColor(st.emotionValence)}22`, color: valenceColor(st.emotionValence) }}>
                    {st.emotion}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: p.textSecondary, marginBottom: 10 }}><strong>Цель:</strong> {st.goal}</div>
                <div style={{ fontSize: 11, color: p.textTertiary, marginBottom: 12 }}><strong>KPI:</strong> {st.kpi}</div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  {st.touchpoints.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: p.blue, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Точки касания</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>
                        {st.touchpoints.slice(0, 4).map((t, j) => <li key={j}>{t.icon} {t.channel}: {t.action}</li>)}
                      </ul>
                    </div>
                  )}
                  {st.painPoints.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: p.red, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Боли</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>
                        {st.painPoints.slice(0, 3).map((t, j) => <li key={j}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {st.opportunities.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: p.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Возможности</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>
                        {st.opportunities.slice(0, 3).map((t, j) => <li key={j}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BenchmarksTab ────────────────────────────────────────────────────────
function BenchmarksTab({ p, data }: { p: Palette; data: BenchmarksResult }) {
  const ob = data.overallBenchmark;
  const priorityColor = (pr: "high" | "medium" | "low"): string =>
    pr === "high" ? p.red : pr === "medium" ? p.orange : p.gray;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Сводка */}
      {data.summary && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "100ms" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 8 }}>
            Позиция в нише «{data.niche}»
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary, lineHeight: 1.5 }}>{data.summary}</div>
        </div>
      )}

      {/* Overall benchmark — 4 метрики */}
      {ob && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
          <MetricCard p={p} label="Ваш балл" value={ob.companyScore ?? 0} change={ob.verdict ?? "—"} positive delayMs={200} />
          <MetricCard p={p} label="Средний по нише" value={ob.nicheAverage ?? 0} change="бенчмарк рынка" positive delayMs={300} />
          <MetricCard p={p} label="Лидеры ниши" value={ob.nicheLeader ?? 0} change="топ-10%" positive delayMs={400} />
          <MetricCard p={p} label="Ваш процентиль" value={ob.percentile ?? 0} change="места в нише" positive delayMs={500} suffix="%" />
        </div>
      )}

      {/* Категорийные бенчмарки */}
      {data.categoryBenchmarks?.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "600ms" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Бенчмарки по категориям</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.categoryBenchmarks.map((cb, i) => {
              const scale = Math.max(100, cb.nicheLeader, cb.companyScore);
              return (
                <div key={i} style={{ padding: 14, background: p.bgSecondary, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: p.textPrimary }}>
                      {cb.icon} {cb.categoryName}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: `${priorityColor(cb.priority)}22`, color: priorityColor(cb.priority) }}>
                      {cb.priority === "high" ? "высокий приоритет" : cb.priority === "medium" ? "средний приоритет" : "низкий приоритет"}
                    </span>
                  </div>
                  {/* Диаграмма: вы / средн. / лидер */}
                  <div style={{ position: "relative", height: 24, background: p.bgCard, borderRadius: 6, marginBottom: 6 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(cb.companyScore / scale) * 100}%`,
                      background: `linear-gradient(90deg, ${p.primary} 0%, ${p.primaryLight} 100%)`, borderRadius: 6 }} />
                    <div style={{ position: "absolute", left: `${(cb.nicheAverage / scale) * 100}%`, top: -2, bottom: -2, width: 2, background: p.orange }} title="средн. по нише" />
                    <div style={{ position: "absolute", left: `${(cb.nicheLeader / scale) * 100}%`, top: -2, bottom: -2, width: 2, background: p.green }} title="лидер ниши" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: p.textTertiary, marginBottom: 8 }}>
                    <span>Вы: <strong style={{ color: p.primary }}>{cb.companyScore}</strong></span>
                    <span>Средн.: <strong style={{ color: p.orange }}>{cb.nicheAverage}</strong></span>
                    <span>Лидер: <strong style={{ color: p.green }}>{cb.nicheLeader}</strong></span>
                    <span>Gap: <strong style={{ color: cb.gap >= 0 ? p.green : p.red }}>{cb.gap >= 0 ? "+" : ""}{cb.gap}</strong></span>
                  </div>
                  {cb.insight && <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>{cb.insight}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Market metrics */}
      {data.marketMetrics?.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "700ms" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Рыночные метрики</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Метрика", "Среднее по нише", "Топ-игроки", "Ваша оценка"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: p.textTertiary, borderBottom: `1px solid ${p.borderTertiary}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.marketMetrics.map((m, i) => (
                  <tr key={i} className="mr-row">
                    <td style={{ padding: "12px", fontWeight: 600, color: p.textPrimary }}>{m.icon} {m.metric}</td>
                    <td style={{ padding: "12px", color: p.textSecondary }}>{m.nicheAverage}</td>
                    <td style={{ padding: "12px", color: p.green, fontWeight: 600 }}>{m.topPlayers}</td>
                    <td style={{ padding: "12px", color: p.primary, fontWeight: 700 }}>{m.yourEstimate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Growth opportunities */}
      {data.growthOpportunities?.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "800ms" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Возможности роста</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {data.growthOpportunities.map((g, i) => (
              <div key={i} style={{ padding: 14, background: p.bgSecondary, borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: p.textPrimary, marginBottom: 6 }}>{g.icon} {g.title}</div>
                <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>{g.description}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${priorityColor(g.potentialImpact)}22`, color: priorityColor(g.potentialImpact) }}>
                    эффект: {g.potentialImpact}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: p.bgCard, color: p.textTertiary }}>
                    усилия: {g.effort}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Niche insights */}
      {data.nicheInsights?.length > 0 && (
        <div className="mr-card" style={{ padding: 24, animationDelay: "900ms" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Инсайты по нише</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: p.textPrimary, lineHeight: 1.8 }}>
            {data.nicheInsights.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────
function buildCSS(p: Palette): string {
  return `
.mr-card {
  background: ${p.bgCard};
  border: 1px solid ${p.borderTertiary};
  border-radius: 14px;
  opacity: 0;
  transform: translateY(18px);
  animation: mrFadeUp 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.mr-metric {
  padding: 18px 20px 20px;
  transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}
.mr-metric:hover { transform: scale(1.015); border-color: ${p.borderSecondary}; box-shadow: 0 6px 18px rgba(15,17,35,0.06); }
.mr-bar-row {
  opacity: 0;
  animation: mrFadeUp 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  transition: background 150ms ease;
  padding: 2px 4px;
  border-radius: 6px;
}
.mr-bar-row:hover { background: ${p.bgSecondary}; }
.mr-bar-fill {
  transform: scaleX(0);
  animation: mrBarGrow 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  border-radius: 6px;
}
.mr-chart-area {
  opacity: 0;
  animation: mrFadeIn 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) 0.3s forwards;
}
.mr-chart-line {
  stroke-dasharray: 1200;
  stroke-dashoffset: 1200;
  animation: mrDrawLine 1.4s cubic-bezier(0.22, 0.61, 0.36, 1) 0.2s forwards;
}
.mr-donut-seg {
  opacity: 0;
  transform-origin: 90px 90px;
  animation: mrFadeIn 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.mr-threat {
  opacity: 0;
  transform: translateX(-12px);
  animation: mrSlideIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  padding: 10px 12px;
  border-radius: 8px;
  transition: transform 150ms ease, background 150ms ease;
  cursor: default;
}
.mr-threat:hover { background: ${p.bgSecondary}; transform: translateX(4px); }
.mr-ai-rec {
  opacity: 0;
  transform: translateX(-12px);
  animation: mrSlideIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  padding: 12px 14px;
  background: ${p.bgSecondary};
  border-radius: 10px;
}
.mr-chart-wrap { opacity: 0; animation: mrFadeUp 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
.mr-row { transition: background 150ms ease; }
.mr-row:hover { background: ${p.bgSecondary}; }
.mr-row td { border-bottom: 1px solid ${p.borderTertiary}; }
.mr-pulse-dot {
  animation: mrPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(214, 69, 69, 0.55);
}

@keyframes mrFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes mrFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes mrSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
@keyframes mrBarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes mrDrawLine { to { stroke-dashoffset: 0; } }
@keyframes mrPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(214, 69, 69, 0.55); }
  50%      { box-shadow: 0 0 0 8px rgba(214, 69, 69, 0); }
}

@media (max-width: 1023px) {
  .mr-main-grid { grid-template-columns: 1fr !important; }
  .mr-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
}
@media (max-width: 639px) {
  .mr-metrics-grid { grid-template-columns: 1fr !important; }
}

@media print {
  .mr-card { animation: none !important; opacity: 1 !important; transform: none !important; box-shadow: none !important; }
  .mr-bar-fill { animation: none !important; transform: scaleX(1) !important; }
  .mr-chart-line { animation: none !important; stroke-dashoffset: 0 !important; }
  .mr-chart-area, .mr-donut-seg { animation: none !important; opacity: 1 !important; }
  .mr-threat, .mr-ai-rec, .mr-chart-wrap, .mr-bar-row { animation: none !important; opacity: 1 !important; transform: none !important; }
  .mr-pulse-dot { animation: none !important; }
  .mr-header-buttons { display: none !important; }
}
`;
}
