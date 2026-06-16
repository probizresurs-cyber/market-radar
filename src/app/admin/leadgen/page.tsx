"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Account { id: number; companyId: number; login: string; name: string | null; role: string }
interface TaskOpt { task: string; total: number }
interface Route { id: number; task: string; companyId: number; accountLogin: string | null; accountName: string | null }

const C = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "32px 40px" } as const,
  panel: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 16 } as const,
  accHead: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 } as const,
  btn: { background: "#f59e0b", color: "#0f1117", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" } as const,
  btnGhost: { background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" } as const,
  chip: (on: boolean) => ({
    display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
    border: `1px solid ${on ? "#f59e0b" : "#2d3748"}`, background: on ? "rgba(245,158,11,0.12)" : "transparent", color: on ? "#f59e0b" : "#cbd5e1",
  }),
};

export default function AdminLeadgenRouting() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({}); // `${companyId}::${task}` → bool
  const [reassign, setReassign] = useState<Record<number, boolean>>({}); // companyId → перенести существующие
  const [stats, setStats] = useState<Record<number, { total: number; hot: number; warm: number; cold: number }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [nl, setNl] = useState(""); const [np, setNp] = useState(""); const [nn, setNn] = useState(""); // новый аккаунт

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch("/api/admin/leadgen/routes", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setErr(r?.error || "Не удалось загрузить (проверь LEADGEN_ADMIN_TOKEN и что лидген развёрнут)"); return; }
    setAccounts(r.accounts || []); setTasks(r.tasks || []); setRoutes(r.routes || []); setStats(r.stats || {});
    const init: Record<string, boolean> = {};
    for (const rt of (r.routes || []) as Route[]) init[`${rt.companyId}::${rt.task}`] = true;
    setChecked(init);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createAccount() {
    if (!nl.trim() || np.length < 4) { setErr("Логин и пароль (≥4) обязательны"); return; }
    setBusy(-1); setErr(""); setMsg("");
    const r = await fetch("/api/admin/leadgen/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: nl.trim(), password: np, name: nn.trim() }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(null);
    if (!r || r.error) { setErr(r?.error || "Не удалось создать"); return; }
    setMsg(`Аккаунт «${r.account?.name || nl}» создан (тенант ${r.account?.companyId})`);
    setNl(""); setNp(""); setNn(""); await load();
  }
  async function delAccount(acc: Account) {
    if (!confirm(`Удалить доступ аккаунта «${acc.name || acc.login}»? Лиды останутся, вход пропадёт.`)) return;
    setBusy(acc.companyId);
    const r = await fetch(`/api/admin/leadgen/accounts?companyId=${acc.companyId}`, { method: "DELETE" }).then((x) => x.json()).catch(() => null);
    setBusy(null);
    if (r?.error) { setErr(r.error); return; }
    await load();
  }

  // отметить базу за аккаунтом → снять её у остальных (одна база = один аккаунт)
  function toggle(companyId: number, task: string) {
    setChecked((prev) => {
      const next = { ...prev };
      const key = `${companyId}::${task}`;
      const willBe = !prev[key];
      // снять у всех аккаунтов
      for (const a of accounts) delete next[`${a.companyId}::${task}`];
      if (willBe) next[key] = true;
      return next;
    });
  }

  async function save(acc: Account) {
    setBusy(acc.companyId); setMsg(""); setErr("");
    const target = tasks.filter((t) => checked[`${acc.companyId}::${t.task}`]).map((t) => t.task);
    const wasMine = routes.filter((r) => r.companyId === acc.companyId).map((r) => r.task);
    let moved = 0;
    try {
      // закрепить выбранные
      for (const task of target) {
        const r = await fetch("/api/admin/leadgen/routes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, companyId: acc.companyId, reassign: !!reassign[acc.companyId] }),
        }).then((x) => x.json());
        if (r?.moved) moved += r.moved;
      }
      // отвязать те, что были за этим аккаунтом, но сняты
      for (const task of wasMine) if (!target.includes(task)) {
        await fetch(`/api/admin/leadgen/routes?task=${encodeURIComponent(task)}`, { method: "DELETE" });
      }
      setMsg(`${acc.name || acc.login}: баз ${target.length}${moved ? `, перенесено лидов: ${moved}` : ""}`);
      await load();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  // у какого аккаунта сейчас закреплена база (для подписи «уже у …»)
  const ownerOf = (task: string) => routes.find((r) => r.task === task);

  return (
    <div style={C.page}>
      <Link href="/admin" style={{ ...C.btnGhost, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 20 }}>
        <ArrowLeft size={14} /> Назад в портал
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>Лидген · Маршрутизация</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Для каждого аккаунта отметь базы (задачи парсинга), которые в него идут — можно несколько. Одна база закрепляется за одним аккаунтом. «Перенести существующие» — переложить уже собранные лиды.</p>

      {err && <div style={{ ...C.panel, borderColor: "#dc2626", color: "#fca5a5" }}>{err}</div>}
      {msg && <div style={{ ...C.panel, borderColor: "#22c55e", color: "#86efac" }}>{msg}</div>}

      {accounts.map((acc) => (
        <div key={acc.id} style={C.panel}>
          <div style={C.accHead}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{acc.name || acc.login}</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>логин {acc.login} · тенант {acc.companyId} · {acc.role}</span>
            {stats[acc.companyId] && (
              <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>
                · лидов <b style={{ color: "#e2e8f0" }}>{stats[acc.companyId].total}</b>
                {" · "}<span style={{ color: "#f87171" }}>hot {stats[acc.companyId].hot}</span>
                {" · "}<span style={{ color: "#fbbf24" }}>warm {stats[acc.companyId].warm}</span>
                {" · "}<span style={{ color: "#64748b" }}>cold {stats[acc.companyId].cold}</span>
              </span>
            )}
            {acc.companyId !== 1 && (
              <button onClick={() => delAccount(acc)} style={{ ...C.btnGhost, marginLeft: "auto", color: "#f87171", borderColor: "#7f1d1d" }}>Удалить аккаунт</button>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {tasks.length === 0 ? <span style={{ color: "#64748b", fontSize: 13 }}>Нет напарсенных баз.</span> : tasks.map((t) => {
              const on = !!checked[`${acc.companyId}::${t.task}`];
              const owner = ownerOf(t.task);
              const elsewhere = owner && owner.companyId !== acc.companyId;
              return (
                <label key={t.task} style={C.chip(on)} title={elsewhere ? `сейчас у: ${owner!.accountName || owner!.accountLogin}` : ""}>
                  <input type="checkbox" checked={on} onChange={() => toggle(acc.companyId, t.task)} style={{ accentColor: "#f59e0b" }} />
                  {t.task} <span style={{ color: "#64748b" }}>({t.total})</span>
                  {elsewhere && <span style={{ color: "#64748b", fontSize: 11 }}>· у {owner!.accountName || owner!.accountLogin}</span>}
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={C.btn} disabled={busy === acc.companyId} onClick={() => save(acc)}>{busy === acc.companyId ? "Сохраняю…" : "Сохранить базы аккаунта"}</button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
              <input type="checkbox" checked={!!reassign[acc.companyId]} onChange={(e) => setReassign({ ...reassign, [acc.companyId]: e.target.checked })} />
              перенести существующие лиды
            </label>
          </div>
        </div>
      ))}

      {/* Создание аккаунта */}
      <div style={{ ...C.panel, borderStyle: "dashed" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>Новый аккаунт</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input value={nn} onChange={(e) => setNn(e.target.value)} placeholder="Название (напр. Орлинк)"
            style={{ background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13 }} />
          <input value={nl} onChange={(e) => setNl(e.target.value)} placeholder="логин"
            style={{ background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13 }} />
          <input value={np} onChange={(e) => setNp(e.target.value)} type="text" placeholder="пароль (≥4)"
            style={{ background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13 }} />
          <button style={C.btn} disabled={busy === -1} onClick={createAccount}>{busy === -1 ? "Создаю…" : "Создать аккаунт"}</button>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>Новый аккаунт = свой изолированный тенант (свои лиды). Логин/пароль выдаёшь клиенту; вход на /leadgen/login.</div>
      </div>
    </div>
  );
}
