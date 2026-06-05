"use client";

import { useEffect, useState } from "react";

const ACCENT = "#0ea5e9";

const S = {
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 28 } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 32 } as React.CSSProperties,
  card: (active: boolean) => ({
    background: "#1a1f2e",
    border: `1px solid ${active ? ACCENT + "55" : "#2d3748"}`,
    borderRadius: 16,
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    position: "relative" as const,
  }),
  cardName: { fontSize: 18, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 } as React.CSSProperties,
  price: { fontSize: 32, fontWeight: 800, color: ACCENT, marginBottom: 2 } as React.CSSProperties,
  priceAnn: { fontSize: 12, color: "#64748b", marginBottom: 14 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", padding: "5px 0", borderBottom: "1px solid #1e2737" } as React.CSSProperties,
  rowVal: { color: "#e2e8f0", fontWeight: 600 } as React.CSSProperties,
  badge: (active: boolean) => ({
    position: "absolute" as const, top: 14, right: 14,
    fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
    background: active ? "#4ade8022" : "#ef444422",
    color: active ? "#4ade80" : "#ef4444",
  }),
  btnRow: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" as const } as React.CSSProperties,
  btn: { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 } as React.CSSProperties,
  btnGhost: { background: "none", color: "#64748b", border: "1px solid #2d3748", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  btnToggle: (active: boolean) => ({
    background: "none", border: `1px solid ${active ? "#ef444455" : "#4ade8055"}`,
    color: active ? "#ef4444" : "#4ade80", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700,
  } as React.CSSProperties),
  editBox: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginTop: 16 } as React.CSSProperties,
  label: { fontSize: 11, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 } as React.CSSProperties,
  input: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, width: "100%", boxSizing: "border-box" as const } as React.CSSProperties,
  field: { marginBottom: 12 } as React.CSSProperties,
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  saveRow: { display: "flex", gap: 8, marginTop: 4 } as React.CSSProperties,
  savingMsg: { fontSize: 12, color: "#4ade80", marginTop: 8 } as React.CSSProperties,
  errMsg: { fontSize: 12, color: "#ef4444", marginTop: 8 } as React.CSSProperties,
  empty: { textAlign: "center" as const, padding: "60px 0", color: "#475569", fontSize: 14 } as React.CSSProperties,
};

interface Plan {
  id: number;
  name: string;
  price_monthly: number;
  price_annual: number | null;
  calls_limit: number;
  managers_limit: number | null;
  features_json: string | null;
  active: boolean;
  created_at: string;
}

interface EditState {
  id: number;
  name: string;
  price_monthly: string;
  price_annual: string;
  calls_limit: string;
  managers_limit: string;
}

function fmtPrice(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("ru-RU") + " ₽";
}

