"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PartnerClient } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";

const BASE_PRICE_RUB = 3900;

const S = {
  page: { minHeight: "100vh", background: "#0a0b0f", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: "rgba(15,17,26,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e2737", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 50 },
  logo: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" } as React.CSSProperties,
  logoAccent: { color: "#22d3ee" },
  nav: { display: "flex", gap: 2, background: "rgba(15,17,26,0.95)", padding: "0 32px", borderBottom: "1px solid #1e2737" } as React.CSSProperties,
  navLink: (active?: boolean) => ({
    padding: "14px 16px", fontSize: 13, fontWeight: 600,
    color: active ? "#22d3ee" : "#64748b",
    textDecoration: "none",
    borderBottom: active ? "2px solid #22d3ee" : "2px solid transparent",
  } as React.CSSProperties),
  main: { padding: "36px 32px", maxWidth: 1100, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 24 } as React.CSSProperties,
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 14, padding: "24px 28px", marginBottom: 20 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#0d0f18", color: "#475569", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #1e2737" },
  td: { padding: "12px 14px", border: "1px solid #1a2234" },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  statRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  stat: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 12, padding: "18px 22px" } as React.CSSProperties,
};

const ITABS = [
  { href: "/integrator", label: "Дашборд" },
  { href: "/integrator/clients", label: "Клиенты" },
  { href: "/integrator/pricing", label: "Ценообразование" },
  { href: "/integrator/payouts", label: "Выплаты" },
];

export default function IntegratorClients() {
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [clientPrice, setClientPrice] = useState(0);
  const [commissionRate, setCommissionRate] = useState(25);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cr, dr] = await Promise.all([
        fetch("/api/partner/clients").then(r => r.json()),
        fetch("/api/partner/dashboard").then(r => r.json()),
      ]);
      if (!dr.ok) { window.location.href = "/partner/login"; return; }
      if (cr.ok) setClients(cr.clients);
      if (dr.ok && dr.partner) {
        setClientPrice(dr.partner.client_price_amount ? dr.partner.client_price_amount / 100 : 0);
        setCommissionRate(Number(dr.partner.commission_rate) || 25);
      }
      setLoading(false);
    })();
  }, []);

  const payingCount = clients.filter(c => c.first_payment_at).length;
  const markupPerClient = Math.max(0, clientPrice - BASE_PRICE_RUB);
  const commissionPerClient = (BASE_PRICE_RUB * commissionRate) / 100;
  const totalMrr = (markupPerClient + commissionPerClient) * payingCount;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>MarketRadar <span style={S.logoAccent}>Integrator</span></span>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
      </header>
      <nav style={S.nav}>
        {ITABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/integrator/clients")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Клиенты ({clients.length})</div>

        <div style={S.statRow}>
          <div style={S.stat}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#22d3ee" }}>{payingCount}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Платящих</div>
          </div>
          <div style={S.stat}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#a78bfa" }}>{clients.length - payingCount}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>На пробном периоде</div>
          </div>
          <div style={S.stat}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#4ade80" }}>{totalMrr > 0 ? totalMrr.toLocaleString("ru-RU") + " ₽" : "—"}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>MRR (ваш доход)</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : clients.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Клиентов пока нет</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
              Поделитесь реферальной ссылкой или внедряйте платформу у клиентов напрямую
            </div>
            <Link href="/integrator" style={{ color: "#22d3ee", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              Скопировать ссылку →
            </Link>
          </div>
        ) : (
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Клиент</th>
                    <th style={S.th}>Привлечён</th>
                    <th style={S.th}>Первый платёж</th>
                    <th style={S.th}>Всего оплатил</th>
                    <th style={S.th}>Ваша цена / мес</th>
                    <th style={S.th}>Ваш доход</th>
                    <th style={S.th}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => {
                    const isPaying = !!c.first_payment_at;
                    const incomePerMonth = isPaying ? (markupPerClient + commissionPerClient) : 0;
                    return (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? "#0d0f18" : "#0a0b0f" }}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{c.client_email || "—"}</div>
                          {c.client_name && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{c.client_name}</div>}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>
                          {new Date(c.attributed_at).toLocaleDateString("ru-RU")}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: isPaying ? "#4ade80" : "#475569" }}>
                          {c.first_payment_at ? new Date(c.first_payment_at).toLocaleDateString("ru-RU") : "Ожидается"}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: "#4ade80" }}>
                          {formatPrice(Number(c.total_paid) || 0)}
                        </td>
                        <td style={{ ...S.td, color: "#a78bfa", fontWeight: 600 }}>
                          {clientPrice > 0 ? `${clientPrice.toLocaleString("ru-RU")} ₽` : "—"}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: incomePerMonth > 0 ? "#22d3ee" : "#334155" }}>
                          {incomePerMonth > 0 ? `+${incomePerMonth.toLocaleString("ru-RU")} ₽/мес` : "—"}
                        </td>
                        <td style={S.td}>
                          {isPaying
                            ? <span style={S.badge("#4ade80")}>Платит</span>
                            : <span style={S.badge("#f59e0b")}>Пробный</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
