"use client";

/**
 * Dashboard руководителя — standalone страница для CEO/собственника.
 * URL: /owner-dashboard
 * Данные: загружаются из localStorage (быстрый MVP) + /api/auth/me (проверка сессии).
 * Дизайн: WOW-каскадная анимация, 30-секундное правило.
 */

import { useEffect, useState, useMemo } from "react";
import type { AnalysisResult } from "@/lib/types";

// ─── Palettes: light & dark (фирменный #534AB7 в обеих) ────────────────────
type Theme = "light" | "dark";

const PALETTES = {
  light: {
    primary: "#534AB7",
    primaryLight: "#7C6BE8",
    bgPage: "#F7F7F8",
    bgCard: "#FFFFFF",
    bgSecondary: "#F0F1F5",
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
} as const;

// Runtime palette — reassigned by OwnerDashboardPage based on theme.
// Sub-components read this at render time.
let C = PALETTES.light as typeof PALETTES.light | typeof PALETTES.dark;

// ─── Типы для dashboard ─────────────────────────────────────────────────────
interface MetricBadgeColor {
  positive: boolean;
  neutral?: boolean;
}

type CompetitorStatus = "leader" | "growing" | "stable" | "new" | "declining";

interface DashCompetitor {
  name: string;
  score: number;
  status: CompetitorStatus;
  rating?: number;
  reviews?: number;
  traffic?: string;
  trend?: number; // percent change
  lastEvent?: string;
}

interface Threat {
  level: "critical" | "warning" | "opportunity";
  title: string;
  description: string;
}

// ─── countUp hook ──────────────────────────────────────────────────────────
function useCountUp(target: number, durationMs = 1200, startDelayMs = 0): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || isNaN(target)) { setV(0); return; }
    let raf = 0;
    const startTimer = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        // easeOutExpo
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setV(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, startDelayMs);
    return () => { clearTimeout(startTimer); cancelAnimationFrame(raf); };
  }, [target, durationMs, startDelayMs]);
  return v;
}

// ─── Metric card ───────────────────────────────────────────────────────────
function MetricCard({ label, value, change, positive, delayMs, suffix }: {
  label: string;
  value: number;
  change: string;
  positive: boolean;
  delayMs: number;
  suffix?: string;
}) {
  const animated = useCountUp(value, 1200, delayMs + 100);
  const badgeColor: MetricBadgeColor = { positive };
  return (
    <div className="mr-card mr-metric" style={{ animationDelay: `${delayMs}ms` }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: C.textTertiary, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: C.textPrimary, lineHeight: 1, marginBottom: 12, letterSpacing: -0.5 }}>
        {animated}{suffix && <span style={{ fontSize: 22, fontWeight: 700, color: C.textTertiary }}>{suffix}</span>}
      </div>
      <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: badgeColor.positive ? C.greenBg : C.redBg,
        color: badgeColor.positive ? C.green : C.red }}>
        {change}
      </div>
    </div>
  );
}

