"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Overview {
  ok: boolean;
  label?: string;
  users?: Array<{ email: string; name: string | null; plan: string; status: string; tokens_used: number; tokens_limit: number | null; expires_at: string | null; created_at: string }>;
  pricing?: Array<{ id: string; name: string; description: string | null; type: string; price_amount: number; currency: string; is_active: boolean }>;
  referrals?: Array<{ id: string; code: string; name: string; trial_days: number; discount_pct: number; used_count: number; max_uses: number | null; is_active: boolean }>;
  stats?: { subs_total: number; subs_active: number; tokens_used: number; revenue: number };
  error?: string;
}

const C = { bg: "#0f1117", card: "#1a1f2e", border: "#2d3748", fg: "#e2e8f0", muted: "#64748b", accent: "#7c3aed", green: "#22c55e", red: "#f87171" };

export default function ProductAdminPage() {
  const params = useParams();
  const router = useRouter();
  const product = String(params.product ?? "");
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Формы
  const [gEmail, setGEmail] = useState(""); const [gDays, setGDays] = useState("30");
  const [tName, setTName] = useState(""); const [tPrice, setTPrice] = useState("");
  const [rCode, setRCode] = useState(""); const [rName, setRName] = useState(""); const [rTrial, setRTrial] = useState("30"); const [rDisc, setRDisc] = useState("0");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/products/${product}`, { credentials: "include" });
      if (r.status === 401 || r.status === 403) { router.replace("/admin/login"); return; }
      const j: Overview = await r.json();
      if (!j.ok) { setErr(j.error ?? "Ошибка"); return; }
      setData(j); setErr(null);
    } catch { setErr("Ошибка соединения"); }
  }, [product, router]);

  useEffect(() => { load(); }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/products/${product}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) { alert(j.error ?? "Ошибка"); return; }
      await load();
    } catch { alert("Ошибка соединения"); } finally { setBusy(false); }
  };

  const rub = (kop: number) => (kop / 100).toLocaleString("ru-RU");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: "system-ui, sans-serif", padding: "28px 32px" }}>
      <Link href="/admin" style={{ color: C.muted, textDecoration: "none", fontSize: 13 }}>← Платформы</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 20px" }}>
        {data?.label ?? product} <span style={{ color: C.muted, fontWeight: 500, fontSize: 16 }}>· панель управления</span>
      </h1>

      {err && <div style={{ color: C.red, marginBottom: 16 }}>{err}</div>}
      {!data && !err && <div style={{ color: C.muted }}>Загрузка…</div>}

      {data && (
        <>
          {/* KPI + сидинг */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 14 }}>
            {[
              { n: data.stats?.subs_total ?? 0, l: "Подписок всего" },
              { n: data.stats?.subs_active ?? 0, l: "Активных" },
              { n: (data.stats?.tokens_used ?? 0).toLocaleString("ru-RU"), l: "Токенов израсходовано" },
              { n: `${rub(data.stats?.revenue ?? 0)} ₽`, l: "Выручка" },
            ].map((k, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{k.n}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{k.l}</div>
              </div>
            ))}
          </div>
          <button disabled={busy} onClick={() => { if (confirm("Выдать триал-подписку на этот продукт ВСЕМ существующим пользователям?")) post({ action: "grant-all" }); }}
            style={btn(C.accent, busy)}>Выдать триал всем юзерам</button>

          {/* Пользователи */}
          <Section title={`Подписчики (${data.users?.length ?? 0})`}>
            <Row>
              <input placeholder="email пользователя" value={gEmail} onChange={e => setGEmail(e.target.value)} style={inp(220)} />
              <input placeholder="дней" value={gDays} onChange={e => setGDays(e.target.value)} style={inp(70)} />
              <button disabled={busy} onClick={() => post({ action: "grant", email: gEmail, days: Number(gDays), plan: "pro" })} style={btn(C.green, busy)}>Выдать подписку</button>
            </Row>
            <Table head={["Email", "Имя", "Тариф", "Статус", "Токены", "Истекает"]}
              rows={(data.users ?? []).map(u => [u.email, u.name ?? "—", u.plan, u.status,
                `${u.tokens_used.toLocaleString("ru-RU")}${u.tokens_limit ? " / " + u.tokens_limit.toLocaleString("ru-RU") : ""}`,
                u.expires_at ? new Date(u.expires_at).toLocaleDateString("ru-RU") : "—"])}
              empty="Пока нет подписчиков." />
          </Section>

          {/* Тарифы */}
          <Section title={`Тарифы (${data.pricing?.length ?? 0})`}>
            <Row>
              <input placeholder="название тарифа" value={tName} onChange={e => setTName(e.target.value)} style={inp(220)} />
              <input placeholder="цена ₽" value={tPrice} onChange={e => setTPrice(e.target.value)} style={inp(90)} />
              <button disabled={busy} onClick={() => post({ action: "pricing-create", name: tName, price: Number(tPrice), type: "subscription" })} style={btn(C.green, busy)}>Добавить тариф</button>
            </Row>
            {(data.pricing ?? []).length === 0 ? <Empty text="Тарифы продукта ещё не заданы." /> : (
              <List items={(data.pricing ?? []).map(p => ({
                id: p.id, main: `${p.name} — ${rub(p.price_amount)} ${p.currency}`, sub: p.type, active: p.is_active,
                onToggle: () => post({ action: "pricing-toggle", id: p.id }),
              }))} busy={busy} />
            )}
          </Section>

          {/* Реф-ссылки */}
          <Section title={`Реферальные ссылки (${data.referrals?.length ?? 0})`}>
            <Row>
              <input placeholder="код" value={rCode} onChange={e => setRCode(e.target.value)} style={inp(130)} />
              <input placeholder="название" value={rName} onChange={e => setRName(e.target.value)} style={inp(160)} />
              <input placeholder="триал, дн" value={rTrial} onChange={e => setRTrial(e.target.value)} style={inp(80)} />
              <input placeholder="скидка %" value={rDisc} onChange={e => setRDisc(e.target.value)} style={inp(80)} />
              <button disabled={busy} onClick={() => post({ action: "referral-create", code: rCode, name: rName, trialDays: Number(rTrial), discountPct: Number(rDisc) })} style={btn(C.green, busy)}>Создать ссылку</button>
            </Row>
            {(data.referrals ?? []).length === 0 ? <Empty text="Реф-ссылок для продукта пока нет." /> : (
              <List items={(data.referrals ?? []).map(r => ({
                id: r.id, main: `${r.code} · ${r.name}`, sub: `триал ${r.trial_days} дн · скидка ${r.discount_pct}% · исп. ${r.used_count}${r.max_uses ? "/" + r.max_uses : ""}`, active: r.is_active,
                onToggle: () => post({ action: "referral-toggle", id: r.id }),
              }))} busy={busy} />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

const inp = (w: number): React.CSSProperties => ({ width: w, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#10141d", color: C.fg, fontSize: 13, fontFamily: "inherit" });
const btn = (bg: string, busy: boolean): React.CSSProperties => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: busy ? "#374151" : bg, color: "#fff", fontWeight: 600, fontSize: 13, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" });

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 28 }}><h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "#f1f5f9" }}>{title}</h2>{children}</div>;
}
function Empty({ text }: { text: string }) { return <div style={{ color: C.muted, fontSize: 14, padding: "8px 0" }}>{text}</div>; }

function List({ items, busy }: { items: Array<{ id: string; main: string; sub: string; active: boolean; onToggle: () => void }>; busy: boolean }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: i ? `1px solid #232a3a` : "none" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{it.main}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{it.sub}</div>
          </div>
          <button disabled={busy} onClick={it.onToggle} style={{ ...btn(it.active ? "#334155" : C.green, busy), padding: "6px 12px" }}>{it.active ? "Выключить" : "Включить"}</button>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) return <Empty text={empty} />;
  return (
    <div style={{ overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci} style={{ padding: "10px 14px", borderBottom: `1px solid #232a3a`, whiteSpace: "nowrap" }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
