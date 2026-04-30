"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Partner, PartnerBalanceEntry } from "@/lib/partner-types";
import { INTEGRATOR_SCALES, formatPrice } from "@/lib/partner-types";

const BASE_PRICE_RUB = 3900;

const S = {
  page: { minHeight: "100vh", background: "#0a0b0f", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: "rgba(15,17,26,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e2737", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 50 },
  logo: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" } as React.CSSProperties,
  logoAccent: { color: "#22d3ee" },
  nav: { display: "flex", gap: 2, background: "rgba(15,17,26,0.95)", padding: "0 32px", borderBottom: "1px solid #1e2737", backdropFilter: "blur(8px)" } as React.CSSProperties,
  navLink: (active?: boolean) => ({
    padding: "14px 16px", fontSize: 13, fontWeight: 600,
    color: active ? "#22d3ee" : "#64748b",
    textDecoration: "none",
    borderBottom: active ? "2px solid #22d3ee" : "2px solid transparent",
    transition: "color 0.15s",
  } as React.CSSProperties),
  main: { padding: "36px 32px", maxWidth: 1100, margin: "0 auto" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 } as React.CSSProperties,
  stat: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 14, padding: "22px 24px" } as React.CSSProperties,
  statNum: (color = "#22d3ee") => ({ fontSize: 34, fontWeight: 800, color, letterSpacing: "-0.02em" } as React.CSSProperties),
  statLabel: { fontSize: 11, color: "#475569", marginTop: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 600 },
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 14, padding: "24px 28px", marginBottom: 20 } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: color + "22", color, display: "inline-block", letterSpacing: "0.04em" }),
  btn: (color = "#22d3ee") => ({ background: color, color: color === "#22d3ee" ? "#0a0b0f" : "#fff", border: "none", borderRadius: 9, padding: "10px 22px", cursor: "pointer", fontWeight: 700, fontSize: 13 } as React.CSSProperties),
  copyBox: { background: "#0a0b0f", border: "1px solid #22d3ee44", borderRadius: 10, padding: "11px 16px", fontFamily: "monospace", fontSize: 13, color: "#22d3ee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#0d0f18", color: "#475569", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #1e2737" },
  td: { padding: "11px 14px", border: "1px solid #1a2234" },
};

const STATUS_LABELS: Record<string, string> = { pending: "На модерации", active: "Активен", suspended: "Приостановлен", rejected: "Отклонён" };
const STATUS_COLORS: Record<string, string> = { pending: "#f59e0b", active: "#4ade80", suspended: "#ef4444", rejected: "#64748b" };

const ITABS = [
  { href: "/integrator", label: "Дашборд" },
  { href: "/integrator/clients", label: "Клиенты" },
  { href: "/integrator/pricing", label: "Ценообразование" },
  { href: "/integrator/payouts", label: "Выплаты" },
];

interface Stats {
  totalClients: number;
  payingClients: number;
  balance: number;
  reserved: number;
  totalEarned: number;
  totalPaidOut: number;
}

