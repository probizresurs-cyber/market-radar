"use client";

/**
 * Консоль менеджера для /kp-ru и /kp-de. Один компонент, язык — через locale.
 * Гейт по паролю (env KP_MANAGER_PASSWORD, дефолт "Radar"). Три таба:
 *   1. Создать КП — вставка ссылок, постановка в очередь.
 *   2. История — все генерации с их статусом и ссылкой для клиента.
 *   3. Ревью пересборок — Фаза 3 (заглушка).
 */

import { useCallback, useEffect, useState } from "react";
import { KP_I18N, type KpLocale } from "@/lib/kp-i18n";

interface GenItem {
  id: string; url: string; company_name: string | null; status: string; error: string | null;
  share_token: string | null; share_password: string | null; rebuild_status: string | null;
  rebuild_id: string | null; client_email: string | null; client_phone: string | null;
  kp_sent_at: string | null; kp_sent_to: string | null; views: number;
  created_at: string; started_at: string | null; completed_at: string | null;
}

const REVIEW_STATUSES = new Set(["running", "pending_review", "approved", "sent", "rejected", "error"]);

// Время генерации — от захвата воркером (started_at) до готовности/ошибки
// (completed_at), не от постановки в очередь (created_at может ждать своей
// очереди дольше, чем сама генерация — это ввело бы в заблуждение).
function formatDuration(startedAt: string | null, completedAt: string | null, locale: KpLocale): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!isFinite(ms) || ms < 0) return null;
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const minLabel = locale === "de" ? "Min" : "мин";
  const secLabel = locale === "de" ? "s" : "с";
  return min > 0 ? `${min} ${minLabel} ${sec} ${secLabel}` : `${sec} ${secLabel}`;
}

type Tab = "create" | "history" | "review";

