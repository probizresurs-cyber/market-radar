"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/partner-types";

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
  main: { padding: "36px 32px", maxWidth: 800, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 24 } as React.CSSProperties,
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 14, padding: "28px 32px", marginBottom: 20 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg, #22d3ee, #0891b2)", color: "#0a0b0f", border: "none", borderRadius: 9, padding: "12px 28px", cursor: "pointer", fontWeight: 800, fontSize: 14 } as React.CSSProperties,
  input: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 10, color: "#e2e8f0", padding: "11px 16px", fontSize: 15, width: 200 } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#0d0f18", color: "#475569", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #1e2737" },
  td: { padding: "11px 14px", border: "1px solid #1a2234" },
};

const ITABS = [
  { href: "/integrator", label: "Дашборд" },
  { href: "/integrator/clients", label: "Клиенты" },
  { href: "/integrator/pricing", label: "Ценообразование" },
  { href: "/integrator/payouts", label: "Выплаты" },
];

interface DashStats {
  balance: number;
  reserved: number;
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

export default function IntegratorPayouts() {
  const [stats, setStats] = useState<DashStats | null>(null);
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
      setStats(d.stats);
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
      setMsg("✓ Запрос на вывод создан! Выплата в течение 5 рабочих дней.");
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
        <span style={S.logo}>MarketRadar <span style={S.logoAccent}>Integrator</span></span>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
      </header>
      <nav style={S.nav}>
        {ITABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/integrator/payouts")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Выплаты</div>

        {/* Balance overview */}
        <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0 }}>
          {[
            { label: "К ВЫВОДУ", value: formatPrice(stats?.balance || 0), color: "#22d3ee" },
            { label: "В РЕЗЕРВЕ (60 дн)", value: formatPrice(stats?.reserved || 0), color: "#94a3b8" },
            { label: "ВСЕГО ЗАРАБОТАНО", value: formatPrice(stats?.totalEarned || 0), color: "#4ade80" },
            { label: "ВЫВЕДЕНО", value: formatPrice(stats?.totalPaidOut || 0), color: "#f59e0b" },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center", padding: "4px 0", borderRight: i < 3 ? "1px solid #1e2737" : "none" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 5, letterSpacing: "0.05em", fontWeight: 600 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Payout request */}
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>Запрос на вывод</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              style={S.input}
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setMsg(""); }}
              placeholder="Сумма в рублях"
              min="500"
            />
            <button style={{ ...S.btn, opacity: requesting ? 0.6 : 1 }} onClick={handlePayout} disabled={requesting}>
              {requesting ? "Отправка..." : "Запросить вывод"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 10, lineHeight: 1.6 }}>
            Минимальная сумма: 500 ₽ · Выплата в течение 5 рабочих дней · Реквизиты уточняются при первом выводе
          </div>
          {msg && <div style={{ color: msgColor, marginTop: 10, fontSize: 13, fontWeight: 500 }}>{msg}</div>}
        </div>

        {/* Transaction history */}
        {balances.length > 0 && (
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 28px", borderBottom: "1px solid #1e2737" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>История операций</div>
            </div>
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
                  <tr key={b.id} style={{ background: i % 2 === 0 ? "#0d0f18" : "#0a0b0f" }}>
                    <td style={{ ...S.td, fontSize: 11, color: "#475569" }}>{new Date(b.created_at).toLocaleString("ru-RU")}</td>
                    <td style={S.td}>
                      <span style={S.badge(
                        b.type === "commission" ? "#22d3ee" :
                        b.type === "payout" ? "#f59e0b" :
                        b.type === "reserve" ? "#94a3b8" : "#ef4444"
                      )}>
                        {b.type === "commission" ? "Комиссия" : b.type === "payout" ? "Вывод" : b.type === "reserve" ? "Резерв" : "Возврат"}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: b.amount >= 0 ? "#4ade80" : "#ef4444", fontSize: 14 }}>
                      {b.amount >= 0 ? "+" : ""}{formatPrice(b.amount)}
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>{b.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {balances.length === 0 && (
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <div style={{ color: "#475569" }}>Операций пока нет</div>
          </div>
        )}
      </main>
    </div>
  );
}
