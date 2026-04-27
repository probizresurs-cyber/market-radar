"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Partner, PartnerBalanceEntry, PartnerType } from "@/lib/partner-types";
import { REFERRAL_SCALES, INTEGRATOR_SCALES, formatPrice } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px", maxWidth: 1100, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 32, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 24, marginBottom: 20 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", background: "#131720", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, border: "1px solid #2d3748" },
  td: { padding: "10px 12px", border: "1px solid #1e2737" },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  btn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14 } as React.CSSProperties,
  input: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%" } as React.CSSProperties,
  select: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%" } as React.CSSProperties,
  label: { fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block", fontWeight: 600 } as React.CSSProperties,
  copyBox: { background: "#0f1117", border: "1px solid #7c3aed", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 14, color: "#7c3aed", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
};

const PTABS = [
  { href: "/partner", label: "Дашборд" },
  { href: "/partner/clients", label: "Клиенты" },
  { href: "/partner/payouts", label: "Выплаты" },
  { href: "/partner/certification", label: "Сертификация 🏆" },
];

const STATUS_LABELS: Record<string, string> = { pending: "На модерации", active: "Активен", suspended: "Приостановлен", rejected: "Отклонён" };
const STATUS_COLORS: Record<string, string> = { pending: "#f59e0b", active: "#4ade80", suspended: "#ef4444", rejected: "#64748b" };

interface Stats {
  totalClients: number;
  payingClients: number;
  balance: number;       // available for payout
  reserved: number;      // locked 60-day reserve
  totalEarned: number;
  totalPaidOut: number;
}

export default function PartnerDashboard() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [balances, setBalances] = useState<PartnerBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notPartner, setNotPartner] = useState(false);
  const [copied, setCopied] = useState(false);

  // Registration form state
  const [regType, setRegType] = useState<PartnerType>("referral");
  const [regCompany, setRegCompany] = useState("");
  const [regWebsite, setRegWebsite] = useState("");
  const [regDesc, setRegDesc] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/partner/dashboard");
    const d = await r.json();
    if (!d.ok) {
      // Not logged in
      window.location.href = "/";
      return;
    }
    if (!d.partner) {
      setNotPartner(true);
    } else {
      setPartner(d.partner);
      setStats(d.stats);
      setBalances(d.recentBalances || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRegister() {
    setRegistering(true);
    setRegError("");
    const r = await fetch("/api/partner/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: regType, company_name: regCompany, website: regWebsite, description: regDesc }),
    });
    const d = await r.json();
    if (d.ok) {
      setNotPartner(false);
      load();
    } else {
      setRegError(d.error || "Ошибка регистрации");
    }
    setRegistering(false);
  }

  function copyLink() {
    if (!partner) return;
    navigator.clipboard.writeText(`${window.location.origin}?rf=${partner.referral_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scales = partner?.type === "integrator" ? INTEGRATOR_SCALES : REFERRAL_SCALES;

  if (loading) {
    return <div style={S.page}><div style={{ textAlign: "center", padding: 80, color: "#475569" }}>Загрузка...</div></div>;
  }

  // Registration form
  if (notPartner) {
    return (
      <div style={S.page}>
        <header style={S.header}>
          <span style={S.logo}>MarketRadar Partner</span>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
        </header>
        <main style={{ ...S.main, maxWidth: 600 }}>
          <div style={{ ...S.h1, textAlign: "center", marginTop: 40 }}>Партнёрская программа</div>
          <div style={{ textAlign: "center", color: "#94a3b8", marginBottom: 32 }}>
            Зарабатывайте 20% с каждого платежа привлечённого клиента
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Регистрация партнёра</div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Тип партнёрства</label>
              <select style={S.select} value={regType} onChange={e => setRegType(e.target.value as PartnerType)}>
                <option value="referral">Реферальный партнёр (20%)</option>
                <option value="integrator">Интегратор (25-50%)</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Компания (необязательно)</label>
              <input style={S.input} value={regCompany} onChange={e => setRegCompany(e.target.value)} placeholder="ООО Компания" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Сайт (необязательно)</label>
              <input style={S.input} value={regWebsite} onChange={e => setRegWebsite(e.target.value)} placeholder="https://..." />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>О вас / как планируете привлекать клиентов</label>
              <textarea
                style={{ ...S.input, minHeight: 80, resize: "vertical" } as React.CSSProperties}
                value={regDesc} onChange={e => setRegDesc(e.target.value)}
                placeholder="Расскажите, как вы будете привлекать клиентов..."
              />
            </div>

            {regError && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{regError}</div>}

            <button style={S.btn} onClick={handleRegister} disabled={registering}>
              {registering ? "Отправка..." : "Подать заявку"}
            </button>
          </div>

          {/* Scale info */}
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Шкала комиссий</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>Реферальный</div>
                {REFERRAL_SCALES.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#94a3b8" }}>
                    <span>{s.minClients}—{s.maxClients === Infinity ? "∞" : s.maxClients} клиентов</span>
                    <span style={{ fontWeight: 700, color: "#4ade80" }}>{s.rate}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>Интегратор</div>
                {INTEGRATOR_SCALES.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#94a3b8" }}>
                    <span>{s.minClients}—{s.maxClients === Infinity ? "∞" : s.maxClients} клиентов</span>
                    <span style={{ fontWeight: 700, color: "#c084fc" }}>{s.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Dashboard
  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>MarketRadar Partner</span>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
      </header>
      <nav style={S.nav}>
        {PTABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/partner")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.h1}>
            Дашборд{" "}
            <span style={S.badge(STATUS_COLORS[partner?.status || "pending"])}>
              {STATUS_LABELS[partner?.status || "pending"]}
            </span>
          </div>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {partner?.type === "integrator" ? "Интегратор" : "Реферал"} • Код: {partner?.referral_code}
          </span>
        </div>

        {partner?.status === "pending" && (
          <div style={{ background: "#f59e0b22", border: "1px solid #f59e0b44", borderRadius: 8, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: "#f59e0b" }}>
            Ваша заявка на модерации. После одобрения вы сможете привлекать клиентов.
          </div>
        )}

        {partner?.status === "active" && (
          <>
            {/* Referral link */}
            <div style={{ ...S.card, border: "1px solid #7c3aed44" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Ваша реферальная ссылка</div>
              <div style={S.copyBox}>
                <span>{typeof window !== "undefined" ? window.location.origin : ""}?rf={partner.referral_code}</span>
                <button onClick={copyLink} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  {copied ? "Скопировано!" : "Копировать"}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={S.statRow}>
              <div style={S.stat}>
                <div style={S.statNum}>{stats?.totalClients || 0}</div>
                <div style={S.statLabel}>Всего клиентов</div>
              </div>
              <div style={S.stat}>
                <div style={{ ...S.statNum, color: "#4ade80" }}>{stats?.payingClients || 0}</div>
                <div style={S.statLabel}>Платящих</div>
              </div>
              <div style={S.stat}>
                <div style={{ ...S.statNum, color: "#f59e0b" }}>{formatPrice(stats?.balance || 0)}</div>
                <div style={S.statLabel}>Доступно к выводу</div>
                {(stats?.reserved || 0) > 0 && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    + {formatPrice(stats!.reserved)} в резерве (60 дн.)
                  </div>
                )}
              </div>
              <div style={S.stat}>
                <div style={{ ...S.statNum, color: "#c084fc" }}>{formatPrice(stats?.totalEarned || 0)}</div>
                <div style={S.statLabel}>Всего заработано</div>
              </div>
            </div>

            {/* Progress to next level */}
            {(() => {
              const payingClients = stats?.payingClients || 0;
              const nextScale = scales.find(s => s.minClients > payingClients);
              if (!nextScale) return null;
              const prevScale = scales.slice().reverse().find(s => s.minClients <= payingClients);
              const prevMin = prevScale ? prevScale.minClients : 0;
              const progress = Math.min(100, ((payingClients - prevMin) / (nextScale.minClients - prevMin)) * 100);
              return (
                <div style={{ ...S.card, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#94a3b8" }}>
                      До следующего уровня <strong style={{ color: "#7c3aed" }}>{nextScale.rate}%</strong>:&nbsp;
                      {nextScale.minClients - payingClients} платящих клиентов
                    </span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{payingClients} / {nextScale.minClients}</span>
                  </div>
                  <div style={{ height: 8, background: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${progress}%`,
                      background: "linear-gradient(90deg, #7c3aed, #c084fc)",
                      borderRadius: 8, transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Commission scale */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            Ваша шкала комиссий ({partner?.type === "integrator" ? "Интегратор" : "Реферал"})
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {scales.map((s, i) => (
              <div key={i} style={{
                flex: 1, background: Number(partner?.commission_rate) === s.rate ? "#7c3aed22" : "#0f1117",
                border: Number(partner?.commission_rate) === s.rate ? "1px solid #7c3aed" : "1px solid #2d3748",
                borderRadius: 8, padding: "12px 8px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: Number(partner?.commission_rate) === s.rate ? "#7c3aed" : "#475569" }}>
                  {s.rate}%
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {s.minClients}—{s.maxClients === Infinity ? "∞" : s.maxClients}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent balance */}
        {balances.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Последние операции</div>
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
                      <span style={S.badge(
                        b.type === "commission" ? "#4ade80" :
                        b.type === "payout" ? "#f59e0b" :
                        b.type === "reserve" ? "#94a3b8" :
                        b.type === "refund" ? "#ef4444" : "#64748b"
                      )}>
                        {b.type === "commission" ? "Комиссия" :
                         b.type === "payout" ? "Вывод" :
                         b.type === "reserve" ? "Резерв" :
                         b.type === "refund" ? "Возврат" : b.type}
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
