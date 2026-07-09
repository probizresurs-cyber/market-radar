"use client";

/**
 * OwnerDashboardContent — общий tabbed-дашборд руководителя.
 * Используется:
 *   - /owner-dashboard (авторизованный пользователь) — передаётся {mode:"private"}
 *   - /share/[id]       (публичная ссылка, без авторизации) — передаётся {mode:"public"}
 */

import React, { useEffect, useMemo, useState } from "react";
import { BarChart2, Building2, Target, Brain, Map, TrendingUp, Smartphone, Factory, Sun, Moon, Link2, ExternalLink, Zap, Search, Globe, Eye, ListTodo, Star, AlertTriangle, ArrowRight, MessageSquare, Banknote, Users as UsersIcon, Briefcase, Scale, FileText as FileTextIcon, Calendar, Tv } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";
import type { ContentPlan, BrandBook } from "@/lib/content-types";
import { hrefForNav } from "@/lib/products";
import {
  classifyMarketShare,
  classifyCompetitorCounter,
  classifyChartHistory,
} from "@/lib/data-quality";
import { QuickAnalyzeCard } from "./QuickAnalyzeCard";
import { SpywordsBlock } from "../ui/SpywordsBlock";
import { MetricRing, StackedBar } from "../ui/Charts";
import { jsonOrThrow } from "@/lib/safe-fetch-json";

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

