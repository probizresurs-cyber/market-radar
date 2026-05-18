"use client";

/**
 * /admin/leads — база лидов + CRM + bulk-операции.
 *
 * Возможности:
 *   • Импорт CSV/XLSX (drag-and-drop, paste, выбор файла)
 *   • Поиск, фильтры по 8 статусам
 *   • Чекбокс-селекшен → bulk «Сгенерировать отчёты» / «Отправить email»
 *   • Аналитика воронки сверху (свёрнутая по умолчанию)
 *   • Прогресс-бары для длительных операций (1000 лидов → ~50 мин)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
// xlsx-парсер подгружаем динамически с CDN внутри ImportModal — npm-пакет xlsx
// сейчас не публикуется на registry.npmjs.org (есть только на cdn.sheetjs.com).
// Чтобы не тащить тяжёлую зависимость в основной бандл и не падать на CI,
// делаем dynamic import только в момент выбора файла .xlsx.
import {
  Upload, Search, ExternalLink, FileText, RefreshCw, Trash2, Send, BarChart3,
  ChevronDown, ChevronUp, Play, Pause, Loader2, Mail,
} from "lucide-react";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  type LeadStatus,
} from "@/lib/lead-types";

interface LeadRow {
  id: string;
  domain: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  niche: string | null;
  slug: string;
  status: LeadStatus;
  source: string | null;
  tags: string[] | null;
  last_contact_at: string | null;
  created_at: string;
  report_status: string | null;
  report_generated_at: string | null;
  notes_count: number;
}

interface Analytics {
  totalLeads: number;
  byStatus: Record<LeadStatus, number>;
  conversionPct: number;
  customers: number;
  reports: Record<string, { count: number; costCents: number }>;
  totalReportCostRub: number;
  avgHoursByStatus: Record<string, number>;
  activity: { today: number; week: number; month: number };
  sources: Array<{ source: string | null; count: number }>;
  emails: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    totalOpens: number;
    totalClicks: number;
    openRatePct: number;
    clickRatePct: number;
  };
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" } as React.CSSProperties,
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "24px 32px 40px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 20 } as React.CSSProperties,
  toolbar: { display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" } as React.CSSProperties,
  searchWrap: { position: "relative" as const, flex: "1 1 280px", maxWidth: 420 },
  searchInput: { width: "100%", padding: "9px 12px 9px 36px", borderRadius: 8, background: "#1a1f2e", border: "1px solid #2d3748", color: "#e2e8f0", fontSize: 13, outline: "none" } as React.CSSProperties,
  searchIcon: { position: "absolute" as const, left: 11, top: "50%", transform: "translateY(-50%)", color: "#475569" },
  btn: (variant: "primary" | "ghost" | "warn" = "primary") => ({
    padding: "9px 14px", borderRadius: 8, border: variant === "ghost" ? "1px solid #2d3748" : "none",
    background: variant === "primary" ? "#7c3aed" : variant === "warn" ? "#f59e0b" : "transparent",
    color: variant === "ghost" ? "#e2e8f0" : "#fff",
    fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
  } as React.CSSProperties),
  statusChips: { display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 18 },
  chip: (active: boolean, color?: string) => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
    background: active ? (color ?? "#7c3aed") + "22" : "#1a1f2e",
    color: active ? (color ?? "#7c3aed") : "#94a3b8",
    border: active ? `1px solid ${(color ?? "#7c3aed")}55` : "1px solid #2d3748",
  } as React.CSSProperties),
  selectionBar: { padding: "11px 16px", background: "#7c3aed22", border: "1px solid #7c3aed55", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 10 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13, background: "#1a1f2e", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left" as const, padding: "11px 14px", background: "#13182a", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid #2d3748" },
  td: { padding: "12px 14px", borderBottom: "1px solid #1e2737", verticalAlign: "middle" as const, color: "#e2e8f0" },
  domainCell: { fontWeight: 600, color: "#f1f5f9" } as React.CSSProperties,
  metaSmall: { fontSize: 11, color: "#64748b", marginTop: 2 } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: color + "22", color, display: "inline-block" }),
  iconBtn: { background: "transparent", border: "1px solid #2d3748", borderRadius: 6, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", cursor: "pointer" } as React.CSSProperties,
  modalBackdrop: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modal: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, maxWidth: 720, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 24 } as React.CSSProperties,
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } as React.CSSProperties,
  textarea: { width: "100%", minHeight: 200, padding: 12, borderRadius: 8, background: "#0f1117", border: "1px solid #2d3748", color: "#e2e8f0", fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.5, outline: "none", resize: "vertical" as const } as React.CSSProperties,
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, background: "#0f1117", border: "1px solid #2d3748", color: "#e2e8f0", fontSize: 13, outline: "none" } as React.CSSProperties,
  // Analytics
  panel: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, marginBottom: 18, overflow: "hidden" } as React.CSSProperties,
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", cursor: "pointer", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  panelTitle: { fontSize: 13, fontWeight: 700, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  panelBody: { padding: 20 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 } as React.CSSProperties,
  kpiCard: { background: "#13182a", borderRadius: 10, padding: 14, border: "1px solid #2d3748" } as React.CSSProperties,
  kpiLabel: { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 } as React.CSSProperties,
  kpiValue: (color: string) => ({ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }),
  funnelRow: { display: "flex", alignItems: "center", marginBottom: 7, gap: 10 } as React.CSSProperties,
  funnelLabel: { width: 110, fontSize: 12, color: "#94a3b8" } as React.CSSProperties,
  funnelBar: (pct: number, color: string) => ({ height: 22, background: color, width: `${Math.max(2, pct)}%`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, color: "#fff", fontWeight: 700, fontSize: 11, transition: "width 0.4s" } as React.CSSProperties),
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/leads",     label: "Лиды" },
  { href: "/admin/partners",  label: "Партнёры" },
  { href: "/admin/pricing",   label: "Тарифы" },
  { href: "/admin/payments",  label: "Платежи" },
  { href: "/admin/promo",     label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features",  label: "Модули" },
  { href: "/admin/visits",    label: "Посещаемость" },
];

const DEFAULT_EMAIL_TEMPLATE = `Здравствуйте!

Меня зовут [имя], я из MarketRadar24 — платформы для конкурентного анализа.

Мы сделали для вашего сайта {domain} автоматический экспресс-аудит. Если коротко: {summary}

Ваш score сейчас {score}/100 при среднем по нише {niche_average}/100. Подробности и план роста — в коротком отчёте по ссылке ниже.

Хорошего дня!`;

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAutoStart, setBulkAutoStart] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Resume: если предыдущий bulk-цикл был прерван (закрыли вкладку без Stop),
  // в localStorage остался флаг. При входе на страницу спрашиваем — продолжить?
  // Если да — открываем модалку с auto-start, она сразу же подхватит pending-лидов.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const wasRunning = localStorage.getItem("mr_bulk_running") === "true";
      if (wasRunning) {
        // Не открываем сразу — дождёмся загрузки analytics, чтобы понять
        // есть ли реальные pending-лиды.
        const t = setTimeout(() => {
          // Проверяем pending после первого fetch analytics.
          fetch("/api/admin/leads/analytics").then(r => r.json()).then(d => {
            if (d.ok && d.totalLeads > (d.reports?.done?.count ?? 0)) {
              if (confirm("Прошлая bulk-генерация была прервана. Возобновить?")) {
                setBulkAutoStart(true);
                setBulkOpen(true);
              } else {
                localStorage.removeItem("mr_bulk_running");
              }
            } else {
              localStorage.removeItem("mr_bulk_running");
            }
          });
        }, 800);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "300");
      const r = await fetch(`/api/admin/leads?${params.toString()}`);
      const d = await r.json();
      if (d.ok) {
        setLeads(d.leads);
        setByStatus(d.byStatus ?? {});
        setTotal(d.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const loadAnalytics = useCallback(async () => {
    const r = await fetch("/api/admin/leads/analytics");
    const d = await r.json();
    if (d.ok) setAnalytics(d);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const totalAll = useMemo(
    () => Object.values(byStatus).reduce((s, n) => s + n, 0),
    [byStatus],
  );

  // ─── Selection ──────────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id)));
  }
  const allChecked = leads.length > 0 && selected.size === leads.length;

  async function deleteLead(id: string, domain: string) {
    if (!confirm(`Удалить «${domain}» и все его данные?`)) return;
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
    load();
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/leads")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={S.h1}>Лиды</div>
        <div style={S.sub}>
          База доменов для холодного аутрича. Импорт CSV/XLSX, экспресс-отчёт по каждому сайту, email-рассылка с CTA на платформу.
          {" "}Всего: <b style={{ color: "#e2e8f0" }}>{totalAll}</b> {totalAll === 1 ? "лид" : "лидов"}.
        </div>

        <AnalyticsPanel analytics={analytics} open={analyticsOpen} onToggle={() => setAnalyticsOpen(o => !o)} />

        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <Search size={15} style={S.searchIcon} />
            <input
              style={S.searchInput}
              placeholder="Поиск по домену, компании или email"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button style={S.btn("primary")} onClick={() => setImportOpen(true)}>
            <Upload size={14} /> Импорт CSV / XLSX
          </button>
          <button style={S.btn("warn")} onClick={() => setBulkOpen(true)}>
            <Play size={14} /> Сгенерировать пачкой
          </button>
          <button style={S.btn("ghost")} onClick={() => load()} title="Обновить">
            <RefreshCw size={14} />
          </button>
        </div>

        {selected.size > 0 && (
          <div style={S.selectionBar}>
            <div style={{ fontSize: 13, color: "#e2e8f0" }}>
              <b>{selected.size}</b> выбрано
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("primary")} onClick={() => setEmailOpen(true)}>
                <Mail size={13} /> Отправить email
              </button>
              <button style={S.btn("ghost")} onClick={() => setSelected(new Set())}>
                Снять выбор
              </button>
            </div>
          </div>
        )}

        <div style={S.statusChips}>
          <button
            style={S.chip(statusFilter === "all")}
            onClick={() => setStatusFilter("all")}
          >
            Все · {totalAll}
          </button>
          {LEAD_STATUSES.map(s => (
            <button
              key={s}
              style={S.chip(statusFilter === s, LEAD_STATUS_COLORS[s])}
              onClick={() => setStatusFilter(s)}
            >
              {LEAD_STATUS_LABELS[s]} · {byStatus[s] ?? 0}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Загрузка...</div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569", border: "1px dashed #2d3748", borderRadius: 12 }}>
            {total === 0
              ? "Пока нет лидов — нажмите «Импорт CSV / XLSX», чтобы загрузить базу"
              : "По выбранным фильтрам ничего не найдено"}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th style={S.th}>Домен / Компания</th>
                <th style={S.th}>Контакты</th>
                <th style={S.th}>Статус</th>
                <th style={S.th}>Отчёт</th>
                <th style={S.th}>Импорт</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => {
                const reportReady = l.report_status === "done";
                const isChecked = selected.has(l.id);
                return (
                  <tr key={l.id} style={isChecked ? { background: "#7c3aed11" } : undefined}>
                    <td style={S.td}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(l.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td style={S.td}>
                      <Link href={`/admin/leads/${l.id}`} style={{ ...S.domainCell, textDecoration: "none", color: "#f1f5f9" }}>
                        {l.domain}
                      </Link>
                      {(l.company_name || l.niche || l.city) && (
                        <div style={S.metaSmall}>
                          {[l.company_name, l.niche, l.city].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ fontSize: 12 }}>{l.contact_email ?? <span style={{ color: "#475569" }}>—</span>}</div>
                      {l.contact_phone && <div style={S.metaSmall}>{l.contact_phone}</div>}
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(LEAD_STATUS_COLORS[l.status])}>{LEAD_STATUS_LABELS[l.status]}</span>
                      {l.notes_count > 0 && (
                        <div style={S.metaSmall}>📝 {l.notes_count} {l.notes_count === 1 ? "заметка" : "заметок"}</div>
                      )}
                    </td>
                    <td style={S.td}>
                      {reportReady ? (
                        <a href={`/r/${l.slug}`} target="_blank" rel="noreferrer" style={{ color: "#22c55e", textDecoration: "none", fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center" }}>
                          <FileText size={13} /> Открыть <ExternalLink size={10} />
                        </a>
                      ) : l.report_status === "running" ? (
                        <span style={{ color: "#3b82f6", fontSize: 12 }}>⟳ генерируется</span>
                      ) : l.report_status === "failed" ? (
                        <span style={{ color: "#ef4444", fontSize: 12 }}>✗ ошибка</span>
                      ) : (
                        <span style={{ color: "#475569", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...S.td, fontSize: 11, color: "#64748b" }}>
                      {l.source ?? "—"}
                      <div style={S.metaSmall}>{fmtDate(l.created_at)}</div>
                    </td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <button
                        style={S.iconBtn}
                        onClick={() => deleteLead(l.id, l.domain)}
                        title="Удалить лид"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); loadAnalytics(); }} />}
        {bulkOpen && (
          <BulkGenerateModal
            autoStart={bulkAutoStart}
            onClose={() => { setBulkOpen(false); setBulkAutoStart(false); }}
            onProgress={() => { load(); loadAnalytics(); }}
          />
        )}
        {emailOpen && (
          <EmailModal
            leadIds={Array.from(selected)}
            onClose={() => setEmailOpen(false)}
            onDone={() => { setEmailOpen(false); setSelected(new Set()); load(); loadAnalytics(); }}
          />
        )}
      </main>
    </div>
  );
}

// ─── Analytics panel ──────────────────────────────────────────────────────

function AnalyticsPanel({ analytics, open, onToggle }: { analytics: Analytics | null; open: boolean; onToggle: () => void }) {
  if (!analytics) return null;
  const { totalLeads, byStatus, conversionPct, customers, reports, totalReportCostRub, activity, emails } = analytics;
  const reportsDone = reports.done?.count ?? 0;
  const reportsPending = totalLeads - reportsDone;

  return (
    <div style={S.panel}>
      <div style={S.panelHead} onClick={onToggle}>
        <div style={S.panelTitle}>
          <BarChart3 size={15} />
          Аналитика воронки
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginLeft: 8 }}>
            · {customers} {customers === 1 ? "клиент" : "клиентов"} · конверсия {conversionPct}%
          </span>
        </div>
        {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </div>
      {open && (
        <div style={S.panelBody}>
          <div style={S.kpiGrid}>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Всего лидов</div>
              <div style={S.kpiValue("#f1f5f9")}>{totalLeads}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Купили</div>
              <div style={S.kpiValue("#22c55e")}>{customers}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Конверсия</div>
              <div style={S.kpiValue("#7c3aed")}>{conversionPct}%</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Отчёты готовы</div>
              <div style={S.kpiValue("#06b6d4")}>{reportsDone}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>осталось: {Math.max(0, reportsPending)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Стоимость отчётов</div>
              <div style={S.kpiValue("#f59e0b")}>{totalReportCostRub} ₽</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Контактов сегодня</div>
              <div style={S.kpiValue("#22c55e")}>{activity.today}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>неделя {activity.week} · месяц {activity.month}</div>
            </div>
          </div>

          {/* Email-метрики — отдельная строка KPI под основными. */}
          {emails && emails.sent > 0 && (
            <div style={{ ...S.kpiGrid, marginBottom: 18 }}>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Email отправлено</div>
                <div style={S.kpiValue("#3b82f6")}>{emails.sent}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>всего попыток: {emails.total}</div>
              </div>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Открыли</div>
                <div style={S.kpiValue("#06b6d4")}>{emails.opened}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>OR: {emails.openRatePct}%</div>
              </div>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Кликнули по CTA</div>
                <div style={S.kpiValue("#22c55e")}>{emails.clicked}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>CTR: {emails.clickRatePct}%</div>
              </div>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Всего открытий</div>
                <div style={S.kpiValue("#94a3b8")}>{emails.totalOpens}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>кликов: {emails.totalClicks}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Воронка</div>
            {LEAD_STATUSES.map(s => {
              const cnt = byStatus[s] ?? 0;
              const pct = totalLeads > 0 ? (cnt / totalLeads) * 100 : 0;
              if (cnt === 0) return null;
              return (
                <div key={s} style={S.funnelRow}>
                  <div style={S.funnelLabel}>{LEAD_STATUS_LABELS[s]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.funnelBar(pct, LEAD_STATUS_COLORS[s])}>{cnt}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Import modal (CSV + XLSX) ────────────────────────────────────────────

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState(`csv-${new Date().toISOString().slice(0, 10)}`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number; errors: string[] } | null>(null);

  async function submit() {
    if (!csv.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, source }),
      });
      const d = await r.json();
      if (d.ok) setResult({ imported: d.imported, skipped: d.skipped, total: d.total, errors: d.errors ?? [] });
      else alert(d.error || "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      try {
        // Динамически грузим SheetJS с их CDN. У них есть UMD-сборка, которая
        // регистрирует window.XLSX. Грузим один раз, потом переиспользуем.
        // Тип не важен — используем 3 метода: read, Sheets, utils.sheet_to_csv.
        const w = window as unknown as { XLSX?: { read: (buf: ArrayBuffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_csv: (ws: unknown, opts?: { FS?: string }) => string } } };
        if (!w.XLSX) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Не удалось загрузить XLSX-парсер с cdn.sheetjs.com"));
            document.head.appendChild(script);
          });
        }
        const XLSX = w.XLSX!;
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csvStr = XLSX.utils.sheet_to_csv(ws, { FS: "," });
        setCsv(csvStr);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Не удалось распарсить XLSX. Попробуйте сохранить файл как CSV в Excel и загрузить заново.");
      }
    } else {
      const text = await file.text();
      setCsv(text);
    }
  }

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>ИМПОРТ БАЗЫ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Загрузить CSV или XLSX с лидами</div>
          </div>
          <button style={{ ...S.btn("ghost"), padding: "6px 14px" }} onClick={onClose}>Закрыть</button>
        </div>

        {result ? (
          <div>
            <div style={{ padding: 20, background: "#0f1117", borderRadius: 10, marginBottom: 16, border: "1px solid #2d3748" }}>
              <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 6 }}>Итог импорта:</div>
              <div style={{ display: "flex", gap: 18, fontSize: 14 }}>
                <div><b style={{ color: "#22c55e", fontSize: 22 }}>{result.imported}</b> новых</div>
                <div><b style={{ color: "#f59e0b", fontSize: 22 }}>{result.skipped}</b> пропущено</div>
                <div><b style={{ color: "#94a3b8", fontSize: 22 }}>{result.total}</b> в файле</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: "#0f1117", borderRadius: 8, border: "1px solid #2d3748" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>Предупреждения (первые 20):</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#94a3b8" }}>
                  {result.errors.map((e, i) => <li key={i} style={{ marginBottom: 4 }}>{e}</li>)}
                </ul>
              </div>
            )}
            <button style={S.btn("primary")} onClick={onDone}>Закрыть и обновить список</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.6 }}>
              Поддерживаются колонки: <code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>domain</code> (обязательно), а также любые из:
              {" "}company / email / phone / telegram / city / niche / tags.
              Разделитель CSV — запятая или точка с запятой. Дубликаты по домену пропускаются.
            </div>
            <input
              type="text"
              placeholder="Метка партии (например, '2GIS стоматологии Москва')"
              value={source}
              onChange={e => setSource(e.target.value)}
              style={{ ...S.input, marginBottom: 10 }}
            />
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "inline-block", padding: "8px 14px", background: "#0f1117", border: "1px dashed #2d3748", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
                📁 Выбрать файл CSV / XLSX
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                />
              </label>
              <span style={{ fontSize: 11, color: "#475569", marginLeft: 10 }}>или вставьте CSV-текст ниже</span>
            </div>
            <textarea
              style={S.textarea}
              placeholder="domain,company,email,phone,niche&#10;me-dent.ru,Стоматология Менделеев,info@me-dent.ru,+7..., медицина"
              value={csv}
              onChange={e => setCsv(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={onClose} disabled={busy}>Отмена</button>
              <button style={S.btn("primary")} onClick={submit} disabled={busy || !csv.trim()}>
                {busy ? "Импорт…" : "Импортировать"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bulk generation modal ────────────────────────────────────────────────

function BulkGenerateModal({ autoStart, onClose, onProgress }: { autoStart?: boolean; onClose: () => void; onProgress: () => void }) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [logs, setLogs] = useState<Array<{ domain: string; ok: boolean; error?: string }>>([]);

  // Используем ref-ы для управления циклом — обычный state не виден внутри
  // запущенного промиса (closure ловит старое значение).
  const runningRef = React.useRef(false);
  const pausedRef = React.useRef(false);

  const start = React.useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    // Флаг в localStorage — если вкладку закроют, при следующем заходе мы
    // спросим «продолжить?» и подхватим pending-лидов.
    try { localStorage.setItem("mr_bulk_running", "true"); } catch { /* ignore */ }

    while (runningRef.current) {
      // Пауза — крутимся в холостую пока не снимут.
      if (pausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      let d: { ok: boolean; error?: string; results?: Array<{ ok: boolean; domain: string; error?: string }>; remaining?: number };
      try {
        const r = await fetch("/api/admin/leads/generate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onlyMissing: true, limit: 5 }),
        });
        d = await r.json();
      } catch (e) {
        // Сеть отвалилась — пауза и retry через 5 сек, не теряя прогресс.
        // Полезно если деплой VPS затянулся или nginx моргнул.
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      if (!d.ok) {
        alert(`Ошибка партии: ${d.error}`);
        break;
      }
      const results = d.results ?? [];
      const ok = results.filter(x => x.ok).length;
      const fail = results.length - ok;
      setDone(prev => prev + ok);
      setFailed(prev => prev + fail);
      setLogs(prev => [...results, ...prev].slice(0, 50));
      setRemaining(d.remaining ?? null);
      onProgress();
      if ((d.remaining ?? 0) === 0 || results.length === 0) break;
    }

    runningRef.current = false;
    setRunning(false);
    try { localStorage.removeItem("mr_bulk_running"); } catch { /* ignore */ }
  }, [onProgress]);

  // Auto-start при возобновлении прерванной сессии.
  useEffect(() => {
    if (autoStart) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  function togglePause() {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  function stop() {
    runningRef.current = false;
    pausedRef.current = false;
    setRunning(false);
    setPaused(false);
    try { localStorage.removeItem("mr_bulk_running"); } catch { /* ignore */ }
  }

  return (
    <div style={S.modalBackdrop} onClick={() => !running && onClose()}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>BULK ГЕНЕРАЦИЯ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Сгенерировать отчёты для всех лидов без отчёта</div>
          </div>
          <button style={{ ...S.btn("ghost"), padding: "6px 14px" }} onClick={onClose} disabled={running}>Закрыть</button>
        </div>

        <div style={{ padding: 14, background: "#0f1117", borderRadius: 10, marginBottom: 16, border: "1px solid #2d3748", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
          Скрипт идёт пачками по 5 лидов параллельно через 3 коннекта (concurrency=3).
          Один отчёт ≈ 15-30 сек, стоимость ≈ 1.5 ₽. Можно поставить на паузу или остановить.
          Уже сгенерированные пропускаются.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Готово</div>
            <div style={S.kpiValue("#22c55e")}>{done}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Ошибок</div>
            <div style={S.kpiValue("#ef4444")}>{failed}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Осталось</div>
            <div style={S.kpiValue("#f59e0b")}>{remaining ?? "?"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {!running ? (
            <button style={S.btn("primary")} onClick={start}>
              <Play size={14} /> Запустить
            </button>
          ) : (
            <>
              <button style={S.btn("warn")} onClick={togglePause}>
                {paused ? <><Play size={14} /> Продолжить</> : <><Pause size={14} /> Пауза</>}
              </button>
              <button style={S.btn("ghost")} onClick={stop}>
                Стоп
              </button>
              <div style={{ alignSelf: "center", color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={14} className="spin" /> {paused ? "На паузе" : "Идёт генерация…"}
              </div>
            </>
          )}
        </div>

        {logs.length > 0 && (
          <div style={{ background: "#0f1117", borderRadius: 8, padding: 10, maxHeight: 220, overflow: "auto", border: "1px solid #2d3748" }}>
            {logs.map((l, i) => (
              <div key={i} style={{ fontSize: 12, padding: "3px 0", color: l.ok ? "#22c55e" : "#ef4444", fontFamily: "ui-monospace, monospace" }}>
                {l.ok ? "✓" : "✗"} {l.domain} {l.error && <span style={{ color: "#64748b" }}>— {l.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Email modal ──────────────────────────────────────────────────────────

function EmailModal({ leadIds, onClose, onDone }: { leadIds: string[]; onClose: () => void; onDone: () => void }) {
  const [subject, setSubject] = useState("Мини-аудит вашего сайта {domain} от MarketRadar24");
  const [template, setTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; results: Array<{ domain: string; ok: boolean; reason?: string }> } | null>(null);

  async function submit() {
    if (!subject.trim() || !template.trim()) return;
    if (!confirm(`Отправить ${leadIds.length} писем?`)) return;
    setSending(true);
    try {
      const r = await fetch("/api/admin/leads/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, subject, template }),
      });
      const d = await r.json();
      if (d.ok) {
        setResult({ sent: d.sent, failed: d.failed, results: d.results });
      } else {
        alert(d.error || "Ошибка отправки");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={S.modalBackdrop} onClick={() => !sending && onClose()}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>EMAIL РАССЫЛКА</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Отправить {leadIds.length} письмам</div>
          </div>
          <button style={{ ...S.btn("ghost"), padding: "6px 14px" }} onClick={onClose} disabled={sending}>Закрыть</button>
        </div>

        {result ? (
          <div>
            <div style={{ padding: 18, background: "#0f1117", borderRadius: 10, marginBottom: 14, border: "1px solid #2d3748" }}>
              <div style={{ display: "flex", gap: 18, fontSize: 14 }}>
                <div><b style={{ color: "#22c55e", fontSize: 22 }}>{result.sent}</b> отправлено</div>
                <div><b style={{ color: "#ef4444", fontSize: 22 }}>{result.failed}</b> не отправлено</div>
              </div>
            </div>
            {result.results.some(r => !r.ok) && (
              <div style={{ marginBottom: 14, padding: 12, background: "#0f1117", borderRadius: 8, border: "1px solid #2d3748", maxHeight: 220, overflow: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>Не отправлены:</div>
                {result.results.filter(r => !r.ok).map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                    {r.domain} <span style={{ color: "#64748b" }}>— {r.reason}</span>
                  </div>
                ))}
              </div>
            )}
            <button style={S.btn("primary")} onClick={onDone}>Закрыть</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.6 }}>
              В тексте можно использовать плейсхолдеры:
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{domain}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{company}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{summary}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{score}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{niche_average}"}</code>.
              {" "}Ссылка на отчёт добавляется автоматически кнопкой. Пропускаются лиды без email или без готового отчёта.
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Тема</label>
              <input style={S.input} value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Текст письма</label>
              <textarea
                style={{ ...S.textarea, fontFamily: "inherit", fontSize: 13, minHeight: 200 }}
                value={template}
                onChange={e => setTemplate(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={onClose} disabled={sending}>Отмена</button>
              <button style={S.btn("primary")} onClick={submit} disabled={sending || !subject.trim() || !template.trim()}>
                {sending ? "Отправляем…" : <><Send size={13} /> Отправить {leadIds.length}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
