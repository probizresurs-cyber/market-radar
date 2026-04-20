"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PromoCode } from "@/lib/partner-types";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  btn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  btnSm: { background: "none", color: "#7c3aed", border: "1px solid #2d3748", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  btnDanger: { background: "none", color: "#ef4444", border: "1px solid #2d3748", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  input: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, width: "100%" } as React.CSSProperties,
  label: { fontSize: 11, color: "#64748b", marginBottom: 4, display: "block", fontWeight: 600 } as React.CSSProperties,
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
];

interface EditCode {
  id?: string;
  code: string;
  name: string;
  discount_percent: number | null;
  discount_amount: number | null;
  valid_from: string;
  valid_to: string;
  max_uses: number | null;
  partner_id: string;
  is_active: boolean;
}

const emptyCode: EditCode = {
  code: "", name: "", discount_percent: null, discount_amount: null,
  valid_from: "", valid_to: "", max_uses: null, partner_id: "", is_active: true,
};

export default function PromoAdmin() {
  const [codes, setCodes] = useState<(PromoCode & { partner_code?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditCode | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/promo-codes");
    const d = await r.json();
    if (d.ok) setCodes(d.codes);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить промокод?")) return;
    await fetch(`/api/admin/promo-codes?id=${id}`, { method: "DELETE" });
    load();
  }

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/promo")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={S.h1}>Промокоды</div>
          <button style={S.btn} onClick={() => setEditing({ ...emptyCode })}>+ Добавить</button>
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{ ...S.card, border: "1px solid #7c3aed" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#f1f5f9" }}>
              {editing.id ? "Редактировать" : "Новый промокод"}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Название промокода</label>
              <input style={S.input} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Новогодняя акция 2025" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Код *</label>
                <input style={S.input} value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="PROMO2024" />
              </div>
              <div>
                <label style={S.label}>Скидка %</label>
                <input style={S.input} type="number" value={editing.discount_percent ?? ""} onChange={e => setEditing({ ...editing, discount_percent: e.target.value ? Number(e.target.value) : null })} placeholder="10" />
              </div>
              <div>
                <label style={S.label}>Скидка (коп.)</label>
                <input style={S.input} type="number" value={editing.discount_amount ?? ""} onChange={e => setEditing({ ...editing, discount_amount: e.target.value ? Number(e.target.value) : null })} placeholder="99000" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Действует с</label>
                <input style={S.input} type="date" value={editing.valid_from} onChange={e => setEditing({ ...editing, valid_from: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Действует до</label>
                <input style={S.input} type="date" value={editing.valid_to} onChange={e => setEditing({ ...editing, valid_to: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Макс. исп.</label>
                <input style={S.input} type="number" value={editing.max_uses ?? ""} onChange={e => setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
                <span style={{ fontSize: 13 }}>Активен</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn} onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button style={S.btnSm} onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : codes.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏷</div>
            <div>Нет промокодов</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Название</th>
                  <th style={S.th}>Код</th>
                  <th style={S.th}>Скидка</th>
                  <th style={S.th}>Период</th>
                  <th style={S.th}>Исп.</th>
                  <th style={S.th}>Партнёр</th>
                  <th style={S.th}>Активен</th>
                  <th style={S.th}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>
                      {c.name || <span style={{ color: "#475569" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.05em" }}>
                      {c.code}
                    </td>
                    <td style={{ ...S.td, color: "#4ade80", fontWeight: 600 }}>
                      {c.discount_percent ? `${c.discount_percent}%` : ""}
                      {c.discount_percent && c.discount_amount ? " + " : ""}
                      {c.discount_amount ? `${(c.discount_amount / 100).toFixed(0)} ₽` : ""}
                      {!c.discount_percent && !c.discount_amount ? "—" : ""}
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: "#64748b" }}>
                      {fmtDate(c.valid_from)} — {fmtDate(c.valid_to)}
                    </td>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8", fontSize: 12 }}>
                      {c.partner_id ? (c.partner_code || c.partner_id.slice(0, 8)) : "—"}
                    </td>
                    <td style={S.td}>
                      {c.is_active ? <span style={S.badge("#4ade80")}>Да</span> : <span style={S.badge("#ef4444")}>Нет</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={S.btnSm} onClick={() => setEditing({
                          id: c.id, code: c.code, name: c.name || "",
                          discount_percent: c.discount_percent, discount_amount: c.discount_amount,
                          valid_from: c.valid_from ? c.valid_from.slice(0, 10) : "", valid_to: c.valid_to ? c.valid_to.slice(0, 10) : "",
                          max_uses: c.max_uses, partner_id: c.partner_id || "", is_active: c.is_active,
                        })}>Ред.</button>
                        <button style={S.btnDanger} onClick={() => handleDelete(c.id)}>Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
