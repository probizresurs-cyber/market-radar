"use client";

import { useEffect, useState } from "react";
import { Plus, X, RefreshCcw } from "lucide-react";

interface CAPayment {
  id: number;
  tenant_id: number | null;
  tenant_name: string | null;
  tenant_name_resolved: string | null;
  amount: number;
  currency: string;
  plan: string | null;
  status: string;
  payment_method: string | null;
  external_id: string | null;
  period_from: string | null;
  period_to: string | null;
  notes: string | null;
  created_at: string;
}

interface CATenant {
  id: number;
  name: string;
  slug: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  paid: "#4ade80",
  pending: "#f59e0b",
  failed: "#ef4444",
  refunded: "#64748b",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Оплачен",
  pending: "Ожидает",
  failed: "Ошибка",
  refunded: "Возврат",
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
  filterBtn: (active: boolean) => ({
    background: active ? "#0ea5e9" : "#1a1f2e",
    color: active ? "#fff" : "#94a3b8",
    border: "1px solid #2d3748", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  } as React.CSSProperties),
  errBox: { background: "#3b0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 13 } as React.CSSProperties,
  emptyMsg: { textAlign: "center" as const, padding: "60px 0", color: "#475569", fontSize: 13 } as React.CSSProperties,
  refreshBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" } as React.CSSProperties,
  addBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } as React.CSSProperties,
  label: { fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block" } as React.CSSProperties,
  input: { width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
  select: { width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
}

function fmtPeriod(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  return [from ? fmtDate(from) : "?", to ? fmtDate(to) : "?"].join(" – ");
}

export default function CAPaymentsPage() {
  const [payments, setPayments] = useState<CAPayment[]>([]);
  const [tenants, setTenants] = useState<CATenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tenant_id: "",
    amount: "",
    plan: "",
    status: "pending",
    payment_method: "",
    period_from: "",
    period_to: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch("/api/admin/call-agent/payments", { cache: "no-store", credentials: "include" }),
        fetch("/api/admin/call-agent/tenants", { cache: "no-store", credentials: "include" }),
      ]);
      if (pRes.status === 401) { window.location.href = "/admin/login"; return; }
      const pData = await pRes.json().catch(() => ({}));
      const tData = await tRes.json().catch(() => ({}));

      if (!pRes.ok || !pData.ok) {
        setErr(pData.error || `HTTP ${pRes.status}`);
        setPayments([]);
      } else {
        setPayments(Array.isArray(pData.payments) ? pData.payments : []);
      }
      if (tRes.ok && tData.ok) {
        setTenants(Array.isArray(tData.items) ? tData.items : []);
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
    if (!form.amount || isNaN(Number(form.amount))) { alert("Введите сумму"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/call-agent/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: form.tenant_id ? Number(form.tenant_id) : undefined,
          amount: Number(form.amount),
          plan: form.plan.trim() || undefined,
          status: form.status || "pending",
          payment_method: form.payment_method.trim() || undefined,
          period_from: form.period_from || undefined,
          period_to: form.period_to || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setForm({ tenant_id: "", amount: "", plan: "", status: "pending", payment_method: "", period_from: "", period_to: "", notes: "" });
        setShowForm(false);
        load();
      } else {
        alert(d.error || "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter ? payments.filter(p => p.status === filter) : payments;

  const totalCount = payments.length;
  const paidCount = payments.filter(p => p.status === "paid").length;
  const paidSum = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const pendingCount = payments.filter(p => p.status === "pending").length;

  return (
    <main style={S.main}>
      <div style={S.titleRow}>
        <div style={S.h1}>Платежи Call-Agent</div>
        <div style={S.actions}>
          <button onClick={load} style={S.refreshBtn} disabled={loading}>
            <RefreshCcw size={14} /> {loading ? "Загрузка..." : "Обновить"}
          </button>
          <button onClick={() => setShowForm(v => !v)} style={S.addBtn}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Скрыть форму" : "Добавить платёж"}
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
          <div style={S.statNum}>{totalCount}</div>
          <div style={S.statLabel}>Всего платежей</div>
        </div>
        <div style={S.stat}>
          <div style={{ ...S.statNum, color: "#4ade80" }}>{paidCount}</div>
          <div style={S.statLabel}>Успешных</div>
        </div>
        <div style={S.stat}>
          <div style={{ ...S.statNum, color: "#4ade80" }}>{paidSum.toLocaleString("ru-RU")} ₽</div>
          <div style={S.statLabel}>Сумма успешных</div>
        </div>
        <div style={S.stat}>
          <div style={{ ...S.statNum, color: "#f59e0b" }}>{pendingCount}</div>
          <div style={S.statLabel}>В ожидании</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>Новый платёж</div>
          <form onSubmit={handleSubmit}>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>Тенант</label>
                <select
                  style={S.select}
                  value={form.tenant_id}
                  onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                >
                  <option value="">— не выбран —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={String(t.id)}>{t.name} #{t.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Сумма (₽) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  style={S.input}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="5000"
                />
              </div>
            </div>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>План</label>
                <input style={S.input} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} placeholder="starter / pro / enterprise" />
              </div>
              <div>
                <label style={S.label}>Статус</label>
                <select style={S.select} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">Ожидает</option>
                  <option value="paid">Оплачен</option>
                  <option value="failed">Ошибка</option>
                  <option value="refunded">Возврат</option>
                </select>
              </div>
            </div>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>Метод оплаты</label>
                <input style={S.input} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="card / bank / yoomoney" />
              </div>
              <div>
                <label style={S.label}>Заметки</label>
                <input style={S.input} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Любые заметки..." />
              </div>
            </div>
            <div style={S.formRow}>
              <div>
                <label style={S.label}>Период с</label>
                <input type="date" style={S.input} value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Период по</label>
                <input type="date" style={S.input} value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} />
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

      {/* Status filter */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["", "paid", "pending", "failed", "refunded"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={S.filterBtn(filter === s)}>
            {s ? (STATUS_LABELS[s] || s) : "Все"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={S.emptyMsg}>Загрузка...</div>
      ) : filtered.length === 0 && !err ? (
        <div style={S.emptyMsg}>Нет платежей{filter ? ` со статусом «${STATUS_LABELS[filter] || filter}»` : ""}.</div>
      ) : filtered.length > 0 ? (
        <div style={{ overflowX: "auto", background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, overflow: "hidden" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Тенант</th>
                <th style={S.th}>Сумма</th>
                <th style={S.th}>План</th>
                <th style={S.th}>Статус</th>
                <th style={S.th}>Метод</th>
                <th style={S.th}>Период</th>
                <th style={S.th}>Создан</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const tenantLabel = p.tenant_name_resolved || p.tenant_name || (p.tenant_id ? `#${p.tenant_id}` : "—");
                return (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>{p.id}</td>
                    <td style={{ ...S.td, color: "#e2e8f0" }}>{tenantLabel}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: p.status === "failed" ? "#ef4444" : "#4ade80" }}>
                      {(p.amount || 0).toLocaleString("ru-RU")} {p.currency || "₽"}
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{p.plan || "—"}</td>
                    <td style={S.td}>
                      <span style={S.badge(STATUS_COLORS[p.status] || "#64748b")}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{p.payment_method || "—"}</td>
                    <td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>{fmtPeriod(p.period_from, p.period_to)}</td>
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{fmtDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