type TabId = "overview" | "actions" | "company" | "competitors" | "ta" | "cjm" | "benchmarks" | "smm" | "content" | "ai-visibility" | "reputation" | "finance" | "hr";

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
// UX: hero numbers — 56px (primary metric on screen) или 48px (стандарт).
// Минимум 14px для всех текстов; UPPERCASE label 12px для категорий.
function MetricCard({ p, label, value, valueOverride, change, positive, delayMs, suffix, neonColor, hero }: {
  p: Palette; label: string; value: number; valueOverride?: string; change: string;
  positive: boolean; delayMs: number; suffix?: string; neonColor?: string;
  /** Hero — главная метрика на экране (одна на дашборде, 56px). По умолчанию false (48px). */
  hero?: boolean;
}) {
  const animated = useCountUp(value, 1200, delayMs + 100);
  const neonStyle = neonColor ? {
    border: `1px solid ${neonColor}`,
    boxShadow: `0 0 20px ${neonColor}40, 0 0 40px ${neonColor}20`,
    background: "rgba(13, 14, 24, 0.85)",
  } : {};
  const numberSize = hero ? 56 : 48;
  const suffixSize = hero ? 28 : 24;
  return (
    <div className="mr-card mr-metric" style={{ animationDelay: `${delayMs}ms`, ...neonStyle }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: neonColor ?? p.textTertiary, marginBottom: 14 }}>{label}</div>
      <div style={{ fontSize: numberSize, fontWeight: 800, color: neonColor ?? p.textPrimary, lineHeight: 1, marginBottom: 14, letterSpacing: -1 }}>
        {valueOverride ?? animated}
        {!valueOverride && suffix && <span style={{ fontSize: suffixSize, fontWeight: 700, color: neonColor ? `${neonColor}CC` : p.textTertiary }}>{suffix}</span>}
      </div>
      <div style={{ display: "inline-block", padding: "5px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
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
        <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 14 }}>{centerLabel}</div>
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
  tabs: Array<{ id: TabId; icon: React.ReactNode; label: string; disabled?: boolean }>;
}) {
  return (
    <div style={{
      display: "flex", gap: 6, overflowX: "auto", background: p.bgCard,
      border: `1px solid ${p.borderTertiary}`, borderRadius: 14, padding: 8, marginBottom: 24,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => !t.disabled && onChange(t.id)}
          disabled={t.disabled}
          style={{
            padding: "11px 18px", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: t.disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            background: active === t.id ? p.bgTabActive : "transparent",
            color: t.disabled ? p.textTertiary : active === t.id ? p.primary : p.textSecondary,
            opacity: t.disabled ? 0.5 : 1,
            transition: "background 150ms ease, color 150ms ease",
            display: "inline-flex", alignItems: "center", gap: 8,
            minHeight: 40,
          }}>
          {t.icon}{t.label}
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
    { id: "overview" as const, icon: <BarChart2 size={17} strokeWidth={1.85} />, label: "Обзор" },
    { id: "actions" as const, icon: <ListTodo size={17} strokeWidth={1.85} />, label: "Действия", disabled: !myCompany },
    { id: "reputation" as const, icon: <Star size={17} strokeWidth={1.85} />, label: "Репутация", disabled: !myCompany },
    { id: "finance" as const, icon: <Banknote size={17} strokeWidth={1.85} />, label: "Финансы", disabled: !myCompany },
    { id: "hr" as const, icon: <UsersIcon size={17} strokeWidth={1.85} />, label: "Команда / Найм", disabled: !myCompany },
    { id: "company" as const, icon: <Building2 size={17} strokeWidth={1.85} />, label: "Компания" },
    { id: "competitors" as const, icon: <Target size={17} strokeWidth={1.85} />, label: "Конкуренты", disabled: competitors.length === 0 },
    { id: "ta" as const, icon: <Brain size={17} strokeWidth={1.85} />, label: "Целевая аудитория", disabled: !taAnalysis },
    { id: "cjm" as const, icon: <Map size={17} strokeWidth={1.85} />, label: "CJM", disabled: !cjm },
    { id: "benchmarks" as const, icon: <TrendingUp size={17} strokeWidth={1.85} />, label: "Бенчмарки", disabled: !benchmarks },
    { id: "smm" as const, icon: <Smartphone size={17} strokeWidth={1.85} />, label: "СММ", disabled: !smmAnalysis },
    { id: "content" as const, icon: <Factory size={17} strokeWidth={1.85} />, label: "Контент", disabled: !content?.plan },
    { id: "ai-visibility" as const, icon: <Zap size={17} strokeWidth={1.85} />, label: "ИИ-видимость", disabled: !myCompany },
  ], [competitors.length, taAnalysis, smmAnalysis, content?.plan, cjm, benchmarks, myCompany]);

  // ─── Metrics ────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const myScore = myCompany?.company.score ?? 0;
    const avgCompScore = competitors.length > 0
      ? Math.round(competitors.reduce((s, c) => s + c.company.score, 0) / competitors.length)
      : 0;
    const shareInfo = classifyMarketShare(myScore, avgCompScore, competitors.length);
    // AI-suggested competitor names from Keys.so (per-engine arrays merged).
    const yandexAiNames = myCompany?.keysoDashboard?.yandex?.competitors ?? [];
    const googleAiNames = myCompany?.keysoDashboard?.google?.competitors ?? [];
    const aiSuggestedNames = Array.from(new Set([...yandexAiNames, ...googleAiNames]));
    const competitorCounter = classifyCompetitorCounter(
      competitors.length,
      aiSuggestedNames,
    );
    const threats = buildThreats(myCompany, competitors);
    const activeThreats = threats.filter(t => t.level === "critical" || t.level === "warning").length;
    return {
      competitors: competitors.length,
      competitorCounter,
      threats: activeThreats,
      marketShare: shareInfo.numeric,         // for charts (fractional ok)
      marketShareDisplay: shareInfo.display,  // "<1%", "12%"
      marketCategory: shareInfo.categoryLabel, // "Микро-игрок"
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
  // Score-history is collected by the monitoring cron (`/api/cron/refresh-scores`)
  // and stored on AnalysisResult.scoreHistory. We only render the chart when
  // there's at least 2 months of real data — otherwise show a placeholder.
  // Mocking 6 months out of a single point made the chart show data from
  // before the domain was even registered. See classifyChartHistory.
  const chartStatus = useMemo(() => {
    return classifyChartHistory(myCompany?.scoreHistory);
  }, [myCompany?.scoreHistory]);

  const trendSeries = useMemo(() => {
    if (!myCompany || !chartStatus.hasEnoughHistory) return [];
    const points = (myCompany.scoreHistory ?? []).map((h) => h.score);
    const series: Array<{ name: string; color: string; points: number[]; dashed?: boolean }> = [];
    if (points.length > 0) {
      series.push({
        name: myCompany.company.name,
        color: p.primary,
        points,
      });
    }
    return series;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCompany?.scoreHistory, theme, chartStatus.hasEnoughHistory]);

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
      const j = await jsonOrThrow(r);
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
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><BarChart2 size={36} strokeWidth={1.5} color={p.textTertiary} /></div>
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
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Target size={20} strokeWidth={2} /></div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.textPrimary, lineHeight: 1.2 }}>
                  {myCompany.company.name}
                </div>
                <div style={{ fontSize: 14, color: p.textSecondary, marginTop: 2 }}>
                  Конкурентная разведка · {period}{mode === "public" && " · публичная ссылка"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} className="mr-header-buttons">
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
                style={{ padding: "10px 14px", background: p.bgCard, border: `1px solid ${p.borderTertiary}`, borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                {theme === "dark" ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
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
                  {sharing ? "Создаём…" : <><Link2 size={14} strokeWidth={2} style={{ marginRight: 6 }} />Поделиться ссылкой</>}
                </button>
              )}
              {mode === "private" && (
                <a href="/owner-dashboard?tv=1" target="_blank" rel="noopener noreferrer"
                  title="Полноэкранное табло для показа на ТВ (листается как презентация)"
                  style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: p.textSecondary,
                    border: `1px solid ${p.borderTertiary}`, borderRadius: 8, textDecoration: "none", background: p.bgCard,
                    display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Tv size={14} strokeWidth={2} /> ТВ-режим
                </a>
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
              <Link2 size={18} strokeWidth={1.75} color={p.primary} />
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

          {/* Quick-analyze: руководитель может прогнать любой URL без перехода в основное приложение */}
          {mode === "private" && (
            <QuickAnalyzeCard
              paletteVars={{
                bgCard: p.bgCard,
                bgSecondary: p.bgSecondary,
                textPrimary: p.textPrimary,
                textSecondary: p.textSecondary,
                textTertiary: p.textTertiary,
                borderTertiary: p.borderTertiary,
                primary: p.primary,
                primaryHover: p.primary,
                red: p.red,
                redBg: p.redBg,
                green: p.green,
              }}
              onOpenFullDashboard={() => { window.location.href = "/"; }}
            />
          )}

          {/* Tab bar */}
          <TabBar
            p={p}
            active={activeTab}
            onChange={(id) => {
              // ВСЕ табы остаются внутренними — показывают мини-сводку
              // прямо на дашборде руководителя.
              //
              // Переход в полный модуль app делается явно — через карточки
               // «Модули анализа» сверху или через кнопку «Открыть полный
              // отчёт» (target=_blank) рядом с активным табом.
              //
              // Раньше эти модульные табы (ta/smm/cjm/...) автоматически
              // редиректили в /?nav=... — это было ошибкой UX: юзер хотел
              // увидеть сводку, а его выкидывало с дашборда руководителя.
              setActiveTab(id);
            }}
            tabs={tabs}
          />

          {/* Ссылка "Открыть полный отчёт на платформе" (только в приватном режиме, для релевантных вкладок) */}
          {mode === "private" && activeTab !== "overview" && (() => {
            const navMap: Record<Exclude<TabId, "overview">, { nav: string; label: string }> = {
              actions: { nav: "insights", label: "AI-инсайты" },
              reputation: { nav: "reviews-analysis", label: "Отзывы и репутация" },
              finance: { nav: "dashboard", label: "Финансы компании" },
              hr: { nav: "dashboard", label: "Команда и найм" },
              company: { nav: "dashboard", label: "Дашборд компании" },
              competitors: { nav: "compare", label: "Сравнение конкурентов" },
              ta: { nav: "ta-dashboard", label: "Дашборд ЦА" },
              cjm: { nav: "ta-cjm", label: "Customer Journey Map" },
              benchmarks: { nav: "ta-benchmarks", label: "Отраслевые бенчмарки" },
              smm: { nav: "smm-dashboard", label: "Дашборд СММ" },
              content: { nav: "content-plan", label: "План контента" },
              "ai-visibility": { nav: "ai-visibility", label: "AI Видимость" },
            };
            const target = navMap[activeTab as Exclude<TabId, "overview">];
            if (!target) return null;
            return (
              <div style={{ margin: "14px 0 8px", display: "flex", justifyContent: "flex-end" }}>
                <a
                  href={hrefForNav(target.nav)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", fontSize: 12, fontWeight: 600,
                    color: p.primary, background: p.bgCard,
                    border: `1px solid ${p.primary}`, borderRadius: 8,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={13} strokeWidth={2} />
                  Открыть полный отчёт на платформе: {target.label}
                </a>
              </div>
            );
          })()}

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && (
            <>
              {/* Сводка по модулям анализа — общая картина «что готово» */}
              {(() => {
                const modules = [
                  { key: "ta", label: "Целевая аудитория", ready: !!data.ta, value: data.ta?.segments?.length, unit: "сегментов", nav: "ta-dashboard" },
                  { key: "smm", label: "СММ-стратегия", ready: !!data.smm, value: data.smm?.platformStrategies?.length, unit: "платформ", nav: "smm-dashboard" },
                  { key: "cjm", label: "Customer Journey", ready: !!data.cjm, value: data.cjm?.stages?.length, unit: "этапов", nav: "ta-cjm" },
                  { key: "benchmarks", label: "Бенчмарки ниши", ready: !!data.benchmarks, value: undefined, unit: "", nav: "ta-benchmarks" },
                  { key: "content", label: "Контент-завод", ready: !!(data.content?.plan), value: (data.content?.plan?.postIdeas?.length ?? 0) + (data.content?.plan?.reelIdeas?.length ?? 0), unit: "идей", nav: "content-plan" },
                  { key: "brandbook", label: "Брендбук", ready: !!(data.brandbook?.brandName), value: undefined, unit: "", nav: "ta-brandbook" },
                ];
                const ready = modules.filter(m => m.ready).length;
                return (
                  <div className="mr-card" style={{ padding: "16px 20px", marginBottom: 20, animationDelay: "50ms" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.08em", marginBottom: 4 }}>
                          МОДУЛИ АНАЛИЗА
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: p.textPrimary }}>
                          {ready} из {modules.length} {ready === 1 ? "модуль готов" : ready < 5 ? "модуля готовы" : "модулей готово"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 140, height: 6, background: p.bgSecondary, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            width: `${(ready / modules.length) * 100}%`,
                            height: "100%", background: p.green,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: p.green }}>{Math.round((ready / modules.length) * 100)}%</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                      {modules.map(m => (
                        <a
                          key={m.key}
                          href={mode === "private" ? hrefForNav(m.nav) : undefined}
                          style={{
                            padding: "10px 12px", borderRadius: 9,
                            background: m.ready ? `${p.green}10` : p.bgSecondary,
                            border: `1px solid ${m.ready ? p.green + "30" : p.borderTertiary}`,
                            display: "block", textDecoration: "none",
                            cursor: mode === "private" ? "pointer" : "default",
                            transition: "transform 0.12s",
                          }}
                          onMouseEnter={e => { if (mode === "private") (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.ready ? p.green : p.textTertiary, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: m.ready ? p.textPrimary : p.textTertiary }}>{m.label}</span>
                          </div>
                          {m.ready && m.value !== undefined && (
                            <div style={{ fontSize: 11, color: p.textSecondary, marginLeft: 14 }}>
                              {m.value} {m.unit}
                            </div>
                          )}
                          {!m.ready && (
                            <div style={{ fontSize: 11, color: p.textTertiary, marginLeft: 14 }}>не запущен</div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Metrics — карточки конкурентов/угроз/доли/балла идут СВЕРХУ
                  (главные индикаторы дашборда руководителя). */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }} className="mr-metrics-grid">
                <MetricCard
                  p={p}
                  label="Конкуренты"
                  value={metrics.competitors}
                  change={metrics.competitorCounter.hint
                    ?? (metrics.competitors > 0 ? `${metrics.competitors} отслеживаются` : "нет")}
                  positive
                  delayMs={100}
                  neonColor="#4FC3F7"
                />
                <MetricCard p={p} label="Угрозы" value={metrics.threats} change={metrics.threats > 0 ? `${metrics.threats} активных` : "всё спокойно"} positive={metrics.threats === 0} delayMs={250} neonColor="#FF5252" />
                <MetricCard
                  p={p}
                  label="Ваша доля"
                  valueOverride={metrics.marketShareDisplay}
                  value={metrics.marketShare}
                  change={metrics.marketCategory}
                  positive
                  delayMs={400}
                  neonColor="#69FF47"
                />
                <MetricCard p={p} label="Ваш балл" value={metrics.score} change={`из 100`} positive delayMs={550} neonColor="#D500F9" hero />
              </div>

              {/* Keys.so расширенная SEO-сводка — позиции, видимость, DR,
                  ссылочный профиль, конкуренты. Раньше было 4 ячейки —
                  теперь полный обзор для руководителя. */}
              {(myCompany.keysoDashboard?.yandex || myCompany.keysoDashboard?.google) && (() => {
                const y = myCompany.keysoDashboard?.yandex;
                const g = myCompany.keysoDashboard?.google;
                // Все суммы — Яндекс + Google
                const totalTop50 = (y?.top50 ?? 0) + (g?.top50 ?? 0);
                const totalTop10 = (y?.top10 ?? 0) + (g?.top10 ?? 0);
                const totalTop5 = (y?.top5 ?? 0) + (g?.top5 ?? 0);
                const totalTop3 = (y?.top3 ?? 0) + (g?.top3 ?? 0);
                const totalTop1 = (y?.top1 ?? 0) + (g?.top1 ?? 0);
                const totalTraffic = (y?.traffic ?? 0) + (g?.traffic ?? 0);
                const totalAdKeys = (y?.adKeys ?? 0) + (g?.adKeys ?? 0);
                // Для ссылок и DR берём данные с Яндекса (они идут с одного
                // и того же домена независимо от ПС).
                const linkSource = y ?? g;
                // Конкуренты — объединяем оба ПС с дедупом
                const allCompetitors = Array.from(
                  new Set([...(y?.competitors ?? []), ...(g?.competitors ?? [])])
                ).slice(0, 8);

                return (
                  <div className="mr-card" style={{ padding: "18px 20px", marginBottom: 20, animationDelay: "600ms" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: `${p.primary}18`, color: p.primary,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Search size={15} strokeWidth={2.2} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: p.textPrimary }}>
                          SEO-данные Keys.so
                        </div>
                        <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 1 }}>
                          Реальные данные по {y && g ? "Яндекс + Google" : y ? "Яндекс" : "Google"} ·
                          {" "}{totalTop50.toLocaleString("ru-RU")} ключей в выдаче
                        </div>
                      </div>
                    </div>

                    {/* 4 кольца сверху — основные показатели */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                      gap: 12, padding: "14px 0", marginBottom: 16,
                      borderBottom: `1px solid ${p.borderSecondary}`,
                    }}>
                      {(linkSource?.dr ?? 0) > 0 && (
                        <MetricRing value={linkSource!.dr!} label="Domain Rating" />
                      )}
                      {(linkSource?.visibility ?? 0) > 0 && (
                        <MetricRing value={linkSource!.visibility!} label="Видимость" />
                      )}
                      <MetricRing value={totalTop10} max={Math.max(100, totalTop10)} label="Ключей в ТОП-10" color="#0cce6b" />
                      {totalAdKeys > 0 && (
                        <MetricRing value={totalAdKeys} max={Math.max(50, totalAdKeys)} label="Рекл. запросов" color="#f59e0b" />
                      )}
                    </div>

                    {/* Stacked-bar распределения по позициям */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.05em", marginBottom: 10 }}>
                        РАСПРЕДЕЛЕНИЕ КЛЮЧЕЙ ПО ПОЗИЦИЯМ
                      </div>
                      <StackedBar segments={[
                        { label: "ТОП-1", value: totalTop1, color: "#16a34a" },
                        { label: "ТОП-2-3", value: Math.max(0, totalTop3 - totalTop1), color: "#0cce6b" },
                        { label: "ТОП-4-5", value: Math.max(0, totalTop5 - totalTop3), color: "#3b82f6" },
                        { label: "ТОП-6-10", value: Math.max(0, totalTop10 - totalTop5), color: "#6366f1" },
                        { label: "ТОП-11-50", value: Math.max(0, totalTop50 - totalTop10), color: "#9ca3af" },
                      ].filter(s => s.value > 0)} />
                    </div>

                    {/* Ссылочный профиль + AI-mentions */}
                    {linkSource && (linkSource.backlinks || linkSource.referringDomains || linkSource.aiMentions) && (
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 10, marginBottom: 16,
                      }}>
                        {linkSource.backlinks ? (
                          <div style={{ padding: "10px 14px", background: p.bgSecondary, borderRadius: 9 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.04em" }}>ВХОДЯЩИХ ССЫЛОК</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: p.textPrimary, marginTop: 4 }}>
                              {linkSource.backlinks.toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ) : null}
                        {linkSource.referringDomains ? (
                          <div style={{ padding: "10px 14px", background: p.bgSecondary, borderRadius: 9 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.04em" }}>ССЫЛАЮЩИХСЯ ДОМЕНОВ</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: p.textPrimary, marginTop: 4 }}>
                              {linkSource.referringDomains.toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ) : null}
                        {linkSource.outboundLinks ? (
                          <div style={{ padding: "10px 14px", background: p.bgSecondary, borderRadius: 9 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.04em" }}>ИСХОДЯЩИХ ССЫЛОК</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: p.textPrimary, marginTop: 4 }}>
                              {linkSource.outboundLinks.toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ) : null}
                        {linkSource.pagesInOrganic ? (
                          <div style={{ padding: "10px 14px", background: p.bgSecondary, borderRadius: 9 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.04em" }}>СТРАНИЦ В ВЫДАЧЕ</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: p.textPrimary, marginTop: 4 }}>
                              {linkSource.pagesInOrganic.toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ) : null}
                        {linkSource.aiMentions ? (
                          <div style={{ padding: "10px 14px", background: `${p.primary}10`, borderRadius: 9, border: `1px solid ${p.primary}30` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.primary, letterSpacing: "0.04em" }}>УПОМИНАНИЙ В АЛИСЕ</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: p.primary, marginTop: 4 }}>
                              {linkSource.aiMentions.toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ) : null}
                        {totalTraffic ? (
                          <div style={{ padding: "10px 14px", background: p.bgSecondary, borderRadius: 9 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.04em" }}>ТРАФИК / ДЕНЬ</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: p.green, marginTop: 4 }}>
                              {totalTraffic.toLocaleString("ru-RU")}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Топ-конкуренты по органике (из Keys.so) */}
                    {allCompetitors.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.05em", marginBottom: 10 }}>
                          ТОП-КОНКУРЕНТЫ В ОРГАНИКЕ
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {allCompetitors.map((c, i) => (
                            <span key={c} style={{
                              padding: "4px 10px",
                              background: i === 0 ? `${p.primary}20` : p.bgSecondary,
                              border: `1px solid ${i === 0 ? p.primary + "50" : p.borderSecondary}`,
                              borderRadius: 6, fontSize: 12, fontWeight: 600,
                              color: i === 0 ? p.primary : p.textSecondary,
                            }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Раздельные показатели Яндекс / Google */}
                    {(y && g) && (
                      <div style={{ marginTop: 8, padding: "9px 14px", background: p.bgSecondary, borderRadius: 8, fontSize: 12, color: p.textSecondary }}>
                        <b style={{ color: "#FF5500" }}>Яндекс</b>: {y.top10?.toLocaleString("ru-RU") ?? 0} в ТОП-10, трафик {y.traffic?.toLocaleString("ru-RU") ?? 0}
                        {" · "}
                        <b style={{ color: "#4285F4" }}>Google</b>: {g.top10?.toLocaleString("ru-RU") ?? 0} в ТОП-10, трафик {g.traffic?.toLocaleString("ru-RU") ?? 0}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SpyWords — дополнение к Keys.so: реклама, бюджеты, SEO-конкуренты.
                  Показываем только если SPYWORDS_LOGIN/TOKEN заданы и API вернул данные. */}
              {myCompany.spywordsDashboard && (
                <div className="mr-card" style={{ padding: "18px 20px", marginBottom: 20, animationDelay: "650ms" }}>
                  <SpywordsBlock data={myCompany.spywordsDashboard} />
                </div>
              )}

              {/* Main 2-col */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }} className="mr-main-grid">
                <div className="mr-card" style={{ padding: 28, animationDelay: "600ms" }}>
                  <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Конкурентный ландшафт</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {bars.map((b, i) => (
                      <CompetitorBar key={i} p={p} name={b.name} score={b.score} status={b.status} delayMs={800 + i * 150} />
                    ))}
                  </div>

                  <div className="mr-chart-wrap" style={{ marginTop: 28, animationDelay: "1000ms" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary, marginBottom: 12 }}>Динамика позиций</div>
                    {chartStatus.hasEnoughHistory && trendSeries.length > 0 ? (
                      <TrendChart p={p} series={trendSeries} />
                    ) : (
                      <div style={{
                        padding: "32px 20px",
                        background: p.bgSecondary,
                        borderRadius: 12,
                        border: `1px dashed ${p.borderSecondary}`,
                        textAlign: "center",
                        color: p.textTertiary,
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.55 }}>📈</div>
                        <div style={{ fontWeight: 600, color: p.textSecondary, marginBottom: 4 }}>
                          Собираем данные мониторинга
                        </div>
                        <div>
                          {chartStatus.placeholder ?? "График появится через 4–6 недель."}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ключевые инсайты — закрывают пустое место под графиком */}
                  {keyInsights.length > 0 && (
                    <div className="mr-chart-wrap" style={{ marginTop: 28, animationDelay: "1100ms" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary, marginBottom: 12 }}>Ключевые инсайты</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        {keyInsights.map((ins, i) => (
                          <div key={i} className="mr-ai-rec" style={{ animationDelay: `${1150 + i * 120}ms`, padding: 14, background: p.bgSecondary, borderRadius: 10, borderLeft: `3px solid ${insightColor(p, ins.type)}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: insightColor(p, ins.type), marginBottom: 6 }}>
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
                      <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary }}>Угрозы и возможности</div>
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
                      <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Рекомендации AI</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {aiRecs.map((r, i) => (
                          <div key={i} className="mr-ai-rec" style={{ animationDelay: `${1600 + i * 150}ms` }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: p.green, minWidth: 20 }}>{i + 1}.</div>
                              <div style={{ flex: 1, fontSize: 14, color: p.textPrimary, lineHeight: 1.45 }}>
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
                  <div className="mr-card" style={{ padding: 28, animationDelay: "1700ms" }}>
                    <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 16 }}>Распределение рынка</div>
                    <DonutChart p={p} segments={marketDonut}
                      centerLabel="Ваша доля"
                      centerValue={metrics.marketShareDisplay} />
                  </div>
                  <div className="mr-card" style={{ padding: 28, animationDelay: "1800ms" }}>
                    <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 16 }}>Прогноз ниши</div>
                    <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 12 }}>{myCompany.nicheForecast?.forecast}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 12, background: p.bgSecondary, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: p.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
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
                        <div style={{ fontSize: 12, fontWeight: 700, color: p.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
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

          {/* ═══ AI-VISIBILITY TAB ═══ */}
          {activeTab === "ai-visibility" && myCompany && (
            <AIVisibilityTab p={p} data={myCompany} competitors={competitors} />
          )}

          {/* ═══ ACTIONS TAB ═══ */}
          {activeTab === "actions" && myCompany && (
            <ActionsTab p={p} data={myCompany} competitors={competitors} threats={threats} aiRecs={aiRecs} />
          )}

          {/* ═══ REPUTATION TAB ═══ */}
          {activeTab === "reputation" && myCompany && (
            <ReputationTab p={p} data={myCompany} competitors={competitors} />
          )}

          {/* ═══ FINANCE TAB ═══ */}
          {activeTab === "finance" && myCompany && (
            <FinanceTab p={p} data={myCompany} competitors={competitors} />
          )}

          {/* ═══ HR TAB ═══ */}
          {activeTab === "hr" && myCompany && (
            <HRTab p={p} data={myCompany} competitors={competitors} />
          )}

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
  const kwCount = data.seo?.keywords?.length ?? 0;
  const vkSubs = data.social?.vk?.subscribers ?? 0;
  const tgSubs = data.social?.telegram?.subscribers ?? 0;
  const totalFollowers = vkSubs + tgSubs;
  const avgRating = (() => {
    const ratings = [data.social?.yandexRating, data.social?.gisRating].filter(r => r && r > 0) as number[];
    if (ratings.length === 0) return 0;
    return Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Метрики компании */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
        <MetricCard p={p} label="Общий балл" value={data.company.score} change="из 100" positive delayMs={0} neonColor="#7C6BE8" />
        <MetricCard p={p} label="Ключевых слов" value={kwCount} change={kwCount > 0 ? "в SEO-индексе" : "нет данных"} positive={kwCount > 0} delayMs={120} neonColor="#4FC3F7" />
        <MetricCard p={p} label="Подписчики" value={totalFollowers} change={totalFollowers > 0 ? "VK + Telegram" : "нет соцсетей"} positive={totalFollowers > 0} delayMs={240} neonColor="#69FF47" />
        <MetricCard p={p} label="Рейтинг" valueOverride={avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : "—"} value={avgRating * 20} change={avgRating > 0 ? "на картах" : "нет данных"} positive={avgRating >= 4} delayMs={360} neonColor="#FBBF24" />
      </div>

      {/* Категории */}
      <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Оценка по категориям</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "400ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>SEO и сайт</div>
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

        <div className="mr-card" style={{ padding: 28, animationDelay: "500ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Присутствие</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "600ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Брендбук</div>
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
    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${p.borderTertiary}`, fontSize: 15 }}>
      <span style={{ color: p.textSecondary }}>{k}</span>
      <span style={{ fontWeight: 700, color: p.textPrimary, textAlign: "right" }}>{v}</span>
    </div>
  );
}

// ─── CompetitorsTab ───────────────────────────────────────────────────────
function CompetitorsTab({ p, myCompany, competitors }: { p: Palette; myCompany: AnalysisResult; competitors: AnalysisResult[] }) {
  const myScore = myCompany.company.score;
  const bestScore = competitors.length > 0 ? Math.max(...competitors.map(c => c.company.score)) : 0;
  const avgScore = competitors.length > 0
    ? Math.round(competitors.reduce((s, c) => s + c.company.score, 0) / competitors.length)
    : 0;
  const gap = myScore - avgScore;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Метрики конкурентов */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
        <MetricCard p={p} label="Конкурентов" value={competitors.length} change="отслеживается" positive delayMs={0} neonColor="#4FC3F7" />
        <MetricCard p={p} label="Ваш балл" value={myScore} change="из 100" positive delayMs={120} neonColor="#7C6BE8" />
        <MetricCard p={p} label="Сильнейший" value={bestScore} change={bestScore > myScore ? "обгоняет вас" : "вы впереди"} positive={bestScore <= myScore} delayMs={240} neonColor={bestScore > myScore ? "#F87171" : "#69FF47"} />
        <MetricCard p={p} label="Разрыв" valueOverride={gap >= 0 ? `+${gap}` : `${gap}`} value={Math.abs(gap)} change={gap >= 0 ? "вы выше среднего" : "ниже среднего"} positive={gap >= 0} delayMs={360} neonColor={gap >= 0 ? "#69FF47" : "#F87171"} />
      </div>

      {/* Score comparison bar chart */}
      <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Сравнение балла</div>
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
      <div className="mr-card" style={{ padding: 28, animationDelay: "600ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Детальная таблица</div>
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
  const segments = data.segments ?? [];
  const goldenCount = segments.filter(s => s.isGolden).length;
  const totalPains = segments.reduce((s, seg) => s + (seg.mainProblems?.length ?? 0), 0);
  const totalObjections = segments.reduce((s, seg) => s + (seg.topObjections?.length ?? 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Метрики ЦА */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
        <MetricCard p={p} label="Сегментов ЦА" value={segments.length} change="выявлено" positive delayMs={0} neonColor="#7C6BE8" />
        <MetricCard p={p} label="Золотых клиентов" value={goldenCount} change="приоритетных" positive={goldenCount > 0} delayMs={120} neonColor="#FBBF24" />
        <MetricCard p={p} label="Болей" value={totalPains} change="задокументировано" positive delayMs={240} neonColor="#F87171" />
        <MetricCard p={p} label="Возражений" value={totalObjections} change="для отработки" positive delayMs={360} neonColor="#4FC3F7" />
      </div>

      <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 10 }}>Целевая аудитория</div>
        <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 16 }}>{data.summary}</div>
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
              <div style={{ fontSize: 14, color: p.textPrimary, lineHeight: 1.5, marginBottom: 12 }}>{seg.worldview.shortDescription}</div>
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
  const platforms = data.platformStrategies?.length ?? 0;
  const quickWins = data.quickWins?.length ?? 0;
  const tovTraits = data.brandIdentity?.toneOfVoice?.length ?? 0;
  const archetype = data.brandIdentity?.archetype ?? "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Метрики СММ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
        <MetricCard p={p} label="Платформ" value={platforms} change="в стратегии" positive={platforms > 0} delayMs={0} neonColor="#7C6BE8" />
        <MetricCard p={p} label="Quick Wins" value={quickWins} change="быстрых побед" positive={quickWins > 0} delayMs={120} neonColor="#69FF47" />
        <MetricCard p={p} label="ToV-черты" value={tovTraits} change="тона голоса" positive={tovTraits > 0} delayMs={240} neonColor="#4FC3F7" />
        <MetricCard p={p} label="Архетип" valueOverride={archetype !== "—" ? archetype.slice(0, 14) : "—"} value={0} change={archetype !== "—" ? "бренд-архетип" : "не определён"} positive={archetype !== "—"} delayMs={360} neonColor="#FBBF24" />
      </div>

      <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 10 }}>Архетип бренда</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "200ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Стратегии по платформам</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "300ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Quick wins</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: p.textPrimary, lineHeight: 1.8 }}>
            {data.quickWins.slice(0, 5).map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── ContentTab ───────────────────────────────────────────────────────────
function ContentTab({ p, plan }: { p: Palette; plan: ContentPlan }) {
  const pillarsCount = plan.pillars?.length ?? 0;
  const postIdeasCount = plan.postIdeas?.length ?? 0;
  const calendarCount = plan.thirtyDayCalendar?.length ?? 0;
  const reelIdeasCount = plan.reelIdeas?.length ?? 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Метрики контента */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
        <MetricCard p={p} label="Контент-столпы" value={pillarsCount} change="темы контента" positive={pillarsCount > 0} delayMs={0} neonColor="#7C6BE8" />
        <MetricCard p={p} label="Идей постов" value={postIdeasCount} change="в плане" positive={postIdeasCount > 0} delayMs={120} neonColor="#4FC3F7" />
        <MetricCard p={p} label="Идей рилс" value={reelIdeasCount} change="сценариев" positive={reelIdeasCount > 0} delayMs={240} neonColor="#EC4899" />
        <MetricCard p={p} label="Дней плана" value={calendarCount} change="контент-календарь" positive={calendarCount > 0} delayMs={360} neonColor="#69FF47" />
      </div>

      <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 10 }}>Большая идея</div>
        <div style={{ fontSize: 15, color: p.textPrimary, lineHeight: 1.5, fontStyle: "italic" }}>{plan.bigIdea}</div>
      </div>
      {plan.pillars && plan.pillars.length > 0 && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "200ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Контент-столпы</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "300ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Идеи постов</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: p.textPrimary, lineHeight: 1.8 }}>
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
      <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 8 }}>Customer Journey Map</div>
        <div style={{ fontSize: 14, color: p.textSecondary }}>
          Путь клиента от осознания до лояльности · {data.stages.length} этапов
          {data.generatedAt && (
            <> · Актуализировано: {new Date(data.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.stages.map((st, i) => (
          <div key={i} className="mr-card" style={{ padding: 20, animationDelay: `${200 + i * 100}ms`, borderLeft: `4px solid ${valenceColor(st.emotionValence)}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{st.emoji}</div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary }}>{st.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: p.bgSecondary, color: p.textTertiary }}>{st.duration}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${valenceColor(st.emotionValence)}22`, color: valenceColor(st.emotionValence) }}>
                    {st.emotion}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 10 }}><strong>Цель:</strong> {st.goal}</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary }}>
              Позиция в нише «{data.niche}»
            </div>
            {data.generatedAt && (
              <div style={{ fontSize: 12, color: p.textTertiary }}>
                Актуализировано: {new Date(data.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "600ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Бенчмарки по категориям</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "700ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Рыночные метрики</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Метрика", "Среднее по нише", "Топ-игроки", "Ваша оценка"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: p.textTertiary, borderBottom: `1px solid ${p.borderTertiary}` }}>{h}</th>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "800ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>Возможности роста</div>
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
        <div className="mr-card" style={{ padding: 28, animationDelay: "900ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 14 }}>Инсайты по нише</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: p.textPrimary, lineHeight: 1.8 }}>
            {data.nicheInsights.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── ActionsTab ───────────────────────────────────────────────────────────
// "Что делать сегодня" — приоритетный список действий руководителю.
// Объединяет угрозы (buildThreats), AI-рекомендации (myCompany.recommendations),
// возможности из niche forecast и quick wins из СММ-стратегии.
function ActionsTab({ p, data, competitors, threats, aiRecs }: {
  p: Palette;
  data: AnalysisResult;
  competitors: AnalysisResult[];
  threats: Threat[];
  aiRecs: Array<{ text: string; effect?: string }>;
}) {
  // Категоризируем все возможные действия в один приоритезированный список.
  type Priority = "critical" | "warning" | "opportunity" | "growth";
  interface ActionItem {
    priority: Priority;
    title: string;
    description: string;
    effect?: string;
    source: string;
  }

  const items: ActionItem[] = [];

  // 1) Угрозы из threats (critical / warning)
  threats.forEach(t => {
    if (t.level === "critical" || t.level === "warning") {
      items.push({
        priority: t.level,
        title: t.title,
        description: t.description,
        source: "Угрозы",
      });
    } else if (t.level === "opportunity") {
      items.push({
        priority: "opportunity",
        title: t.title,
        description: t.description,
        source: "Возможности",
      });
    }
  });

  // 2) AI-рекомендации
  aiRecs.forEach(r => {
    items.push({
      priority: "growth",
      title: r.text.length > 60 ? r.text.slice(0, 60) + "…" : r.text,
      description: r.text,
      effect: r.effect,
      source: "AI-рекомендации",
    });
  });

  // 3) Если есть прогноз ниши с возможностями — добавим
  const opportunities = data.nicheForecast?.opportunities ?? [];
  opportunities.slice(0, 3).forEach(o => {
    items.push({
      priority: "opportunity",
      title: "Рыночная возможность",
      description: o,
      source: "Прогноз ниши",
    });
  });

  // Сортируем по приоритету
  const order: Record<Priority, number> = { critical: 0, warning: 1, growth: 2, opportunity: 3 };
  items.sort((a, b) => order[a.priority] - order[b.priority]);

  const priorityMeta = (pr: Priority): { label: string; color: string; bg: string; icon: React.ReactNode } => {
    switch (pr) {
      case "critical":    return { label: "Срочно",       color: p.red,    bg: p.redBg,    icon: <AlertTriangle size={18} strokeWidth={2.2} /> };
      case "warning":     return { label: "В этом месяце", color: p.orange, bg: p.orangeBg, icon: <AlertTriangle size={18} strokeWidth={2.2} /> };
      case "growth":      return { label: "Для роста",    color: p.primary, bg: p.bgTabActive, icon: <TrendingUp size={18} strokeWidth={2.2} /> };
      case "opportunity": return { label: "Возможность",  color: p.green,  bg: p.greenBg,  icon: <Star size={18} strokeWidth={2.2} /> };
    }
  };

  // KPI наверху
  const critical = items.filter(i => i.priority === "critical").length;
  const warning = items.filter(i => i.priority === "warning").length;
  const opportunity = items.filter(i => i.priority === "opportunity").length;
  const growthCount = items.filter(i => i.priority === "growth").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero — общее число дел */}
      <div className="mr-card" style={{ padding: 32, animationDelay: "0ms" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: p.textTertiary, marginBottom: 14 }}>Список действий на этот месяц</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: p.textPrimary, lineHeight: 1, letterSpacing: -1.5 }}>
            {items.length}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: p.textSecondary }}>
            {items.length === 0 ? "всё сделано — компания в порядке" : "приоритетов в фокусе"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {critical > 0 && <KPIPill p={p} count={critical} label="срочно" color={p.red} bg={p.redBg} />}
          {warning > 0 && <KPIPill p={p} count={warning} label="в работе" color={p.orange} bg={p.orangeBg} />}
          {growthCount > 0 && <KPIPill p={p} count={growthCount} label="для роста" color={p.primary} bg={p.bgTabActive} />}
          {opportunity > 0 && <KPIPill p={p} count={opportunity} label="возможностей" color={p.green} bg={p.greenBg} />}
        </div>
      </div>

      {/* Список дел */}
      {items.length === 0 ? (
        <div className="mr-card" style={{ padding: 48, textAlign: "center", animationDelay: "100ms" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 8 }}>Всё под контролем</div>
          <div style={{ fontSize: 15, color: p.textSecondary, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
            На текущем анализе критичных задач не найдено. Запустите повторный анализ через
            месяц — по мере изменения рынка появятся новые приоритеты.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((item, i) => {
            const meta = priorityMeta(item.priority);
            return (
              <div key={i} className="mr-card" style={{
                padding: 24,
                animationDelay: `${i * 80}ms`,
                borderLeft: `4px solid ${meta.color}`,
              }}>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: meta.bg, color: meta.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
                        padding: "3px 10px", borderRadius: 6,
                        background: meta.bg, color: meta.color,
                      }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 12, color: p.textTertiary }}>· {item.source}</span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: p.textPrimary, marginBottom: 6, lineHeight: 1.35 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 15, color: p.textSecondary, lineHeight: 1.55 }}>
                      {item.description}
                    </div>
                    {item.effect && (
                      <div style={{
                        marginTop: 12, padding: "10px 14px", borderRadius: 10,
                        background: p.bgSecondary, fontSize: 14, color: p.textPrimary,
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <ArrowRight size={15} style={{ color: p.green, flexShrink: 0 }} />
                        <span><strong style={{ color: p.green }}>Эффект:</strong> {item.effect}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="mr-card" style={{ padding: 20, background: p.bgSecondary, animationDelay: `${items.length * 80}ms`, fontSize: 14, color: p.textSecondary, lineHeight: 1.55 }}>
        💡 Этот список собирается автоматически на основе угроз, прогноза ниши и AI-рекомендаций.
        После выполнения задач запустите новый анализ — часть пунктов исчезнет, на их место
        придут новые.
        {competitors.length === 0 && (
          <> Добавьте конкурентов на платформе, чтобы получить ещё <strong>5–7 пунктов</strong> на основе сравнительного анализа.</>
        )}
      </div>
    </div>
  );
}

function KPIPill({ p: _p, count, label, color, bg }: { p: Palette; count: number; label: string; color: string; bg: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: 24,
      background: bg, color,
      fontSize: 14, fontWeight: 700,
    }}>
      <span style={{ fontSize: 18, fontWeight: 800 }}>{count}</span>
      {label}
    </div>
  );
}

// ─── ReputationTab ────────────────────────────────────────────────────────
// Объединяет все рейтинги и отзывы в одно окно.
// Hero — сводный рейтинг по картам, дальше — по площадкам, конкурентам и СММ.
function ReputationTab({ p, data, competitors }: {
  p: Palette;
  data: AnalysisResult;
  competitors: AnalysisResult[];
}) {
  const yandex = data.social?.yandexRating ?? 0;
  const yandexReviews = data.social?.yandexReviews ?? 0;
  const gis = data.social?.gisRating ?? 0;
  const gisReviews = data.social?.gisReviews ?? 0;

  // Сводный рейтинг по доступным площадкам
  const ratings = [yandex, gis].filter(r => r > 0);
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
    : 0;
  const totalReviews = yandexReviews + gisReviews;

  // Сравнение с конкурентами
  const compRatings = competitors
    .map(c => {
      const r = [c.social?.yandexRating, c.social?.gisRating].filter(x => x && x > 0) as number[];
      const avg = r.length > 0 ? r.reduce((s, x) => s + x, 0) / r.length : 0;
      return { name: c.company.name, rating: Math.round(avg * 10) / 10, reviews: (c.social?.yandexReviews ?? 0) + (c.social?.gisReviews ?? 0) };
    })
    .filter(c => c.rating > 0)
    .sort((a, b) => b.rating - a.rating);

  const myRank = compRatings.filter(c => c.rating > avgRating).length + 1;
  const totalCompetitors = compRatings.length + 1;

  const ratingColor = (r: number): string => r >= 4.5 ? p.green : r >= 4.0 ? p.primary : r >= 3.5 ? p.orange : p.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero: сводный рейтинг */}
      <div className="mr-card" style={{ padding: 32, animationDelay: "0ms" }}>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: p.textTertiary, marginBottom: 14 }}>
              Сводный рейтинг по картам
            </div>
            {avgRating > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 72, fontWeight: 800, color: ratingColor(avgRating), lineHeight: 1, letterSpacing: -1.5 }}>
                    {avgRating.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: p.textTertiary }}>/ 5</div>
                </div>
                {/* Star bar */}
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star
                      key={n}
                      size={22}
                      strokeWidth={1.5}
                      fill={n <= Math.round(avgRating) ? ratingColor(avgRating) : "transparent"}
                      color={n <= Math.round(avgRating) ? ratingColor(avgRating) : p.borderSecondary}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 15, color: p.textSecondary }}>
                  На основе <strong style={{ color: p.textPrimary }}>{totalReviews.toLocaleString("ru-RU")}</strong> отзывов
                  {compRatings.length > 0 && <> · позиция <strong style={{ color: ratingColor(avgRating) }}>{myRank} из {totalCompetitors}</strong> в нише</>}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 16, color: p.textSecondary, lineHeight: 1.6 }}>
                Рейтинги с карт ещё не собраны. Они подтянутся при следующем анализе.
              </div>
            )}
          </div>
          {avgRating > 0 && (
            <div style={{ flex: "1 1 240px", borderLeft: `1px solid ${p.borderTertiary}`, paddingLeft: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: p.textTertiary, marginBottom: 14 }}>
                Что это значит
              </div>
              <div style={{ fontSize: 16, color: p.textPrimary, lineHeight: 1.55 }}>
                {avgRating >= 4.7 && <>🏆 <strong>Лидер по репутации.</strong> Используйте этот актив в отделе продаж — публикуйте отзывы на сайте и в соцсетях.</>}
                {avgRating >= 4.3 && avgRating < 4.7 && <>👍 <strong>Сильная репутация.</strong> Чтобы стать лидером, активнее просите оставить отзыв довольных клиентов.</>}
                {avgRating >= 3.8 && avgRating < 4.3 && <>⚠️ <strong>Средний уровень.</strong> Проанализируйте негативные отзывы — обычно есть 2-3 повторяющиеся проблемы. Их устранение даст +0.5 балла за месяц.</>}
                {avgRating < 3.8 && <>🔥 <strong>Срочно работать с репутацией.</strong> Низкий рейтинг = потеря 30-50% потенциальных клиентов. Запустите регулярный сбор отзывов и работу с негативом.</>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* По площадкам */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <PlatformReviewCard p={p} icon="🔍" name="Яндекс Карты" rating={yandex} reviews={yandexReviews} delayMs={100} />
        <PlatformReviewCard p={p} icon="🗺️" name="2ГИС" rating={gis} reviews={gisReviews} delayMs={200} />
      </div>

      {/* Сравнение с конкурентами */}
      {compRatings.length > 0 && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "300ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>
            Репутация vs конкуренты
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Моя строка */}
            <RatingRow p={p} name={`${data.company.name} (вы)`} rating={avgRating} reviews={totalReviews} maxRating={5} highlight />
            {compRatings.slice(0, 5).map((c, i) => (
              <RatingRow key={i} p={p} name={c.name} rating={c.rating} reviews={c.reviews} maxRating={5} />
            ))}
          </div>
        </div>
      )}

      {/* CTA — открыть полный модуль */}
      <a
        href={hrefForNav("reviews-analysis")}
        style={{
          display: "block",
          padding: "20px 24px",
          background: p.bgSecondary,
          border: `1px solid ${p.borderTertiary}`,
          borderRadius: 14,
          color: p.textPrimary,
          textDecoration: "none",
          transition: "background 150ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bgTabActive, color: p.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageSquare size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: p.textPrimary, marginBottom: 4 }}>
              Открыть полный модуль отзывов
            </div>
            <div style={{ fontSize: 14, color: p.textSecondary }}>
              AI-анализ тональности, повторяющиеся темы, шаблоны ответов на негатив
            </div>
          </div>
          <ArrowRight size={20} style={{ color: p.primary, flexShrink: 0 }} />
        </div>
      </a>
    </div>
  );
}

function PlatformReviewCard({ p, icon, name, rating, reviews, delayMs }: {
  p: Palette; icon: string; name: string; rating: number; reviews: number; delayMs: number;
}) {
  const ratingColor = rating >= 4.5 ? p.green : rating >= 4.0 ? p.primary : rating >= 3.5 ? p.orange : rating > 0 ? p.red : p.textTertiary;
  return (
    <div className="mr-card" style={{ padding: 24, animationDelay: `${delayMs}ms` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary }}>{name}</span>
      </div>
      {rating > 0 ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: ratingColor, lineHeight: 1 }}>
              {rating.toFixed(1)}
            </span>
            <span style={{ fontSize: 18, color: p.textTertiary, fontWeight: 600 }}>/ 5</span>
          </div>
          <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Star key={n} size={16} fill={n <= Math.round(rating) ? ratingColor : "transparent"} color={n <= Math.round(rating) ? ratingColor : p.borderSecondary} strokeWidth={1.5} />
            ))}
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary }}>
            {reviews.toLocaleString("ru-RU")} {reviews === 1 ? "отзыв" : reviews < 5 ? "отзыва" : "отзывов"}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: p.textTertiary, padding: "20px 0" }}>
          Нет данных по этой площадке
        </div>
      )}
    </div>
  );
}

function RatingRow({ p, name, rating, reviews, maxRating, highlight }: {
  p: Palette; name: string; rating: number; reviews: number; maxRating: number; highlight?: boolean;
}) {
  const color = rating >= 4.5 ? p.green : rating >= 4.0 ? p.primary : rating >= 3.5 ? p.orange : p.red;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: highlight ? 800 : 600, color: highlight ? p.textPrimary : p.textSecondary }}>
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color }}>{rating.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: p.textTertiary }}>· {reviews.toLocaleString("ru-RU")} отз.</span>
        </div>
      </div>
      <div style={{ height: 10, background: p.bgSecondary, borderRadius: 6 }}>
        <div className="mr-bar-fill" style={{
          width: `${(rating / maxRating) * 100}%`, height: "100%",
          background: highlight ? `linear-gradient(90deg, ${color} 0%, ${p.primaryLight} 100%)` : color,
          borderRadius: 6,
        }} />
      </div>
    </div>
  );
}

// ─── FinanceTab ────────────────────────────────────────────────────────────
// Финансово-юридический портрет компании из DaData/Руспрофайл.
// Hero — выручка, плюс блоки: размер бизнеса, юр.информация, госконтракты,
// сравнение с конкурентами по обороту/штату.
function FinanceTab({ p, data, competitors }: {
  p: Palette;
  data: AnalysisResult;
  competitors: AnalysisResult[];
}) {
  const business = data.business ?? null;
  const gov = data.governmentContracts ?? null;

  const revenue = business?.revenue ?? "";
  const employees = business?.employees ?? "";
  const founded = business?.founded ?? "";
  const legalForm = business?.legalForm ?? "";
  const courtCases = business?.courtCases ?? 0;
  const rusprofileUrl = business?.rusprofileUrl ?? null;

  const hasFinanceData = !!(revenue || employees || founded);
  const govContracts = gov?.totalContracts ?? 0;
  const govAmount = gov?.totalAmount ?? "";

  // Возраст компании в годах — из founded
  const companyAge = (() => {
    if (!founded) return null;
    const m = founded.match(/(\d{4})/);
    if (!m) return null;
    return new Date().getFullYear() - parseInt(m[1], 10);
  })();

  // Сравнение с конкурентами: сколько у нас vs сколько в среднем у них
  const competitorRevenues = competitors
    .map(c => c.business?.revenue ?? "")
    .filter(r => r && /\d/.test(r));
  const competitorEmployees = competitors
    .map(c => c.business?.employees ?? "")
    .filter(e => e && /\d/.test(e));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero — выручка / возраст / штат */}
      <div className="mr-card" style={{ padding: 32, animationDelay: "0ms" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: p.textTertiary, marginBottom: 14 }}>
          Финансовый портрет
        </div>
        {hasFinanceData ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 28 }}>
            <FinanceMetric p={p} label="Выручка" value={revenue || "—"} icon={<Banknote size={26} />} accent={p.green} hero />
            <FinanceMetric p={p} label="Сотрудников" value={employees || "—"} icon={<UsersIcon size={26} />} accent={p.primary} />
            <FinanceMetric p={p} label="Возраст бизнеса" value={companyAge !== null ? `${companyAge} ${companyAge === 1 ? "год" : companyAge < 5 ? "года" : "лет"}` : (founded || "—")} icon={<Calendar size={26} />} accent={p.blue} />
            <FinanceMetric p={p} label="Форма" value={legalForm || "—"} icon={<Briefcase size={26} />} accent={p.orange} />
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: p.textSecondary, fontSize: 15 }}>
            Финансовые данные подтянутся при следующем анализе (DaData/Руспрофайл).
          </div>
        )}
      </div>

      {/* Юридическая информация + риски */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        {/* Court cases */}
        <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: courtCases > 0 ? p.redBg : p.greenBg, color: courtCases > 0 ? p.red : p.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Scale size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary }}>Судебные дела</div>
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: courtCases > 0 ? p.red : p.green, lineHeight: 1, marginBottom: 8, letterSpacing: -1 }}>
            {courtCases}
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary, lineHeight: 1.5 }}>
            {courtCases === 0
              ? "Открытых производств не найдено — компания без юридических рисков."
              : courtCases <= 3
                ? "Несколько дел — обычно нормально для активного бизнеса."
                : "Много открытых дел — стоит проанализировать причины с юристом."}
          </div>
        </div>

        {/* Government contracts */}
        <div className="mr-card" style={{ padding: 28, animationDelay: "200ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bgTabActive, color: p.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileTextIcon size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary }}>Госконтракты</div>
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: govContracts > 0 ? p.primary : p.textTertiary, lineHeight: 1, marginBottom: 8, letterSpacing: -1 }}>
            {govContracts}
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary, lineHeight: 1.5 }}>
            {govContracts === 0
              ? "Нет данных о госконтрактах. Возможно, компания не работает с госсектором."
              : govAmount
                ? <>Общий объём: <strong style={{ color: p.textPrimary }}>{govAmount}</strong></>
                : "Контракты найдены, объём уточняется."}
          </div>
        </div>
      </div>

      {/* Recent gov contracts */}
      {gov && gov.recentContracts && gov.recentContracts.length > 0 && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "300ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>
            Последние госконтракты
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {gov.recentContracts.slice(0, 5).map((c, i) => (
              <div key={i} style={{
                padding: "16px 18px", borderRadius: 12, background: p.bgSecondary,
                display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 100 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: p.textTertiary, marginBottom: 4 }}>{c.date}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: p.green }}>{c.amount}</div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary, marginBottom: 4 }}>{c.subject}</div>
                  <div style={{ fontSize: 14, color: p.textSecondary }}>Заказчик: {c.customer}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сравнение с конкурентами */}
      {competitors.length > 0 && (competitorRevenues.length > 0 || competitorEmployees.length > 0) && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "400ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>
            Размер компании vs конкуренты
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 540, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Компания", "Выручка", "Штат", "Возраст", "Форма"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: p.textTertiary, borderBottom: `1px solid ${p.borderTertiary}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "14px", fontWeight: 800, color: p.primary, borderBottom: `1px solid ${p.borderTertiary}` }}>{data.company.name} (вы)</td>
                  <td style={{ padding: "14px", fontWeight: 700, color: p.textPrimary, borderBottom: `1px solid ${p.borderTertiary}` }}>{revenue || "—"}</td>
                  <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{employees || "—"}</td>
                  <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{companyAge !== null ? `${companyAge} лет` : "—"}</td>
                  <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{legalForm || "—"}</td>
                </tr>
                {competitors.slice(0, 5).map((c, i) => {
                  const cAge = c.business?.founded?.match(/(\d{4})/)?.[1];
                  const cAgeYears = cAge ? new Date().getFullYear() - parseInt(cAge, 10) : null;
                  return (
                    <tr key={i}>
                      <td style={{ padding: "14px", fontWeight: 600, color: p.textPrimary, borderBottom: `1px solid ${p.borderTertiary}` }}>{c.company.name}</td>
                      <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{c.business?.revenue || "—"}</td>
                      <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{c.business?.employees || "—"}</td>
                      <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{cAgeYears !== null ? `${cAgeYears} лет` : "—"}</td>
                      <td style={{ padding: "14px", color: p.textSecondary, borderBottom: `1px solid ${p.borderTertiary}` }}>{c.business?.legalForm || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* External links */}
      {rusprofileUrl && (
        <a href={rusprofileUrl} target="_blank" rel="noopener noreferrer" style={{
          display: "block", padding: "20px 24px", background: p.bgSecondary,
          border: `1px solid ${p.borderTertiary}`, borderRadius: 14,
          color: p.textPrimary, textDecoration: "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bgCard, color: p.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ExternalLink size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.textPrimary, marginBottom: 4 }}>
                Подробнее на Руспрофайл
              </div>
              <div style={{ fontSize: 14, color: p.textSecondary }}>
                Финансовая отчётность, налоги, бенефициары, аффилированные лица
              </div>
            </div>
            <ArrowRight size={20} style={{ color: p.primary }} />
          </div>
        </a>
      )}
    </div>
  );
}

function FinanceMetric({ p, label, value, icon, accent, hero }: {
  p: Palette; label: string; value: string; icon: React.ReactNode; accent: string; hero?: boolean;
}) {
  // Если value содержит цифры — выделяем число крупнее
  const isNumeric = /^[\d\s.,млр₽\-—]+$/i.test(value);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: accent }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: p.textTertiary }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: hero ? 32 : isNumeric ? 28 : 22,
        fontWeight: 800,
        color: p.textPrimary,
        lineHeight: 1.15,
        letterSpacing: -0.5,
        wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── HRTab ─────────────────────────────────────────────────────────────────
// Команда и найм: открытые вакансии (hh.ru), средняя зарплата, тренд найма,
// ключевые роли, сравнение с конкурентами.
function HRTab({ p, data, competitors }: {
  p: Palette;
  data: AnalysisResult;
  competitors: AnalysisResult[];
}) {
  const hiring = data.hiring ?? null;
  const employees = data.business?.employees ?? "";
  const openVacancies = hiring?.openVacancies ?? 0;
  const avgSalary = hiring?.avgSalary ?? "";
  const salaryRange = hiring?.salaryRange ?? "";
  const topRoles = hiring?.topRoles ?? [];
  const trend = hiring?.trend ?? "stable";

  const trendMeta = {
    growing: { label: "Активный найм", color: p.green, icon: "↑", desc: "Компания растёт — это привлекательно для кандидатов и говорит о здоровье бизнеса." },
    stable: { label: "Стабильный штат", color: p.blue, icon: "→", desc: "Найм идёт ровно. Хорошо для удержания, но без рывков." },
    declining: { label: "Сокращение", color: p.red, icon: "↓", desc: "Вакансии сокращаются. Стоит проанализировать причины." },
  }[trend];

  // Сравнение по найму с конкурентами
  const compHiring = competitors.map(c => ({
    name: c.company.name,
    vacancies: c.hiring?.openVacancies ?? 0,
    salary: c.hiring?.avgSalary ?? "",
    employees: c.business?.employees ?? "",
    trend: c.hiring?.trend ?? "stable",
  }));

  const totalCompVacancies = compHiring.reduce((s, c) => s + c.vacancies, 0);
  const avgCompVacancies = compHiring.length > 0 ? Math.round(totalCompVacancies / compHiring.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero — открытые вакансии */}
      <div className="mr-card" style={{ padding: 32, animationDelay: "0ms" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: p.textTertiary, marginBottom: 14 }}>
              Открытые вакансии (hh.ru)
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 64, fontWeight: 800, color: p.textPrimary, lineHeight: 1, letterSpacing: -1.5 }}>
                {openVacancies}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: trendMeta.color, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {trendMeta.icon} {trendMeta.label}
              </div>
            </div>
            <div style={{ fontSize: 15, color: p.textSecondary, lineHeight: 1.55, maxWidth: 480 }}>
              {trendMeta.desc}
            </div>
          </div>

          {avgCompVacancies > 0 && (
            <div style={{
              flex: "0 0 200px",
              padding: 20,
              borderRadius: 12,
              background: p.bgSecondary,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.textTertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                В среднем у конкурентов
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: p.textPrimary, lineHeight: 1, marginBottom: 6 }}>
                {avgCompVacancies}
              </div>
              <div style={{ fontSize: 13, color: openVacancies >= avgCompVacancies ? p.green : p.red, fontWeight: 700 }}>
                {openVacancies >= avgCompVacancies
                  ? `Вы нанимаете на ${openVacancies - avgCompVacancies} больше`
                  : `Они нанимают на ${avgCompVacancies - openVacancies} больше`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Salary + Employees */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div className="mr-card" style={{ padding: 28, animationDelay: "100ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.greenBg, color: p.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary }}>Средняя зарплата</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: p.textPrimary, lineHeight: 1.15, marginBottom: 8, letterSpacing: -0.5 }}>
            {avgSalary || "—"}
          </div>
          {salaryRange && <div style={{ fontSize: 14, color: p.textSecondary }}>Диапазон: {salaryRange}</div>}
        </div>

        <div className="mr-card" style={{ padding: 28, animationDelay: "200ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bgTabActive, color: p.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UsersIcon size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: p.textPrimary }}>Размер команды</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: p.textPrimary, lineHeight: 1.15, marginBottom: 8, letterSpacing: -0.5 }}>
            {employees || "—"}
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary }}>По данным DaData / hh.ru</div>
        </div>
      </div>

      {/* Top roles */}
      {topRoles.length > 0 && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "300ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>
            Кого ищут сейчас
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {topRoles.slice(0, 12).map((role, i) => (
              <div key={i} style={{
                padding: "10px 16px",
                borderRadius: 24,
                background: p.bgSecondary,
                fontSize: 15,
                fontWeight: 600,
                color: p.textPrimary,
                border: `1px solid ${p.borderTertiary}`,
              }}>
                {role}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 14, color: p.textSecondary, marginTop: 14, lineHeight: 1.55 }}>
            💡 Эти позиции активно ищет компания на hh.ru. По ним можно понять, в какие отделы инвестируется компания.
          </div>
        </div>
      )}

      {/* Сравнение с конкурентами */}
      {compHiring.length > 0 && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "400ms" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>
            Найм vs конкуренты
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Я */}
            <HiringRow p={p} name={`${data.company.name} (вы)`} vacancies={openVacancies} salary={avgSalary} employees={employees} max={Math.max(openVacancies, ...compHiring.map(c => c.vacancies))} highlight />
            {compHiring.slice(0, 5).map((c, i) => (
              <HiringRow key={i} p={p} name={c.name} vacancies={c.vacancies} salary={c.salary} employees={c.employees} max={Math.max(openVacancies, ...compHiring.map(x => x.vacancies))} />
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <a
        href="https://hh.ru/search/employer"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block", padding: "20px 24px",
          background: p.bgSecondary,
          border: `1px solid ${p.borderTertiary}`,
          borderRadius: 14,
          color: p.textPrimary, textDecoration: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bgCard, color: "#D6001C", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Briefcase size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: p.textPrimary, marginBottom: 4 }}>
              Открыть профиль на hh.ru
            </div>
            <div style={{ fontSize: 14, color: p.textSecondary }}>
              Все вакансии, отзывы кандидатов, рейтинг работодателя
            </div>
          </div>
          <ArrowRight size={20} style={{ color: p.primary }} />
        </div>
      </a>
    </div>
  );
}

function HiringRow({ p, name, vacancies, salary, employees, max, highlight }: {
  p: Palette; name: string; vacancies: number; salary: string; employees: string; max: number; highlight?: boolean;
}) {
  const pct = max > 0 ? (vacancies / max) * 100 : 0;
  const color = highlight ? p.primary : (vacancies > max * 0.7 ? p.green : vacancies > max * 0.3 ? p.blue : p.gray);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: highlight ? 800 : 600, color: highlight ? p.textPrimary : p.textSecondary }}>
          {name}
        </span>
        <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "baseline" }}>
          {salary && <span style={{ color: p.textSecondary }}>{salary}</span>}
          {employees && <span style={{ color: p.textTertiary, fontSize: 12 }}>{employees}</span>}
          <span style={{ fontSize: 18, fontWeight: 800, color }}>{vacancies}</span>
        </div>
      </div>
      <div style={{ height: 8, background: p.bgSecondary, borderRadius: 6 }}>
        <div className="mr-bar-fill" style={{
          width: `${pct}%`, height: "100%",
          background: highlight ? `linear-gradient(90deg, ${color} 0%, ${p.primaryLight} 100%)` : color,
          borderRadius: 6,
        }} />
      </div>
    </div>
  );
}

// ─── AIVisibilityTab ──────────────────────────────────────────────────────
function AIVisibilityTab({ p, data, competitors }: { p: Palette; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const yandex = data.keysoDashboard?.yandex;
  const google = data.keysoDashboard?.google;

  // Compute overall AI visibility score (0-100) from top positions + traffic
  const yScore = yandex ? Math.min(100, Math.round(
    (yandex.top1 ?? 0) * 4 +
    (yandex.top3 ?? 0) * 2 +
    (yandex.top10 ?? 0) * 0.5 +
    Math.min(40, (yandex.traffic ?? 0) / 25)
  )) : 0;
  const gScore = google ? Math.min(100, Math.round(
    (google.top1 ?? 0) * 4 +
    (google.top3 ?? 0) * 2 +
    (google.top10 ?? 0) * 0.5 +
    Math.min(40, (google.traffic ?? 0) / 25)
  )) : 0;
  const visibilityScore = yandex || google ? Math.max(yScore, gScore) : 0;

  const totalKeywords = (yandex?.top50 ?? 0) + (google?.top50 ?? 0);
  const top3Count = (yandex?.top3 ?? 0) + (google?.top3 ?? 0);
  const dailyTraffic = (yandex?.traffic ?? 0) + (google?.traffic ?? 0);

  // Competitor AI visibility comparison
  const compVisibility = competitors.slice(0, 5).map(c => {
    const cy = c.keysoDashboard?.yandex;
    const cg = c.keysoDashboard?.google;
    const cs = cy || cg ? Math.min(100, Math.round(
      ((cy?.top3 ?? 0) + (cg?.top3 ?? 0)) * 2.5 +
      ((cy?.top10 ?? 0) + (cg?.top10 ?? 0)) * 0.4 +
      Math.min(30, ((cy?.traffic ?? 0) + (cg?.traffic ?? 0)) / 30)
    )) : Math.floor(c.company.score * 0.6);
    return { name: c.company.name, score: cs };
  });

  const engineCards = [
    { label: "Яндекс", icon: "🔍", data: yandex, color: "#FF5500" },
    { label: "Google", icon: "🌐", data: google, color: "#4285F4" },
  ];

  const aiSearchSources = [
    { name: "ChatGPT / GPT-4", icon: "🤖", note: "LLM-ответы на запросы пользователей" },
    { name: "Perplexity AI", icon: "🔮", note: "AI-поиск с ссылками на источники" },
    { name: "Яндекс ИИ (Алиса)", icon: "🗣️", note: "Голосовой поиск + Я.GPT" },
    { name: "Google AI Overview", icon: "✨", note: "AI-резюме в поисковой выдаче" },
    { name: "Microsoft Copilot", icon: "💼", note: "Поиск Bing с AI-ответами" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Ключевые метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mr-metrics-grid">
        <MetricCard p={p} label="ИИ-видимость" value={visibilityScore} change="из 100" positive={visibilityScore > 30} delayMs={0} suffix="" neonColor="#D500F9" />
        <MetricCard p={p} label="Запросов в топ-3" value={top3Count} change="Яндекс + Google" positive={top3Count > 0} delayMs={120} neonColor="#69FF47" />
        <MetricCard p={p} label="Запросов в топ-50" value={totalKeywords} change="общий охват" positive={totalKeywords > 0} delayMs={240} neonColor="#4FC3F7" />
        <MetricCard p={p} label="Трафик/сутки" value={dailyTraffic} change="оценка поиска" positive={dailyTraffic > 0} delayMs={360} neonColor="#FBBF24" />
      </div>

      {/* Поисковые системы — детали */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="mr-main-grid">
        {engineCards.map(({ label, icon, data: eng, color }) => (
          <div key={label} className="mr-card" style={{ padding: 28, animationDelay: "400ms" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary }}>{label}</div>
              {!eng && <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", borderRadius: 10, background: p.grayBg, color: p.gray }}>нет данных</span>}
            </div>
            {eng ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <KV p={p} k="Трафик (сутки)" v={eng.traffic?.toLocaleString("ru-RU") ?? "—"} />
                <KV p={p} k="Страниц в выдаче" v={eng.pagesInOrganic?.toLocaleString("ru-RU") ?? "—"} />
                <KV p={p} k="Топ-1" v={<span style={{ color, fontWeight: 700 }}>{eng.top1 ?? 0}</span>} />
                <KV p={p} k="Топ-3" v={<span style={{ color, fontWeight: 700 }}>{eng.top3 ?? 0}</span>} />
                <KV p={p} k="Топ-10" v={eng.top10 ?? 0} />
                <KV p={p} k="Топ-50" v={eng.top50 ?? 0} />
                {eng.adKeys > 0 && <KV p={p} k="Контекстных запросов" v={eng.adKeys} />}
                {(eng.dr ?? 0) > 0 && <KV p={p} k="Domain Rating" v={<span style={{ fontWeight: 700, color: p.primary }}>{eng.dr}</span>} />}
                {/* Position bar */}
                <div style={{ marginTop: 14 }}>
                  {[
                    { label: "Топ-1", val: eng.top1 ?? 0, color: "#D500F9" },
                    { label: "Топ-3", val: eng.top3 ?? 0, color: color },
                    { label: "Топ-10", val: eng.top10 ?? 0, color: p.primary },
                    { label: "Топ-50", val: eng.top50 ?? 0, color: p.textTertiary },
                  ].map(bar => (
                    <div key={bar.label} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: p.textTertiary, marginBottom: 3 }}>
                        <span>{bar.label}</span>
                        <span style={{ fontWeight: 700, color: p.textSecondary }}>{bar.val}</span>
                      </div>
                      <div style={{ height: 6, background: p.bgSecondary, borderRadius: 4 }}>
                        <div className="mr-bar-fill" style={{ width: `${Math.min(100, (bar.val / Math.max(1, eng.top50 ?? 1)) * 100)}%`, height: "100%", background: bar.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: p.textTertiary, lineHeight: 1.6 }}>
                Данные появятся после запуска анализа с подключённым Key.so API.
                <br /><br />
                <div style={{ padding: 12, background: p.bgSecondary, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 4 }}>Что отслеживается:</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: p.textTertiary, lineHeight: 1.7 }}>
                    <li>Позиции по ключевым словам</li>
                    <li>Органический трафик</li>
                    <li>Страниц в индексе</li>
                    <li>Рейтинг домена (DR)</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ИИ-поиск — статус присутствия */}
      <div className="mr-card" style={{ padding: 28, animationDelay: "600ms" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Zap size={18} style={{ color: p.primary }} strokeWidth={2} />
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary }}>Присутствие в ИИ-поиске</div>
        </div>
        <div style={{ fontSize: 14, color: p.textSecondary, marginBottom: 16 }}>
          Современные LLM и ИИ-поисковики формируют ответы на основе авторитетности контента в сети.
          Ваша поисковая видимость напрямую влияет на то, упоминает ли ИИ вашу компанию.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {aiSearchSources.map((src, i) => {
            // Estimate likelihood based on visibility score
            const likelihood = visibilityScore >= 70 ? "высокая" : visibilityScore >= 40 ? "средняя" : visibilityScore > 0 ? "низкая" : "неизвестно";
            const likelihoodColor = visibilityScore >= 70 ? p.green : visibilityScore >= 40 ? p.orange : p.red;
            return (
              <div key={i} style={{ padding: 14, background: p.bgSecondary, borderRadius: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{src.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: p.textPrimary, marginBottom: 3 }}>{src.name}</div>
                  <div style={{ fontSize: 11, color: p.textTertiary, marginBottom: 6 }}>{src.note}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: `${likelihoodColor}22`, color: likelihoodColor }}>
                    вероятность упоминания: {likelihood}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Сравнение с конкурентами */}
      {compVisibility.length > 0 && (
        <div className="mr-card" style={{ padding: 28, animationDelay: "800ms" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary, marginBottom: 18 }}>ИИ-видимость vs конкуренты</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* My company */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.textPrimary }}>{data.company.name} (вы)</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: p.primary }}>{visibilityScore}</span>
              </div>
              <div style={{ height: 8, background: p.bgSecondary, borderRadius: 4 }}>
                <div className="mr-bar-fill" style={{ width: `${visibilityScore}%`, height: "100%", background: `linear-gradient(90deg, ${p.primary} 0%, ${p.primaryLight} 100%)`, borderRadius: 4 }} />
              </div>
            </div>
            {compVisibility.map((cv, i) => {
              const ahead = cv.score > visibilityScore;
              const barColor = ahead ? p.red : p.green;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, color: p.textSecondary }}>{cv.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ahead ? p.red : p.green }}>{cv.score}</span>
                  </div>
                  <div style={{ height: 8, background: p.bgSecondary, borderRadius: 4 }}>
                    <div className="mr-bar-fill" style={{ width: `${cv.score}%`, height: "100%", background: barColor, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Рекомендации по улучшению */}
      <div className="mr-card" style={{ padding: 28, animationDelay: "1000ms" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Search size={16} style={{ color: p.primary }} strokeWidth={2} />
          <div style={{ fontSize: 18, fontWeight: 800, color: p.textPrimary }}>Как улучшить ИИ-видимость</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {[
            { icon: "📝", title: "Экспертный контент", text: "Публикуйте глубокие статьи, кейсы, руководства — LLM-модели обучены на таком контенте и чаще цитируют авторитетные источники." },
            { icon: "🔗", title: "Ссылочная масса", text: "Увеличивайте DR (Domain Rating). Сайты с высоким DR чаще попадают в ответы AI-поисковиков как авторитетные источники." },
            { icon: "⭐", title: "Отзывы и рейтинги", text: "Google AI, Perplexity и Яндекс ИИ используют отзывы с платформ при формировании ответов о компаниях и продуктах." },
            { icon: "🗂️", title: "Структурированные данные", text: "Используйте Schema.org разметку (FAQ, Product, LocalBusiness) — это помогает LLM понимать ваш контент точнее." },
            { icon: "📱", title: "Социальные сигналы", text: "Активность в соцсетях и упоминания бренда формируют «социальный граф» — LLM учитывает его при оценке авторитетности." },
            { icon: "🎯", title: "Точечные запросы", text: "Оптимизируйте под длинные запросы (long-tail). Именно на них пользователи задают вопросы AI-поисковикам." },
          ].map((rec, i) => (
            <div key={i} className="mr-ai-rec" style={{ animationDelay: `${1050 + i * 100}ms`, padding: 14, background: p.bgSecondary, borderRadius: 10 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{rec.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.textPrimary, marginBottom: 4 }}>{rec.title}</div>
              <div style={{ fontSize: 12, color: p.textSecondary, lineHeight: 1.5 }}>{rec.text}</div>
            </div>
          ))}
        </div>
      </div>
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
  padding: 24px 26px 26px;
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
