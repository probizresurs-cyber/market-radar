"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EventRow {
  id: string;
  path: string;
  share_id: string | null;
  session_id: string;
  event_type: "view" | "section" | "click";
  label: string | null;
  created_at: string;
}
interface CountRow { label: string; count: string }
interface PathRow { path: string; views: string }

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" } as React.CSSProperties,
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 20 } as React.CSSProperties,
  filters: { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" as const },
  tab: (active: boolean) => ({ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "#7c3aed" : "#2d3748"}`, background: active ? "#7c3aed" : "#1a1f2e", color: active ? "#fff" : "#94a3b8" } as React.CSSProperties),
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 } as React.CSSProperties,
  statCard: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 18 } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 800, color: "#f1f5f9" } as React.CSSProperties,
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#f1f5f9" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 12px", background: "#0f1117", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid #2d3748" },
  td: { padding: "10px 12px", borderBottom: "1px solid #1e2737", verticalAlign: "top" as const, color: "#e2e8f0" },
  row: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e2737", fontSize: 13 },
  barBg: { height: 6, borderRadius: 3, background: "#0f1117", overflow: "hidden", marginTop: 4 } as React.CSSProperties,
  eventTag: (t: EventRow["event_type"]) => {
    const map: Record<EventRow["event_type"], { bg: string; fg: string }> = {
      view: { bg: "#7c3aed22", fg: "#a78bfa" },
      section: { bg: "#22d3ee22", fg: "#22d3ee" },
      click: { bg: "#22c55e22", fg: "#4ade80" },
    };
    const c = map[t];
    return { fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: c.bg, color: c.fg, display: "inline-block", textTransform: "uppercase" as const, letterSpacing: "0.06em" };
  },
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/leads", label: "Лиды" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/analysis-requests", label: "Заявки с анализа" },
  { href: "/admin/kp-analytics", label: "Аналитика анализа" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
];

const PATH_TABS = [
  { id: "all", label: "Все" },
  { id: "/kp", label: "/kp" },
  { id: "/kp-sozdavaya", label: "/kp-sozdavaya" },
  { id: "/share", label: "Публичные ссылки" },
];

export default function KpAnalyticsAdmin() {
  const [path, setPath] = useState("all");
  const [summary, setSummary] = useState({ total_views: "0", unique_sessions: "0" });
  const [byPath, setByPath] = useState<PathRow[]>([]);
  const [byLabel, setByLabel] = useState<CountRow[]>([]);
  const [bySection, setBySection] = useState<CountRow[]>([]);
  const [recent, setRecent] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (path !== "all") sp.set("path", path);
      const r = await fetch(`/api/admin/kp-analytics?${sp.toString()}`);
      const d = await r.json();
      if (d.ok) {
        setSummary(d.summary);
        setByPath(d.byPath);
        setByLabel(d.byLabel);
        setBySection(d.bySection);
        setRecent(d.recent);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [path]);

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  const maxLabelCount = Math.max(1, ...byLabel.map((r) => parseInt(r.count, 10)));
  const maxSectionCount = Math.max(1, ...bySection.map((r) => parseInt(r.count, 10)));

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map((t) => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/kp-analytics")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Аналитика интерактивного анализа</div>
        <div style={S.sub}>Просмотры, до какого раздела долистали и клики по кнопкам на /kp, /kp-sozdavaya и публичных ссылках /share/[id]. За последние 30 дней.</div>

        <div style={S.filters}>
          {PATH_TABS.map((t) => (
            <button key={t.id} type="button" style={S.tab(path === t.id)} onClick={() => setPath(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={S.statGrid}>
          <div style={S.statCard}>
            <div style={S.statLabel}>Просмотров</div>
            <div style={S.statValue}>{summary.total_views}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>Уникальных сессий</div>
            <div style={S.statValue}>{summary.unique_sessions}</div>
          </div>
        </div>

        {path === "all" && byPath.length > 0 && (
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={S.cardTitle}>Просмотры по страницам</div>
            {byPath.map((r) => (
              <div key={r.path} style={S.row}><span>{r.path}</span><span style={{ fontWeight: 700, color: "#f1f5f9" }}>{r.views}</span></div>
            ))}
          </div>
        )}

        <div style={S.cardGrid}>
          <div style={S.card}>
            <div style={S.cardTitle}>До какого раздела долистали</div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 20, color: "#475569" }}>Загрузка...</div>
            ) : bySection.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#475569" }}>Данных пока нет</div>
            ) : (
              bySection.map((r) => (
                <div key={r.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span>{r.label}</span><span style={{ color: "#94a3b8" }}>{r.count}</span>
                  </div>
                  <div style={S.barBg}><div style={{ width: `${(parseInt(r.count, 10) / maxSectionCount) * 100}%`, height: "100%", background: "#22d3ee" }} /></div>
                </div>
              ))
            )}
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Клики по кнопкам</div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 20, color: "#475569" }}>Загрузка...</div>
            ) : byLabel.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#475569" }}>Кликов пока нет</div>
            ) : (
              byLabel.map((r) => (
                <div key={r.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span>{r.label}</span><span style={{ color: "#94a3b8" }}>{r.count}</span>
                  </div>
                  <div style={S.barBg}><div style={{ width: `${(parseInt(r.count, 10) / maxLabelCount) * 100}%`, height: "100%", background: "#4ade80" }} /></div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Последние события</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Загрузка...</div>
          ) : recent.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Событий ещё не было</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Время</th>
                    <th style={S.th}>Тип</th>
                    <th style={S.th}>Метка</th>
                    <th style={S.th}>Страница</th>
                    <th style={S.th}>Ссылка</th>
                    <th style={S.th}>Сессия</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id}>
                      <td style={{ ...S.td, whiteSpace: "nowrap", color: "#94a3b8" }}>{fmtTime(e.created_at)}</td>
                      <td style={S.td}><span style={S.eventTag(e.event_type)}>{e.event_type}</span></td>
                      <td style={{ ...S.td, fontSize: 12 }}>{e.label || "—"}</td>
                      <td style={{ ...S.td, fontSize: 12, color: "#94a3b8" }}>{e.path}</td>
                      <td style={{ ...S.td, fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{e.share_id || "—"}</td>
                      <td style={{ ...S.td, fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{e.session_id.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
