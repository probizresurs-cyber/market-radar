"use client";

/**
 * /admin/leads — база лидов для холодного аутрича.
 *
 * Возможности:
 *   • Импорт CSV (drag-and-drop или paste)
 *   • Поиск по домену / компании / email
 *   • Фильтры по статусу + счётчики «сколько в каком статусе»
 *   • Колонка статуса отчёта (готов / в работе / отсутствует)
 *   • Кнопка «Сгенерировать отчёт» на каждой строке (см. ./[id]/page.tsx)
 *   • Прямая ссылка на публичный экспресс-отчёт /r/{slug}
 *
 * CRM-функционал (статусы / заметки / история) — на детальной странице.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload, Search, ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";
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
  btn: (variant: "primary" | "ghost" = "primary") => ({
    padding: "9px 14px", borderRadius: 8, border: variant === "primary" ? "none" : "1px solid #2d3748",
    background: variant === "primary" ? "#7c3aed" : "transparent",
    color: variant === "primary" ? "#fff" : "#e2e8f0",
    fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
  } as React.CSSProperties),
  statusChips: { display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 18 },
  chip: (active: boolean, color?: string) => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
    background: active ? (color ?? "#7c3aed") + "22" : "#1a1f2e",
    color: active ? (color ?? "#7c3aed") : "#94a3b8",
    border: active ? `1px solid ${(color ?? "#7c3aed")}55` : "1px solid #2d3748",
  } as React.CSSProperties),
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
  textarea: { width: "100%", minHeight: 220, padding: 12, borderRadius: 8, background: "#0f1117", border: "1px solid #2d3748", color: "#e2e8f0", fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.5, outline: "none", resize: "vertical" as const } as React.CSSProperties,
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

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "200");
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
  }

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 200);
    return () => clearTimeout(t);
  }, [search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAll = useMemo(
    () => Object.values(byStatus).reduce((s, n) => s + n, 0),
    [byStatus],
  );

  async function deleteLead(id: string, domain: string) {
    if (!confirm(`Удалить «${domain}» и все его данные?`)) return;
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
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
          База доменов для холодного аутрича. Загрузите CSV с компаниями, для каждого сайта можно сгенерировать экспресс-отчёт и кинуть владельцу ссылку.
          Всего: <b style={{ color: "#e2e8f0" }}>{totalAll}</b> {totalAll === 1 ? "лид" : "лидов"}.
        </div>

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
            <Upload size={14} /> Импорт CSV
          </button>
          <button style={S.btn("ghost")} onClick={() => load()} title="Обновить">
            <RefreshCw size={14} />
          </button>
        </div>

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
              ? "Пока нет лидов — нажмите «Импорт CSV», чтобы загрузить базу"
              : "По выбранным фильтрам ничего не найдено"}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
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
                return (
                  <tr key={l.id}>
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

        {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />}
      </main>
    </div>
  );
}

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
    const text = await file.text();
    setCsv(text);
  }

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>ИМПОРТ БАЗЫ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Загрузить CSV с лидами</div>
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
              Разделитель — запятая или точка с запятой. Дубликаты по домену пропускаются.
            </div>
            <input
              type="text"
              placeholder="Метка партии (например, '2GIS стоматологии Москва')"
              value={source}
              onChange={e => setSource(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "#0f1117", border: "1px solid #2d3748", color: "#e2e8f0", fontSize: 13, outline: "none", marginBottom: 10 }}
            />
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "inline-block", padding: "8px 14px", background: "#0f1117", border: "1px dashed #2d3748", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
                📁 Выбрать CSV-файл
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                />
              </label>
              <span style={{ fontSize: 11, color: "#475569", marginLeft: 10 }}>или вставьте текст ниже</span>
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
