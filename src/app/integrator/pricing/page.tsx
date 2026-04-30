"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INTEGRATOR_SCALES, formatPrice } from "@/lib/partner-types";

const BASE_PRICE_RUB = 3900;
const BASE_PRICE_KOPECKS = BASE_PRICE_RUB * 100;

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
  main: { padding: "36px 32px", maxWidth: 860, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 8 } as React.CSSProperties,
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 14, padding: "28px 32px", marginBottom: 20 } as React.CSSProperties,
  label: { fontSize: 12, color: "#94a3b8", marginBottom: 8, display: "block", fontWeight: 600, letterSpacing: "0.04em" } as React.CSSProperties,
  input: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 10, color: "#e2e8f0", padding: "12px 16px", fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box" as const },
  btn: { background: "linear-gradient(135deg, #22d3ee, #0891b2)", color: "#0a0b0f", border: "none", borderRadius: 9, padding: "12px 28px", cursor: "pointer", fontWeight: 800, fontSize: 14, letterSpacing: "-0.01em" } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e2737" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#0d0f18", color: "#475569", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #1e2737" },
};

const ITABS = [
  { href: "/integrator", label: "Дашборд" },
  { href: "/integrator/clients", label: "Клиенты" },
  { href: "/integrator/pricing", label: "Ценообразование" },
  { href: "/integrator/payouts", label: "Выплаты" },
];

