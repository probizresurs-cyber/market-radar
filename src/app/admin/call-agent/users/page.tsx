"use client";

import { useEffect, useState } from "react";

interface CAUser {
  id: number;
  login: string;
  role: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
  bitrixManagerId: string | null;
  tenantId: number;
  tenantName: string | null;
  createdAt: string;
}

const S = {
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 32, fontWeight: 800, color: "#0ea5e9" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } as React.CSSProperties,
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#f1f5f9" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#13182a", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "10px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  errBox: { background: "#3b0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13 } as React.CSSProperties,
  emptyMsg: { textAlign: "center" as const, padding: 40, color: "#64748b", fontSize: 13 },
  refreshBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" } as React.CSSProperties,
};

function roleColor(role: string): string {
  switch (role) {
    case "owner":   return "#a855f7";
    case "admin":   return "#7c3aed";
    case "head":    return "#0ea5e9";
    case "manager": return "#4ade80";
    default:        return "#64748b";
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CAUsersPage() {
  const [users, setUsers] = useState<CAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin/call-agent/users", { cache: "no-store" });
      const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!data.ok) { setErr(data.error || "Ошибка"); setUsers([]); }
      else setUsers(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const active  = users.filter(u => u.isActive).length;
  const tenants = new Set(users.map(u => u.tenantId)).size;
  const owners  = users.filter(u => u.role === "owner").length;

  return (
    <main style={S.main}>
      {err && (
        <div style={S.errBox}>
          <strong>Не удалось загрузить пользователей:</strong> {err}
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
            Проверьте: CA_BASE_URL и CA_ADMIN_TOKEN совпадают в .env обоих приложений.
          </div>
        </div>
      )}

      <div style={S.statRow}>
        {[
          { n: users.length, l: "Всего пользователей" },
          { n: active,       l: "Активных" },
          { n: tenants,      l: "Тенантов" },
          { n: owners,       l: "Владельцев" },
        ].map(({ n, l }) => (
          <div key={l} style={S.stat}>
            <div style={S.statNum}>{loading ? "…" : n}</div>
            <div style={S.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>Пользователи Call-Agent</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              Редактирование —{" "}
              <a href="/call-agent/settings" target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>
                Настройки CA →
              </a>
            </span>
            <button onClick={load} style={S.refreshBtn} disabled={loading}>
              {loading ? "Загрузка..." : "↻ Обновить"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={S.emptyMsg}>Загрузка...</div>
        ) : users.length === 0 ? (
          <div style={S.emptyMsg}>{err ? "—" : "Пользователей пока нет."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Логин", "Имя", "Email", "Роль", "Тенант", "Bitrix ID", "Статус", "Создан"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, fontWeight: 600, color: "#e2e8f0" }}>
                      <a href={'/admin/call-agent/users/' + u.id} style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>{u.login}</a>
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{u.name || "—"}</td>
                    <td style={{ ...S.td, color: "#94a3b8" }}>{u.email || "—"}</td>
                    <td style={S.td}><span style={S.badge(roleColor(u.role))}>{u.role}</span></td>
                    <td style={{ ...S.td, color: "#cbd5e1" }}>{u.tenantName || `#${u.tenantId}`}</td>
                    <td style={{ ...S.td, color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>
                      {u.bitrixManagerId || "—"}
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(u.isActive ? "#4ade80" : "#64748b")}>
                        {u.isActive ? "Активен" : "Выкл."}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