export function KpManagerConsole({ locale }: { locale: KpLocale }) {
  const t = KP_I18N[locale];
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("create");

  const [urls, setUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [items, setItems] = useState<GenItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<{ id: string; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Отправка КП клиенту на email из карточки истории.
  const [sendEmailById, setSendEmailById] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const sendKp = async (item: GenItem) => {
    const email = (sendEmailById[item.id] ?? "").trim();
    if (!email) return;
    setSendingId(item.id); setSendNotice(null);
    try {
      const r = await fetch(`/api/kp-generate/${item.id}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      setSendNotice({ id: item.id, text: j.ok ? t.sendDone : (j.error || t.sendError), ok: !!j.ok });
      if (j.ok) loadHistory();
    } catch {
      setSendNotice({ id: item.id, text: t.sendError, ok: false });
    } finally { setSendingId(null); }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/kp-manager/login");
        const j = await r.json();
        setAuthed(!!j.authed);
      } catch { setAuthed(false); }
    })();
  }, []);

  const login = async () => {
    setAuthError(null);
    try {
      const r = await fetch("/api/kp-manager/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (!j.ok) { setAuthError(j.error || t.wrongPassword); return; }
      setAuthed(true);
    } catch { setAuthError(t.wrongPassword); }
  };

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch(`/api/kp-generate/list?locale=${locale}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) setItems(j.items);
    } catch { /* ignore */ }
  }, [locale]);

  // Автообновление истории пока есть незавершённые генерации.
  useEffect(() => {
    if (!authed) return;
    loadHistory();
    const hasActive = items.some(i => i.status === "queued" || i.status === "running" || i.rebuild_status === "running");
    const iv = setInterval(loadHistory, hasActive ? 4000 : 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab]);

  const submit = async () => {
    const list = urls.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    setSubmitting(true); setNotice(null);
    try {
      const r = await fetch("/api/kp-generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ urls: list, locale }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка");
      setNotice(`${t.queued}: ${j.queued}`);
      setUrls("");
      setTab("history");
      loadHistory();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  // «Открыть КП» ведёт сразу на клиентскую ссылку (то же самое, что увидит
  // клиент) — раньше открывала внутренний /kp-gen/<id>, из-за чего в
  // истории было слишком много разных ссылок непонятно для чего. Копирование
  // теперь копирует пароль — ссылку менеджер и так видит открытой во вкладке.
  const copyPassword = (item: GenItem) => {
    if (!item.share_password) return;
    navigator.clipboard.writeText(item.share_password).then(() => {
      setCopiedId(item.id); setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  const deleteItem = async (item: GenItem) => {
    if (!window.confirm(`${t.deleteConfirm} «${item.company_name || item.url}»?`)) return;
    setDeletingId(item.id);
    try {
      const r = await fetch(`/api/kp-generate/${item.id}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (j.ok) setItems(prev => prev.filter(i => i.id !== item.id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const approveRebuild = async (item: GenItem) => {
    setReviewBusyId(item.id); setReviewNotice(null);
    try {
      const r = await fetch(`/api/kp-generate/${item.id}/approve-rebuild`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!j.ok) { setReviewNotice({ id: item.id, text: j.error || "Ошибка" }); return; }
      setReviewNotice({ id: item.id, text: j.emailSent ? t.reviewEmailSent : t.reviewEmailFailed });
      loadHistory();
    } catch { setReviewNotice({ id: item.id, text: "Ошибка сети" }); }
    finally { setReviewBusyId(null); }
  };

  const rejectRebuild = async (item: GenItem) => {
    setReviewBusyId(item.id); setReviewNotice(null);
    try {
      const r = await fetch(`/api/kp-generate/${item.id}/reject-rebuild`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!j.ok) { setReviewNotice({ id: item.id, text: j.error || "Ошибка" }); return; }
      loadHistory();
    } catch { setReviewNotice({ id: item.id, text: "Ошибка сети" }); }
    finally { setReviewBusyId(null); }
  };

  const rebuildStatusLabel = (s: string) =>
    s === "running" ? t.reviewStatusRunning
    : s === "pending_review" ? t.reviewStatusPending
    : s === "approved" ? t.reviewStatusApproved
    : s === "sent" ? t.reviewStatusSent
    : s === "rejected" ? t.reviewStatusRejected
    : t.reviewStatusError;
  const rebuildStatusColor = (s: string) =>
    s === "sent" ? "#059669" : s === "pending_review" ? "#d97706" : s === "error" ? "#dc2626" : s === "rejected" ? "#6b7280" : "#2a78d6";

  const statusLabel = (s: string) =>
    s === "queued" ? t.statusQueued : s === "running" ? t.statusRunning : s === "done" ? t.statusDone : t.statusError;
  const statusColor = (s: string) =>
    s === "done" ? "#059669" : s === "error" ? "#dc2626" : "#d97706";

  const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff" };

  // ── Гейт ──────────────────────────────────────────────────────────────────
  if (authed === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontFamily: "'Inter',system-ui" }}>…</div>;
  }
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f8", fontFamily: "'Inter',system-ui" }}>
        <div style={{ ...card, padding: 28, width: 360, maxWidth: "90vw" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{t.title}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>{t.passwordPrompt}</div>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") login(); }}
            placeholder={t.passwordPlaceholder}
            style={{ width: "100%", height: 44, padding: "0 14px", fontSize: 16, border: "1px solid #d1d5db", borderRadius: 10, marginBottom: 10, boxSizing: "border-box" }}
          />
          {authError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 10 }}>{authError}</div>}
          <button onClick={login} style={{ width: "100%", height: 44, fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none", background: "#2a78d6", color: "#fff", cursor: "pointer" }}>
            {t.enter}
          </button>
        </div>
      </div>
    );
  }

  // ── Консоль ───────────────────────────────────────────────────────────────
  const TABS: Array<{ k: Tab; label: string }> = [
    { k: "create", label: t.tabCreate },
    { k: "history", label: t.tabHistory },
    { k: "review", label: t.tabReview },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", fontFamily: "'Inter',system-ui" }}>
      {/* Мобильная адаптивка: консоль открывают и с телефона (в т.ч. из
          Telegram-webview, у которого плавающая шапка поверх контента) —
          отсюда запас сверху, скроллящиеся табы и стек карточек. */}
      <style>{`
        .kpm-wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
        .kpm-tabs { display: flex; gap: 4px; margin-bottom: 18px; padding: 4px; border-radius: 12px; background: #eef0f3; width: fit-content; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
        .kpm-tabs::-webkit-scrollbar { display: none; }
        .kpm-tabs button { white-space: nowrap; flex-shrink: 0; }
        @media (max-width: 640px) {
          .kpm-wrap { padding: 52px 14px 48px; }
          .kpm-title { font-size: 21px !important; }
        }
      `}</style>
      <div className="kpm-wrap">
        <h1 className="kpm-title" style={{ fontSize: 26, fontWeight: 850, margin: "0 0 6px" }}>{t.title}</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.5 }}>{t.subtitle}</p>

        <div className="kpm-tabs">
          {TABS.map(x => (
            <button key={x.k} onClick={() => setTab(x.k)}
              style={{ height: 36, padding: "0 16px", fontSize: 13.5, fontWeight: 650, borderRadius: 9, border: "none", cursor: "pointer",
                background: tab === x.k ? "#fff" : "transparent", color: tab === x.k ? "#2a78d6" : "#6b7280",
                boxShadow: tab === x.k ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {x.label}
            </button>
          ))}
        </div>

        {/* СОЗДАТЬ */}
        {tab === "create" && (
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>{t.createHint}</div>
            {/* rows=3 и fontSize 16: компактнее на телефоне, и iOS не зумит
                страницу при фокусе (зумит только поля с шрифтом <16px). */}
            <textarea
              value={urls} onChange={e => setUrls(e.target.value)} placeholder={t.urlsPlaceholder}
              rows={3}
              style={{ width: "100%", padding: "10px 14px", fontSize: 16, border: "1px solid #d1d5db", borderRadius: 10, fontFamily: "ui-monospace,monospace", resize: "vertical", marginBottom: 12, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={submit} disabled={submitting}
                style={{ height: 44, padding: "0 22px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none",
                  background: submitting ? "#9ca3af" : "#2a78d6", color: "#fff", cursor: submitting ? "default" : "pointer" }}>
                {submitting ? t.generating : t.generate}
              </button>
              {notice && <span style={{ fontSize: 13.5, color: "#059669" }}>{notice}</span>}
            </div>
          </div>
        )}

        {/* ИСТОРИЯ */}
        {tab === "history" && (
          <div style={{ display: "grid", gap: 10 }}>
            {items.length === 0 && (
              <div style={{ ...card, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 14 }}>{t.historyEmpty}</div>
            )}
            {items.map(item => (
              <div key={item.id} style={{ ...card, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* flex-basis 240px: на телефоне блок занимает всю строку, а
                      бейдж с кнопками уходит вниз — вместо названия «в столбик». */}
                  <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{item.company_name || item.url}</div>
                    <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2, overflowWrap: "anywhere" }}>
                      {item.url}
                      {formatDuration(item.started_at, item.completed_at, locale) && (
                        <> · {t.generationTime}: {formatDuration(item.started_at, item.completed_at, locale)}</>
                      )}
                    </div>
                    {item.status === "error" && item.error && (
                      <div style={{ fontSize: 12.5, color: "#dc2626", marginTop: 4 }}>{item.error}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
                      background: `color-mix(in srgb, ${statusColor(item.status)} 12%, transparent)`, color: statusColor(item.status) }}>
                      {statusLabel(item.status)}
                    </span>
                    {item.status === "done" && item.share_token && (
                      <a href={`/kp-share/${item.share_token}`} target="_blank" rel="noopener noreferrer"
                        style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, background: "#2a78d6", color: "#fff", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                        {t.open}
                      </a>
                    )}
                    <button onClick={() => deleteItem(item)} disabled={deletingId === item.id}
                      style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: deletingId === item.id ? "default" : "pointer" }}>
                      {deletingId === item.id ? t.deleting : t.delete}
                    </button>
                  </div>
                </div>
                {item.status === "done" && item.share_token && (
                  <>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>{t.shareLabel}:</span>
                    <code style={{ fontSize: 12.5, overflowWrap: "anywhere", minWidth: 0 }}>/kp-share/{item.share_token}</code>
                    <span style={{ color: "#6b7280" }}>· {t.passwordLabel}:</span>
                    <b style={{ fontFamily: "ui-monospace,monospace" }}>{item.share_password}</b>
                    <button onClick={() => copyPassword(item)}
                      style={{ height: 30, padding: "0 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "none", background: copiedId === item.id ? "#059669" : "#eef2f7", color: copiedId === item.id ? "#fff" : "#334155", cursor: "pointer" }}>
                      {copiedId === item.id ? t.copied : t.copy}
                    </button>
                  </div>
                  {/* Отправка клиенту из системы + статус воронки (отправлено/открыто) */}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                    <input
                      type="email"
                      value={sendEmailById[item.id] ?? item.kp_sent_to ?? item.client_email ?? ""}
                      onChange={e => setSendEmailById(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder={t.sendEmailPlaceholder}
                      style={{ height: 32, padding: "0 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, flex: "1 1 180px", minWidth: 160, boxSizing: "border-box" }}
                    />
                    <button onClick={() => sendKp(item)} disabled={sendingId === item.id}
                      style={{ height: 32, padding: "0 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "none", background: sendingId === item.id ? "#9ca3af" : "#2a78d6", color: "#fff", cursor: sendingId === item.id ? "default" : "pointer" }}>
                      {sendingId === item.id ? t.sending : t.sendBtn}
                    </button>
                    {item.kp_sent_at && (
                      <span style={{ color: "#059669", fontWeight: 600 }}>
                        {t.sentAtLabel} {new Date(item.kp_sent_at).toLocaleDateString(locale === "de" ? "de-DE" : "ru-RU")}
                      </span>
                    )}
                    <span style={{ color: item.views > 0 ? "#059669" : "#9ca3af" }}>
                      {item.views > 0 ? `👀 ${item.views} ${t.viewsLabel}` : t.notOpenedYet}
                    </span>
                  </div>
                  {sendNotice?.id === item.id && (
                    <div style={{ marginTop: 6, fontSize: 12.5, color: sendNotice.ok ? "#059669" : "#dc2626" }}>{sendNotice.text}</div>
                  )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* РЕВЬЮ ПЕРЕСБОРОК (Фаза 3) */}
        {tab === "review" && (() => {
          const reviewItems = items.filter(i => i.rebuild_status && REVIEW_STATUSES.has(i.rebuild_status));
          if (reviewItems.length === 0) {
            return <div style={{ ...card, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 14 }}>{t.reviewEmpty}</div>;
          }
          return (
            <div style={{ display: "grid", gap: 10 }}>
              {reviewItems.map(item => (
                <div key={item.id} style={{ ...card, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{item.company_name || item.url}</div>
                      <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2, overflowWrap: "anywhere" }}>{item.url}</div>
                      <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4, overflowWrap: "anywhere" }}>
                        {t.reviewClientEmail}: <b style={{ color: "#334155" }}>{item.client_email || t.reviewNoEmail}</b>
                        {item.client_phone && <> · {t.phoneLabel}: <b style={{ color: "#334155" }}>{item.client_phone}</b></>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: `color-mix(in srgb, ${rebuildStatusColor(item.rebuild_status!)} 12%, transparent)`, color: rebuildStatusColor(item.rebuild_status!) }}>
                      {rebuildStatusLabel(item.rebuild_status!)}
                    </span>
                  </div>
                  {item.rebuild_id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <a href={`/astro-rebuild?id=${item.rebuild_id}`} target="_blank" rel="noopener noreferrer"
                        style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#334155", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                        {t.reviewCompare}
                      </a>
                      {(item.rebuild_status === "pending_review" || item.rebuild_status === "approved") && item.client_email && (
                        <>
                          <button onClick={() => approveRebuild(item)} disabled={reviewBusyId === item.id}
                            style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "none", background: reviewBusyId === item.id ? "#9ca3af" : "#059669", color: "#fff", cursor: reviewBusyId === item.id ? "default" : "pointer" }}>
                            {reviewBusyId === item.id ? t.reviewApproving : t.reviewApprove}
                          </button>
                          <button onClick={() => rejectRebuild(item)} disabled={reviewBusyId === item.id}
                            style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: reviewBusyId === item.id ? "default" : "pointer" }}>
                            {t.reviewReject}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {reviewNotice?.id === item.id && (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: "#334155" }}>{reviewNotice.text}</div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
