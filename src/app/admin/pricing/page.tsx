"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PricingItem, PriceGroup, PriceType } from "@/lib/partner-types";
import { PRICE_GROUP_LABELS, PRICE_TYPE_LABELS, formatPrice } from "@/lib/partner-types";

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
  td: { padding: "10px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  btn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  btnSm: { background: "none", color: "#7c3aed", border: "1px solid #2d3748", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  btnDanger: { background: "none", color: "#ef4444", border: "1px solid #2d3748", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  input: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, width: "100%" } as React.CSSProperties,
  select: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13 } as React.CSSProperties,
  label: { fontSize: 11, color: "#64748b", marginBottom: 4, display: "block", fontWeight: 600 } as React.CSSProperties,
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
];

const emptyItem = {
  name: "", description: "", price_group: "A" as PriceGroup, type: "free" as PriceType,
  price_amount: 0, currency: "RUB", is_active: true, sort_order: 0,
};

export default function PricingAdmin() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<PricingItem> & typeof emptyItem) | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  async function loadItems() {
    setLoading(true);
    const r = await fetch("/api/admin/pricing");
    const d = await r.json();
    if (d.ok) setItems(d.items);
    setLoading(false);
  }

  async function handleSeed(force = false) {
    if (force && !confirm("Удалить все существующие тарифы и загрузить 67 стандартных позиций?")) return;
    setSeeding(true);
    setSeedMsg("");
    const r = await fetch(`/api/admin/seed-pricing${force ? "?force=1" : ""}`, { method: "POST" });
    const d = await r.json();
    setSeedMsg(d.message || d.error || "Ошибка");
    setSeeding(false);
    if (d.ok) loadItems();
  }

  useEffect(() => { loadItems(); }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, price_amount: Math.round(Number(editing.price_amount) || 0) }),
    });
    setSaving(false);
    setEditing(null);
    loadItems();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить тариф?")) return;
    await fetch(`/api/admin/pricing?id=${id}`, { method: "DELETE" });
    loadItems();
  }

  const groupColor: Record<string, string> = { A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#c084fc", E: "#f43f5e" };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/pricing")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={S.h1}>Тарифы и услуги</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {items.length === 0 && (
              <button style={{ ...S.btn, background: "#16a34a" }} onClick={() => handleSeed(false)} disabled={seeding}>
                {seeding ? "Загрузка..." : "⬇ Загрузить 67 тарифов"}
              </button>
            )}
            {items.length > 0 && (
              <button style={{ ...S.btnSm, color: "#f59e0b", borderColor: "#f59e0b55" }} onClick={() => handleSeed(true)} disabled={seeding}>
                {seeding ? "..." : "↻ Пересеять"}
              </button>
            )}
            <button style={S.btn} onClick={() => setEditing({ ...emptyItem })}>+ Добавить тариф</button>
          </div>
        </div>
        {seedMsg && (
          <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 8, background: seedMsg.includes("Загружено") ? "#16a34a22" : "#ef444422", color: seedMsg.includes("Загружено") ? "#4ade80" : "#ef4444", fontSize: 13 }}>
            {seedMsg}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div style={{ ...S.card, marginBottom: 24, border: "1px solid #7c3aed" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#f1f5f9" }}>
              {editing.id ? "Редактировать тариф" : "Новый тариф"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Название *</label>
                <input style={S.input} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Группа</label>
                <select style={S.select} value={editing.price_group} onChange={e => setEditing({ ...editing, price_group: e.target.value as PriceGroup })}>
                  {(["A","B","C","D","E"] as PriceGroup[]).map(g => <option key={g} value={g}>{g} — {PRICE_GROUP_LABELS[g]}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Тип</label>
                <select style={S.select} value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as PriceType })}>
                  {(["free","one_time","subscription"] as PriceType[]).map(t => <option key={t} value={t}>{PRICE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Цена (копейки)</label>
                <input style={S.input} type="number" value={editing.price_amount} onChange={e => setEditing({ ...editing, price_amount: Number(e.target.value) })} />
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{formatPrice(editing.price_amount)}</div>
              </div>
              <div>
                <label style={S.label}>Порядок сортировки</label>
                <input style={S.input} type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
                <span style={{ fontSize: 13 }}>Активен</span>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Описание</label>
              <input style={S.input} value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn} onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button style={S.btnSm} onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        )}

        {/* Table grouped by price_group */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div>Нет тарифов</div>
          </div>
        ) : (
          (["A","B","C","D","E"] as PriceGroup[]).map(g => {
            const groupItems = items.filter(i => i.price_group === g);
            if (groupItems.length === 0) return null;
            return (
              <div key={g} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={S.badge(groupColor[g] || "#64748b")}>{g}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{PRICE_GROUP_LABELS[g]}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>({groupItems.length})</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Название</th>
                        <th style={S.th}>Тип</th>
                        <th style={S.th}>Цена</th>
                        <th style={S.th}>Активен</th>
                        <th style={S.th}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map((item, i) => (
                        <tr key={item.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{item.name}</div>
                            {item.description && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{item.description}</div>}
                          </td>
                          <td style={S.td}><span style={S.badge("#60a5fa")}>{PRICE_TYPE_LABELS[item.type]}</span></td>
                          <td style={{ ...S.td, fontWeight: 700, color: "#4ade80" }}>{item.type === "free" ? "Бесплатно" : formatPrice(item.price_amount)}</td>
                          <td style={S.td}>{item.is_active ? <span style={S.badge("#4ade80")}>Да</span> : <span style={S.badge("#ef4444")}>Нет</span>}</td>
                          <td style={S.td}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button style={S.btnSm} onClick={() => setEditing({ ...item, description: item.description || "" })}>Ред.</button>
                              <button style={S.btnDanger} onClick={() => handleDelete(item.id)}>Удалить</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
