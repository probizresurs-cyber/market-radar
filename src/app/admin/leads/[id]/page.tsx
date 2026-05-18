"use client";

/**
 * /admin/leads/[id] — детальная карточка лида с CRM-функционалом.
 *
 * Слева:
 *   • Контакты (email/phone/telegram) — редактируемые
 *   • Превью последнего отчёта или кнопка «Сгенерировать»
 *   • Ссылка на публичную страницу /r/{slug}
 *
 * Справа:
 *   • Селектор статуса с воронкой и историей переходов
 *   • Список заметок с автором и timestamp + поле добавить новую
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, FileText, Loader2, ArrowLeft, Send, Mail, Eye, MousePointerClick } from "lucide-react";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  type Lead,
  type LeadReport,
  type LeadStatus,
} from "@/lib/lead-types";

interface ReportRecord {
  id: string;
  data: LeadReport | Record<string, never>;
  model: string | null;
  cost_cents: number | null;
  status: string;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
}

interface NoteRow {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

interface HistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
}

interface EmailRow {
  id: string;
  subject: string;
  to_email: string;
  message_id: string | null;
  sent_at: string;
  open_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  click_count: number;
  first_clicked_at: string | null;
  last_clicked_at: string | null;
  sent_by_name: string | null;
}

const C = {
  bg: "#0f1117",
  card: "#1a1f2e",
  cardElev: "#13182a",
  border: "#2d3748",
  fg: "#e2e8f0",
  muted: "#64748b",
  primary: "#7c3aed",
};

const S = {
  page: { minHeight: "100vh", background: C.bg, color: C.fg } as React.CSSProperties,
  header: { background: C.card, borderBottom: `1px solid ${C.border}`, padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: C.primary } as React.CSSProperties,
  main: { maxWidth: 1200, margin: "0 auto", padding: "24px 32px 40px" } as React.CSSProperties,
  backLink: { color: C.muted, textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12 } as React.CSSProperties,
  h1: { fontSize: 28, fontWeight: 800, marginBottom: 4 } as React.CSSProperties,
  domainBig: { fontSize: 16, color: C.muted, marginBottom: 24 } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 24 } as React.CSSProperties,
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  cardTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 14 } as React.CSSProperties,
  field: { marginBottom: 12 } as React.CSSProperties,
  fieldLabel: { fontSize: 11, color: C.muted, marginBottom: 4, display: "block" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 11px", borderRadius: 7, background: C.cardElev, border: `1px solid ${C.border}`, color: C.fg, fontSize: 13, outline: "none" } as React.CSSProperties,
  btn: (variant: "primary" | "ghost" = "primary") => ({
    padding: "9px 14px", borderRadius: 8, border: variant === "primary" ? "none" : `1px solid ${C.border}`,
    background: variant === "primary" ? C.primary : "transparent",
    color: variant === "primary" ? "#fff" : C.fg,
    fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
  } as React.CSSProperties),
  statusGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 8 } as React.CSSProperties,
  statusBtn: (active: boolean, color: string) => ({
    padding: "8px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left" as const,
    background: active ? `${color}22` : C.cardElev,
    color: active ? color : C.muted,
    border: active ? `1px solid ${color}55` : `1px solid ${C.border}`,
  } as React.CSSProperties),
  noteItem: { padding: "12px 14px", borderRadius: 8, background: C.cardElev, marginBottom: 8, border: `1px solid ${C.border}` } as React.CSSProperties,
  noteMeta: { fontSize: 11, color: C.muted, marginBottom: 4, display: "flex", justifyContent: "space-between" } as React.CSSProperties,
  textarea: { width: "100%", minHeight: 70, padding: "10px 12px", borderRadius: 7, background: C.cardElev, border: `1px solid ${C.border}`, color: C.fg, fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit" } as React.CSSProperties,
  historyRow: { fontSize: 12, color: C.muted, padding: "6px 0", borderBottom: `1px dashed ${C.border}` } as React.CSSProperties,
};

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [draft, setDraft] = useState<Partial<Lead>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/leads/${id}`);
      const d = await r.json();
      if (d.ok) {
        setLead(d.lead);
        setReports(d.reports);
        setNotes(d.notes);
        setHistory(d.history);
        setEmails(d.emails ?? []);
        setDraft({});
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: LeadStatus) {
    if (!lead || status === lead.status) return;
    await patch({ status });
  }

  async function saveContacts() {
    await patch(draft);
  }

  async function addNote() {
    if (!newNote.trim()) return;
    await patch({ add_note: newNote });
    setNewNote("");
  }

  async function generateReport() {
    setGenError(null);
    setGenerating(true);
    try {
      const r = await fetch(`/api/admin/leads/${id}/generate-report`, { method: "POST" });
      const d = await r.json();
      if (!d.ok) {
        setGenError(d.error ?? "Не удалось сгенерировать отчёт");
      } else {
        await load();
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div style={S.page}><div style={{ padding: 60, textAlign: "center", color: C.muted }}>Загрузка...</div></div>;
  if (!lead) return <div style={S.page}><div style={{ padding: 60, textAlign: "center", color: C.muted }}>Лид не найден</div></div>;

  const lastReport = reports[0];
  const reportReady = lastReport?.status === "done";
  const reportRunning = lastReport?.status === "running" || generating;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <main style={S.main}>
        <Link href="/admin/leads" style={S.backLink}><ArrowLeft size={14} /> К списку лидов</Link>
        <h1 style={S.h1}>{lead.company_name ?? lead.domain}</h1>
        <div style={S.domainBig}>
          <a href={`https://${lead.domain}`} target="_blank" rel="noreferrer" style={{ color: C.primary, textDecoration: "none" }}>
            {lead.domain} <ExternalLink size={11} style={{ display: "inline" }} />
          </a>
        </div>

        <div style={S.grid}>
          <div>
            {/* Контакты */}
            <div style={S.card}>
              <div style={S.cardTitle}>Контакты</div>
              <div style={S.field}>
                <label style={S.fieldLabel}>Компания</label>
                <input
                  style={S.input}
                  defaultValue={lead.company_name ?? ""}
                  onChange={e => setDraft(d => ({ ...d, company_name: e.target.value || null }))}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Email</label>
                  <input
                    style={S.input}
                    type="email"
                    defaultValue={lead.contact_email ?? ""}
                    onChange={e => setDraft(d => ({ ...d, contact_email: e.target.value || null }))}
                  />
                </div>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Телефон</label>
                  <input
                    style={S.input}
                    defaultValue={lead.contact_phone ?? ""}
                    onChange={e => setDraft(d => ({ ...d, contact_phone: e.target.value || null }))}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Telegram</label>
                  <input
                    style={S.input}
                    defaultValue={lead.contact_telegram ?? ""}
                    onChange={e => setDraft(d => ({ ...d, contact_telegram: e.target.value || null }))}
                  />
                </div>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Город</label>
                  <input
                    style={S.input}
                    defaultValue={lead.city ?? ""}
                    onChange={e => setDraft(d => ({ ...d, city: e.target.value || null }))}
                  />
                </div>
              </div>
              <div style={S.field}>
                <label style={S.fieldLabel}>Ниша</label>
                <input
                  style={S.input}
                  defaultValue={lead.niche ?? ""}
                  onChange={e => setDraft(d => ({ ...d, niche: e.target.value || null }))}
                />
              </div>
              <button style={S.btn("primary")} onClick={saveContacts} disabled={saving || Object.keys(draft).length === 0}>
                {saving ? "Сохранение…" : "Сохранить контакты"}
              </button>
            </div>

            {/* Экспресс-отчёт */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={S.cardTitle}>Экспресс-отчёт</div>
                {reportReady && (
                  <a href={`/r/${lead.slug}`} target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12 }}>
                    <ExternalLink size={12} /> Открыть публичную страницу
                  </a>
                )}
              </div>

              {reportReady ? (
                <div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                    <div>
                      <div style={S.fieldLabel}>Score</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>{(lastReport.data as LeadReport).overallScore}/100</div>
                    </div>
                    <div>
                      <div style={S.fieldLabel}>Среднее по нише</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: C.muted }}>{(lastReport.data as LeadReport).nicheAverage}/100</div>
                    </div>
                    <div>
                      <div style={S.fieldLabel}>Сгенерирован</div>
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{fmtDate(lastReport.generated_at)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.fg, padding: 12, background: C.cardElev, borderRadius: 8, marginBottom: 12 }}>
                    {(lastReport.data as LeadReport).oneLineSummary}
                  </div>
                  <button style={S.btn("ghost")} onClick={generateReport} disabled={generating}>
                    {generating ? <><Loader2 size={13} className="spin" /> Перегенерируем…</> : <><FileText size={13} /> Сгенерировать заново</>}
                  </button>
                </div>
              ) : reportRunning ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 13 }}>
                  <Loader2 size={16} className="spin" /> Генерируем отчёт (15-30 сек)…
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>
                    Отчёта пока нет. Сгенерируем за 15-30 сек, стоимость ≈ 1.5 ₽.
                    После создания будет доступна публичная ссылка <code>/r/{lead.slug}</code> — её можно
                    отправить владельцу сайта в email/мессенджер.
                  </div>
                  <button style={S.btn("primary")} onClick={generateReport} disabled={generating}>
                    <FileText size={13} /> Сгенерировать экспресс-отчёт
                  </button>
                </div>
              )}
              {genError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>{genError}</div>}
              {lastReport?.status === "failed" && (
                <div style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>
                  Прошлая попытка упала: {lastReport.error_message}
                </div>
              )}
            </div>
          </div>

          <div>
            {/* Статус */}
            <div style={S.card}>
              <div style={S.cardTitle}>Статус CRM</div>
              <div style={S.statusGrid}>
                {LEAD_STATUSES.map(s => (
                  <button
                    key={s}
                    style={S.statusBtn(lead.status === s, LEAD_STATUS_COLORS[s])}
                    onClick={() => changeStatus(s)}
                    disabled={saving}
                  >
                    {LEAD_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {history.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>История</div>
                  {history.slice(0, 6).map(h => (
                    <div key={h.id} style={S.historyRow}>
                      {fmtDate(h.created_at)} · {h.from_status ? `${LEAD_STATUS_LABELS[h.from_status as LeadStatus] ?? h.from_status} → ` : ""}
                      <b style={{ color: LEAD_STATUS_COLORS[h.to_status as LeadStatus] ?? C.fg }}>{LEAD_STATUS_LABELS[h.to_status as LeadStatus] ?? h.to_status}</b>
                      {h.changed_by_name && <span style={{ color: C.muted }}> · {h.changed_by_name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Заметки */}
            <div style={S.card}>
              <div style={S.cardTitle}>Заметки · {notes.length}</div>
              <textarea
                style={S.textarea}
                placeholder="Добавить заметку…"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <button style={{ ...S.btn("primary"), marginTop: 8 }} onClick={addNote} disabled={!newNote.trim() || saving}>
                <Send size={13} /> Сохранить
              </button>

              <div style={{ marginTop: 16 }}>
                {notes.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.muted }}>Пока нет заметок</div>
                ) : (
                  notes.map(n => (
                    <div key={n.id} style={S.noteItem}>
                      <div style={S.noteMeta}>
                        <span>{n.author_name ?? "—"}</span>
                        <span>{fmtDate(n.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.fg, lineHeight: 1.55, whiteSpace: "pre-wrap" as const }}>{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Email-история с метриками открытий/кликов */}
            {emails.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>
                  <Mail size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  Email · {emails.length}
                </div>
                {emails.map(em => {
                  const sent = !!em.message_id;
                  const opened = em.open_count > 0;
                  const clicked = em.click_count > 0;
                  return (
                    <div key={em.id} style={S.noteItem}>
                      <div style={S.noteMeta}>
                        <span style={{ fontWeight: 600, color: C.fg }}>{em.to_email}</span>
                        <span>{fmtDate(em.sent_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.fg, marginBottom: 6 }}>{em.subject}</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, fontSize: 11 }}>
                        {sent ? (
                          <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ Отправлено</span>
                        ) : (
                          <span style={{ color: "#ef4444", fontWeight: 600 }}>✗ Не доставлено</span>
                        )}
                        <span style={{ color: opened ? "#06b6d4" : C.muted, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Eye size={11} /> {em.open_count} {opened && em.first_opened_at && <span style={{ color: C.muted, marginLeft: 4 }}>({fmtDate(em.first_opened_at)})</span>}
                        </span>
                        <span style={{ color: clicked ? "#22c55e" : C.muted, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <MousePointerClick size={11} /> {em.click_count} {clicked && em.first_clicked_at && <span style={{ color: C.muted, marginLeft: 4 }}>({fmtDate(em.first_clicked_at)})</span>}
                        </span>
                      </div>
                      {em.sent_by_name && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>отправил: {em.sent_by_name}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
