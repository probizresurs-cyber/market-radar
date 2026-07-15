"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RequestRow {
  id: string;
  company_name: string;
  website: string;
  contact: string;
  source_path: string | null;
  intent: "full" | "contact";
  status: "new" | "contacted" | "converted" | "rejected";
  admin_notes: string | null;
  created_at: string;
}

const INTENT_LABEL: Record<RequestRow["intent"], string> = {
  full: "Полный анализ · 2 990 ₽",
  contact: "Заявка",
};

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
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 12px", background: "#0f1117", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid #2d3748" },
  td: { padding: "10px 12px", borderBottom: "1px solid #1e2737", verticalAlign: "top" as const, color: "#e2e8f0" },
  select: { background: "#0f1117", color: "#e2e8f0", border: "1px solid #2d3748", borderRadius: 6, padding: "5px 8px", fontSize: 12 } as React.CSSProperties,
  notesInput: { background: "#0f1117", color: "#e2e8f0", border: "1px solid #2d3748", borderRadius: 6, padding: "5px 8px", fontSize: 12, width: "100%", boxSizing: "border-box" as const },
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

const STATUS_TABS: { id: "all" | RequestRow["status"]; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "contacted", label: "Связались" },
  { id: "converted", label: "Конвертированы" },
  { id: "rejected", label: "Отклонены" },
];

const STATUS_LABEL: Record<RequestRow["status"], string> = {
  new: "Новая", contacted: "Связались", converted: "Конвертирована", rejected: "Отклонена",
};

export default function AnalysisRequestsAdmin() {
  const [status, setStatus] = useState<"all" | RequestRow["status"]>("all");
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status !== "all") sp.set("status", status);
      const r = await fetch(`/api/admin/analysis-requests?${sp.toString()}`);
      const d = await r.json();
      if (d.ok) setRows(d.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  async function updateStatus(id: string, newStatus: RequestRow["status"]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    await fetch("/api/admin/analysis-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
  }

  async function saveNotes(id: string) {
    const admin_notes = notesDraft[id];
    if (admin_notes === undefined) return;
    await fetch("/api/admin/analysis-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, admin_notes }),
    });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, admin_notes } : r)));
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map((t) => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/analysis-requests")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Заявки с интерактивного анализа</div>
        <div style={S.sub}>Обе формы с публичных страниц анализа (/kp и т.д.): «Оставить заявку» (общий контакт) и «Заказать за 2 990 ₽» (полный анализ).</div>

        <div style={S.filters}>
          {STATUS_TABS.map((t) => (
            <button key={t.id} type="button" style={S.tab(status === t.id)} onClick={() => setStatus(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={S.card}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Загрузка...</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Заявок ещё не было</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Дата</th>
                    <th style={S.th}>Тип</th>
                    <th style={S.th}>Компания</th>
                    <th style={S.th}>Сайт</th>
                    <th style={S.th}>Контакт</th>
                    <th style={S.th}>Источник</th>
                    <th style={S.th}>Статус</th>
                    <th style={{ ...S.th, width: "22%" }}>Заметки</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...S.td, whiteSpace: "nowrap", color: "#94a3b8" }}>{fmtTime(r.created_at)}</td>
                      <td style={{ ...S.td, fontSize: 11, color: r.intent === "full" ? "#22d3ee" : "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{INTENT_LABEL[r.intent]}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{r.company_name}</td>
                      <td style={{ ...S.td, fontSize: 12, color: "#94a3b8", maxWidth: 200, wordBreak: "break-all" }}>{r.website}</td>
                      <td style={{ ...S.td, fontSize: 12 }}>{r.contact}</td>
                      <td style={{ ...S.td, fontSize: 11, color: "#64748b" }}>{r.source_path || "—"}</td>
                      <td style={S.td}>
                        <select style={S.select} value={r.status} onChange={(e) => updateStatus(r.id, e.target.value as RequestRow["status"])}>
                          {(Object.keys(STATUS_LABEL) as RequestRow["status"][]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={S.td}>
                        <input
                          style={S.notesInput}
                          defaultValue={r.admin_notes ?? ""}
                          placeholder="Заметка…"
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          onBlur={() => saveNotes(r.id)}
                        />
                      </td>
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
