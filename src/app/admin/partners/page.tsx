"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Partner } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 36, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  link: { color: "#7c3aed", textDecoration: "none", fontWeight: 600 } as React.CSSProperties,
  filterBtn: (active: boolean) => ({
    background: active ? "#7c3aed" : "#1a1f2e",
    color: active ? "#fff" : "#94a3b8",
    border: "1px solid #2d3748", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  } as React.CSSProperties),
  sectionTab: (active: boolean) => ({
    padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", borderRadius: 8,
    background: active ? "#7c3aed" : "transparent",
    color: active ? "#fff" : "#64748b",
    border: active ? "1px solid #7c3aed" : "1px solid #2d3748",
    transition: "all 0.15s",
  } as React.CSSProperties),
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  active: "#4ade80",
  suspended: "#ef4444",
  rejected: "#64748b",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  active: "Активен",
  suspended: "Заблокирован",
  rejected: "Отклонён",
};

const APP_STATUS_COLORS: Record<string, string> = {
  new: "#60a5fa",
  contacted: "#f59e0b",
  converted: "#4ade80",
  rejected: "#64748b",
};

const APP_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  contacted: "Contacted",
  converted: "Конвертирован",
  rejected: "Отклонена",
};

const TYPE_LABELS: Record<string, string> = {
  referral: "Реферал",
  integrator: "Интегратор",
};

interface PartnerApplication {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  website?: string;
  type: "referral" | "integrator";
  description?: string;
  client_price_amount?: number;
  status: "new" | "contacted" | "converted" | "rejected";
  admin_notes?: string;
  created_at: string;
}

interface ConvertResult {
  email: string;
  tempPassword: string | null;
  isExistingUser: boolean;
  type: string;
  loginUrl: string;
  emailSent?: boolean;
}

