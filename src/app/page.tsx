"use client";

import { useState, useEffect, useRef } from "react";

// ============================================================
// MarketRadar — Конкурентный анализ для Company24.pro
// Дашборд MVP: Score, категории, рекомендации, конкуренты, сравнение
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
    scoreRing: "#3b82f6",
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
    scoreRing: "#5b9cf6",
    tagBg: "#1e2a3d",
    tagText: "#7bb5f9",
  },
} as const;

type Theme = keyof typeof COLORS;
type Colors = (typeof COLORS)[Theme];

// Mock data
const MY_COMPANY = {
  name: "Digital-студия «Маяк»",
  url: "mayak.studio",
  score: 68,
  avgNiche: 54,
  top10: 85,
  categories: [
    { name: "SEO", weight: 25, score: 72, icon: "🔍", delta: +3 },
    { name: "Соцсети", weight: 25, score: 45, icon: "📱", delta: -2 },
    { name: "Контент", weight: 20, score: 52, icon: "✏️", delta: +5 },
    { name: "HR-бренд", weight: 15, score: 81, icon: "👥", delta: +1 },
    { name: "Технологии", weight: 15, score: 88, icon: "⚙️", delta: 0 },
  ],
};

const COMPETITORS = [
  {
    id: 1,
    name: "Студия «Пиксель»",
    url: "pixel-studio.ru",
    score: 74,
    vkSubs: 12400,
    vacancies: 5,
    rating: 4.7,
    updated: "Сегодня",
    categories: [78, 62, 70, 65, 80],
  },
  {
    id: 2,
    name: "Агентство «Флагман»",
    url: "flagman.digital",
    score: 61,
    vkSubs: 8200,
    vacancies: 2,
    rating: 4.3,
    updated: "Вчера",
    categories: [65, 55, 48, 72, 75],
  },
  {
    id: 3,
    name: "WebCraft Pro",
    url: "webcraft.pro",
    score: 59,
    vkSubs: 5600,
    vacancies: 8,
    rating: 4.5,
    updated: "2 дня назад",
    categories: [60, 42, 55, 78, 70],
  },
];

const RECOMMENDATIONS = [
  {
    priority: "high",
    text: "Добавьте мета-описания на 12 страниц",
    effect: "SEO +10%",
    category: "SEO",
  },
  {
    priority: "high",
    text: "Публикуйте в VK 3–4 раза в неделю (сейчас 1 раз)",
    effect: "Соцсети +15%",
    category: "Соцсети",
  },
  {
    priority: "medium",
    text: "Оптимизируйте изображения — сайт грузится 4.2 сек",
    effect: "SEO +5%",
    category: "SEO",
  },
  {
    priority: "medium",
    text: "Создайте страницу с кейсами и портфолио",
    effect: "Контент +12%",
    category: "Контент",
  },
  {
    priority: "low",
    text: "Добавьте Telegram-канал для коммуникации",
    effect: "Соцсети +5%",
    category: "Соцсети",
  },
];

const INSIGHTS = [
  {
    type: "niche",
    title: "Пустая ниша",
    text: "AI-чатботы для клиентов — ни один конкурент не предлагает. Спрос растёт на 40% в год.",
  },
  {
    type: "action",
    title: "Топ-действие",
    text: "Добавьте калькулятор стоимости на сайт — это увеличит конверсию на 25-30%.",
  },
  {
    type: "battle",
    title: "Battle Card: Пиксель",
    text: "Ваши преимущества: скорость сайта, HR-бренд. Их слабость: нет Telegram, устаревший блог.",
  },
];

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

