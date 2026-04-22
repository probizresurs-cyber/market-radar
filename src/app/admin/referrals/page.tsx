"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReferralLink } from "@/lib/partner-types";
import { Link2, Copy, Check } from "lucide-react";

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
  hint: { fontSize: 11, color: "#64748b", marginTop: 4 } as React.CSSProperties,
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
];

interface EditLink {
  id?: string;
  name: string;
  code: string; // read-only for existing; optional on create
  trial_days: number;
  discount_pct: number;
  discount_months: number;
  tokens_limit: number | null;   // null = use default (100 000)
  valid_to: string;
  max_uses: number | null;
  notes: string;
  is_active: boolean;
}

const emptyLink: EditLink = {
  name: "",
  code: "",
  trial_days: 30,
  discount_pct: 50,
  discount_months: 12,
  tokens_limit: null,
  valid_to: "",
  max_uses: null,
  notes: "",
  is_active: true,
};

export default function ReferralsAdmin() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/referrals");
    const d = await r.json();
    if (d.ok) setLinks(d.links);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert("Укажите название ссылки");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/admin/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        name: editing.name,
        code: editing.id ? undefined : (editing.code || undefined),
        trial_days: editing.trial_days,
        discount_pct: editing.discount_pct,
        discount_months: editing.discount_months,
        tokens_limit: editing.tokens_limit,
        valid_to: editing.valid_to || null,
        max_uses: editing.max_uses,
        notes: editing.notes,
        is_active: editing.is_active,
      }),
    });
    const res = await r.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      alert(res.error || "Ошибка сохранения");
      return;
    }
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить реферальную ссылку? Это не повлияет на уже применённые бонусы.")) return;
    await fetch(`/api/admin/referrals?id=${id}`, { method: "DELETE" });
    load();
  }

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
  }

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  function buildUrl(code: string) {
    return `${origin}/register?ref=${encodeURIComponent(code)}`;
  }

  async function copy(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(buildUrl(code));
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      // no-op
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}>
          <span style={S.logo}>MarketRadar Admin</span>
        </Link>
      </header>
      <nav style={S.nav}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/referrals")}>
            {t.label}
          </Link>
        ))}
      </nav>

      <main style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={S.h1}>Реферальные ссылки</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: -18 }}>
              Админские ссылки для регистрации с бонусами: расширенный триал + скидка на подписку.
            </div>
          </div>
          <button style={S.btn} onClick={() => setEditing({ ...emptyLink })}>
            + Создать ссылку
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{ ...S.card, border: "1px solid #7c3aed" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#f1f5f9" }}>
              {editing.id ? "Редактировать ссылку" : "Новая реферальная ссылка"}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Название (для админов)</label>
              <input
                style={S.input}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Партнёрка Иванова · февраль 2026"
              />
            </div>

            {!editing.id && (
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Код (опционально — иначе сгенерируется автоматически)</label>
                <input
                  style={S.input}
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  placeholder="IVANOV-2026"
                />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Бесплатный триал (дней)</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  max={365}
                  value={editing.trial_days}
                  onChange={(e) => setEditing({ ...editing, trial_days: Number(e.target.value) || 0 })}
                />
                <div style={S.hint}>Например, 30 = месяц бесплатно</div>
              </div>
              <div>
                <label style={S.label}>Скидка после триала (%)</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  max={100}
                  value={editing.discount_pct}
                  onChange={(e) => setEditing({ ...editing, discount_pct: Number(e.target.value) || 0 })}
                />
                <div style={S.hint}>0 — без скидки</div>
              </div>
              <div>
                <label style={S.label}>Длительность скидки (мес.)</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  max={60}
                  value={editing.discount_months}
                  onChange={(e) => setEditing({ ...editing, discount_months: Number(e.target.value) || 0 })}
                />
                <div style={S.hint}>Например, 12 = скидка на год</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Лимит токенов на триал</label>
              <input
                style={S.input}
                type="number"
                min={1000}
                step={10000}
                value={editing.tokens_limit ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    tokens_limit: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="пусто = стандарт 100 000"
              />
              <div style={S.hint}>
                Переопределяет стандартный лимит (100 000 токенов). Например, 500 000 для премиум-партнёров.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Действует до</label>
                <input
                  style={S.input}
                  type="date"
                  value={editing.valid_to ? editing.valid_to.slice(0, 10) : ""}
                  onChange={(e) => setEditing({ ...editing, valid_to: e.target.value })}
                />
              </div>
              <div>
                <label style={S.label}>Лимит регистраций</label>
                <input
                  style={S.input}
                  type="number"
                  min={1}
                  value={editing.max_uses ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="пусто = без лимита"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                <span style={{ fontSize: 13 }}>Активна</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Заметки (необязательно)</label>
              <input
                style={S.input}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Для какой кампании / источника"
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn} onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button style={S.btnSm} onClick={() => setEditing(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Загрузка...</div>
        ) : links.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ marginBottom: 12 }}>
              <Link2 size={32} />
            </div>
            <div>Пока нет реферальных ссылок</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Создайте первую — например: 30 дней бесплатно + 50% скидка на 12 месяцев
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Название</th>
                  <th style={S.th}>Ссылка</th>
                  <th style={S.th}>Триал</th>
                  <th style={S.th}>Токены</th>
                  <th style={S.th}>Скидка</th>
                  <th style={S.th}>Действует до</th>
                  <th style={S.th}>Использовано</th>
                  <th style={S.th}>Активна</th>
                  <th style={S.th}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l, i) => {
                  const expired = l.valid_to && new Date(l.valid_to).getTime() < Date.now();
                  const capped = l.max_uses != null && l.used_count >= l.max_uses;
                  return (
                    <tr key={l.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                      <td style={{ ...S.td, color: "#e2e8f0", fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        {l.notes && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{l.notes}</div>}
                      </td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "#e2e8f0", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>{l.code}</span>
                          <button
                            style={S.btnSm}
                            onClick={() => copy(l.id, l.code)}
                            title={buildUrl(l.code)}
                          >
                            {copiedId === l.id ? <Check size={12} /> : <Copy size={12} />}
                            <span style={{ marginLeft: 4 }}>
                              {copiedId === l.id ? "Скопировано" : "URL"}
                            </span>
                          </button>
                        </div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 4, wordBreak: "break-all" }}>
                          {buildUrl(l.code)}
                        </div>
                      </td>
                      <td style={{ ...S.td, color: "#4ade80", fontWeight: 600 }}>
                        {l.trial_days}{l.trial_days > 0 ? " дн." : ""}
                      </td>
                      <td style={{ ...S.td, color: l.tokens_limit ? "#22d3ee" : "#64748b", fontWeight: 600 }}>
                        {l.tokens_limit
                          ? l.tokens_limit.toLocaleString("ru-RU")
                          : <span style={{ fontWeight: 400 }}>100 000<sup style={{ color: "#475569" }}> (станд.)</sup></span>}
                      </td>
                      <td style={{ ...S.td, color: "#4ade80", fontWeight: 600 }}>
                        {l.discount_pct > 0 && l.discount_months > 0
                          ? `${l.discount_pct}% × ${l.discount_months} мес.`
                          : l.discount_pct > 0
                            ? `${l.discount_pct}%`
                            : "—"}
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: expired ? "#ef4444" : "#94a3b8" }}>
                        {fmtDate(l.valid_to)}
                      </td>
                      <td style={{ ...S.td, fontWeight: 600 }}>
                        {l.used_count}{l.max_uses ? ` / ${l.max_uses}` : ""}
                      </td>
                      <td style={S.td}>
                        {!l.is_active ? (
                          <span style={S.badge("#64748b")}>Выкл.</span>
                        ) : expired ? (
                          <span style={S.badge("#ef4444")}>Истекла</span>
                        ) : capped ? (
                          <span style={S.badge("#f59e0b")}>Лимит</span>
                        ) : (
                          <span style={S.badge("#4ade80")}>Да</span>
                        )}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            style={S.btnSm}
                            onClick={() =>
                              setEditing({
                                id: l.id,
                                name: l.name,
                                code: l.code,
                                trial_days: l.trial_days,
                                discount_pct: l.discount_pct,
                                discount_months: l.discount_months,
                                tokens_limit: l.tokens_limit,
                                valid_to: l.valid_to ? l.valid_to.slice(0, 10) : "",
                                max_uses: l.max_uses,
                                notes: l.notes || "",
                                is_active: l.is_active,
                              })
                            }
                          >
                            Ред.
                          </button>
                          <button style={S.btnDanger} onClick={() => handleDelete(l.id)}>
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