// ─── Competitor bar ────────────────────────────────────────────────────────
function statusColor(s: CompetitorStatus): string {
  switch (s) {
    case "leader": return C.primary;
    case "growing": return C.green;
    case "stable": return C.blue;
    case "new": return C.orange;
    case "declining": return C.gray;
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

function CompetitorBar({ name, score, status, delayMs }: {
  name: string; score: number; status: CompetitorStatus; delayMs: number;
}) {
  const color = statusColor(status);
  return (
    <div className="mr-bar-row" style={{ animationDelay: `${delayMs}ms` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{name}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary }}>{score} / 100</span>
      </div>
      <div style={{ position: "relative", height: 26, background: C.bgSecondary, borderRadius: 6, overflow: "hidden" }}>
        <div className="mr-bar-fill" style={{
          position: "absolute", inset: 0, right: "auto",
          width: `${Math.max(2, Math.min(100, score))}%`,
          background: color,
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

// ─── Trend chart (SVG, без Chart.js) ───────────────────────────────────────
function TrendChart({ series }: {
  series: Array<{ name: string; color: string; points: number[]; dashed?: boolean }>;
}) {
  const W = 600, H = 220, pad = { top: 20, right: 16, bottom: 24, left: 32 };
  const months = ["Ноя", "Дек", "Янв", "Фев", "Мар", "Апр"];
  const yMin = 40, yMax = 90;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const xAt = (i: number) => pad.left + (i / (months.length - 1)) * innerW;
  const yAt = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 220, display: "block" }}>
      {/* Y gridlines */}
      {[40, 50, 60, 70, 80, 90].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={yAt(v)} x2={W - pad.right} y2={yAt(v)}
            stroke={C.borderTertiary} strokeWidth={0.5} />
          <text x={pad.left - 8} y={yAt(v) + 4} fontSize={10} fill={C.textTertiary} textAnchor="end">{v}</text>
        </g>
      ))}
      {/* X labels */}
      {months.map((m, i) => (
        <text key={m} x={xAt(i)} y={H - 6} fontSize={10} fill={C.textTertiary} textAnchor="middle">{m}</text>
      ))}
      {/* Lines */}
      {series.map((s) => {
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p)}`).join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color}
              strokeWidth={s.dashed ? 1.5 : 2.5}
              strokeDasharray={s.dashed ? "4 4" : undefined}
              strokeLinecap="round" strokeLinejoin="round" />
            {!s.dashed && s.points.map((p, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(p)} r={3} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Threat row ────────────────────────────────────────────────────────────
function ThreatRow({ level, title, description, delayMs }: {
  level: "critical" | "warning" | "opportunity"; title: string; description: string; delayMs: number;
}) {
  const color = level === "critical" ? C.red : level === "warning" ? C.orange : C.blue;
  const bg = level === "critical" ? C.redBg : level === "warning" ? C.orangeBg : C.blueBg;
  const badgeText = level === "critical" ? "критично" : level === "warning" ? "внимание" : "возможность";
  return (
    <div className="mr-threat" style={{ animationDelay: `${delayMs}ms` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div className={level === "critical" ? "mr-pulse-dot" : ""}
          style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 7, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, lineHeight: 1.35 }}>{title}</div>
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: bg, color, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {badgeText}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.45 }}>{description}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers: build dashboard data from user's analyses ────────────────────
function deriveStatus(score: number, myScore: number): CompetitorStatus {
  if (score >= myScore + 5) return "growing";
  if (score >= myScore - 5) return "stable";
  if (score <= myScore - 15) return "declining";
  return "new";
}

function buildThreatsFromAnalyses(
  my: AnalysisResult | null,
  competitors: AnalysisResult[],
): Threat[] {
  const threats: Threat[] = [];
  if (!my) return threats;

  // Критичные: конкуренты с баллом выше нашего
  const strongerCompetitors = competitors.filter(c => c.company.score > my.company.score).slice(0, 2);
  for (const c of strongerCompetitors) {
    threats.push({
      level: "critical",
      title: `${c.company.name} опережает по общему баллу`,
      description: `Балл ${c.company.score} против вашего ${my.company.score}. Проверьте в чём они сильнее.`,
    });
  }

  // Из nicheForecast.threats
  (my.nicheForecast?.threats ?? []).slice(0, 2).forEach(t => {
    threats.push({ level: "warning", title: "Рыночная угроза", description: t });
  });

  // Из nicheForecast.opportunities
  (my.nicheForecast?.opportunities ?? []).slice(0, 3).forEach(o => {
    threats.push({ level: "opportunity", title: "Возможность", description: o });
  });

  return threats.slice(0, 6);
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function OwnerDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myCompany, setMyCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  // Detect theme from localStorage (same key as main platform)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mr_theme");
      if (saved === "dark") setTheme("dark");
      else if (saved === "light" || saved === "warm") setTheme("light");
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
    } catch { /* ignore */ }
  }, []);

  // Switch module-level palette before children render
  C = PALETTES[theme];

  // 1. Проверяем авторизацию + сразу грузим данные (сервер → localStorage fallback)
  useEffect(() => {
    (async () => {
      let uid: string | null = null;
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = await r.json();
        if (j.ok && j.user) { uid = j.user.id; setUserId(uid); }
      } catch { /* ignore */ }
      setAuthChecked(true);

      // Пытаемся загрузить с сервера (основной источник)
      let loadedFromServer = false;
      try {
        const res = await fetch("/api/data", { credentials: "include" });
        const json = await res.json();
        if (json.ok && json.data) {
          if (json.data.company) { setMyCompany(json.data.company as AnalysisResult); loadedFromServer = true; }
          if (Array.isArray(json.data.competitors)) setCompetitors(json.data.competitors as AnalysisResult[]);
        }
      } catch { /* ignore */ }

      // Fallback: localStorage (если на сервере ничего нет)
      if (!loadedFromServer && uid) {
        try {
          const c = localStorage.getItem(`mr_company_${uid}`);
          if (c) setMyCompany(JSON.parse(c) as AnalysisResult);
          const comp = localStorage.getItem(`mr_competitors_${uid}`);
          if (comp) setCompetitors(JSON.parse(comp) as AnalysisResult[]);
        } catch { /* ignore */ }
      }
    })();
  }, []);

  // ─── Metrics ────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalCompetitors = competitors.length;
    const myScore = myCompany?.company.score ?? 0;
    // Avg competitor score
    const avgCompScore = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + c.company.score, 0) / competitors.length)
      : 0;
    // Market share proxy: my score / (my + avg competitor scores)
    const marketShare = myScore > 0 && competitors.length > 0
      ? Math.round((myScore / (myScore + avgCompScore * competitors.length)) * 100)
      : 0;
    const threats = buildThreatsFromAnalyses(myCompany, competitors);
    const criticalCount = threats.filter(t => t.level === "critical" || t.level === "warning").length;

    return {
      competitors: totalCompetitors,
      threats: criticalCount,
      marketShare,
      score: myScore,
    };
  }, [myCompany, competitors]);

  // ─── Competitor bars data ──────────────────────────────────────────────
  const bars = useMemo(() => {
    const all: DashCompetitor[] = [];
    if (myCompany) {
      all.push({
        name: myCompany.company.name,
        score: myCompany.company.score,
        status: "leader",
      });
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

  // ─── Trend chart data (mocked by current score + variation) ────────────
  const trendSeries = useMemo(() => {
    if (!myCompany) return [];
    const mk = (final: number, variance: number): number[] => {
      // 6 точек, последняя = final, с плавным трендом
      const start = final - variance;
      return Array.from({ length: 6 }, (_, i) => {
        const t = i / 5;
        return Math.round(start + (final - start) * (t * t * (3 - 2 * t)) + (Math.random() - 0.5) * 2);
      });
    };
    const series: Array<{ name: string; color: string; points: number[]; dashed?: boolean }> = [];
    series.push({
      name: myCompany.company.name,
      color: C.primary,
      points: mk(myCompany.company.score, 10),
    });
    competitors.slice(0, 3).forEach(c => {
      series.push({
        name: c.company.name,
        color: statusColor(deriveStatus(c.company.score, myCompany.company.score)),
        points: mk(c.company.score, 12),
        dashed: true,
      });
    });
    return series;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCompany?.company.score, competitors.length]);

  // ─── Threats ───────────────────────────────────────────────────────────
  const threats = useMemo(() => buildThreatsFromAnalyses(myCompany, competitors), [myCompany, competitors]);

  // ─── AI recommendations ────────────────────────────────────────────────
  const aiRecs = useMemo(() => {
    const recs = (myCompany?.recommendations ?? []).slice(0, 3);
    return recs.map(r => ({ text: r.text, effect: r.effect }));
  }, [myCompany]);

  // ─── Period ─────────────────────────────────────────────────────────────
  const period = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────
  if (!authChecked) {
    return <div style={{ padding: 40, textAlign: "center", color: C.textTertiary }}>Проверка доступа…</div>;
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", background: C.bgPage, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>Нужен вход</div>
          <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>Войдите чтобы увидеть дашборд руководителя</div>
          <a href="/" style={{ display: "inline-block", padding: "12px 24px", background: C.primary, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            На платформу →
          </a>
        </div>
      </div>
    );
  }

  if (!myCompany) {
    return (
      <div style={{ minHeight: "100vh", background: C.bgPage, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>Сначала запустите анализ</div>
          <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>Дашборд руководителя собирается из ваших анализов компании и конкурентов.</div>
          <a href="/" style={{ display: "inline-block", padding: "12px 24px", background: C.primary, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            Запустить анализ →
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{buildDashboardCSS(C)}</style>
      <div style={{ minHeight: "100vh", background: C.bgPage, fontFamily: "'Inter', 'PT Sans', system-ui, sans-serif", color: C.textPrimary }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px" }}>
          {/* ─── Header ─── */}
          <div className="mr-card" style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, animationDelay: "0ms" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>
                🎯
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, lineHeight: 1.2 }}>MarketRadar</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                  Конкурентная разведка — обзор за {period}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/" style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: C.textSecondary, border: `1px solid ${C.borderTertiary}`, borderRadius: 8, textDecoration: "none", background: "#fff" }}>
                ← На платформу
              </a>
              <button onClick={() => window.print()} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#fff", background: C.primary, border: "none", borderRadius: 8, cursor: "pointer" }}>
                Скачать отчёт
              </button>
            </div>
          </div>

          {/* ─── Metrics ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            <MetricCard label="Конкуренты" value={metrics.competitors} change={metrics.competitors > 0 ? `+${Math.min(3, metrics.competitors)} новых` : "нет"} positive delayMs={100} />
            <MetricCard label="Угрозы" value={metrics.threats} change={metrics.threats > 0 ? `${metrics.threats} активных` : "всё спокойно"} positive={metrics.threats === 0} delayMs={250} />
            <MetricCard label="Ваша доля рынка" value={metrics.marketShare} change="текущая оценка" positive delayMs={400} suffix="%" />
            <MetricCard label="Средний балл" value={metrics.score} change="ваша компания" positive delayMs={550} />
          </div>

          {/* ─── Main 2-col block ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }} className="mr-main-grid">
            {/* Left: landscape + chart */}
            <div className="mr-card" style={{ padding: 24, animationDelay: "600ms" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, marginBottom: 18 }}>Конкурентный ландшафт</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {bars.map((b, i) => (
                  <CompetitorBar key={i} name={b.name} score={b.score} status={b.status} delayMs={800 + i * 150} />
                ))}
              </div>

              {trendSeries.length > 0 && (
                <div className="mr-chart-wrap" style={{ marginTop: 28, animationDelay: "600ms" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 12 }}>Динамика позиций</div>
                  <TrendChart series={trendSeries} />
                </div>
              )}
            </div>

            {/* Right: threats + AI */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="mr-card" style={{ padding: 20, animationDelay: "700ms" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div className="mr-pulse-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: C.red }} />
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary }}>Угрозы и возможности</div>
                </div>
                {threats.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textTertiary }}>Добавьте конкурентов — здесь появятся угрозы.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {threats.map((t, i) => (
                      <ThreatRow key={i} level={t.level} title={t.title} description={t.description} delayMs={900 + i * 150} />
                    ))}
                  </div>
                )}
              </div>

              {aiRecs.length > 0 && (
                <div className="mr-card" style={{ padding: 20, animationDelay: "1600ms" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 14 }}>Рекомендации AI</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {aiRecs.map((r, i) => (
                      <div key={i} className="mr-ai-rec" style={{ animationDelay: `${1600 + i * 150}ms` }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.green, minWidth: 20 }}>{i + 1}.</div>
                          <div style={{ flex: 1, fontSize: 13, color: C.textPrimary, lineHeight: 1.45 }}>
                            {r.text}
                            {r.effect && <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>→ {r.effect}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Competitor table ─── */}
          {competitors.length > 0 && (
            <div className="mr-card" style={{ padding: 24, animationDelay: "1800ms" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, marginBottom: 18 }}>Таблица конкурентов</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Компания", "Балл", "Статус", "Рейтинг", "Отзывы", "Трафик"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.textTertiary, borderBottom: `1px solid ${C.borderTertiary}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map((c, i) => {
                      const status = deriveStatus(c.company.score, myCompany?.company.score ?? 70);
                      const color = statusColor(status);
                      return (
                        <tr key={i} className="mr-row">
                          <td style={{ padding: "12px", fontWeight: 600, color: C.textPrimary }}>
                            {c.company.name}
                            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>{c.company.url}</div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 700, color: C.textPrimary, minWidth: 28 }}>{c.company.score}</span>
                              <div style={{ flex: 1, height: 6, background: C.bgSecondary, borderRadius: 6, overflow: "hidden", minWidth: 60 }}>
                                <div style={{ width: `${c.company.score}%`, height: "100%", background: color, borderRadius: 6 }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                              background: `${color}1A`, color }}>
                              {statusLabel(status)}
                            </span>
                          </td>
                          <td style={{ padding: "12px", color: C.textSecondary }}>
                            {c.social?.yandexRating > 0 ? `★ ${c.social.yandexRating.toFixed(1)}` : "—"}
                          </td>
                          <td style={{ padding: "12px", color: C.textSecondary }}>
                            {c.social?.yandexReviews || 0}
                          </td>
                          <td style={{ padding: "12px", color: C.textSecondary }}>
                            {c.seo?.estimatedTraffic || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: C.textTertiary }}>
            MarketRadar · Дашборд руководителя · Обновлено {new Date().toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS (анимации + responsive) ──────────────────────────────────────────
function buildDashboardCSS(p: typeof PALETTES.light | typeof PALETTES.dark): string {
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
.mr-metric:hover {
  transform: scale(1.015);
  border-color: ${p.borderSecondary};
  box-shadow: 0 6px 18px rgba(15,17,35,0.06);
}
.mr-bar-row {
  opacity: 0;
  animation: mrFadeUp 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  transition: background 150ms ease;
  padding: 2px 4px;
  border-radius: 6px;
}
.mr-bar-row:hover {
  background: ${p.bgSecondary};
}
.mr-bar-fill {
  transform: scaleX(0);
  animation: mrBarGrow 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  border-radius: 6px;
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
.mr-threat:hover {
  background: ${p.bgSecondary};
  transform: translateX(4px);
}
.mr-ai-rec {
  opacity: 0;
  transform: translateX(-12px);
  animation: mrSlideIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  padding: 12px 14px;
  background: ${p.bgSecondary};
  border-radius: 10px;
}
.mr-chart-wrap {
  opacity: 0;
  animation: mrFadeUp 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.mr-row {
  transition: background 150ms ease;
}
.mr-row:hover {
  background: ${p.bgSecondary};
}
.mr-row td {
  border-bottom: 1px solid ${p.borderTertiary};
}
.mr-pulse-dot {
  animation: mrPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(214, 69, 69, 0.55);
}

@keyframes mrFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes mrSlideIn {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes mrBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes mrPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(214, 69, 69, 0.55); }
  50%      { box-shadow: 0 0 0 8px rgba(214, 69, 69, 0); }
}

@media (max-width: 1023px) {
  .mr-main-grid { grid-template-columns: 1fr !important; }
}
@media (max-width: 767px) {
  .mr-card { border-radius: 12px; }
}

@media print {
  .mr-card { animation: none !important; opacity: 1 !important; transform: none !important; box-shadow: none !important; }
  .mr-bar-fill { animation: none !important; transform: scaleX(1) !important; }
  .mr-threat, .mr-ai-rec, .mr-chart-wrap { animation: none !important; opacity: 1 !important; transform: none !important; }
  .mr-pulse-dot { animation: none !important; }
  button, a[href="/"] { display: none !important; }
}
`;
}
