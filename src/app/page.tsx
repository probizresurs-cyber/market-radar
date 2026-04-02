"use client";

import { useState, useEffect } from "react";
import type { AnalysisResult } from "@/lib/types";

// ============================================================
// MarketRadar — Конкурентный анализ
// ============================================================

const COLORS = {
  light: {
    bg: "#faf8f5",
    bgCard: "#ffffff",
    bgSidebar: "#fdf6ee",
    bgSidebarHover: "#f5ebe0",
    bgSidebarActive: "#ede2d4",
    accent: "#3b82f6",
    accentWarm: "#d4894e",
    accentGreen: "#22a06b",
    accentRed: "#e34935",
    accentYellow: "#e6a817",
    textPrimary: "#1e293b",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    border: "#e8dfd5",
    borderLight: "#f0ebe4",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    shadowLg: "0 4px 12px rgba(0,0,0,0.08)",
    tagBg: "#f0f7ff",
    tagText: "#2563eb",
  },
  dark: {
    bg: "#1a1a1f",
    bgCard: "#24242b",
    bgSidebar: "#1e1e24",
    bgSidebarHover: "#2a2a32",
    bgSidebarActive: "#32323c",
    accent: "#5b9cf6",
    accentWarm: "#e0a06a",
    accentGreen: "#36b37e",
    accentRed: "#f06555",
    accentYellow: "#f0b830",
    textPrimary: "#e8e4df",
    textSecondary: "#9e9a94",
    textMuted: "#6b6860",
    border: "#35353d",
    borderLight: "#2c2c34",
    shadow: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
    shadowLg: "0 4px 12px rgba(0,0,0,0.4)",
    tagBg: "#1e2a3d",
    tagText: "#7bb5f9",
  },
} as const;

type Theme = keyof typeof COLORS;
type Colors = (typeof COLORS)[Theme];

// Static data (sources page stays unchanged)
const SOURCES_FREE = [
  { name: "Сайт конкурента", method: "Playwright → Turndown → Claude API", price: "~$0.03/сайт", phase: "MVP" },
  { name: "Wappalyzer", method: "npm wappalyzer-core", price: "Бесплатно", phase: "MVP" },
  { name: "WHOIS", method: "whois lookup", price: "Бесплатно", phase: "MVP" },
  { name: "robots.txt / sitemap", method: "HTTP fetch + XML parse", price: "Бесплатно", phase: "MVP" },
  { name: "VK API", method: "VK API (groups, wall)", price: "Бесплатно", phase: "MVP" },
  { name: "Telegram", method: "t.me парсинг", price: "Бесплатно", phase: "MVP" },
  { name: "DaData", method: "dadata.ru API", price: "Бесплатно (10k/день)", phase: "MVP" },
  { name: "egrul.nalog.ru", method: "Через DaData", price: "Бесплатно", phase: "MVP" },
  { name: "hh.ru API", method: "api.hh.ru", price: "Бесплатно", phase: "MVP" },
  { name: "MegaIndex", method: "megaindex.ru API", price: "Бесплатно (базовый)", phase: "v2" },
  { name: "Яндекс.Wordstat", method: "wordstat.yandex.ru парсинг", price: "Бесплатно", phase: "v2" },
  { name: "Яндекс.Карты", method: "Playwright парсинг", price: "Бесплатно", phase: "v2" },
  { name: "2ГИС", method: "Playwright парсинг", price: "Бесплатно", phase: "v2" },
  { name: "YouTube / Social Blade", method: "YouTube Data API", price: "Бесплатно", phase: "v2" },
  { name: "zakupki.gov.ru", method: "Парсинг / API", price: "Бесплатно", phase: "v2" },
  { name: "Rusprofile.ru", method: "Парсинг", price: "Бесплатно (базовый)", phase: "v2" },
  { name: "SuperJob", method: "Парсинг", price: "Бесплатно", phase: "v3" },
  { name: "Авито Работа", method: "Парсинг", price: "Бесплатно", phase: "v3" },
  { name: "Отзовик / IRecommend", method: "Парсинг", price: "Бесплатно", phase: "v3" },
];

