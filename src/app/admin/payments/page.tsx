"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Payment } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";
import { CreditCard } from "lucide-react";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
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

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", completed: "#4ade80", failed: "#ef4444", refunded: "#64748b",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает", completed: "Оплачен", failed: "Ошибка", refunded: "Возврат",
};
const TYPE_LABELS: Record<string, string> = {
  one_time: "Разовый", subscription: "Подписка", refund: "Возврат",
};

export default function PaymentsAdmin() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  async function load() {
    setLoading(true);
    let url = `/api/admin/payments?limit=${limit}&offset=${page * limit}`;
    if (filter) url += `&status=${filter}`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.ok) { setPayments(d.payments); setTotal(d.total); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/payments")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Платежи</div>

        {/* Filter */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          {["", "pending", "completed", "failed", "refunded"].map(s => (
            <button key={s} onClick={() => { setFilter(s); setPage(0); }} style={{
              background: filter === s ? "#7c3aed" : "#1a1f2e",
              color: filter === s ? "#fff" : "#94a3b8",
              border: "1px solid #2d3748", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>
              {s ? STATUS_LABELS[s] : "Все"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ marginBottom: 12 }}><CreditCard size={32}/></div>
            <div>Нет платежей</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Пользователь</th>
                    <th style={S.th}>Сумма</th>
                    <th style={S.th}>Тип</th>
                    <th style={S.th}>Услуга</th>
                    <th style={S.th}>Статус</th>
                    <th style={S.th}>Партнёр</th>
                    <th style={S.th}>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 500, color: "#e2e8f0" }}>{p.user_email || "—"}</div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{p.id.slice(0, 12)}...</div>
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: p.type === "refund" ? "#ef4444" : "#4ade80" }}>
                        {p.type === "refund" ? "−" : ""}{formatPrice(p.amount)}
                      </td>
                      <td style={S.td}><span style={S.badge("#60a5fa")}>{TYPE_LABELS[p.type] || p.type}</span></td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.item_name || "—"}</td>
                      <td style={S.td}>
                        <span style={S.badge(STATUS_COLORS[p.status] || "#475569")}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>
                        {p.partner_id ? <Link href={`/admin/partners/${p.partner_id}`} style={{ color: "#7c3aed", textDecoration: "none" }}>Партнёр</Link> : "—"}
                      </td>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                        {new Date(p.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ background: "#1a1f2e", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 6, padding: "6px 14px", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>← Назад</button>
                <span style={{ padding: "6px 14px", fontSize: 13, color: "#64748b" }}>{page + 1} / {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ background: "#1a1f2e", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 6, padding: "6px 14px", cursor: page >= totalPages - 1 ? "default" : "pointer", opacity: page >= totalPages - 1 ? 0.4 : 1 }}>Далее →</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