export default function IntegratorPricing() {
  const [currentPrice, setCurrentPrice] = useState(0); // rubles
  const [commissionRate, setCommissionRate] = useState(25);
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgColor, setMsgColor] = useState("#4ade80");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/dashboard").then(r => r.json()).then(d => {
      if (d.ok && d.partner) {
        const rub = d.partner.client_price_amount ? d.partner.client_price_amount / 100 : 0;
        setCurrentPrice(rub);
        setPriceInput(rub > 0 ? String(rub) : "");
        setCommissionRate(Number(d.partner.commission_rate) || 25);
      }
      setLoading(false);
    });
  }, []);

  const priceNum = parseInt(priceInput.replace(/\D/g, ""), 10) || 0;
  const markup = priceNum > BASE_PRICE_RUB ? priceNum - BASE_PRICE_RUB : 0;
  const commission = (BASE_PRICE_RUB * commissionRate) / 100;
  const totalPerClient = markup + commission;

  async function save() {
    if (priceNum > 0 && priceNum < BASE_PRICE_RUB) {
      setMsg(`Минимальная цена — ${BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽`);
      setMsgColor("#ef4444");
      return;
    }
    setSaving(true);
    setMsg("");
    const r = await fetch("/api/partner/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_price_amount: priceNum > 0 ? priceNum * 100 : null }),
    });
    const d = await r.json();
    if (d.ok) {
      setCurrentPrice(priceNum);
      setMsg("Цена обновлена!");
      setMsgColor("#4ade80");
    } else {
      setMsg(d.error || "Ошибка");
      setMsgColor("#ef4444");
    }
    setSaving(false);
  }

  if (loading) return <div style={S.page}><div style={{ textAlign: "center", padding: 80, color: "#475569" }}>Загрузка...</div></div>;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>MarketRadar <span style={S.logoAccent}>Integrator</span></span>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
      </header>
      <nav style={S.nav}>
        {ITABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/integrator/pricing")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Ценообразование</div>
        <div style={{ fontSize: 14, color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}>
          Вы можете устанавливать собственную цену для клиентов. MarketRadar получает базовую стоимость {BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽ — всё остальное ваш доход.
        </div>

        {/* Current + edit */}
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 20 }}>Ваша цена для клиентов</div>

          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>ЦЕНА ДЛЯ КЛИЕНТА (₽/МЕС)</label>
            <input
              style={S.input}
              type="number"
              min={BASE_PRICE_RUB}
              step={100}
              value={priceInput}
              onChange={e => { setPriceInput(e.target.value); setMsg(""); }}
              placeholder={`от ${BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽`}
            />
          </div>

          {/* Live breakdown */}
          <div style={{ background: "#0a0b0f", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{ ...S.row, borderBottom: "1px solid #1e2737" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Базовая цена MarketRadar</span>
              <span style={{ fontSize: 13, color: "#475569" }}>{BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽/мес</span>
            </div>
            <div style={{ ...S.row, borderBottom: "1px solid #1e2737" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Ваша цена клиентам</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: priceNum >= BASE_PRICE_RUB ? "#f1f5f9" : "#ef4444" }}>
                {priceNum > 0 ? `${priceNum.toLocaleString("ru-RU")} ₽/мес` : "—"}
              </span>
            </div>
            <div style={{ ...S.row, borderBottom: "1px solid #1e2737" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Ваша наценка</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: markup > 0 ? "#a78bfa" : "#334155" }}>
                {markup > 0 ? `+${markup.toLocaleString("ru-RU")} ₽` : "0 ₽"}
              </span>
            </div>
            <div style={{ ...S.row, borderBottom: "1px solid #1e2737" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Комиссия {commissionRate}% от {BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#22d3ee" }}>+{commission.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div style={{ ...S.row, borderBottom: "none", marginTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>Итого с клиента / мес</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: totalPerClient > 0 ? "#4ade80" : "#334155" }}>
                {totalPerClient > 0 ? `+${totalPerClient.toLocaleString("ru-RU")} ₽` : "—"}
              </span>
            </div>
          </div>

          {priceNum > 0 && priceNum < BASE_PRICE_RUB && (
            <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: 16 }}>
              ⚠ Цена не может быть ниже базовой ({BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽)
            </div>
          )}

          {msg && <div style={{ color: msgColor, fontSize: 13, marginBottom: 12 }}>{msg}</div>}

          <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить цену"}
          </button>
        </div>

        {/* Income projection table */}
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>Прогноз дохода при вашей цене</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...S.table, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={S.th}>Клиентов</th>
                  <th style={S.th}>Ставка</th>
                  <th style={S.th}>Комиссия / мес</th>
                  <th style={S.th}>Наценка / мес</th>
                  <th style={S.th}>Итого / мес</th>
                </tr>
              </thead>
              <tbody>
                {[1, 3, 5, 6, 10, 11, 20, 30, 50].map((n, i) => {
                  const scale = INTEGRATOR_SCALES.find(s => n >= s.minClients && n <= s.maxClients) || INTEGRATOR_SCALES[0];
                  const comm = (BASE_PRICE_RUB * scale.rate / 100) * n;
                  const mkup = markup * n;
                  const total = comm + mkup;
                  return (
                    <tr key={n} style={{ background: i % 2 === 0 ? "#0d0f18" : "#0a0b0f" }}>
                      <td style={{ padding: "10px 14px", border: "1px solid #1a2234", fontWeight: 700, color: "#f1f5f9" }}>{n}</td>
                      <td style={{ padding: "10px 14px", border: "1px solid #1a2234" }}>
                        <span style={{ background: "#22d3ee22", color: "#22d3ee", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{scale.rate}%</span>
                      </td>
                      <td style={{ padding: "10px 14px", border: "1px solid #1a2234", color: "#22d3ee", fontWeight: 600 }}>
                        {formatPrice(comm * 100)}
                      </td>
                      <td style={{ padding: "10px 14px", border: "1px solid #1a2234", color: "#a78bfa", fontWeight: 600 }}>
                        {markup > 0 ? formatPrice(mkup * 100) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", border: "1px solid #1a2234", color: "#4ade80", fontWeight: 800, fontSize: 14 }}>
                        {formatPrice(total * 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {markup === 0 && (
            <div style={{ fontSize: 12, color: "#475569", marginTop: 12 }}>
              * Введите вашу цену выше, чтобы увидеть доход с учётом наценки
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