// ============================================================
// Components
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
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={circ - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 40, fontWeight: 700, color: c.textPrimary, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>из 100</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, color, c, height = 8 }: { value: number; max?: number; color: string; c: Colors; height?: number }) {
  return (
    <div style={{ height, borderRadius: height / 2, background: c.borderLight, overflow: "hidden", width: "100%" }}>
      <div
        style={{
          height: "100%",
          width: `${(value / max) * 100}%`,
          borderRadius: height / 2,
          background: color,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

function CategoryCard({ cat, c }: { cat: typeof MY_COMPANY.categories[number]; c: Colors }) {
  const color = cat.score >= 75 ? c.accentGreen : cat.score >= 50 ? c.accentWarm : c.accentRed;
  return (
    <div
      style={{
        background: c.bgCard,
        borderRadius: 12,
        padding: "16px 20px",
        border: `1px solid ${c.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cat.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: c.textPrimary }}>{cat.name}</span>
          <span style={{ fontSize: 11, color: c.textMuted }}>{cat.weight}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 20, color }}>{cat.score}</span>
          {cat.delta !== 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: cat.delta > 0 ? c.accentGreen : c.accentRed,
                background: cat.delta > 0 ? c.accentGreen + "18" : c.accentRed + "18",
                padding: "2px 6px",
                borderRadius: 6,
              }}
            >
              {cat.delta > 0 ? "+" : ""}
              {cat.delta}
            </span>
          )}
        </div>
      </div>
      <ProgressBar value={cat.score} color={color} c={c} />
    </div>
  );
}

function RadarChart({ data, competitors, c, size = 280 }: { data: typeof MY_COMPANY; competitors: typeof COMPETITORS; c: Colors; size?: number }) {
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
        <polygon
          key={v}
          points={Array.from({ length: n }, (_, i) => getPoint(i, v))
            .map((p) => `${p.x},${p.y}`)
            .join(" ")}
          fill="none"
          stroke={c.border}
          strokeWidth={1}
        />
      ))}
      {cats.map((cat, i) => {
        const p = getPoint(i, 105);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={c.textSecondary}
            fontSize={11}
            fontWeight={500}
          >
            {cat.name}
          </text>
        );
      })}
      {competitors.map((comp, ci) => (
        <polygon
          key={ci}
          points={makePolygon(comp.categories)}
          fill={[c.accentRed + "15", c.accentYellow + "15", c.accentGreen + "15"][ci]}
          stroke={[c.accentRed, c.accentYellow, c.accentGreen][ci]}
          strokeWidth={1.5}
          strokeOpacity={0.6}
        />
      ))}
      <polygon
        points={makePolygon(cats.map((c2) => c2.score))}
        fill={c.accent + "25"}
        stroke={c.accent}
        strokeWidth={2.5}
      />
      {cats.map((cat, i) => {
        const p = getPoint(i, cat.score);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill={c.accent} stroke={c.bgCard} strokeWidth={2} />;
      })}
    </svg>
  );
}

function CompetitorCard({ comp, c, onClick }: { comp: typeof COMPETITORS[number]; c: Colors; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: c.bgCard,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${c.border}`,
        cursor: "pointer",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = c.shadowLg;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: c.textPrimary }}>{comp.name}</div>
          <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{comp.url}</div>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: comp.score >= 70 ? c.accentGreen + "18" : c.accentWarm + "18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
            color: comp.score >= 70 ? c.accentGreen : c.accentWarm,
          }}
        >
          {comp.score}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: c.textSecondary }}>
        <span>VK: {(comp.vkSubs / 1000).toFixed(1)}K</span>
        <span>Вакансии: {comp.vacancies}</span>
        <span>★ {comp.rating}</span>
      </div>
      <div style={{ fontSize: 11, color: c.textMuted, marginTop: 8 }}>Обновлено: {comp.updated}</div>
    </div>
  );
}

function PriorityBadge({ priority, c }: { priority: string; c: Colors }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    high: { label: "Высокий", bg: c.accentRed + "18", color: c.accentRed },
    medium: { label: "Средний", bg: c.accentYellow + "18", color: c.accentYellow },
    low: { label: "Низкий", bg: c.accentGreen + "18", color: c.accentGreen },
  };
  const { label, bg, color } = map[priority];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 6,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ============================================================
