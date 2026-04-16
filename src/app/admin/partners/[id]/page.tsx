"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Partner, PartnerClient, PartnerBalanceEntry } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  main: { padding: "32px", maxWidth: 1100, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "16px 20px" } as React.CSSProperties,
  statNum: { fontSize: 28, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, border: "1px solid #2d3748" },
  td: { padding: "10px 12px", border: "1px solid #1e2737" },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  back: { color: "#7c3aed", textDecoration: "none", fontSize: 13, fontWeight: 600 } as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, padding: "6px 0", borderBottom: "1px solid #1e2737", fontSize: 13 } as React.CSSProperties,
  lbl: { color: "#64748b", fontWeight: 600 } as React.CSSProperties,
  val: { color: "#e2e8f0" } as React.CSSProperties,
};

const STATUS_COLORS: Record<string, string> = { pending: "#f59e0b", active: "#4ade80", suspended: "#ef4444", rejected: "#64748b" };
const STATUS_LABELS: Record<string, string> = { pending: "Ожидает", active: "Активен", suspended: "Заблокирован", rejected: "Отклонён" };
const TYPE_LABELS: Record<string, string> = { referral: "Реферал", integrator: "Интегратор" };

export default function PartnerDetail() {
  const { id } = useParams() as { id: string };
  const [partner, setPartner] = useState<Partner | null>(null);
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [balances, setBalances] = useState<PartnerBalanceEntry[]>([]);
  const [balanceTotal, setBalanceTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/partners/${id}`);
    const d = await r.json();
    if (d.ok) {
      setPartner(d.partner);
      setClients(d.clients);
      setBalances(d.balances);
      setBalanceTotal(d.balanceTotal);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: string) {
    await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: id, status }),
    });
    load();
  }

  if (loading) return <div style={S.page}><div style={{ textAlign: "center", padding: 80, color: "#475569" }}>Загрузка...</div></div>;
  if (!partner) return <div style={S.page}><div style={{ textAlign: "center", padding: 80, color: "#ef4444" }}>Партнёр не найден</div></div>;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>

      <main style={S.main}>
        <Link href="/admin/partners" style={S.back}>← Назад к партнёрам</Link>
        <div style={{ ...S.h1, marginTop: 16 }}>
          {partner.email}{" "}
          <span style={S.badge(STATUS_COLORS[partner.status] || "#475569")}>{STATUS_LABELS[partner.status]}</span>
        </div>

        {/* Stats */}
        <div style={S.statRow}>
          <div style={S.stat}>
            <div style={S.statNum}>{clients.length}</div>
            <div style={S.statLabel}>Клиентов</div>
          </div>
          <div style={S.stat}>
            <div style={{ ...S.statNum, color: "#4ade80" }}>{partner.commission_rate}%</div>
            <div style={S.statLabel}>Ставка</div>
          </div>
          <div style={S.stat}>
            <div style={{ ...S.statNum, color: "#f59e0b" }}>{formatPrice(balanceTotal)}</div>
            <div style={S.statLabel}>Баланс</div>
          </div>
          <div style={S.stat}>
            <div style={{ ...S.statNum, color: "#c084fc" }}>{TYPE_LABELS[partner.type]}</div>
            <div style={S.statLabel}>Тип</div>
          </div>
        </div>

        {/* Partner details */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Данные партнёра</div>
          <div style={S.row}><span style={S.lbl}>Email</span><span style={S.val}>{partner.email}</span></div>
          <div style={S.row}><span style={S.lbl}>Имя</span><span style={S.val}>{partner.name || "—"}</span></div>
          <div style={S.row}><span style={S.lbl}>Компания</span><span style={S.val}>{partner.company_name || "—"}</span></div>
          <div style={S.row}><span style={S.lbl}>Сайт</span><span style={S.val}>{partner.website || "—"}</span></div>
          <div style={S.row}><span style={S.lbl}>Реф. код</span><span style={{ ...S.val, fontFamily: "monospace", color: "#7c3aed" }}>{partner.referral_code}</span></div>
          <div style={S.row}><span style={S.lbl}>Описание</span><span style={S.val}>{partner.description || "—"}</span></div>
          <div style={S.row}><span style={S.lbl}>Дата регистрации</span><span style={S.val}>{new Date(partner.created_at).toLocaleString("ru-RU")}</span></div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {partner.status !== "active" && (
              <button onClick={() => updateStatus("active")} style={{ background: "#4ade8022", color: "#4ade80", border: "1px solid #4ade8044", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Активировать</button>
            )}
            {partner.status === "active" && (
              <button onClick={() => updateStatus("suspended")} style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Приостановить</button>
            )}
            {partner.status !== "rejected" && (
              <button onClick={() => updateStatus("rejected")} style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Отклонить</button>
            )}
          </div>
        </div>

        {/* Clients table */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Привлечённые клиенты ({clients.length})</div>
          {clients.length === 0 ? (
            <div style={{ color: "#475569", padding: "20px 0" }}>Нет привлечённых клиентов</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Имя</th>
                  <th style={S.th}>Привлечён</th>
                  <th style={S.th}>1-й платёж</th>
                  <th style={S.th}>Оплатил</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={S.td}>{c.client_email || "—"}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{c.client_name || "—"}</td>
                    <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>{new Date(c.attributed_at).toLocaleDateString("ru-RU")}</td>
                    <td style={{ ...S.td, fontSize: 12, color: c.first_payment_at ? "#4ade80" : "#475569" }}>
                      {c.first_payment_at ? new Date(c.first_payment_at).toLocaleDateString("ru-RU") : "Нет"}
                    </td>
                    <td style={{ ...S.td, fontWeight: 600, color: "#4ade80" }}>{formatPrice(Number(c.total_paid) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Balance history */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            История баланса <span style={{ color: "#64748b", fontWeight: 400 }}>(Итого: {formatPrice(balanceTotal)})</span>
          </div>
          {balances.length === 0 ? (
            <div style={{ color: "#475569", padding: "20px 0" }}>Нет записей</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Дата</th>
                  <th style={S.th}>Тип</th>
                  <th style={S.th}>Сумма</th>
                  <th style={S.th}>Описание</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr key={b.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>{new Date(b.created_at).toLocaleString("ru-RU")}</td>
                    <td style={S.td}>
                      <span style={S.badge(b.type === "commission" ? "#4ade80" : b.type === "payout" ? "#f59e0b" : "#64748b")}>
                        {b.type}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: b.amount >= 0 ? "#4ade80" : "#ef4444" }}>
                      {b.amount >= 0 ? "+" : ""}{formatPrice(b.amount)}
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>{b.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