export default function IntegratorDashboard() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [balances, setBalances] = useState<PartnerBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notPartner, setNotPartner] = useState(false);
  const [wrongType, setWrongType] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/partner/dashboard");
    const d = await r.json();
    if (!d.ok) { window.location.href = "/"; return; }
    if (!d.partner) { setNotPartner(true); setLoading(false); return; }
    if (d.partner.type !== "integrator") { setWrongType(true); setLoading(false); return; }
    setPartner(d.partner);
    setStats(d.stats);
    setBalances(d.recentBalances || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink() {
    if (!partner) return;
    navigator.clipboard.writeText(`${window.location.origin}?rf=${partner.referral_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const clientPriceRub = partner?.client_price_amount ? partner.client_price_amount / 100 : 0;
  const markupPerClient = Math.max(0, clientPriceRub - BASE_PRICE_RUB);
  const commissionPerClient = (BASE_PRICE_RUB * (Number(partner?.commission_rate) || 25)) / 100;
  const totalPerClient = markupPerClient + commissionPerClient;

  if (loading) return (
    <div style={S.page}><div style={{ textAlign: "center", padding: 80, color: "#475569", fontSize: 15 }}>Загрузка...</div></div>
  );

  if (wrongType) return (
    <div style={S.page}>
      <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔀</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>Это кабинет интегратора</div>
        <div style={{ color: "#64748b", marginBottom: 24 }}>Ваш аккаунт зарегистрирован как реферальный партнёр.</div>
        <Link href="/partner" style={{ ...S.btn(), textDecoration: "none", display: "inline-block" }}>Перейти в партнёрский кабинет</Link>
      </div>
    </div>
  );

  if (notPartner) return (
    <div style={S.page}>
      <div style={{ maxWidth: 520, margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤝</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>Кабинет интегратора</div>
        <div style={{ color: "#94a3b8", lineHeight: 1.7, marginBottom: 32 }}>
          Для доступа нужно подать заявку на вступление в партнёрскую программу как интегратор.
        </div>
        <Link href="/partner/apply" style={{ ...S.btn(), textDecoration: "none", display: "inline-block", padding: "13px 28px" }}>
          Подать заявку интегратора →
        </Link>
      </div>
    </div>
  );

  const payingClients = stats?.payingClients || 0;
  const nextScale = INTEGRATOR_SCALES.find(s => s.minClients > payingClients);
  const prevMin = INTEGRATOR_SCALES.slice().reverse().find(s => s.minClients <= payingClients)?.minClients || 0;
  const progressPct = nextScale
    ? Math.min(100, ((payingClients - prevMin) / (nextScale.minClients - prevMin)) * 100)
    : 100;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>
          MarketRadar <span style={S.logoAccent}>Integrator</span>
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/partner/apply" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>Реферальный кабинет</Link>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← На платформу</Link>
        </div>
      </header>
      <nav style={S.nav}>
        {ITABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/integrator")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        {/* Title + status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              Кабинет интегратора
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
              {partner?.company_name || partner?.email} · Код: <span style={{ fontFamily: "monospace", color: "#22d3ee" }}>{partner?.referral_code}</span>
            </div>
          </div>
          <span style={S.badge(STATUS_COLORS[partner?.status || "pending"])}>
            {STATUS_LABELS[partner?.status || "pending"]}
          </span>
        </div>

        {partner?.status === "pending" && (
          <div style={{ background: "#f59e0b11", border: "1px solid #f59e0b33", borderRadius: 10, padding: "12px 18px", marginBottom: 24, fontSize: 13, color: "#f59e0b" }}>
            ⏳ Заявка на модерации. После одобрения вы получите доступ ко всем функциям.
          </div>
        )}

        {partner?.status === "active" && (
          <>
            {/* Stats */}
            <div style={S.statRow}>
              <div style={S.stat}>
                <div style={S.statNum()}>{stats?.payingClients || 0}</div>
                <div style={S.statLabel}>Активных клиентов</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Всего: {stats?.totalClients || 0}</div>
              </div>
              <div style={S.stat}>
                <div style={S.statNum("#a78bfa")}>{formatPrice(stats?.balance || 0)}</div>
                <div style={S.statLabel}>К выводу</div>
                {(stats?.reserved || 0) > 0 && (
                  <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>+ {formatPrice(stats!.reserved)} резерв</div>
                )}
              </div>
              <div style={S.stat}>
                <div style={S.statNum("#f59e0b")}>{Number(partner?.commission_rate) || 25}%</div>
                <div style={S.statLabel}>Текущая ставка</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>от базовой цены</div>
              </div>
              <div style={S.stat}>
                <div style={S.statNum("#4ade80")}>{formatPrice(stats?.totalEarned || 0)}</div>
                <div style={S.statLabel}>Всего заработано</div>
              </div>
            </div>

            {/* Pricing & income block */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Referral link */}
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", marginBottom: 12, letterSpacing: "0.02em" }}>РЕФЕРАЛЬНАЯ ССЫЛКА</div>
                <div style={S.copyBox}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {typeof window !== "undefined" ? window.location.origin : ""}?rf={partner.referral_code}
                  </span>
                  <button onClick={copyLink} style={{ ...S.btn(), flexShrink: 0, padding: "7px 14px", fontSize: 12 }}>
                    {copied ? "✓ Скопировано" : "Копировать"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>
                  Клиенты, зарегистрированные по ссылке, автоматически привязываются к вам
                </div>
              </div>

              {/* Income per client */}
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", marginBottom: 12, letterSpacing: "0.02em" }}>ДОХОД С КЛИЕНТА / МЕС</div>
                {clientPriceRub > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#64748b" }}>Комиссия {Number(partner?.commission_rate)}% от {BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽</span>
                      <span style={{ fontWeight: 700, color: "#22d3ee" }}>+{commissionPerClient.toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#64748b" }}>Наценка ({clientPriceRub.toLocaleString("ru-RU")} − {BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽)</span>
                      <span style={{ fontWeight: 700, color: "#a78bfa" }}>+{markupPerClient.toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ borderTop: "1px solid #1e2737", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: "#f1f5f9", fontWeight: 700 }}>Итого с клиента</span>
                      <span style={{ fontWeight: 800, color: "#4ade80", fontSize: 16 }}>+{totalPerClient.toLocaleString("ru-RU")} ₽</span>
                    </div>
                    {(stats?.payingClients || 0) > 0 && (
                      <div style={{ background: "#4ade8011", border: "1px solid #4ade8033", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#4ade80" }}>
                        При {stats?.payingClients} клиентах → <strong>{(totalPerClient * (stats?.payingClients || 0)).toLocaleString("ru-RU")} ₽/мес</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#475569", fontSize: 13 }}>
                    <div>Цена для клиентов не задана</div>
                    <Link href="/integrator/pricing" style={{ color: "#22d3ee", textDecoration: "none", fontWeight: 600, display: "inline-block", marginTop: 8 }}>
                      Настроить ценообразование →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Commission scale progress */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Шкала комиссий</div>
                {nextScale && (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    До <strong style={{ color: "#22d3ee" }}>{nextScale.rate}%</strong>: ещё {nextScale.minClients - payingClients} клиентов
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {INTEGRATOR_SCALES.map((s, i) => (
                  <div key={i} style={{
                    flex: 1, borderRadius: 10, padding: "12px 8px", textAlign: "center",
                    background: Number(partner?.commission_rate) === s.rate ? "#22d3ee11" : "#0a0b0f",
                    border: Number(partner?.commission_rate) === s.rate ? "1px solid #22d3ee55" : "1px solid #1e2737",
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: Number(partner?.commission_rate) === s.rate ? "#22d3ee" : "#334155" }}>
                      {s.rate}%
                    </div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                      {s.minClients}–{s.maxClients === Infinity ? "∞" : s.maxClients}
                    </div>
                  </div>
                ))}
              </div>
              {nextScale && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 4 }}>
                    <span>{payingClients} платящих</span>
                    <span>{nextScale.minClients}</span>
                  </div>
                  <div style={{ height: 6, background: "#1e293b", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #22d3ee, #a78bfa)",
                      borderRadius: 6, transition: "width 0.4s",
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Recent transactions */}
            {balances.length > 0 && (
              <div style={S.card}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#f1f5f9" }}>Последние операции</div>
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
                            {b.type === "commission" ? "Комиссия" : b.type === "payout" ? "Вывод" : b.type === "reserve" ? "Резерв" : b.type}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: b.amount >= 0 ? "#4ade80" : "#ef4444" }}>
                          {b.amount >= 0 ? "+" : ""}{formatPrice(b.amount)}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>{b.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
