"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PartnerClient } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px", maxWidth: 1100, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737" },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
};

const PTABS = [
  { href: "/partner", label: "Дашборд" },
  { href: "/partner/clients", label: "Клиенты" },
  { href: "/partner/payouts", label: "Выплаты" },
];

export default function PartnerClients() {
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/partner/clients");
      const d = await r.json();
      if (d.ok) setClients(d.clients);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>MarketRadar Partner</span>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
      </header>
      <nav style={S.nav}>
        {PTABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/partner/clients")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Привлечённые клиенты ({clients.length})</div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : clients.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div>Пока нет привлечённых клиентов</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>Поделитесь реферальной ссылкой, чтобы начать зарабатывать</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Имя</th>
                  <th style={S.th}>Привлечён</th>
                  <th style={S.th}>Первый платёж</th>
                  <th style={S.th}>Всего оплатил</th>
                  <th style={S.th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{c.client_email || "—"}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{c.client_name || "—"}</td>
                    <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>
                      {new Date(c.attributed_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: c.first_payment_at ? "#4ade80" : "#475569" }}>
                      {c.first_payment_at ? new Date(c.first_payment_at).toLocaleDateString("ru-RU") : "Ожидается"}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: "#4ade80" }}>
                      {formatPrice(Number(c.total_paid) || 0)}
                    </td>
                    <td style={S.td}>
                      {c.first_payment_at
                        ? <span style={S.badge("#4ade80")}>Платящий</span>
                        : <span style={S.badge("#f59e0b")}>Бесплатный</span>
                      }
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
