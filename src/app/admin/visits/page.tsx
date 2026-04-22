"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface VisitRow {
  id: string;
  user_id: string | null;
  entity_type: string | null;
  metadata: { path?: string; referrer?: string; utm?: Record<string, string> } | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email: string | null;
}

interface StatRow {
  source: string;
  day: string;
  cnt: string;
  unique_ips: string;
}

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
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 } as React.CSSProperties,
  statCard: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 18 } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 800, color: "#f1f5f9" } as React.CSSProperties,
  statSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 12px", background: "#0f1117", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid #2d3748" },
  td: { padding: "10px 12px", borderBottom: "1px solid #1e2737", verticalAlign: "top" as const, color: "#e2e8f0" },
  sourceTag: (source: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      landing:  { bg: "#22d3ee22", fg: "#22d3ee" },
      platform: { bg: "#7c3aed22", fg: "#a78bfa" },
    };
    const c = map[source] ?? { bg: "#33415522", fg: "#94a3b8" };
    return { fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: c.bg, color: c.fg, display: "inline-block", textTransform: "uppercase" as const, letterSpacing: "0.06em" };
  },
  barCell: { width: "100%", minWidth: 80 } as React.CSSProperties,
  bar: (pct: number, color: string) => ({ height: 8, borderRadius: 4, background: color, width: `${Math.max(2, Math.min(100, pct))}%`, transition: "width 0.3s" } as React.CSSProperties),
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
];

const SOURCE_TABS: { id: "all" | "landing" | "platform"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "landing", label: "Лендинг" },
  { id: "platform", label: "Платформа" },
];

const RANGE_TABS = [
  { id: 1, label: "24 часа" },
  { id: 7, label: "7 дней" },
  { id: 30, label: "30 дней" },
  { id: 90, label: "90 дней" },
];

export default function VisitsAdmin() {
  const [source, setSource] = useState<"all" | "landing" | "platform">("all");
  const [days, setDays] = useState(7);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (source !== "all") sp.set("source", source);
      sp.set("days", String(days));
      const r = await fetch(`/api/admin/visits?${sp.toString()}`);
      const d = await r.json();
      if (d.ok) {
        setVisits(d.visits);
        setStats(d.stats);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [source, days]);

  const totalVisits = visits.length;
  const totalLanding = visits.filter(v => v.entity_type === "landing").length;
  const totalPlatform = visits.filter(v => v.entity_type === "platform").length;
  const uniqueIps = new Set(visits.map(v => v.ip_address).filter(Boolean)).size;

  // Подготовим агрегированную таблицу по дням
  const byDay: Record<string, { landing: number; platform: number }> = {};
  stats.forEach(s => {
    if (!byDay[s.day]) byDay[s.day] = { landing: 0, platform: 0 };
    if (s.source === "landing") byDay[s.day].landing += parseInt(s.cnt, 10) || 0;
    else if (s.source === "platform") byDay[s.day].platform += parseInt(s.cnt, 10) || 0;
  });
  const days_sorted = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));
  const maxPerDay = Math.max(1, ...days_sorted.map(d => byDay[d].landing + byDay[d].platform));

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function fmtDay(iso: string) {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  }
  function shortUA(ua: string | null) {
    if (!ua) return "—";
    if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile";
    if (/Mac/i.test(ua)) return "Mac";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Linux/i.test(ua)) return "Linux";
    return ua.slice(0, 32);
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/visits")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Журнал посещаемости</div>
        <div style={S.sub}>Визиты на лендинг (radar.company24.pro) и в панель платформы. Один визит в рамках одной браузерной сессии не дублируется.</div>

        <div style={S.filters}>
          {SOURCE_TABS.map(t => (
            <button key={t.id} type="button" style={S.tab(source === t.id)} onClick={() => setSource(t.id)}>{t.label}</button>
          ))}
          <div style={{ width: 1, background: "#2d3748", margin: "0 6px" }} />
          {RANGE_TABS.map(t => (
            <button key={t.id} type="button" style={S.tab(days === t.id)} onClick={() => setDays(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={S.statGrid}>
          <div style={S.statCard}>
            <div style={S.statLabel}>Всего визитов</div>
            <div style={S.statValue}>{totalVisits}</div>
            <div style={S.statSub}>за выбранный период (до 500 последних)</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>Лендинг</div>
            <div style={{ ...S.statValue, color: "#22d3ee" }}>{totalLanding}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>Платформа</div>
            <div style={{ ...S.statValue, color: "#a78bfa" }}>{totalPlatform}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>Уникальных IP</div>
            <div style={S.statValue}>{uniqueIps}</div>
          </div>
        </div>

        {days_sorted.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#f1f5f9" }}>По дням</div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>День</th>
                  <th style={S.th}>Лендинг</th>
                  <th style={S.th}>Платформа</th>
                  <th style={{ ...S.th, width: "35%" }}>График</th>
                </tr>
              </thead>
              <tbody>
                {days_sorted.map(day => {
                  const row = byDay[day];
                  const total = row.landing + row.platform;
                  const pct = (total / maxPerDay) * 100;
                  return (
                    <tr key={day}>
                      <td style={S.td}>{fmtDay(day)}</td>
                      <td style={{ ...S.td, color: "#22d3ee", fontWeight: 600 }}>{row.landing}</td>
                      <td style={{ ...S.td, color: "#a78bfa", fontWeight: 600 }}>{row.platform}</td>
                      <td style={{ ...S.td }}>
                        <div style={{ display: "flex", gap: 2, height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${(row.landing / maxPerDay) * 100}%`, background: "#22d3ee" }} />
                          <div style={{ width: `${(row.platform / maxPerDay) * 100}%`, background: "#a78bfa" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{total} визитов · {pct.toFixed(0)}% от пика</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#f1f5f9" }}>Последние визиты</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Загрузка...</div>
          ) : visits.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Посещений ещё не было</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Время</th>
                    <th style={S.th}>Источник</th>
                    <th style={S.th}>Пользователь</th>
                    <th style={S.th}>Путь</th>
                    <th style={S.th}>Referrer</th>
                    <th style={S.th}>UTM</th>
                    <th style={S.th}>IP</th>
                    <th style={S.th}>Устройство</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(v => {
                    const meta = v.metadata || {};
                    const utm = meta.utm && Object.keys(meta.utm).length ? Object.entries(meta.utm).map(([k, val]) => `${k.replace("utm_", "")}: ${val}`).join(", ") : "";
                    return (
                      <tr key={v.id}>
                        <td style={{ ...S.td, whiteSpace: "nowrap", color: "#94a3b8" }}>{fmtTime(v.created_at)}</td>
                        <td style={S.td}><span style={S.sourceTag(v.entity_type || "other")}>{v.entity_type || "—"}</span></td>
                        <td style={{ ...S.td, fontSize: 12 }}>{v.user_email || <span style={{ color: "#475569" }}>гость</span>}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, color: "#94a3b8", maxWidth: 240, wordBreak: "break-all" }}>{meta.path || "—"}</td>
                        <td style={{ ...S.td, fontSize: 12, color: "#94a3b8", maxWidth: 200, wordBreak: "break-all" }}>{meta.referrer || <span style={{ color: "#475569" }}>—</span>}</td>
                        <td style={{ ...S.td, fontSize: 11, color: "#94a3b8" }}>{utm || <span style={{ color: "#475569" }}>—</span>}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{v.ip_address || "—"}</td>
                        <td style={{ ...S.td, fontSize: 11, color: "#94a3b8" }}>{shortUA(v.user_agent)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
