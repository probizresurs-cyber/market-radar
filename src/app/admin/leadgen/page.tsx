"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, RefreshCw } from "lucide-react";

interface Account { id: number; companyId: number; login: string; name: string | null; role: string }
interface TaskOpt { task: string; total: number }
interface Route { id: number; task: string; companyId: number; accountLogin: string | null; accountName: string | null }
interface Signup { id: number; name: string | null; contact: string; niche: string | null; comment: string | null; source: string | null; createdAt: string }
type Tab = "overview" | "signups" | "clients";

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
  th: { textAlign: "left" as const, fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: 0.5, padding: "10px 12px", borderBottom: "1px solid #2d3748" },
  td: { fontSize: 13, color: "#e2e8f0", padding: "12px", borderBottom: "1px solid #232a3a", verticalAlign: "top" as const },
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function Kpi({ value, label, accent }: { value: any; label: string; accent?: string }) {
  return (
    <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 14, padding: "22px 24px", flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 38, fontWeight: 800, color: accent ?? "#38bdf8", letterSpacing: -1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 }}>{label}</div>
    </div>
  );
}

export default function AdminLeadgen() {
  const [tab, setTab] = useState<Tab>("overview");
  // routing/accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reassign, setReassign] = useState<Record<number, boolean>>({});
  const [stats, setStats] = useState<Record<number, { total: number; hot: number; warm: number; cold: number }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [nl, setNl] = useState(""); const [np, setNp] = useState(""); const [nn, setNn] = useState("");
  // signups
  const [signups, setSignups] = useState<Signup[]>([]);
  const [sCounts, setSCounts] = useState<{ total: number; today: number; week: number }>({ total: 0, today: 0, week: 0 });
  const [sErr, setSErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch("/api/admin/leadgen/routes", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setErr(r?.error || "Не удалось загрузить (проверь LEADGEN_ADMIN_TOKEN и что лидген развёрнут)"); return; }
    setAccounts(r.accounts || []); setTasks(r.tasks || []); setRoutes(r.routes || []); setStats(r.stats || {});
    const init: Record<string, boolean> = {};
    for (const rt of (r.routes || []) as Route[]) init[`${rt.companyId}::${rt.task}`] = true;
    setChecked(init);
  }, []);
  const loadSignups = useCallback(async () => {
    setSErr("");
    const r = await fetch("/api/admin/leadgen/signups", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setSErr(r?.error || "Не удалось загрузить заявки"); return; }
    setSignups(r.rows || []); setSCounts(r.counts || { total: 0, today: 0, week: 0 });
  }, []);
  useEffect(() => { load(); loadSignups(); }, [load, loadSignups]);

  async function delSignup(id: number) {
    if (!confirm("Удалить заявку?")) return;
    await fetch(`/api/admin/leadgen/signups?id=${id}`, { method: "DELETE" });
    await loadSignups();
  }

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

  function toggle(companyId: number, task: string) {
    setChecked((prev) => {
      const next = { ...prev };
      const key = `${companyId}::${task}`;
      const willBe = !prev[key];
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
      for (const task of target) {
        const r = await fetch("/api/admin/leadgen/routes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, companyId: acc.companyId, reassign: !!reassign[acc.companyId] }),
        }).then((x) => x.json());
        if (r?.moved) moved += r.moved;
      }
      for (const task of wasMine) if (!target.includes(task)) {
        await fetch(`/api/admin/leadgen/routes?task=${encodeURIComponent(task)}`, { method: "DELETE" });
      }
      setMsg(`${acc.name || acc.login}: баз ${target.length}${moved ? `, перенесено лидов: ${moved}` : ""}`);
      await load();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  const ownerOf = (task: string) => routes.find((r) => r.task === task);
  const totalLeads = Object.values(stats).reduce((s, x) => s + (x?.total || 0), 0);

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Обзор" },
    { key: "signups", label: `Заявки${sCounts.total ? ` (${sCounts.total})` : ""}` },
    { key: "clients", label: "Клиенты и базы" },
  ];

  return (
    <div style={C.page}>
      <Link href="/admin" style={{ ...C.btnGhost, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 20 }}>
        <ArrowLeft size={14} /> Назад в портал
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 16 }}>Лидген · Администрирование</h1>

      {/* tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #2d3748", marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: 14,
            fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? "#38bdf8" : "#94a3b8",
            borderBottom: `2px solid ${tab === t.key ? "#38bdf8" : "transparent"}`, marginBottom: -1,
          }}>{t.label}</button>
        ))}
        <button onClick={() => { load(); loadSignups(); }} style={{ ...C.btnGhost, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={13} /> Обновить
        </button>
      </div>

      {err && <div style={{ ...C.panel, borderColor: "#dc2626", color: "#fca5a5" }}>{err}</div>}
      {msg && <div style={{ ...C.panel, borderColor: "#22c55e", color: "#86efac" }}>{msg}</div>}

      {/* ───────────── ОБЗОР ───────────── */}
      {tab === "overview" && (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <Kpi value={accounts.length} label="Клиентов" accent="#38bdf8" />
            <Kpi value={sCounts.total} label="Заявок всего" accent="#a78bfa" />
            <Kpi value={sCounts.week} label="Заявок за неделю" accent="#34d399" />
            <Kpi value={totalLeads} label="Лидов в системе" accent="#f59e0b" />
          </div>
          <div style={C.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Последние заявки</div>
              <button onClick={() => setTab("signups")} style={C.btnGhost}>Все заявки →</button>
            </div>
            {signups.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>Заявок пока нет.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={C.th}>Создана</th><th style={C.th}>Имя</th><th style={C.th}>Контакт</th><th style={C.th}>Ниша</th></tr></thead>
                <tbody>
                  {signups.slice(0, 5).map((s) => (
                    <tr key={s.id}>
                      <td style={C.td}>{fmtDate(s.createdAt)}</td>
                      <td style={C.td}>{s.name || "—"}</td>
                      <td style={{ ...C.td, color: "#38bdf8" }}>{s.contact}</td>
                      <td style={C.td}>{s.niche || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ───────────── ЗАЯВКИ ───────────── */}
      {tab === "signups" && (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <Kpi value={sCounts.total} label="Всего заявок" accent="#a78bfa" />
            <Kpi value={sCounts.week} label="За неделю" accent="#34d399" />
            <Kpi value={sCounts.today} label="Сегодня" accent="#38bdf8" />
          </div>
          {sErr && <div style={{ ...C.panel, borderColor: "#dc2626", color: "#fca5a5" }}>{sErr}</div>}
          <div style={C.panel}>
            {signups.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>Заявок пока нет. Они приходят с лендинга /leadgen/preview.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={C.th}>Создана</th><th style={C.th}>Имя</th><th style={C.th}>Контакт</th>
                  <th style={C.th}>Ниша и город</th><th style={C.th}>Комментарий</th><th style={C.th}></th>
                </tr></thead>
                <tbody>
                  {signups.map((s) => (
                    <tr key={s.id}>
                      <td style={{ ...C.td, whiteSpace: "nowrap", color: "#94a3b8" }}>{fmtDate(s.createdAt)}</td>
                      <td style={{ ...C.td, fontWeight: 600 }}>{s.name || "—"}</td>
                      <td style={{ ...C.td, color: "#38bdf8", whiteSpace: "nowrap" }}>{s.contact}</td>
                      <td style={C.td}>{s.niche || "—"}</td>
                      <td style={{ ...C.td, maxWidth: 320, color: "#cbd5e1" }}>{s.comment || "—"}</td>
                      <td style={C.td}>
                        <button onClick={() => delSignup(s.id)} title="Удалить заявку"
                          style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ───────────── КЛИЕНТЫ И БАЗЫ ───────────── */}
      {tab === "clients" && (
        <>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Для каждого аккаунта отметь базы (задачи парсинга), которые в него идут — можно несколько. Одна база закрепляется за одним аккаунтом. «Перенести существующие» — переложить уже собранные лиды.</p>

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
        </>
      )}
    </div>
  );
}
