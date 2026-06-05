import { requireAdmin } from "@/app/admin/layout";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface CATenant {
  id: number;
  name: string;
  createdAt: string;
  analysisModel: string | null;
  usersCount: number;
  callsCount: number;
  analyzedCount: number;
}

interface TenantsResponse {
  ok: boolean;
  tenants?: CATenant[];
  total?: number;
  error?: string;
  base?: string;
}

const S = {
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  counter: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0ea5e9",
    background: "#0ea5e918",
    border: "1px solid #0ea5e944",
    borderRadius: 20,
    padding: "3px 12px",
  } as React.CSSProperties,
  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 28,
  } as React.CSSProperties,
  stat: {
    background: "#1a1f2e",
    border: "1px solid #2d3748",
    borderRadius: 12,
    padding: "20px 24px",
  } as React.CSSProperties,
  statNum: { fontSize: 32, fontWeight: 800, color: "#0ea5e9" } as React.CSSProperties,
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  card: {
    background: "#1a1f2e",
    border: "1px solid #2d3748",
    borderRadius: 12,
    overflow: "hidden",
  } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: {
    textAlign: "left" as const,
    padding: "10px 14px",
    background: "#13182a",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    border: "1px solid #2d3748",
  },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 10,
    background: color + "22",
    color,
    display: "inline-block",
  }),
  errBox: {
    background: "#3b0d0d",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 24,
    fontSize: 13,
  } as React.CSSProperties,
  emptyMsg: {
    textAlign: "center" as const,
    padding: "60px 0",
    color: "#475569",
    fontSize: 13,
  } as React.CSSProperties,
  actionLink: {
    color: "#0ea5e9",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 12,
  } as React.CSSProperties,
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function modelLabel(model: string | null): React.ReactNode {
  if (!model) return <span style={S.badge("#64748b")}>Авто (ENV)</span>;
  // Shorten known long names
  const label = model.replace("claude-", "").replace("gpt-4o", "GPT-4o");
  return <span style={S.badge("#a855f7")}>{label}</span>;
}

async function fetchTenants(): Promise<TenantsResponse> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  try {
    const r = await fetch(`${base}/api/admin/call-agent/tenants`, {
      cache: "no-store",
      // Server-to-server call — use internal cookie forwarding trick via headers
      // (requireAdmin already validated session; we call our own API with a server-side token)
    });
    return await r.json().catch(() => ({ ok: false, error: `Bad JSON (HTTP ${r.status})` }));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function TenantsPage() {
  await requireAdmin();

  // Directly proxy to CA without going through HTTP self-call —
  // replicate proxy logic inline (CA_BASE_URL + CA_ADMIN_TOKEN) for SSR reliability
  const base = (process.env.CA_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
  const token = process.env.CA_ADMIN_TOKEN;

  let data: TenantsResponse;

  if (!token) {
    data = { ok: false, error: "CA_ADMIN_TOKEN is not configured on MarketRadar server" };
  } else {
    try {
      const r = await fetch(`${base}/api/admin/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      data = { ok: false, error: `Call-Agent недоступен: ${msg}`, base };
    }
  }

  const tenants: CATenant[] = data.ok && Array.isArray(data.tenants) ? data.tenants : [];
  const total = tenants.length;
  const totalUsers = tenants.reduce((s, t) => s + t.usersCount, 0);
  const totalCalls = tenants.reduce((s, t) => s + t.callsCount, 0);
  const totalAnalyzed = tenants.reduce((s, t) => s + t.analyzedCount, 0);

  return (
    <main style={S.main}>
      <div style={S.titleRow}>
        <div style={S.h1}>
          <Building2 size={20} />
          Тенанты Call-Agent
        </div>
        <span style={S.counter}>{total} тенантов</span>
      </div>

      {!data.ok && (
        <div style={S.errBox}>
          <strong>Не удалось загрузить тенантов:</strong> {data.error}
          {data.base && (
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
              CA_BASE_URL: <code>{data.base}</code>. Проверьте: (1) Call-Agent запущен;
              (2) переменные <code>CA_ADMIN_TOKEN</code> в .env обоих приложений совпадают.
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={S.statRow}>
        <div style={S.stat}>
          <div style={S.statNum}>{total}</div>
          <div style={S.statLabel}>Тенантов</div>
        </div>
        <div style={S.stat}>
          <div style={S.statNum}>{totalUsers}</div>
          <div style={S.statLabel}>Пользователей</div>
        </div>
        <div style={S.stat}>
          <div style={S.statNum}>{totalCalls}</div>
          <div style={S.statLabel}>Звонков</div>
        </div>
        <div style={S.stat}>
          <div style={S.statNum}>{totalAnalyzed}</div>
          <div style={S.statLabel}>Проанализировано</div>
        </div>
      </div>

      {/* Table */}
      {tenants.length === 0 && data.ok ? (
        <div style={S.emptyMsg}>
          <Building2 size={32} color="#475569" />
          <div style={{ marginTop: 12 }}>Тенантов пока нет.</div>
        </div>
      ) : tenants.length > 0 ? (
        <div style={S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>ID</th>
                  <th style={S.th}>Название</th>
                  <th style={S.th}>Пользователи</th>
                  <th style={S.th}>Звонков</th>
                  <th style={S.th}>Проанализировано</th>
                  <th style={S.th}>Модель AI</th>
                  <th style={S.th}>Создан</th>
                  <th style={S.th}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => {
                  const analyzedPct =
                    t.callsCount > 0
                      ? Math.round((t.analyzedCount / t.callsCount) * 100)
                      : 0;
                  return (
                    <tr
                      key={t.id}
                      style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}
                    >
                      <td style={{ ...S.td, color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>
                        #{t.id}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{t.name}</div>
                      </td>
                      <td style={{ ...S.td, color: "#cbd5e1", fontWeight: 600 }}>
                        {t.usersCount}
                      </td>
                      <td style={{ ...S.td, color: "#cbd5e1", fontWeight: 600 }}>
                        {t.callsCount}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: t.analyzedCount > 0 ? "#4ade80" : "#475569" }}>
                          {t.analyzedCount}
                        </div>
                        {t.callsCount > 0 && (
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                            {analyzedPct}%
                          </div>
                        )}
                      </td>
                      <td style={S.td}>{modelLabel(t.analysisModel)}</td>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                        {fmtDate(t.createdAt)}
                      </td>
                      <td style={S.td}>
                        <a
                          href={`/call-agent/settings/tenants/${t.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={S.actionLink}
                        >
                          Открыть →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </main>
  );
}
