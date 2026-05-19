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
  ChevronDown, ChevronUp, Play, Pause, Loader2, Mail, LayoutGrid, List, MoveRight, X,
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

  // ─── Kanban доска ─────────────────────────────────────────────────────
  viewToggle: { display: "inline-flex", background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, padding: 2 } as React.CSSProperties,
  viewBtn: (active: boolean) => ({
    padding: "7px 12px", borderRadius: 6, border: "none",
    background: active ? "#7c3aed" : "transparent",
    color: active ? "#fff" : "#94a3b8",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  } as React.CSSProperties),
  // Доска: горизонтально-скроллируемый контейнер с фиксированными столбцами.
  // overflow-x: auto чтобы при 8 статусах × 280px не ломать layout.
  board: { display: "flex", gap: 12, overflowX: "auto" as const, paddingBottom: 16, scrollbarColor: "#2d3748 transparent" } as React.CSSProperties,
  column: (color: string, dragOver: boolean) => ({
    flex: "0 0 290px",
    background: "#13182a",
    border: `1px solid ${dragOver ? color : "#2d3748"}`,
    boxShadow: dragOver ? `0 0 0 2px ${color}55, 0 0 22px ${color}33` : "none",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column" as const,
    maxHeight: "calc(100vh - 300px)",
    transition: "border 0.15s, box-shadow 0.15s",
  }),
  columnHead: (color: string) => ({
    padding: "12px 14px",
    borderBottom: `1px solid #2d3748`,
    borderTop: `3px solid ${color}`,
    borderRadius: "12px 12px 0 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: `${color}10`,
  }),
  columnTitle: (color: string) => ({
    fontSize: 12, fontWeight: 800, color, letterSpacing: "0.04em",
    textTransform: "uppercase" as const, display: "flex", alignItems: "center", gap: 6,
  }),
  columnCount: { fontSize: 11, color: "#64748b", background: "#0f1117", padding: "2px 8px", borderRadius: 999, fontWeight: 700 } as React.CSSProperties,
  columnBody: { padding: 8, overflowY: "auto" as const, flex: 1, display: "flex", flexDirection: "column" as const, gap: 8 } as React.CSSProperties,
  kanCard: (selected: boolean, dragging: boolean) => ({
    background: selected ? "#7c3aed18" : "#1a1f2e",
    border: `1px solid ${selected ? "#7c3aed55" : "#2d3748"}`,
    borderRadius: 10,
    padding: 11,
    cursor: "grab",
    opacity: dragging ? 0.35 : 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    transition: "background 0.1s",
  } as React.CSSProperties),
  kanCardHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } as React.CSSProperties,
  kanDomain: { fontSize: 13, fontWeight: 700, color: "#f1f5f9", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden" as const, textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const } as React.CSSProperties,
  kanCompany: { fontSize: 11, color: "#94a3b8", lineHeight: 1.35 } as React.CSSProperties,
  kanFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#64748b", marginTop: 2 } as React.CSSProperties,
  kanEmptyHint: { fontSize: 11, color: "#475569", padding: 12, textAlign: "center" as const, fontStyle: "italic" as const } as React.CSSProperties,
  // Dropdown для bulk-move
  dropdown: { position: "absolute" as const, top: "calc(100% + 6px)", right: 0, background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, padding: 6, minWidth: 200, zIndex: 30, boxShadow: "0 8px 28px rgba(0,0,0,0.4)" } as React.CSSProperties,
  ddItem: (color: string) => ({
    padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
    display: "flex", alignItems: "center", gap: 8,
    color,
  } as React.CSSProperties),
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

  // View mode: «kanban» (доска CRM) или «table» (список). Сохраняется в localStorage.
  const [view, setView] = useState<"kanban" | "table">("kanban");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("mr_leads_view");
    if (saved === "table" || saved === "kanban") setView(saved);
  }, []);
  const setViewPersist = (v: "kanban" | "table") => {
    setView(v);
    try { localStorage.setItem("mr_leads_view", v); } catch { /* ignore */ }
  };

  // Bulk-операции (delete / move to status) — состояния для UI.
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Drag-and-drop по Kanban-доске: храним id перетаскиваемого лида и id колонки,
  // над которой висит курсор (чтобы подсветить целевой статус).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  // Закрываем dropdown «Переместить в…» при клике вне меню.
  useEffect(() => {
    if (!moveMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-move-menu]")) setMoveMenuOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [moveMenuOpen]);

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

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Удалить ${selected.size} ${selected.size === 1 ? "лида" : "лидов"} и все их данные?`)) return;
    setBulkBusy(true);
    try {
      const r = await fetch("/api/admin/leads/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", leadIds: Array.from(selected) }),
      });
      const d = await r.json();
      if (!d.ok) { alert(d.error || "Ошибка удаления"); return; }
      setSelected(new Set());
      load();
      loadAnalytics();
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkMove(status: LeadStatus) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setMoveMenuOpen(false);
    try {
      const r = await fetch("/api/admin/leads/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-status", status, leadIds: Array.from(selected) }),
      });
      const d = await r.json();
      if (!d.ok) { alert(d.error || "Ошибка перемещения"); return; }
      setSelected(new Set());
      load();
      loadAnalytics();
    } finally {
      setBulkBusy(false);
    }
  }

  // Drag-and-drop по Kanban-доске.
  // Оптимистично обновляем UI до возврата сервера — иначе карточка «дёргается».
  async function moveLeadToStatus(leadId: string, status: LeadStatus) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      loadAnalytics();
    } catch (e) {
      console.warn("Move failed:", e);
      load(); // откатываем — пере-фетчим с сервера
    }
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
          <div style={{ ...S.viewToggle, marginLeft: "auto" }}>
            <button style={S.viewBtn(view === "kanban")} onClick={() => setViewPersist("kanban")} title="Доска CRM">
              <LayoutGrid size={13} /> Доска
            </button>
            <button style={S.viewBtn(view === "table")} onClick={() => setViewPersist("table")} title="Таблица">
              <List size={13} /> Таблица
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <div style={S.selectionBar}>
            <div style={{ fontSize: 13, color: "#e2e8f0" }}>
              <b>{selected.size}</b> выбрано
            </div>
            <div style={{ display: "flex", gap: 8, position: "relative" }}>
              <button style={S.btn("primary")} onClick={() => setEmailOpen(true)} disabled={bulkBusy}>
                <Mail size={13} /> Отправить email
              </button>
              <div style={{ position: "relative" }} data-move-menu>
                <button style={S.btn("warn")} onClick={() => setMoveMenuOpen(o => !o)} disabled={bulkBusy}>
                  <MoveRight size={13} /> Переместить в…
                </button>
                {moveMenuOpen && (
                  <div style={S.dropdown}>
                    {LEAD_STATUSES.map(s => (
                      <div
                        key={s}
                        style={S.ddItem(LEAD_STATUS_COLORS[s])}
                        onClick={() => bulkMove(s)}
                        onMouseEnter={e => e.currentTarget.style.background = "#0f1117"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: LEAD_STATUS_COLORS[s] }} />
                        {LEAD_STATUS_LABELS[s]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button style={{ ...S.btn("ghost"), color: "#ef4444", borderColor: "#ef444455" }} onClick={bulkDelete} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Удалить
              </button>
              <button style={S.btn("ghost")} onClick={() => setSelected(new Set())}>
                <X size={13} /> Снять выбор
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
        ) : view === "kanban" ? (
          <KanbanBoard
            leads={leads}
            selected={selected}
            onToggleSelect={toggleOne}
            onMove={moveLeadToStatus}
            onDelete={deleteLead}
            draggingId={draggingId}
            dragOverStatus={dragOverStatus}
            setDraggingId={setDraggingId}
            setDragOverStatus={setDragOverStatus}
            fmtDate={fmtDate}
          />
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

// ─── Kanban board (CRM-доска) ────────────────────────────────────────────
// Каждый из 8 статусов — отдельная колонка. Карточки можно тащить мышкой,
// drop сразу обновляет lead.status оптимистично (UI до подтверждения сервером).
// Чекбоксы на карточках выбирают для bulk-операций (delete / move N to ...).

interface KanbanProps {
  leads: LeadRow[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onMove: (leadId: string, status: LeadStatus) => void;
  onDelete: (id: string, domain: string) => void;
  draggingId: string | null;
  dragOverStatus: LeadStatus | null;
  setDraggingId: (id: string | null) => void;
  setDragOverStatus: (s: LeadStatus | null) => void;
  fmtDate: (s: string | null) => string;
}

function KanbanBoard({
  leads, selected, onToggleSelect, onMove, onDelete,
  draggingId, dragOverStatus, setDraggingId, setDragOverStatus, fmtDate,
}: KanbanProps) {
  // Группируем лидов по статусу для рендера колонок.
  const leadsByStatus = useMemo(() => {
    const map: Record<LeadStatus, LeadRow[]> = {} as Record<LeadStatus, LeadRow[]>;
    for (const s of LEAD_STATUSES) map[s] = [];
    for (const l of leads) {
      if ((LEAD_STATUSES as readonly string[]).includes(l.status)) {
        map[l.status].push(l);
      }
    }
    return map;
  }, [leads]);

  function handleDragStart(e: React.DragEvent, leadId: string) {
    setDraggingId(leadId);
    // Firefox требует setData чтобы DnD запустился.
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStatus !== status) setDragOverStatus(status);
  }
  function handleDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setDragOverStatus(null);
    if (!leadId) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === status) return;
    onMove(leadId, status);
  }
  function handleDragEnd() {
    setDraggingId(null);
    setDragOverStatus(null);
  }

  return (
    <div style={S.board}>
      {LEAD_STATUSES.map(status => {
        const color = LEAD_STATUS_COLORS[status];
        const cards = leadsByStatus[status];
        const isOver = dragOverStatus === status;
        return (
          <div
            key={status}
            style={S.column(color, isOver)}
            onDragOver={e => handleDragOver(e, status)}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={e => handleDrop(e, status)}
          >
            <div style={S.columnHead(color)}>
              <div style={S.columnTitle(color)}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                {LEAD_STATUS_LABELS[status]}
              </div>
              <div style={S.columnCount}>{cards.length}</div>
            </div>
            <div style={S.columnBody}>
              {cards.length === 0 ? (
                <div style={S.kanEmptyHint}>Перетащите карточку сюда</div>
              ) : (
                cards.map(l => {
                  const isChecked = selected.has(l.id);
                  const isDragging = draggingId === l.id;
                  return (
                    <div
                      key={l.id}
                      style={S.kanCard(isChecked, isDragging)}
                      draggable
                      onDragStart={e => handleDragStart(e, l.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div style={S.kanCardHead}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleSelect(l.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: "pointer", marginTop: 2 }}
                        />
                        <Link href={`/admin/leads/${l.id}`} style={S.kanDomain} onClick={e => e.stopPropagation()}>
                          {l.domain}
                        </Link>
                        <button
                          style={{ ...S.iconBtn, width: 22, height: 22, border: "none" }}
                          onClick={e => { e.stopPropagation(); onDelete(l.id, l.domain); }}
                          title="Удалить лид"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      {l.company_name && (
                        <div style={S.kanCompany}>{l.company_name}</div>
                      )}
                      {l.contact_email && (
                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                          {l.contact_email}
                        </div>
                      )}
                      <div style={S.kanFooter}>
                        <span>
                          {l.report_status === "done" ? (
                            <a href={`/r/${l.slug}`} target="_blank" rel="noreferrer" style={{ color: "#22c55e", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={e => e.stopPropagation()}>
                              <FileText size={10} /> отчёт
                            </a>
                          ) : l.report_status === "running" ? (
                            <span style={{ color: "#3b82f6" }}>⟳ генерируется</span>
                          ) : l.report_status === "failed" ? (
                            <span style={{ color: "#ef4444" }}>✗ ошибка</span>
                          ) : (
                            <span style={{ color: "#475569" }}>—</span>
                          )}
                        </span>
                        <span>{fmtDate(l.created_at)}</span>
                      </div>
                      {l.notes_count > 0 && (
                        <div style={{ fontSize: 10, color: "#64748b" }}>📝 {l.notes_count}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
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

interface Preview {
  leadId: string;
  domain: string;
  companyName: string | null;
  email: string | null;
  subject: string;
  body: string;
  canSend: boolean;
  reason?: string;
}

function EmailModal({ leadIds, onClose, onDone }: { leadIds: string[]; onClose: () => void; onDone: () => void }) {
  // Шаги: compose → preview → result. По дороге можно вернуться назад.
  const [step, setStep] = useState<"compose" | "preview" | "result">("compose");
  const [subject, setSubject] = useState("Мини-аудит вашего сайта {domain} от MarketRadar24");
  const [template, setTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  // Выбор SMTP-аккаунта. По умолчанию hello — это outbound от админа.
  const [fromAccount, setFromAccount] = useState<"hello" | "noreply" | "billing">("hello");
  const [previews, setPreviews] = useState<Preview[]>([]);
  // Per-lead перекрытия после ручного редактирования. Ключ = leadId.
  const [overrides, setOverrides] = useState<Record<string, { subject?: string; body?: string }>>({});
  // Какой лид сейчас в режиме редактирования (раскрыт inline).
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; results: Array<{ domain: string; ok: boolean; reason?: string }> } | null>(null);

  async function loadPreview() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/leads/preview-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, subject, template }),
      });
      const d = await r.json();
      if (d.ok) {
        setPreviews(d.previews);
        setOverrides({});
        setStep("preview");
      } else {
        alert(d.error || "Ошибка превью");
      }
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const sendable = previews.filter(p => p.canSend);
    if (sendable.length === 0) {
      alert("Нет получателей с готовыми отчётами и email");
      return;
    }
    if (!confirm(`Отправить ${sendable.length} писем с аккаунта ${fromAccount}@marketradar24.ru?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/leads/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: sendable.map(p => p.leadId),
          subject,
          template,
          fromAccount,
          perLeadOverrides: overrides,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setResult({ sent: d.sent, failed: d.failed, results: d.results });
        setStep("result");
      } else {
        alert(d.error || "Ошибка отправки");
      }
    } finally {
      setBusy(false);
    }
  }

  function updateOverride(leadId: string, field: "subject" | "body", value: string) {
    setOverrides(prev => ({ ...prev, [leadId]: { ...prev[leadId], [field]: value } }));
  }

  // На preview-шаге даём модалке больше ширины — там длинные тексты.
  const modalStyle = step === "preview"
    ? { ...S.modal, maxWidth: 980 }
    : S.modal;

  return (
    <div style={S.modalBackdrop} onClick={() => !busy && onClose()}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>
              {step === "compose" && "EMAIL · ШАГ 1 ИЗ 3 — ШАБЛОН"}
              {step === "preview" && `EMAIL · ШАГ 2 ИЗ 3 — ПРЕДПРОСМОТР ${previews.length} ПИСЕМ`}
              {step === "result" && "EMAIL · ШАГ 3 ИЗ 3 — ИТОГ"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
              {step === "compose" && `Рассылка по ${leadIds.length} лидам`}
              {step === "preview" && "Проверьте и отредактируйте перед отправкой"}
              {step === "result" && "Готово"}
            </div>
          </div>
          <button style={{ ...S.btn("ghost"), padding: "6px 14px" }} onClick={onClose} disabled={busy}>Закрыть</button>
        </div>

        {/* ─── ШАГ 1: COMPOSE ────────────────────────────────────── */}
        {step === "compose" && (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, lineHeight: 1.6 }}>
              Плейсхолдеры: <code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{domain}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{company}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{summary}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{score}"}</code>,
              {" "}<code style={{ background: "#0f1117", padding: "1px 6px", borderRadius: 4 }}>{"{niche_average}"}</code>.
              {" "}Ссылка на отчёт добавляется автоматически кнопкой в HTML.
            </div>

            {/* Выбор SMTP-аккаунта */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6 }}>Отправитель</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["hello", "noreply", "billing"] as const).map(acc => (
                  <button
                    key={acc}
                    onClick={() => setFromAccount(acc)}
                    style={{
                      padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: fromAccount === acc ? "#7c3aed" : "#0f1117",
                      color: fromAccount === acc ? "#fff" : "#94a3b8",
                      border: `1px solid ${fromAccount === acc ? "#7c3aed" : "#2d3748"}`,
                    }}
                  >
                    {acc}@marketradar24.ru
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                {fromAccount === "hello" && "Для outbound-аутрича к клиентам. Reply-To идёт сюда же."}
                {fromAccount === "noreply" && "Для системных писем (welcome, восстановление пароля). Reply-To на hello."}
                {fromAccount === "billing" && "Для счетов и финансовых документов. Reply-To на hello."}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Тема</label>
              <input style={S.input} value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Текст письма</label>
              <textarea
                style={{ ...S.textarea, fontFamily: "inherit", fontSize: 13, minHeight: 220 }}
                value={template}
                onChange={e => setTemplate(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={onClose} disabled={busy}>Отмена</button>
              <button style={S.btn("primary")} onClick={loadPreview} disabled={busy || !subject.trim() || !template.trim()}>
                {busy ? "Загружаем…" : "Предпросмотр →"}
              </button>
            </div>
          </>
        )}

        {/* ─── ШАГ 2: PREVIEW ────────────────────────────────────── */}
        {step === "preview" && (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
              Каждое письмо отрисовано с подставленными данными конкретного лида.
              Кликни <b>«Изменить»</b> на любом — отредактируешь тему/текст только для него.
              Скип-причины (нет email / нет отчёта) — не уйдут.
            </div>

            <div style={{ maxHeight: "55vh", overflow: "auto", border: "1px solid #2d3748", borderRadius: 10, marginBottom: 14 }}>
              {previews.map(p => {
                const isEditing = editingLeadId === p.leadId;
                const ov = overrides[p.leadId];
                const finalSubject = ov?.subject ?? p.subject;
                const finalBody = ov?.body ?? p.body;
                return (
                  <div key={p.leadId} style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #1e2737",
                    background: !p.canSend ? "#0f111720" : (isEditing ? "#0f1117" : "transparent"),
                    opacity: !p.canSend ? 0.5 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                          {p.companyName || p.domain}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
                          {p.email ? `→ ${p.email}` : `✗ ${p.reason ?? "не отправится"}`}
                        </div>
                      </div>
                      {p.canSend && (
                        isEditing ? (
                          <button style={{ ...S.btn("primary"), padding: "5px 12px", fontSize: 11 }} onClick={() => setEditingLeadId(null)}>
                            Готово
                          </button>
                        ) : (
                          <button style={{ ...S.btn("ghost"), padding: "5px 12px", fontSize: 11 }} onClick={() => setEditingLeadId(p.leadId)}>
                            Изменить
                          </button>
                        )
                      )}
                      {ov && (ov.subject || ov.body) && (
                        <button
                          style={{ ...S.btn("ghost"), padding: "5px 12px", fontSize: 11, color: "#f59e0b" }}
                          onClick={() => setOverrides(prev => { const n = { ...prev }; delete n[p.leadId]; return n; })}
                          title="Сбросить ручные правки этого письма"
                        >
                          Сброс
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <>
                        <input
                          style={{ ...S.input, marginBottom: 6, fontSize: 12 }}
                          value={finalSubject}
                          onChange={e => updateOverride(p.leadId, "subject", e.target.value)}
                          placeholder="Тема"
                        />
                        <textarea
                          style={{ ...S.textarea, fontFamily: "inherit", fontSize: 12, minHeight: 140 }}
                          value={finalBody}
                          onChange={e => updateOverride(p.leadId, "body", e.target.value)}
                        />
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4 }}>
                          {ov?.subject && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#f59e0b22", color: "#f59e0b", marginRight: 6 }}>ИЗМЕНЕНО</span>}
                          {finalSubject}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.55, whiteSpace: "pre-wrap" as const, maxHeight: 90, overflow: "hidden", position: "relative" }}>
                          {ov?.body && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#f59e0b22", color: "#f59e0b", marginRight: 6 }}>ИЗМЕНЕНО</span>}
                          {finalBody.length > 280 ? finalBody.slice(0, 280) + "…" : finalBody}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Уйдёт: <b style={{ color: "#22c55e" }}>{previews.filter(p => p.canSend).length}</b> ·
                {" "}пропустится: <b style={{ color: "#f59e0b" }}>{previews.filter(p => !p.canSend).length}</b>
                {" "}· отправитель: <b style={{ color: "#f1f5f9" }}>{fromAccount}@</b>
                {" "}· изменено вручную: <b style={{ color: "#f1f5f9" }}>{Object.keys(overrides).length}</b>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={S.btn("ghost")} onClick={() => setStep("compose")} disabled={busy}>
                  ← Назад
                </button>
                <button style={S.btn("primary")} onClick={send} disabled={busy}>
                  {busy ? "Отправляем…" : <><Send size={13} /> Отправить {previews.filter(p => p.canSend).length}</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── ШАГ 3: RESULT ─────────────────────────────────────── */}
        {step === "result" && result && (
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
        )}
      </div>
    </div>
  );
}