export default function PartnersAdmin() {
  const [section, setSection] = useState<"partners" | "applications">("partners");

  // Partners state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // Applications state
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsFilter, setAppsFilter] = useState("");
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);

  async function loadPartners() {
    setPartnersLoading(true);
    const url = filter ? `/api/admin/partners?status=${filter}` : "/api/admin/partners";
    const r = await fetch(url);
    const d = await r.json();
    if (d.ok) setPartners(d.partners);
    setPartnersLoading(false);
  }

  async function loadApplications() {
    setAppsLoading(true);
    const url = appsFilter ? `/api/admin/partners/applications?status=${appsFilter}` : "/api/admin/partners/applications";
    const r = await fetch(url);
    const d = await r.json();
    if (d.ok) setApplications(d.applications);
    setAppsLoading(false);
  }

  useEffect(() => { loadPartners(); }, [filter]);
  useEffect(() => { if (section === "applications") loadApplications(); }, [section, appsFilter]);

  async function updateStatus(partnerId: string, status: string) {
    await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId, status }),
    });
    loadPartners();
  }

  async function updateAppStatus(id: string, status: string, admin_notes?: string) {
    await fetch("/api/admin/partners/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, admin_notes }),
    });
    setEditingApp(null);
    loadApplications();
  }

  async function convertApplication(id: string) {
    setConverting(id);
    const r = await fetch("/api/admin/partners/applications/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: id }),
    });
    const d = await r.json();
    setConverting(null);
    if (d.ok) {
      setConvertResult(d);
      loadApplications();
    } else {
      alert(d.error || "Ошибка конвертации");
    }
  }

  const total = partners.length;
  const active = partners.filter(p => p.status === "active").length;
  const referrals = partners.filter(p => p.type === "referral").length;
  const integrators = partners.filter(p => p.type === "integrator").length;

  const newApps = applications.filter(a => a.status === "new").length;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/partners")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={S.h1}>Партнёры</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.sectionTab(section === "partners")} onClick={() => setSection("partners")}>
              Партнёры
            </button>
            <button style={S.sectionTab(section === "applications")} onClick={() => setSection("applications")}>
              Заявки {newApps > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "50%", padding: "0 6px", fontSize: 11, marginLeft: 4 }}>{newApps}</span>}
            </button>
          </div>
        </div>

        {section === "partners" && (
          <>
            <div style={S.statRow}>
              <div style={S.stat}><div style={S.statNum}>{total}</div><div style={S.statLabel}>Всего</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#4ade80" }}>{active}</div><div style={S.statLabel}>Активных</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#60a5fa" }}>{referrals}</div><div style={S.statLabel}>Рефералы</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#c084fc" }}>{integrators}</div><div style={S.statLabel}>Интеграторы</div></div>
            </div>

            {/* Filter */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              {["", "pending", "active", "suspended", "rejected"].map(s => (
                <button key={s} onClick={() => setFilter(s)} style={S.filterBtn(filter === s)}>
                  {s ? STATUS_LABELS[s] : "Все"}
                </button>
              ))}
            </div>

            {/* Partners Table */}
            {partnersLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
            ) : partners.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
                <div>Нет партнёров</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Партнёр</th>
                      <th style={S.th}>Тип</th>
                      <th style={S.th}>Статус</th>
                      <th style={S.th}>Код</th>
                      <th style={S.th}>Ставка</th>
                      <th style={S.th}>Клиенты</th>
                      <th style={S.th}>Заработано</th>
                      <th style={S.th}>Дата</th>
                      <th style={S.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{p.email}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{p.company_name || p.name || "—"}</div>
                        </td>
                        <td style={S.td}>
                          <span style={S.badge(p.type === "integrator" ? "#c084fc" : "#60a5fa")}>
                            {TYPE_LABELS[p.type]}
                          </span>
                        </td>
                        <td style={S.td}>
                          <span style={S.badge(STATUS_COLORS[p.status] || "#475569")}>
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{p.referral_code}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: "#f59e0b" }}>{p.commission_rate}%</td>
                        <td style={{ ...S.td, fontWeight: 600, color: "#4ade80" }}>{p.client_count || 0}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{formatPrice(Number(p.total_earned) || 0)}</td>
                        <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                          {new Date(p.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <Link href={`/admin/partners/${p.id}`} style={S.link}>Подробнее</Link>
                            {p.status === "pending" && (
                              <>
                                <button onClick={() => updateStatus(p.id, "active")} style={{ background: "none", color: "#4ade80", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Одобрить</button>
                                <button onClick={() => updateStatus(p.id, "rejected")} style={{ background: "none", color: "#ef4444", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Отклонить</button>
                              </>
                            )}
                            {p.status === "active" && (
                              <button onClick={() => updateStatus(p.id, "suspended")} style={{ background: "none", color: "#f59e0b", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Приостановить</button>
                            )}
                            {p.status === "suspended" && (
                              <button onClick={() => updateStatus(p.id, "active")} style={{ background: "none", color: "#4ade80", border: "1px solid #2d3748", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>Возобновить</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Convert result modal */}
        {convertResult && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 16, padding: "32px 36px", maxWidth: 480, width: "100%" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80", marginBottom: 8 }}>✓ Аккаунт создан!</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
                {convertResult.isExistingUser
                  ? "Пользователь с таким email уже существовал — партнёрская запись активирована."
                  : "Новый аккаунт создан. Передайте партнёру следующие данные для входа:"}
              </div>

              <div style={{ background: "#0f1117", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, marginBottom: 4 }}>EMAIL</div>
                  <div style={{ fontFamily: "monospace", fontSize: 15, color: "#e2e8f0", fontWeight: 700 }}>{convertResult.email}</div>
                </div>
                {convertResult.tempPassword && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, marginBottom: 4 }}>ВРЕМЕННЫЙ ПАРОЛЬ</div>
                    <div style={{ fontFamily: "monospace", fontSize: 20, color: "#4ade80", fontWeight: 800, letterSpacing: "0.1em" }}>{convertResult.tempPassword}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Партнёр сможет сменить пароль в настройках</div>
                  </div>
                )}
              </div>

              <div style={{ background: "#7c3aed11", border: "1px solid #7c3aed33", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#a78bfa" }}>
                Ссылка для входа:{" "}
                <strong style={{ color: "#c4b5fd" }}>marketradar24.ru{convertResult.loginUrl}</strong>
              </div>

              <div style={{
                background: convertResult.emailSent ? "#4ade8011" : "#f59e0b11",
                border: `1px solid ${convertResult.emailSent ? "#4ade8033" : "#f59e0b33"}`,
                borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12,
                color: convertResult.emailSent ? "#4ade80" : "#f59e0b",
              }}>
                {convertResult.emailSent
                  ? "✓ Письмо с данными для входа отправлено партнёру на email"
                  : "⚠ Email не отправлен — добавьте RESEND_API_KEY в .env на VPS"}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    const text = `Вход в партнёрский кабинет MarketRadar:\nСсылка: https://marketradar24.ru${convertResult.loginUrl}\nEmail: ${convertResult.email}${convertResult.tempPassword ? `\nПароль: ${convertResult.tempPassword}` : ""}`;
                    navigator.clipboard.writeText(text);
                  }}
                  style={{ flex: 1, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                >
                  Копировать данные
                </button>
                <button
                  onClick={() => setConvertResult(null)}
                  style={{ background: "none", color: "#64748b", border: "1px solid #2d3748", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {section === "applications" && (
          <>
            <div style={{ ...S.statRow, gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div style={S.stat}><div style={S.statNum}>{applications.length}</div><div style={S.statLabel}>Всего заявок</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#60a5fa" }}>{applications.filter(a => a.status === "new").length}</div><div style={S.statLabel}>Новых</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#f59e0b" }}>{applications.filter(a => a.status === "contacted").length}</div><div style={S.statLabel}>В обработке</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#4ade80" }}>{applications.filter(a => a.status === "converted").length}</div><div style={S.statLabel}>Конвертировано</div></div>
            </div>

            {/* Apps Filter */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              {(["", "new", "contacted", "converted", "rejected"] as const).map(s => (
                <button key={s} onClick={() => setAppsFilter(s)} style={S.filterBtn(appsFilter === s)}>
                  {s ? APP_STATUS_LABELS[s] : "Все"}
                </button>
              ))}
            </div>

            {/* Applications Table */}
            {appsLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
            ) : applications.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div>Нет заявок</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Заявитель</th>
                      <th style={S.th}>Тип</th>
                      <th style={S.th}>Контакты</th>
                      <th style={S.th}>Описание</th>
                      <th style={S.th}>Цена клиенту</th>
                      <th style={S.th}>Статус</th>
                      <th style={S.th}>Дата</th>
                      <th style={S.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a, i) => (
                      <>
                        <tr key={a.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 2 }}>{a.email}</div>
                            {a.company_name && <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{a.company_name}</div>}
                          </td>
                          <td style={S.td}>
                            <span style={S.badge(a.type === "integrator" ? "#c084fc" : "#60a5fa")}>
                              {TYPE_LABELS[a.type]}
                            </span>
                          </td>
                          <td style={S.td}>
                            {a.phone && <div style={{ fontSize: 12, color: "#94a3b8" }}>{a.phone}</div>}
                            {a.website && (
                              <a href={a.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#7c3aed", textDecoration: "none" }}>
                                {a.website.replace(/^https?:\/\//, "")}
                              </a>
                            )}
                            {!a.phone && !a.website && <span style={{ color: "#334155" }}>—</span>}
                          </td>
                          <td style={{ ...S.td, maxWidth: 260 }}>
                            {a.description ? (
                              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, wordBreak: "break-word" }}>
                                {a.description.length > 120 ? a.description.slice(0, 120) + "…" : a.description}
                              </div>
                            ) : <span style={{ color: "#334155" }}>—</span>}
                          </td>
                          <td style={S.td}>
                            {a.client_price_amount ? (
                              <div>
                                <div style={{ fontWeight: 700, color: "#f59e0b" }}>{(a.client_price_amount / 100).toLocaleString("ru-RU")} ₽/мес</div>
                                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                                  наценка: +{((a.client_price_amount / 100) - 3900).toLocaleString("ru-RU")} ₽
                                </div>
                              </div>
                            ) : <span style={{ color: "#334155" }}>—</span>}
                          </td>
                          <td style={S.td}>
                            <span style={S.badge(APP_STATUS_COLORS[a.status] || "#475569")}>
                              {APP_STATUS_LABELS[a.status] || a.status}
                            </span>
                            {a.admin_notes && (
                              <div style={{ fontSize: 10, color: "#475569", marginTop: 4, fontStyle: "italic" }}>
                                {a.admin_notes.length > 60 ? a.admin_notes.slice(0, 60) + "…" : a.admin_notes}
                              </div>
                            )}
                          </td>
                          <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                            {new Date(a.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {a.status === "new" && (
                                <button onClick={() => updateAppStatus(a.id, "contacted")} style={{ background: "none", color: "#f59e0b", border: "1px solid #2d3748", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>
                                  ✉ Связались
                                </button>
                              )}
                              {(a.status === "new" || a.status === "contacted") && (
                                <button
                                  onClick={() => convertApplication(a.id)}
                                  disabled={converting === a.id}
                                  style={{ background: "#4ade8022", color: "#4ade80", border: "1px solid #4ade8044", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", fontWeight: 700, opacity: converting === a.id ? 0.6 : 1 }}
                                >
                                  {converting === a.id ? "..." : "✓ Одобрить + создать аккаунт"}
                                </button>
                              )}
                              {a.status !== "rejected" && (
                                <button onClick={() => updateAppStatus(a.id, "rejected")} style={{ background: "none", color: "#ef4444", border: "1px solid #2d3748", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>
                                  ✕ Отклонить
                                </button>
                              )}
                              <button
                                onClick={() => { setEditingApp(editingApp === a.id ? null : a.id); setNotesInput(a.admin_notes || ""); }}
                                style={{ background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}
                              >
                                ✎ Заметка
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingApp === a.id && (
                          <tr key={a.id + "_note"} style={{ background: "#0d1020" }}>
                            <td colSpan={8} style={{ padding: "12px 14px", border: "1px solid #1e2737" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <textarea
                                  value={notesInput}
                                  onChange={e => setNotesInput(e.target.value)}
                                  placeholder="Заметка к заявке..."
                                  style={{ flex: 1, background: "#11131c", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, minHeight: 60, resize: "vertical", outline: "none" }}
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <button
                                    onClick={() => updateAppStatus(a.id, a.status, notesInput)}
                                    style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                  >
                                    Сохранить
                                  </button>
                                  <button
                                    onClick={() => setEditingApp(null)}
                                    style={{ background: "none", color: "#64748b", border: "1px solid #2d3748", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12 }}
                                  >
                                    Отмена
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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