export default function CAPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/call-agent/plans");
      const d = await r.json();
      if (d.ok && d.plans) setPlans(d.plans);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(p: Plan) {
    setEditId(p.id);
    setEdit({
      id: p.id,
      name: p.name,
      price_monthly: String(p.price_monthly),
      price_annual: p.price_annual != null ? String(p.price_annual) : "",
      calls_limit: String(p.calls_limit),
      managers_limit: p.managers_limit != null ? String(p.managers_limit) : "",
    });
    setMsg(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEdit(null);
    setMsg(null);
  }

  async function handleSave() {
    if (!edit) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        id: edit.id,
        name: edit.name.trim(),
        price_monthly: parseInt(edit.price_monthly, 10) || 0,
        price_annual: edit.price_annual ? parseInt(edit.price_annual, 10) : null,
        calls_limit: parseInt(edit.calls_limit, 10) || 0,
        managers_limit: edit.managers_limit ? parseInt(edit.managers_limit, 10) : null,
      };
      const r = await fetch("/api/admin/call-agent/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg({ text: "Сохранено", ok: true });
        cancelEdit();
        load();
      } else {
        setMsg({ text: d.error || "Ошибка сохранения", ok: false });
      }
    } catch (e) {
      setMsg({ text: String(e), ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(p: Plan) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/call-agent/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: p.id,
          name: p.name,
          price_monthly: p.price_monthly,
          price_annual: p.price_annual,
          calls_limit: p.calls_limit,
          managers_limit: p.managers_limit,
          active: !p.active,
        }),
      });
      const d = await r.json();
      if (d.ok) load();
      else setMsg({ text: d.error || "Ошибка", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={S.main}>
      <div style={S.h1}>Тарифы Call-Agent</div>
      <div style={S.sub}>Управление тарифными планами. Изменения применяются мгновенно.</div>

      {loading ? (
        <div style={S.empty}>Загрузка...</div>
      ) : plans.length === 0 ? (
        <div style={S.empty}>Тарифы не найдены. Проверьте подключение к Call-Agent.</div>
      ) : (
        <div style={S.grid}>
          {plans.map((p) => (
            <div key={p.id} style={S.card(p.active)}>
              <span style={S.badge(p.active)}>{p.active ? "Активен" : "Отключён"}</span>

              <div style={S.cardName}>{p.name}</div>
              <div style={S.price}>{fmtPrice(p.price_monthly)}<span style={{ fontSize: 14, fontWeight: 400, color: "#64748b" }}>/мес</span></div>
              <div style={S.priceAnn}>
                {p.price_annual != null ? `${fmtPrice(p.price_annual)}/год` : "Годовой тариф не задан"}
              </div>

              <div style={S.row}>
                <span>Звонков</span>
                <span style={S.rowVal}>{p.calls_limit.toLocaleString("ru-RU")}</span>
              </div>
              <div style={{ ...S.row, borderBottom: "none" }}>
                <span>Менеджеров</span>
                <span style={S.rowVal}>{p.managers_limit != null ? p.managers_limit : "Без лимита"}</span>
              </div>

              <div style={S.btnRow}>
                <button style={S.btn} onClick={() => startEdit(p)}>Редактировать</button>
                <button style={S.btnToggle(p.active)} onClick={() => handleToggleActive(p)} disabled={saving}>
                  {p.active ? "Отключить" : "Включить"}
                </button>
              </div>

              {editId === p.id && edit && (
                <div style={S.editBox}>
                  <div style={S.field}>
                    <label style={S.label}>Название</label>
                    <input style={S.input} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
                  </div>
                  <div style={{ ...S.grid2, ...S.field }}>
                    <div>
                      <label style={S.label}>Цена/мес (₽)</label>
                      <input style={S.input} type="number" value={edit.price_monthly} onChange={e => setEdit({ ...edit, price_monthly: e.target.value })} />
                    </div>
                    <div>
                      <label style={S.label}>Цена/год (₽)</label>
                      <input style={S.input} type="number" value={edit.price_annual} onChange={e => setEdit({ ...edit, price_annual: e.target.value })} placeholder="не задан" />
                    </div>
                  </div>
                  <div style={{ ...S.grid2, ...S.field }}>
                    <div>
                      <label style={S.label}>Лимит звонков</label>
                      <input style={S.input} type="number" value={edit.calls_limit} onChange={e => setEdit({ ...edit, calls_limit: e.target.value })} />
                    </div>
                    <div>
                      <label style={S.label}>Лимит менеджеров</label>
                      <input style={S.input} type="number" value={edit.managers_limit} onChange={e => setEdit({ ...edit, managers_limit: e.target.value })} placeholder="без лимита" />
                    </div>
                  </div>
                  <div style={S.saveRow}>
                    <button style={S.btn} onClick={handleSave} disabled={saving}>
                      {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <button style={S.btnGhost} onClick={cancelEdit}>Отмена</button>
                  </div>
                  {msg && (
                    <div style={msg.ok ? S.savingMsg : S.errMsg}>{msg.text}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