// Navigation items
// ============================================================
const NAV_SECTIONS = [
  {
    title: "МАРКЕТИНГ",
    items: [
      { id: "dashboard", icon: "📊", label: "Дашборд", count: null as number | null },
      { id: "competitors", icon: "🎯", label: "Конкуренты", count: 3 as number | null },
      { id: "compare", icon: "⚖️", label: "Сравнение", count: null as number | null },
      { id: "insights", icon: "💡", label: "AI-инсайты", count: 4 as number | null },
      { id: "reports", icon: "📄", label: "Отчёты", count: null as number | null },
      { id: "sources", icon: "🔗", label: "Источники", count: null as number | null },
    ],
  },
];

// ============================================================
// Main App
// ============================================================
export default function MarketRadarDashboard() {
  const [theme, setTheme] = useState<Theme>("light");
  const [activeNav, setActiveNav] = useState("dashboard");
  const c = COLORS[theme];

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif",
        background: c.bg,
        color: c.textPrimary,
        overflow: "hidden",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          minWidth: 220,
          background: c.bgSidebar,
          borderRight: `1px solid ${c.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "16px 16px 8px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            MR
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, lineHeight: 1.2 }}>MarketRadar</div>
            <div style={{ fontSize: 10, color: c.textMuted }}>company24.pro</div>
          </div>
        </div>

        {/* Nav sections */}
        <div style={{ padding: "8px 8px", flex: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: c.textMuted,
                  letterSpacing: "0.08em",
                  padding: "12px 8px 6px",
                }}
              >
                {section.title}
              </div>
              {section.items.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: isActive ? c.bgSidebarActive : "transparent",
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 13,
                      color: isActive ? c.textPrimary : c.textSecondary,
                      transition: "background 0.15s",
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = c.bgSidebarHover;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.count !== null && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: c.accentWarm + "25",
                          color: c.accentWarm,
                          borderRadius: 10,
                          padding: "1px 7px",
                          minWidth: 18,
                          textAlign: "center",
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom: settings + theme */}
        <div style={{ padding: "8px 8px 12px", borderTop: `1px solid ${c.border}` }}>
          <div
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              color: c.textSecondary,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = c.bgSidebarHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 15 }}>{theme === "light" ? "🌙" : "☀️"}</span>
            <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              color: c.textSecondary,
            }}
          >
            <span style={{ fontSize: 15 }}>⚙️</span>
            <span>Настройки</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: c.textMuted,
            }}
          >
            Powered by company24.pro
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {activeNav === "dashboard" && <DashboardView c={c} />}
        {activeNav === "competitors" && <CompetitorsView c={c} />}
        {activeNav === "compare" && <CompareView c={c} />}
        {activeNav === "insights" && <InsightsView c={c} />}
        {activeNav === "reports" && <ReportsView c={c} />}
        {activeNav === "sources" && <SourcesView c={c} />}
      </main>
    </div>
  );
}

// ============================================================
// Dashboard View
// ============================================================
function DashboardView({ c }: { c: Colors }) {
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Дашборд</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>
          {MY_COMPANY.name} · Общий Score и AI-рекомендации
        </p>
      </div>

      {/* Score + Radar */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Score Card */}
        <div
          style={{
            background: c.bgCard,
            borderRadius: 16,
            border: `1px solid ${c.border}`,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 200,
            boxShadow: c.shadow,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 16, letterSpacing: "0.03em" }}>
            ОБЩИЙ SCORE
          </div>
          <ScoreRing score={MY_COMPANY.score} c={c} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 12, color: c.textSecondary }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary }}>{MY_COMPANY.avgNiche}</div>
              <div>Среднее ниши</div>
            </div>
            <div style={{ width: 1, background: c.border }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: c.accentGreen }}>{MY_COMPANY.top10}+</div>
              <div>ТОП-10%</div>
            </div>
          </div>
        </div>

        {/* Radar Chart Card */}
        <div
          style={{
            background: c.bgCard,
            borderRadius: 16,
            border: `1px solid ${c.border}`,
            padding: 24,
            flex: 1,
            minWidth: 320,
            boxShadow: c.shadow,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>
            СРАВНЕНИЕ ПО КАТЕГОРИЯМ
          </div>
          <RadarChart data={MY_COMPANY} competitors={COMPETITORS} c={c} size={260} />
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> Вы
            </span>
            {COMPETITORS.map((comp, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: c.textSecondary }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: [c.accentRed, c.accentYellow, c.accentGreen][i],
                  }}
                />
                {comp.name.split("«")[1]?.replace("»", "") || comp.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Категории оценки</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        {MY_COMPANY.categories.map((cat) => (
          <CategoryCard key={cat.name} cat={cat} c={c} />
        ))}
      </div>

      {/* Recommendations */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>AI-рекомендации</div>
      <div
        style={{
          background: c.bgCard,
          borderRadius: 16,
          border: `1px solid ${c.border}`,
          overflow: "hidden",
          boxShadow: c.shadow,
        }}
      >
        {RECOMMENDATIONS.map((rec, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 20px",
              borderBottom: i < RECOMMENDATIONS.length - 1 ? `1px solid ${c.borderLight}` : "none",
            }}
          >
            <PriorityBadge priority={rec.priority} c={c} />
            <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: c.accentGreen,
                background: c.accentGreen + "12",
                padding: "3px 10px",
                borderRadius: 6,
                whiteSpace: "nowrap",
              }}
            >
              {rec.effect}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Competitors View
// ============================================================
function CompetitorsView({ c }: { c: Colors }) {
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Конкуренты</h1>
          <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>
            3 из 3 (Free). Добавьте ещё за ₽100/мес
          </p>
        </div>
        <button
          style={{
            background: c.accent,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Добавить конкурента
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {COMPETITORS.map((comp) => (
          <CompetitorCard key={comp.id} comp={comp} c={c} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Compare View
// ============================================================
function CompareView({ c }: { c: Colors }) {
  const allCols = [{ ...MY_COMPANY, isOwn: true as const, vkSubs: 9800, vacancies: 3, rating: 4.6, categories: MY_COMPANY.categories.map(c => c.score) }, ...COMPETITORS.map(comp => ({ ...comp, isOwn: false as const }))];
  const catNames = MY_COMPANY.categories.map((cat) => cat.name);
  const rows: { label: string; key?: string; catIndex?: number }[] = [
    { label: "Score", key: "score" },
    ...catNames.map((name, i) => ({ label: name, catIndex: i })),
    { label: "VK подписчики", key: "vkSubs" },
    { label: "Вакансии", key: "vacancies" },
    { label: "Рейтинг", key: "rating" },
  ];

  const getCellValue = (entity: typeof allCols[number], row: typeof rows[number]): number => {
    if (row.key === "score") return entity.score;
    if (row.catIndex !== undefined) return entity.categories[row.catIndex];
    if (row.key === "vkSubs") return "vkSubs" in entity ? entity.vkSubs : 0;
    if (row.key === "vacancies") return "vacancies" in entity ? entity.vacancies : 0;
    if (row.key === "rating") return "rating" in entity ? entity.rating : 0;
    return 0;
  };

  const getMax = (row: typeof rows[number]) => {
    const vals = allCols.map((e) => getCellValue(e, row));
    return Math.max(...vals);
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Сравнение</h1>

      <div
        style={{
          background: c.bgCard,
          borderRadius: 16,
          border: `1px solid ${c.border}`,
          overflow: "auto",
          boxShadow: c.shadow,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  borderBottom: `2px solid ${c.border}`,
                  color: c.textMuted,
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  position: "sticky",
                  left: 0,
                  background: c.bgCard,
                  minWidth: 120,
                }}
              >
                МЕТРИКА
              </th>
              {allCols.map((entity, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "center",
                    padding: "14px 12px",
                    borderBottom: `2px solid ${c.border}`,
                    fontWeight: 600,
                    fontSize: 12,
                    color: entity.isOwn ? c.accent : c.textPrimary,
                    background: entity.isOwn ? c.accent + "08" : "transparent",
                    minWidth: 120,
                  }}
                >
                  {entity.isOwn ? "Вы" : entity.name.length > 18 ? entity.name.slice(0, 18) + "…" : entity.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const maxVal = getMax(row);
              return (
                <tr key={ri}>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${c.borderLight}`,
                      fontWeight: 500,
                      color: c.textSecondary,
                      position: "sticky",
                      left: 0,
                      background: c.bgCard,
                    }}
                  >
                    {row.label}
                  </td>
                  {allCols.map((entity, i) => {
                    const val = getCellValue(entity, row);
                    const isBest = val === maxVal;
                    return (
                      <td
                        key={i}
                        style={{
                          textAlign: "center",
                          padding: "12px",
                          borderBottom: `1px solid ${c.borderLight}`,
                          fontWeight: isBest ? 700 : 400,
                          color: isBest ? c.accentGreen : c.textPrimary,
                          background: entity.isOwn ? c.accent + "08" : "transparent",
                        }}
                      >
                        {typeof val === "number" && row.key === "vkSubs" ? (val / 1000).toFixed(1) + "K" : val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Insights View
// ============================================================
function InsightsView({ c }: { c: Colors }) {
  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
    niche: { icon: "🔭", label: "Пустая ниша", color: c.accent },
    action: { icon: "🚀", label: "Действие", color: c.accentGreen },
    battle: { icon: "⚔️", label: "Battle Card", color: c.accentRed },
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>AI-инсайты</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {INSIGHTS.map((ins, i) => {
          const cfg = typeConfig[ins.type];
          return (
            <div
              key={i}
              style={{
                background: c.bgCard,
                borderRadius: 14,
                border: `1px solid ${c.border}`,
                padding: 20,
                boxShadow: c.shadow,
                borderLeft: `4px solid ${cfg.color}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: cfg.color,
                    background: cfg.color + "15",
                    padding: "3px 10px",
                    borderRadius: 6,
                    letterSpacing: "0.03em",
                  }}
                >
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
      <div
        style={{
          background: c.bgCard,
          borderRadius: 16,
          border: `1px solid ${c.border}`,
          padding: 32,
          textAlign: "center",
          boxShadow: c.shadow,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>
          PDF-отчёты доступны на тарифе Starter
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 16 }}>
          Получите полный PDF с аудитом, сравнением конкурентов и AI-рекомендациями
        </div>
        <button
          style={{
            background: c.accentWarm,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 24px",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
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
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 16px" }}>
        Бесплатные источники для конкурентного анализа на российском рынке
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "MVP", "v2", "v3"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${filter === f ? c.accent : c.border}`,
              background: filter === f ? c.accent + "15" : "transparent",
              color: filter === f ? c.accent : c.textSecondary,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>

      <div
        style={{
          background: c.bgCard,
          borderRadius: 16,
          border: `1px solid ${c.border}`,
          overflow: "hidden",
          boxShadow: c.shadow,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Источник", "Метод / API", "Цена", "Фаза"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    borderBottom: `2px solid ${c.border}`,
                    color: c.textMuted,
                    fontWeight: 600,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: "10px 16px",
                    borderBottom: `1px solid ${c.borderLight}`,
                    fontWeight: 600,
                    color: c.textPrimary,
                  }}
                >
                  {s.name}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    borderBottom: `1px solid ${c.borderLight}`,
                    color: c.textSecondary,
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {s.method}
                </td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}` }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: c.accentGreen + "18",
                      color: c.accentGreen,
                    }}
                  >
                    {s.price}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    borderBottom: `1px solid ${c.borderLight}`,
                    fontWeight: 600,
                    fontSize: 12,
                    color: s.phase === "MVP" ? c.accent : c.textMuted,
                  }}
                >
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
