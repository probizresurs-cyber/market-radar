"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCcw, Plus, X } from "lucide-react";

interface Referral {
  id: number;
  code: string;
  name: string | null;
  uses_count: number;
  max_uses: number | null;
  discount_pct: number;
  expires_at: string | null;
  created_at: string;
}

const ACCENT = "#0ea5e9";

const S = {
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 24 } as React.CSSProperties,
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" as const } as React.CSSProperties,
  btn: (primary?: boolean) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: primary ? `1px solid ${ACCENT}` : "1px solid #2d3748",
    background: primary ? `${ACCENT}22` : "none",
    color: primary ? ACCENT : "#94a3b8",
  } as React.CSSProperties),
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 14 } as React.CSSProperties,
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 } as React.CSSProperties,
  label: { fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4, display: "block" },
  input: { width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box" as const } as React.CSSProperties,
  formActions: { display: "flex", gap: 10, alignItems: "center" } as React.CSSProperties,
  errBox: { background: "#3b0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#13182a", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "10px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  mono: { fontFamily: "monospace", fontWeight: 700, color: ACCENT },
  emptyMsg: { textAlign: "center" as const, padding: 40, color: "#64748b", fontSize: 13 },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CARefPage() {
  const [rows, setRows] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const expiresRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/call-agent/referrals", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setErr(d.error || `HTTP ${r.status}`);
      } else {
        setRows(Array.isArray(d.referrals) ? d.referrals : []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const code = codeRef.current?.value.trim() ?? "";
    if (!code) { setFormErr("Код обязателен"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/admin/call-agent/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name: nameRef.current?.value.trim() || null,
          discount_pct: discountRef.current?.value ? Number(discountRef.current.value) : 0,
          max_uses: maxRef.current?.value ? Number(maxRef.current.value) : null,
          expires_at: expiresRef.current?.value || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setFormErr(d.error || `HTTP ${r.status}`);
      } else {
        setShowForm(false);
        // reset fields
        if (codeRef.current) codeRef.current.value = "";
        if (nameRef.current) nameRef.current.value = "";
        if (discountRef.current) discountRef.current.value = "";
        if (maxRef.current) maxRef.current.value = "";
        if (expiresRef.current) expiresRef.current.value = "";
        await load();
      }
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={S.main}>
      <div style={S.h1}>Рефералки Call-Agent</div>
      <div style={S.sub}>Реф-ссылки с кодами скидок для привлечения клиентов Call-Agent.</div>

      {err && <div style={S.errBox}><strong>Ошибка:</strong> {err}</div>}

      <div style={S.toolbar}>
        <button style={S.btn(true)} onClick={() => setShowForm(v => !v)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Отмена" : "+ Создать реф-ссылку"}
        </button>
        <button style={S.btn()} onClick={load} disabled={loading}>
          <RefreshCcw size={13} /> {loading ? "Загрузка..." : "Обновить"}
        </button>
      </div>

      {showForm && (
        <div style={S.card}>
          <div style={S.cardTitle}>Новая реф-ссылка</div>
          <form onSubmit={handleCreate}>
            <div style={S.formGrid}>
              <div>
                <label style={S.label}>Код *</label>
                <input ref={codeRef} style={S.input} placeholder="PARTNER2025" required />
              </div>
              <div>
                <label style={S.label}>Название</label>
                <input ref={nameRef} style={S.input} placeholder="Партнёр Иванов" />
              </div>
              <div>
                <label style={S.label}>Скидка %</label>
                <input ref={discountRef} style={S.input} type="number" min="0" max="100" placeholder="10" />
              </div>
              <div>
                <label style={S.label}>Макс. использований</label>
                <input ref={maxRef} style={S.input} type="number" min="1" placeholder="без лимита" />
              </div>
              <div>
                <label style={S.label}>Истекает</label>
                <input ref={expiresRef} style={S.input} type="date" />
              </div>
            </div>
            {formErr && <div style={{ ...S.errBox, marginBottom: 12 }}>{formErr}</div>}
            <div style={S.formActions}>
              <button type="submit" style={S.btn(true)} disabled={saving}>
                {saving ? "Сохранение..." : "Создать"}
              </button>
              <button type="button" style={S.btn()} onClick={() => { setShowForm(false); setFormErr(null); }}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={S.card}>
        {loading ? (
          <div style={S.emptyMsg}>Загрузка...</div>
        ) : rows.length === 0 ? (
          <div style={S.emptyMsg}>Реф-ссылок пока нет. Создайте первую.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>ID</th>
                  <th style={S.th}>Код</th>
                  <th style={S.th}>Название</th>
                  <th style={S.th}>Использований</th>
                  <th style={S.th}>Макс</th>
                  <th style={S.th}>Скидка %</th>
                  <th style={S.th}>Истекает</th>
                  <th style={S.th}>Создан</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, color: "#475569", fontSize: 11 }}>{r.id}</td>
                    <td style={{ ...S.td, ...S.mono }}>{r.code}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{r.name || "—"}</td>
                    <td style={{ ...S.td, color: "#e2e8f0", fontWeight: 600 }}>{r.uses_count}</td>
                    <td style={{ ...S.td, color: "#64748b" }}>{r.max_uses ?? "∞"}</td>
                    <td style={{ ...S.td, color: r.discount_pct > 0 ? "#4ade80" : "#64748b", fontWeight: r.discount_pct > 0 ? 700 : 400 }}>
                      {r.discount_pct > 0 ? `${r.discount_pct}%` : "—"}
                    </td>
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{fmtDate(r.expires_at)}</td>
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
