"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Account { id: number; companyId: number; login: string; name: string | null; role: string }
interface TaskOpt { task: string; total: number }
interface Route { id: number; task: string; companyId: number; accountLogin: string | null; accountName: string | null }

const C = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "32px 40px" } as const,
  panel: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 20 } as const,
  h2: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 14 } as const,
  sel: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 8, padding: "7px 10px", color: "#e2e8f0", fontSize: 13 } as const,
  btn: { background: "#f59e0b", color: "#0f1117", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" } as const,
  btnGhost: { background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" } as const,
  row: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #232a3a", fontSize: 13 } as const,
};

export default function AdminLeadgenRouting() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [sel, setSel] = useState<Record<string, number>>({});
  const [reassign, setReassign] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch("/api/admin/leadgen/routes", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setErr(r?.error || "Не удалось загрузить"); return; }
    setAccounts(r.accounts || []); setTasks(r.tasks || []); setRoutes(r.routes || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const routeFor = (task: string) => routes.find((x) => x.task === task);
  const accName = (companyId: number) => { const a = accounts.find((x) => x.companyId === companyId); return a ? (a.name || a.login) : `тенант ${companyId}`; };

  async function assign(task: string) {
    const companyId = sel[task];
    if (!companyId) { setErr("Выбери аккаунт"); return; }
    setBusy(task); setMsg(""); setErr("");
    const r = await fetch("/api/admin/leadgen/routes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, companyId, reassign: !!reassign[task] }),
    }).then((x) => x.json()).catch(() => null);
    setBusy("");
    if (!r || r.error) { setErr(r?.error || "Ошибка"); return; }
    setMsg(`«${task}» → ${accName(companyId)}${r.moved ? `, перенесено лидов: ${r.moved}` : ""}`);
    await load();
  }

  async function unassign(task: string) {
    setBusy(task);
    await fetch(`/api/admin/leadgen/routes?task=${encodeURIComponent(task)}`, { method: "DELETE" });
    setBusy(""); await load();
  }

  return (
    <div style={C.page}>
      <Link href="/admin" style={{ ...C.btnGhost, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 20 }}>
        <ArrowLeft size={14} /> Назад в портал
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>Лидген · Маршрутизация</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Закрепи напарсенные базы (задачи) за аккаунтами лидгена. Лиды задачи пойдут в выбранный аккаунт; «перенести существующие» — переложить уже собранные.</p>

      {err && <div style={{ ...C.panel, borderColor: "#dc2626", color: "#fca5a5" }}>{err}</div>}
      {msg && <div style={{ ...C.panel, borderColor: "#22c55e", color: "#86efac" }}>{msg}</div>}

      <div style={C.panel}>
        <div style={C.h2}>Базы (задачи парсинга) → аккаунт</div>
        {tasks.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>Пока нет напарсенных баз.</div> : tasks.map((t) => {
          const cur = routeFor(t.task);
          return (
            <div key={t.task} style={C.row}>
              <div style={{ flex: 1 }}>
                <b style={{ color: "#f1f5f9" }}>{t.task}</b> <span style={{ color: "#64748b" }}>· {t.total} лидов</span>
                {cur && <span style={{ marginLeft: 8, color: "#f59e0b" }}>→ {cur.accountName || cur.accountLogin || `тенант ${cur.companyId}`}</span>}
              </div>
              <select style={C.sel} value={sel[t.task] ?? ""} onChange={(e) => setSel({ ...sel, [t.task]: Number(e.target.value) })}>
                <option value="">— аккаунт —</option>
                {accounts.map((a) => <option key={a.id} value={a.companyId}>{a.name || a.login}</option>)}
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8" }}>
                <input type="checkbox" checked={!!reassign[t.task]} onChange={(e) => setReassign({ ...reassign, [t.task]: e.target.checked })} />
                перенести существующие
              </label>
              <button style={C.btn} disabled={busy === t.task} onClick={() => assign(t.task)}>{busy === t.task ? "…" : "Закрепить"}</button>
              {cur && <button style={C.btnGhost} onClick={() => unassign(t.task)}>Отвязать</button>}
            </div>
          );
        })}
      </div>

      <div style={C.panel}>
        <div style={C.h2}>Аккаунты лидгена</div>
        {accounts.map((a) => (
          <div key={a.id} style={C.row}>
            <div style={{ flex: 1 }}><b style={{ color: "#f1f5f9" }}>{a.name || a.login}</b> <span style={{ color: "#64748b" }}>· логин {a.login} · тенант {a.companyId} · {a.role}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