const NAV_SECTIONS = [
  {
    title: "МАРКЕТИНГ",
    items: [
      { id: "dashboard", icon: "📊", label: "Дашборд", count: null as number | null },
      { id: "insights", icon: "💡", label: "AI-инсайты", count: null as number | null },
      { id: "reports", icon: "📄", label: "Отчёты", count: null as number | null },
      { id: "sources", icon: "🔗", label: "Источники", count: null as number | null },
    ],
  },
];

// ============================================================
// Reusable UI Components
// ============================================================

function ScoreRing({ score, size = 160, strokeWidth = 10, c }: { score: number; size?: number; strokeWidth?: number; c: Colors }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  const color = score >= 75 ? c.accentGreen : score >= 50 ? c.accentWarm : c.accentRed;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.borderLight} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={circ - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: c.textPrimary, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>из 100</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, color, c, height = 8 }: { value: number; color: string; c: Colors; height?: number }) {
  return (
    <div style={{ height, borderRadius: height / 2, background: c.borderLight, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${value}%`, borderRadius: height / 2, background: color, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

function CategoryCard({ cat, c }: { cat: AnalysisResult["company"]["categories"][number]; c: Colors }) {
  const color = cat.score >= 75 ? c.accentGreen : cat.score >= 50 ? c.accentWarm : c.accentRed;
  return (
    <div style={{ background: c.bgCard, borderRadius: 12, padding: "16px 20px", border: `1px solid ${c.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cat.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: c.textPrimary }}>{cat.name}</span>
          <span style={{ fontSize: 11, color: c.textMuted }}>{cat.weight}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 20, color }}>{cat.score}</span>
          {cat.delta !== 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: cat.delta > 0 ? c.accentGreen : c.accentRed, background: cat.delta > 0 ? c.accentGreen + "18" : c.accentRed + "18", padding: "2px 6px", borderRadius: 6 }}>
              {cat.delta > 0 ? "+" : ""}{cat.delta}
            </span>
          )}
        </div>
      </div>
      <ProgressBar value={cat.score} color={color} c={c} />
    </div>
  );
}

function RadarChart({ data, c, size = 280 }: { data: AnalysisResult["company"]; c: Colors; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const cats = data.categories;
  const n = cats.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const dist = (value / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const makePolygon = (values: number[]) =>
    values.map((v, i) => getPoint(i, v)).map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[20, 40, 60, 80, 100].map((v) => (
        <polygon key={v} points={Array.from({ length: n }, (_, i) => getPoint(i, v)).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={c.border} strokeWidth={1} />
      ))}
      {cats.map((cat, i) => {
        const p = getPoint(i, 108);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill={c.textSecondary} fontSize={11} fontWeight={500}>
            {cat.name}
          </text>
        );
      })}
      <polygon points={makePolygon(cats.map((c2) => c2.score))} fill={c.accent + "25"} stroke={c.accent} strokeWidth={2.5} />
      {cats.map((cat, i) => {
        const p = getPoint(i, cat.score);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill={c.accent} stroke={c.bgCard} strokeWidth={2} />;
      })}
    </svg>
  );
}

function PriorityBadge({ priority, c }: { priority: string; c: Colors }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    high: { label: "Высокий", bg: c.accentRed + "18", color: c.accentRed },
    medium: { label: "Средний", bg: c.accentYellow + "18", color: c.accentYellow },
    low: { label: "Низкий", bg: c.accentGreen + "18", color: c.accentGreen },
  };
  const { label, bg, color } = map[priority] ?? map.medium;
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ============================================================
// Landing / Input View
// ============================================================

