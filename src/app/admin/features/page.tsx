"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";

interface FeatureRow {
  id: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
  waitlistCount: number;
}

interface WaitlistRow {
  id: string;
  feature_id: string;
  user_id: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  feature_label: string;
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" } as React.CSSProperties,
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 24 } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20 } as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center", padding: "14px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  featureId: { fontFamily: "monospace", fontSize: 11, color: "#64748b", letterSpacing: "0.04em" } as React.CSSProperties,
  label: { fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 } as React.CSSProperties,
  desc: { fontSize: 12, color: "#94a3b8" } as React.CSSProperties,
  toggle: (on: boolean) => ({ width: 44, height: 24, borderRadius: 12, background: on ? "#7c3aed" : "#334155", position: "relative" as const, cursor: "pointer", border: "none", transition: "background 0.2s" }),
  toggleDot: (on: boolean) => ({ position: "absolute" as const, top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }),
  countBadge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 20, fontSize: 12, color: "#94a3b8", cursor: "pointer" } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  modalBackdrop: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modal: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, maxWidth: 760, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 24 } as React.CSSProperties,
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } as React.CSSProperties,
  closeBtn: { background: "none", border: "1px solid #2d3748", borderRadius: 8, padding: "6px 14px", color: "#e2e8f0", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 12px", background: "#0f1117", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid #2d3748" },
  td: { padding: "10px 12px", borderBottom: "1px solid #1e2737", verticalAlign: "top" as const, color: "#e2e8f0" },
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
];

export default function FeaturesAdmin() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openWaitlist, setOpenWaitlist] = useState<{ featureId: string; label: string } | null>(null);
  const [waitlistRows, setWaitlistRows] = useState<WaitlistRow[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/features");
      const d = await r.json();
      if (d.ok) setFeatures(d.features);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(featureId: string, next: boolean) {
    setBusyId(featureId);
    try {
      await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: featureId, enabled: next }),
      });
      setFeatures(prev => prev.map(f => f.id === featureId ? { ...f, enabled: next } : f));
    } finally {
      setBusyId(null);
    }
  }

  async function openWaitlistFor(featureId: string, label: string) {
    setOpenWaitlist({ featureId, label });
    setWaitlistLoading(true);
    try {
      const r = await fetch(`/api/admin/features/waitlist?feature=${encodeURIComponent(featureId)}`);
      const d = await r.json();
      if (d.ok) setWaitlistRows(d.items);
    } finally {
      setWaitlistLoading(false);
    }
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/features")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Модули платформы</div>
        <div style={S.sub}>Отключение модуля скрывает его функциональность для всех пользователей. Вкладка остаётся видимой, но показывает экран «Скоро будет» с формой ожидания.</div>

        <div style={S.card}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Загрузка...</div>
          ) : features.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Модули не настроены</div>
          ) : (
            features.map(f => (
              <div key={f.id} style={S.row}>
                <div>
                  <div style={S.label}>{f.label}</div>
                  {f.description && <div style={S.desc}>{f.description}</div>}
                  <div style={{ ...S.featureId, marginTop: 4 }}>{f.id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openWaitlistFor(f.id, f.label)}
                  style={S.countBadge}
                  title="Показать список ожидания"
                >
                  <Users size={12} />
                  {f.waitlistCount} в ожидании
                </button>
                <div>
                  {f.enabled ? (
                    <span style={S.badge("#4ade80")}>Включён</span>
                  ) : (
                    <span style={S.badge("#ef4444")}>Выключен</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(f.id, !f.enabled)}
                  disabled={busyId === f.id}
                  style={S.toggle(f.enabled)}
                  aria-label={f.enabled ? "Выключить" : "Включить"}
                >
                  <span style={S.toggleDot(f.enabled)} />
                </button>
              </div>
            ))
          )}
        </div>

        {openWaitlist && (
          <div style={S.modalBackdrop} onClick={() => setOpenWaitlist(null)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHead}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>СПИСОК ОЖИДАНИЯ</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{openWaitlist.label}</div>
                </div>
                <button style={S.closeBtn} onClick={() => setOpenWaitlist(null)}>Закрыть</button>
              </div>

              {waitlistLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Загрузка...</div>
              ) : waitlistRows.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Пока никто не записался</div>
              ) : (
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Дата</th>
                      <th style={S.th}>Пользователь / Email</th>
                      <th style={S.th}>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlistRows.map(r => (
                      <tr key={r.id}>
                        <td style={S.td}>{fmtDate(r.created_at)}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600 }}>{r.user_name || r.user_email || r.email || "—"}</div>
                          {(r.email || r.user_email) && (
                            <div style={{ fontSize: 11, color: "#64748b" }}>{r.email || r.user_email}</div>
                          )}
                        </td>
                        <td style={{ ...S.td, color: "#94a3b8" }}>{r.note || <span style={{ color: "#475569" }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
