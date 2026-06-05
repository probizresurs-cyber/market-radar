"use client";

import { useEffect, useState } from "react";
import { Plus, X, RefreshCcw } from "lucide-react";

interface CAPartner {
  id: number;
  name: string;
  email: string | null;
  contact: string | null;
  commission_pct: number;
  ref_code: string | null;
  clients_count: number;
  revenue_total: number;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#4ade80",
  inactive: "#f59e0b",
  blocked: "#ef4444",
};

const S = {
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, color: "#f1f5f9" } as React.CSSProperties,
  actions: { display: "flex", gap: 10, alignItems: "center" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 32, fontWeight: 800, color: "#0ea5e9" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 24, marginBottom: 24 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#13182a", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  errBox: { background: "#3b0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 13 } as React.CSSProperties,
  emptyMsg: { textAlign: "center" as const, padding: "60px 0", color: "#475569", fontSize: 13 } as React.CSSProperties,
  refreshBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" } as React.CSSProperties,
  addBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } as React.CSSProperties,
  label: { fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block" } as React.CSSProperties,
  input: { width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
}

export default function CAPartnersPage() {
  const [partners, setPartners] = useState<CAPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", contact: "", commission_pct: "10", ref_code: "", notes: "" });

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/call-agent/partners", { cache: "no-store", credentials: "include" });
      if (r.status === 401) { window.location.href = "/admin/login"; return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setErr(d.error || `HTTP ${r.status}`);
        setPartners([]);
      } else {
        setPartners(Array.isArray(d.partners) ? d.partners : []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/admin/call-agent/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          contact: form.contact.trim() || undefined,
          commission_pct: Number(form.commission_pct) || 10,
          ref_code: form.ref_code.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setForm({ name: "", email: "", contact: "", commission_pct: "10", ref_code: "", notes: "" });
        setShowForm(false);
        load();
      } else {
        alert(d.error || "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  const total = partners.length;
  const active = partners.filter(p => p.status === "active").length;
  const totalRevenue = partners.reduce((s, p) => s + (p.revenue_total || 0), 0);
  const totalClients = partners.reduce((s, p) => s + (p.clients_count || 0), 0);

  return (
    <main style={S.main}>
      <div style={S.titleRow}>
        <div style={S.h1}>Партнёры Call-Agent</div>
        <div style={S.actions}>
          <button onClick={load} style={S.refreshBtn} disabled={loading}>
            <RefreshCcw size={14} /> {loading ? "Загрузка..." : "Обновить"}
          </button>
          <button onClick={() => setShowForm(v => !v)} style={S.addBtn}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Скрыть форму" : "Добавить партнёра"}
          </button>
        </div>
      </div>

      {err && (
        <div style={S.errBox}>
          <strong>Ошибка:</strong> {err}
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
            Убедитесь, что Call-Agent запущен и переменные CA_BASE_URL / CA_ADMIN_TOKEN настроены верно.
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={S.statRow}>
        <div style={S.stat}>
          <div style={S.statNum}>{total}</div>
          <div style={S.statLabel}>Всего партнёров</div>
        </div>
        <div style={S.stat}>
          <div style={{ ...S.statNum, color: "#4ade80" }}>{active}</div>
          <div style={S.statLabel}>Активных</div>
        </div>
        <div style={S.stat}>
          <div style={{ ...S.statNum, color: "#c084fc" }}>{totalClients}</div>
          <div style={S.statLabel}>Клиентов всего</div>
        </div>
        <div style={S.stat}>
          <div style={{ ...S.statNum, color: "#f59e0b" }}>{totalRevenue.toLocaleString("ru-RU")} ₽</div>
          <div style={S.statLabel}>Выручка всего</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>Новый партнёр</div>
          <form onSubmit={handleSubmit}>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>Название *</label>
                <input required style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ООО Ромашка" />
              </div>
              <div>
                <label style={S.label}>Email</label>
                <input type="email" style={S.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="partner@example.com" />
              </div>
            </div>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>Контакт (ФИО/телефон)</label>
                <input style={S.input} value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="+7 999 000 00 00" />
              </div>
              <div>
                <label style={S.label}>Комиссия %</label>
                <input type="number" min="0" max="100" style={S.input} value={form.commission_pct} onChange={e => setForm(f => ({ ...f, commission_pct: e.target.value }))} />
              </div>
            </div>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>Реф-код</label>
                <input style={S.input} value={form.ref_code} onChange={e => setForm(f => ({ ...f, ref_code: e.target.value }))} placeholder="PARTNER2024" />
              </div>
              <div>
                <label style={S.label}>Заметки</label>
                <input style={S.input} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Любые заметки..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={saving} style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", color: "#64748b", border: "1px solid #2d3748", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={S.emptyMsg}>Загрузка...</div>
      ) : partners.length === 0 && !err ? (
        <div style={S.emptyMsg}>Нет партнёров. Нажмите «Добавить партнёра».</div>
      ) : partners.length > 0 ? (
        <div style={{ overflowX: "auto", background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, overflow: "hidden" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Название</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Контакт</th>
                <th style={S.th}>Комиссия %</th>
                <th style={S.th}>Реф-код</th>
                <th style={S.th}>Клиентов</th>
                <th style={S.th}>Выручка</th>
                <th style={S.th}>Статус</th>
                <th style={S.th}>Создан</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                  <td style={{ ...S.td, color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>{p.id}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: "#e2e8f0" }}>
                    {p.name}
                    {p.notes && <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontStyle: "italic" }}>{p.notes.length > 60 ? p.notes.slice(0, 60) + "…" : p.notes}</div>}
                  </td>
                  <td style={{ ...S.td, color: "#94a3b8" }}>{p.email || "—"}</td>
                  <td style={{ ...S.td, color: "#94a3b8" }}>{p.contact || "—"}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: "#f59e0b" }}>{p.commission_pct}%</td>
                  <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{p.ref_code || "—"}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: "#0ea5e9" }}>{p.clients_count || 0}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: "#4ade80" }}>{(p.revenue_total || 0).toLocaleString("ru-RU")} ₽</td>
                  <td style={S.td}>
                    <span style={S.badge(STATUS_COLORS[p.status] || "#64748b")}>{p.status}</span>
                  </td>
                  <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