function LandingView({ c, theme, setTheme, onAnalyze }: {
  c: Colors;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onAnalyze: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAnalyze(url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
      setLoading(false);
    }
  };

  const features = [
    { icon: "🔍", text: "SEO-аудит" },
    { icon: "📱", text: "Соцсети" },
    { icon: "✏️", text: "Анализ контента" },
    { icon: "⚙️", text: "Технологии" },
    { icon: "👥", text: "HR-бренд" },
    { icon: "💡", text: "AI-рекомендации" },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: "0 16px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>
          MR
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, color: c.textPrimary, lineHeight: 1.1 }}>MarketRadar</div>
          <div style={{ fontSize: 12, color: c.textMuted }}>Конкурентный анализ за 30 секунд</div>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "32px 36px", width: "100%", maxWidth: 520, boxShadow: c.shadowLg }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: c.textPrimary, margin: "0 0 6px" }}>
          Проанализируйте любой сайт — TEST
        </h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 24px" }}>
          Введите URL — мы оценим SEO, соцсети, контент и дадим конкретные рекомендации
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.ru или https://example.ru"
              disabled={loading}
              style={{
                flex: 1, padding: "11px 14px", borderRadius: 10,
                border: `1.5px solid ${error ? c.accentRed : c.border}`,
                background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              style={{
                background: c.accent, color: "#fff", border: "none", borderRadius: 10,
                padding: "11px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer",
                whiteSpace: "nowrap", opacity: loading || !url.trim() ? 0.65 : 1,
                transition: "opacity 0.2s", fontFamily: "inherit",
              }}
            >
              {loading ? "Анализ…" : "Анализировать →"}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 10, color: c.accentRed, fontSize: 13 }}>{error}</div>
          )}
        </form>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginTop: 24 }}>
          {features.map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.textSecondary }}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        style={{ marginTop: 20, background: "none", border: "none", cursor: "pointer", color: c.textMuted, fontSize: 13, fontFamily: "inherit" }}
      >
        {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
      </button>
    </div>
  );
}

// ============================================================
// Loading View
// ============================================================

