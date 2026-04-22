"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Partner } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 36, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  link: { color: "#7c3aed", textDecoration: "none", fontWeight: 600 } as React.CSSProperties,
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

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  active: "#4ade80",
  suspended: "#ef4444",
  rejected: "#64748b",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  active: "Активен",
  suspended: "Заблокирован",
  rejected: "Отклонён",
};

const TYPE_LABELS: Record<string, string> = {
  referral: "Реферал",
  integrator: "Интегратор",
};

export default function PartnersAdmin() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    const url = filter ? `/api/admin/partners?status=${filter}` : "/api/admin/partners";
    const r = await fetch(url);
    const d = await r.json();
    if (d.ok) setPartners(d.partners);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function updateStatus(partnerId: string, status: string) {
    await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId, status }),
    });
    load();
  }

  const total = partners.length;
  const active = partners.filter(p => p.status === "active").length;
  const referrals = partners.filter(p => p.type === "referral").length;
  const integrators = partners.filter(p => p.type === "integrator").length;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/partners")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Партнёры</div>

        <div style={S.statRow}>
          <div style={S.stat}><div style={S.statNum}>{total}</div><div style={S.statLabel}>Всего</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: "#4ade80" }}>{active}</div><div style={S.statLabel}>Активных</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: "#60a5fa" }}>{referrals}</div><div style={S.statLabel}>Рефералы</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: "#c084fc" }}>{integrators}</div><div style={S.statLabel}>Интеграторы</div></div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          {["", "pending", "active", "suspended", "rejected"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? "#7c3aed" : "#1a1f2e",
              color: filter === s ? "#fff" : "#94a3b8",
              border: "1px solid #2d3748", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>
              {s ? STATUS_LABELS[s] : "Все"}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : partners.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
            <div>Нет партнёров</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Партнёр</th>
                  <th style={S.th}>Тип</th>
                  <th style={S.th}>Статус</th>
                  <th style={S.th}>Код</th>
                  <th style={S.th}>Ставка</th>
                  <th style={S.th}>Клиенты</th>
                  <th style={S.th}>Заработано</th>
                  <th style={S.th}>Дата</th>
                  <th style={S.th}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{p.email}</div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{p.company_name || p.name || "—"}</div>
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(p.type === "integrator" ? "#c084fc" : "#60a5fa")}>
                        {TYPE_LABELS[p.type]}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(STATUS_COLORS[p.status] || "#475569")}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{p.referral_code}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: "#f59e0b" }}>{p.commission_rate}%</td>
                    <td style={{ ...S.td, fontWeight: 600, color: "#4ade80" }}>{p.client_count || 0}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{formatPrice(Number(p.total_earned) || 0)}</td>
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                      {new Date(p.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Link href={`/admin/partners/${p.id}`} style={S.link}>Подробнее</Link>
                        {p.status === "pending" && (
                          <>
                            <button onClick={() => updateStatus(p.id, "active")} style={{ background: "none", color: "#4ade80", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Одобрить</button>
                            <button onClick={() => updateStatus(p.id, "rejected")} style={{ background: "none", color: "#ef4444", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Отклонить</button>
                          </>
                        )}
                        {p.status === "active" && (
                          <button onClick={() => updateStatus(p.id, "suspended")} style={{ background: "none", color: "#f59e0b", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Приостановить</button>
                        )}
                        {p.status === "suspended" && (
                          <button onClick={() => updateStatus(p.id, "active")} style={{ background: "none", color: "#4ade80", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Возобновить</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
