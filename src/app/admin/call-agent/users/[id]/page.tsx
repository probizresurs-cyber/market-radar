"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CAUserDetail {
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

interface CAStats {
  totalCalls: number;
  analyzed: number;
  failed: number;
  noRecording: number;
  avgScore: number | null;
  avgCompliancePct: number | null;
  lastCallAt: string | null;
  totalDurationSec: number;
}

interface CACall {
  id: number | string;
  startedAt: string | null;
  durationSec: number | null;
  status: string | null;
  direction: string | null;
  managerScore: number | null;
  summary: string | null;
}

const S = {
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  topBar: { display: "flex", alignItems: "center", gap: 16, marginBottom: 28 } as React.CSSProperties,
  backLink: { color: "#64748b", textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 800, color: "#f1f5f9", flex: 1 } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 32, fontWeight: 800, color: "#0ea5e9" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 16, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontSize_: 11 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e2737" } as React.CSSProperties,
  rowLabel: { fontSize: 12, color: "#64748b" } as React.CSSProperties,
  rowValue: { fontSize: 13, color: "#e2e8f0", fontWeight: 500, textAlign: "right" as const } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#13182a", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "10px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  errBox: { background: "#3b0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13 } as React.CSSProperties,
  emptyMsg: { textAlign: "center" as const, padding: 32, color: "#64748b", fontSize: 13 } as React.CSSProperties,
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

function statusColor(status: string | null): string {
  switch (status) {
    case "done":         return "#4ade80";
    case "failed":       return "#f87171";
    case "no_recording": return "#f59e0b";
    case "pending":      return "#64748b";
    case "processing":   return "#0ea5e9";
    default:             return "#64748b";
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(sec: number | null | undefined) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtMinutes(sec: number | null | undefined) {
  if (sec == null || sec === 0) return "0 мин";
  return `${Math.round(sec / 60)} мин`;
}

export default function CAUserDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<CAUserDetail | null>(null);
  const [stats, setStats] = useState<CAStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<CACall[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    fetch(`/api/admin/call-agent/users/${id}`, { cache: "no-store" })
      .then((r) => r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` })))
      .then((data) => {
        if (!data.ok) {
          setErr(data.error || "Ошибка загрузки");
        } else {
          setUser(data.user ?? null);
          setStats(data.stats ?? null);
          setRecentCalls(Array.isArray(data.recentCalls) ? data.recentCalls : []);
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const kpiItems = [
    { n: stats ? String(stats.totalCalls) : "—",         l: "Всего звонков" },
    { n: stats ? String(stats.analyzed)   : "—",         l: "Проанализировано" },
    { n: stats?.avgScore != null ? String(stats.avgScore) : "—", l: "Ср. оценка менеджера" },
    { n: stats?.avgCompliancePct != null ? `${stats.avgCompliancePct}%` : "—", l: "Чек-лист %" },
  ];

  return (
    <main style={S.main}>
      {/* Top bar */}
      <div style={S.topBar}>
        <a href="/admin/call-agent/users" style={S.backLink}>← Пользователи</a>
        <div style={S.title}>
          {loading ? "Загрузка..." : user ? `${user.login}${user.name ? " / " + user.name : ""}` : "Пользователь"}
        </div>
        {user && (
          <span style={S.badge(roleColor(user.role))}>{user.role}</span>
        )}
      </div>

      {err && (
        <div style={S.errBox}>
          <strong>Ошибка:</strong> {err}
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
            Проверьте CA_BASE_URL и CA_ADMIN_TOKEN в .env.
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={S.statRow}>
        {kpiItems.map(({ n, l }) => (
          <div key={l} style={S.stat}>
            <div style={S.statNum}>{loading ? "…" : n}</div>
            <div style={S.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      {/* Two-column info */}
      <div style={S.twoCol}>
        {/* Left: Account data */}
        <div style={S.card}>
          <div style={{ ...S.cardTitle, fontSize: 13 }}>Данные аккаунта</div>
          {[
            { label: "Логин",     value: user?.login || "—" },
            { label: "Email",     value: user?.email || "—" },
            { label: "Роль",      value: user ? <span style={S.badge(roleColor(user.role))}>{user.role}</span> : "—" },
            { label: "Тенант",    value: user ? (user.tenantName || `#${user.tenantId}`) : "—" },
            { label: "Bitrix ID", value: user?.bitrixManagerId
                ? <span style={{ fontFamily: "monospace", fontSize: 12 }}>{user.bitrixManagerId}</span>
                : "—"
            },
            { label: "Статус",    value: user
                ? <span style={S.badge(user.isActive ? "#4ade80" : "#64748b")}>{user.isActive ? "Активен" : "Выкл."}</span>
                : "—"
            },
            { label: "Создан",    value: user ? fmtDate(user.createdAt) : "—" },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ ...S.row, borderBottom: i === 6 ? "none" : "1px solid #1e2737" }}>
              <span style={S.rowLabel}>{label}</span>
              <span style={S.rowValue}>{value}</span>
            </div>
          ))}
        </div>

        {/* Right: Activity */}
        <div style={S.card}>
          <div style={{ ...S.cardTitle, fontSize: 13 }}>Активность</div>
          {[
            { label: "Последний звонок",          value: stats ? fmtDateTime(stats.lastCallAt) : "—" },
            { label: "Всего минут разговора",      value: stats ? fmtMinutes(stats.totalDurationSec) : "—" },
            { label: "Не проанализировано (ошибки)", value: stats != null ? String(stats.failed) : "—" },
            { label: "Без записи",                 value: stats != null ? String(stats.noRecording) : "—" },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ ...S.row, borderBottom: i === 3 ? "none" : "1px solid #1e2737" }}>
              <span style={S.rowLabel}>{label}</span>
              <span style={S.rowValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent calls table */}
      <div style={S.card}>
        <div style={{ ...S.cardTitle, fontSize: 13, marginBottom: 16 }}>Последние звонки</div>
        {loading ? (
          <div style={S.emptyMsg}>Загрузка...</div>
        ) : !stats ? (
          <div style={S.emptyMsg}>
            {user?.bitrixManagerId
              ? "Звонков не найдено."
              : "У пользователя не задан Bitrix Manager ID — статистика недоступна."}
          </div>
        ) : recentCalls.length === 0 ? (
          <div style={S.emptyMsg}>Звонков нет.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Дата", "Длительность", "Статус", "Оценка", "Краткое содержание", ""].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                    <td style={{ ...S.td, color: "#94a3b8", fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtDateTime(c.startedAt)}
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {fmtDuration(c.durationSec)}
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(statusColor(c.status))}>{c.status || "—"}</span>
                    </td>
                    <td style={{ ...S.td, color: "#e2e8f0", fontWeight: 600, textAlign: "center" as const }}>
                      {c.managerScore != null ? c.managerScore : "—"}
                    </td>
                    <td style={{ ...S.td, color: "#94a3b8", fontSize: 12, maxWidth: 400 }}>
                      {c.summary ? c.summary.slice(0, 200) + (c.summary.length > 200 ? "…" : "") : "—"}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                      <a
                        href={`/call-agent/calls/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#0ea5e9", fontSize: 12, textDecoration: "none" }}
                      >
                        →
                      </a>
                    </td>
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