function LoadingView({ c, url }: { c: Colors; url: string }) {
  const steps = ["Загружаем сайт…", "Извлекаем данные…", "AI анализирует…"];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s < steps.length - 1 ? s + 1 : s)), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", gap: 20 }}>
      <style>{`@keyframes mr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 48, height: 48, border: `4px solid ${c.borderLight}`, borderTop: `4px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin 1s linear infinite" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>{steps[step]}</div>
        <div style={{ fontSize: 12, color: c.textMuted }}>
          {url.replace(/^https?:\/\//, "")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= step ? c.accent : c.borderLight, transition: "background 0.4s" }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Dashboard View
// ============================================================

function DashboardView({ c, data }: { c: Colors; data: AnalysisResult }) {
  const { company, recommendations } = data;
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Дашборд</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>
          {company.name} · {company.url}
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Score Card */}
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200, boxShadow: c.shadow }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 16, letterSpacing: "0.03em" }}>ОБЩИЙ SCORE</div>
          <ScoreRing score={company.score} c={c} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 12, color: c.textSecondary }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary }}>{company.avgNiche}</div>
              <div>Среднее ниши</div>
            </div>
            <div style={{ width: 1, background: c.border }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: c.accentGreen }}>{company.top10}+</div>
              <div>ТОП-10%</div>
            </div>
          </div>
        </div>

        {/* Radar Card */}
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, flex: 1, minWidth: 280, boxShadow: c.shadow, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>ПРОФИЛЬ ПО КАТЕГОРИЯМ</div>
          <RadarChart data={company} c={c} size={240} />
        </div>
      </div>

      {/* Categories */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Категории оценки</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map((cat) => (
          <CategoryCard key={cat.name} cat={cat} c={c} />
        ))}
      </div>

      {/* Recommendations */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>AI-рекомендации</div>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
        {recommendations.map((rec, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
            <PriorityBadge priority={rec.priority} c={c} />
            <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.accentGreen, background: c.accentGreen + "12", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>
              {rec.effect}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Insights View
// ============================================================

function InsightsView({ c, data }: { c: Colors; data: AnalysisResult }) {
  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
    niche: { icon: "🔭", label: "Пустая ниша", color: c.accent },
    action: { icon: "🚀", label: "Действие", color: c.accentGreen },
    battle: { icon: "⚔️", label: "Battle Card", color: c.accentRed },
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>AI-инсайты</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.insights.map((ins, i) => {
          const cfg = typeConfig[ins.type] ?? typeConfig.action;
          return (
            <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.color + "15", padding: "3px 10px", borderRadius: 6, letterSpacing: "0.03em" }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{ins.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Reports View
// ============================================================

function ReportsView({ c }: { c: Colors }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Отчёты</h1>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 32, textAlign: "center", boxShadow: c.shadow }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>PDF-отчёты доступны на тарифе Starter</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 16 }}>
          Получите полный PDF с аудитом, сравнением конкурентов и AI-рекомендациями
        </div>
        <button style={{ background: c.accentWarm, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Перейти на Starter — ₽2 990/мес
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Sources View
// ============================================================

function SourcesView({ c }: { c: Colors }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? SOURCES_FREE : SOURCES_FREE.filter((s) => s.phase === filter);

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Источники данных</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 16px" }}>Бесплатные источники для конкурентного анализа на российском рынке</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "MVP", "v2", "v3"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === f ? c.accent : c.border}`, background: filter === f ? c.accent + "15" : "transparent", color: filter === f ? c.accent : c.textSecondary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Источник", "Метод / API", "Цена", "Фаза"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.textPrimary }}>{s.name}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, fontFamily: "monospace", fontSize: 12 }}>{s.method}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: c.accentGreen + "18", color: c.accentGreen }}>{s.price}</span>
                </td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, fontSize: 12, color: s.phase === "MVP" ? c.accent : c.textMuted }}>
                  {s.phase}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Main App
// ============================================================

export default function MarketRadarDashboard() {
  const [theme, setTheme] = useState<Theme>("light");
  const [activeNav, setActiveNav] = useState("dashboard");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const c = COLORS[theme];

  const handleAnalyze = async (url: string) => {
    setCurrentUrl(url);
    setStatus("loading");
    setErrorMsg(null);

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const json = await res.json();

    if (!json.ok) {
      setErrorMsg(json.error ?? "Ошибка анализа");
      setStatus("error");
      throw new Error(json.error ?? "Ошибка анализа");
    }

    setAnalysisResult(json.data);
    setActiveNav("dashboard");
    setStatus("done");
  };

  const handleReset = () => {
    setStatus("idle");
    setAnalysisResult(null);
    setErrorMsg(null);
    setCurrentUrl("");
  };

  // Landing / error
  if (status === "idle" || status === "error") {
    return (
      <LandingView
        c={c}
        theme={theme}
        setTheme={setTheme}
        onAnalyze={handleAnalyze}
      />
    );
  }

  // Loading
  if (status === "loading") {
    return <LoadingView c={c} url={currentUrl} />;
  }

  // Dashboard
  const data = analysisResult!;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", background: c.bg, color: c.textPrimary, overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, minWidth: 220, background: c.bgSidebar, borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            MR
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, lineHeight: 1.2 }}>MarketRadar</div>
            <div style={{ fontSize: 10, color: c.textMuted }}>{data.company.url}</div>
          </div>
        </div>

        {/* New analysis button */}
        <div style={{ padding: "0 8px 4px" }}>
          <button
            onClick={handleReset}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🔄</span> Новый анализ
          </button>
        </div>

        {/* Nav */}
        <div style={{ padding: "4px 8px", flex: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.08em", padding: "12px 8px 6px" }}>
                {section.title}
              </div>
              {section.items.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: isActive ? c.bgSidebarActive : "transparent", fontWeight: isActive ? 600 : 400, fontSize: 13, color: isActive ? c.textPrimary : c.textSecondary, transition: "background 0.15s", marginBottom: 2 }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = c.bgSidebarHover; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.count !== null && (
                      <span style={{ fontSize: 11, fontWeight: 600, background: c.accentWarm + "25", color: c.accentWarm, borderRadius: 10, padding: "1px 7px" }}>
                        {item.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ padding: "8px 8px 12px", borderTop: `1px solid ${c.border}` }}>
          <div
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: c.textSecondary, transition: "background 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = c.bgSidebarHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 15 }}>{theme === "light" ? "🌙" : "☀️"}</span>
            <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", fontSize: 11, color: c.textMuted }}>
            Powered by company24.pro
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {activeNav === "dashboard" && <DashboardView c={c} data={data} />}
        {activeNav === "insights" && <InsightsView c={c} data={data} />}
        {activeNav === "reports" && <ReportsView c={c} />}
        {activeNav === "sources" && <SourcesView c={c} />}
      </main>
    </div>
  );
}
