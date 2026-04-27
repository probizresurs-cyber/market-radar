"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px", maxWidth: 800, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 24, marginBottom: 20 } as React.CSSProperties,
  btn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14 } as React.CSSProperties,
  input: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: 200 } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", background: "#131720", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, border: "1px solid #2d3748" },
  td: { padding: "10px 12px", border: "1px solid #1e2737" },
};

const PTABS = [
  { href: "/partner", label: "Дашборд" },
  { href: "/partner/clients", label: "Клиенты" },
  { href: "/partner/payouts", label: "Выплаты" },
  { href: "/partner/certification", label: "Сертификация 🏆" },
];

interface DashData {
  balance: number;
  totalEarned: number;
  totalPaidOut: number;
}

interface BalanceEntry {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default function PartnerPayouts() {
  const [data, setData] = useState<DashData | null>(null);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgColor, setMsgColor] = useState("#4ade80");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/partner/dashboard");
    const d = await r.json();
    if (d.ok && d.partner) {
      setData(d.stats);
      setBalances(d.recentBalances || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handlePayout() {
    const kopecks = Math.round(Number(amount) * 100);
    if (!kopecks || kopecks < 50000) {
      setMsg("Минимальная сумма вывода — 500 ₽");
      setMsgColor("#ef4444");
      return;
    }
    setRequesting(true);
    setMsg("");
    const r = await fetch("/api/partner/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: kopecks }),
    });
    const d = await r.json();
    if (d.ok) {
      setMsg("Запрос на вывод создан!");
      setMsgColor("#4ade80");
      setAmount("");
      load();
    } else {
      setMsg(d.error || "Ошибка");
      setMsgColor("#ef4444");
    }
    setRequesting(false);
  }

  if (loading) return <div style={S.page}><div style={{ textAlign: "center", padding: 80, color: "#475569" }}>Загрузка...</div></div>;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>MarketRadar Partner</span>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
      </header>
      <nav style={S.nav}>
        {PTABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/partner/payouts")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Выплаты</div>

        {/* Balance card */}
        <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>{formatPrice(data?.balance || 0)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>ТЕКУЩИЙ БАЛАНС</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{formatPrice(data?.totalEarned || 0)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>ВСЕГО ЗАРАБОТАНО</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{formatPrice(data?.totalPaidOut || 0)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>ВЫВЕДЕНО</div>
          </div>
        </div>

        {/* Payout form */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Запрос на вывод</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              style={S.input}
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Сумма в рублях"
              min="500"
            />
            <button style={S.btn} onClick={handlePayout} disabled={requesting}>
              {requesting ? "Отправка..." : "Запросить вывод"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Минимум 500 ₽. Выплата в течение 5 рабочих дней.</div>
          {msg && <div style={{ color: msgColor, marginTop: 8, fontSize: 13 }}>{msg}</div>}
        </div>

        {/* History */}
        {balances.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>История операций</div>
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
                        {b.type === "commission" ? "Комиссия" : b.type === "payout" ? "Вывод" : b.type}
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
          </div>
        )}
      </main>
    </div>
  );
}
