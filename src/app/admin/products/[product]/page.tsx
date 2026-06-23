"use client";

import { useEffect, useState } from "react";
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

const C = { bg: "#0f1117", card: "#1a1f2e", border: "#2d3748", fg: "#e2e8f0", muted: "#64748b", accent: "#7c3aed", green: "#22c55e" };

export default function ProductAdminPage() {
  const params = useParams();
  const router = useRouter();
  const product = String(params.product ?? "");
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/products/${product}`, { credentials: "include" });
        if (r.status === 401 || r.status === 403) { router.replace("/admin/login"); return; }
        const j: Overview = await r.json();
        if (!j.ok) { setErr(j.error ?? "Ошибка"); return; }
        setData(j);
      } catch { setErr("Ошибка соединения"); }
    })();
  }, [product, router]);

  const rub = (kop: number) => (kop / 100).toLocaleString("ru-RU");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: "system-ui, sans-serif", padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link href="/admin" style={{ color: C.muted, textDecoration: "none", fontSize: 13 }}>← Платформы</Link>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 24px" }}>
        {data?.label ?? product} <span style={{ color: C.muted, fontWeight: 500, fontSize: 16 }}>· панель управления</span>
      </h1>

      {err && <div style={{ color: "#f87171" }}>{err}</div>}
      {!data && !err && <div style={{ color: C.muted }}>Загрузка…</div>}

      {data && (
        <>
          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 }}>
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

          <Section title={`Пользователи (${data.users?.length ?? 0})`}>
            <Table head={["Email", "Имя", "Тариф", "Статус", "Токены", "Истекает"]}
              rows={(data.users ?? []).map(u => [
                u.email, u.name ?? "—", u.plan, u.status,
                `${u.tokens_used.toLocaleString("ru-RU")}${u.tokens_limit ? " / " + u.tokens_limit.toLocaleString("ru-RU") : ""}`,
                u.expires_at ? new Date(u.expires_at).toLocaleDateString("ru-RU") : "—",
              ])}
              empty="Пока нет подписчиков на этот продукт." />
          </Section>

          <Section title={`Тарифы (${data.pricing?.length ?? 0})`}>
            <Table head={["Название", "Тип", "Цена", "Активен"]}
              rows={(data.pricing ?? []).map(p => [
                p.name, p.type, `${rub(p.price_amount)} ${p.currency}`, p.is_active ? "да" : "нет",
              ])}
              empty="Тарифы продукта ещё не заданы." />
          </Section>

          <Section title={`Реферальные ссылки (${data.referrals?.length ?? 0})`}>
            <Table head={["Код", "Название", "Триал", "Скидка", "Использовано", "Активна"]}
              rows={(data.referrals ?? []).map(r => [
                r.code, r.name, `${r.trial_days} дн`, `${r.discount_pct}%`,
                `${r.used_count}${r.max_uses ? " / " + r.max_uses : ""}`, r.is_active ? "да" : "нет",
              ])}
              empty="Реф-ссылок для продукта пока нет." />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "#f1f5f9" }}>{title}</h2>
      {children}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) return <div style={{ color: C.muted, fontSize: 14, padding: "10px 0" }}>{empty}</div>;
  return (
    <div style={{ overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((cell, ci) => <td key={ci} style={{ padding: "10px 14px", borderBottom: `1px solid #232a3a`, whiteSpace: "nowrap" }}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
