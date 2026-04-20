import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import AdminNav from "../components/AdminNav";
import { Zap, User } from "lucide-react";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  data_count: string;
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 36, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#1a1f2e", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "12px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  link: { color: "#7c3aed", textDecoration: "none", fontWeight: 600 } as React.CSSProperties,
  logoutBtn: { background: "none", border: "1px solid #2d3748", color: "#94a3b8", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12 } as React.CSSProperties,
};

export default async function AdminDashboard() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/admin/login");

  await initDb();
  const users = await query<UserRow>(`
    SELECT u.id, u.email, u.name, u.role, u.created_at,
           COUNT(d.id)::text as data_count
    FROM users u
    LEFT JOIN user_data d ON d.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);

  const total = users.length;
  const admins = users.filter(u => u.role === "admin").length;
  const withData = users.filter(u => parseInt(u.data_count) > 0).length;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}><Zap size={18}/> MarketRadar Admin</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>{session.email}</span>
          <form action="/api/auth/logout" method="POST">
            <button style={S.logoutBtn}>Выйти</button>
          </form>
        </div>
      </header>
      <AdminNav current="/admin/dashboard" />

      <main style={S.main}>
        <div style={S.h1}>Пользователи</div>

        {/* Stats */}
        <div style={S.statRow}>
          <div style={S.stat}>
            <div style={S.statNum}>{total}</div>
            <div style={S.statLabel}>Всего аккаунтов</div>
          </div>
          <div style={S.stat}>
            <div style={S.statNum}>{withData}</div>
            <div style={S.statLabel}>С данными на сервере</div>
          </div>
          <div style={S.stat}>
            <div style={S.statNum}>{admins}</div>
            <div style={S.statLabel}>Администраторов</div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" as const }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Email</th>
                <th style={S.th}>Имя</th>
                <th style={S.th}>Роль</th>
                <th style={S.th}>Данных</th>
                <th style={S.th}>Зарегистрирован</th>
                <th style={S.th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 500, color: "#e2e8f0" }}>{u.email}</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{u.id.slice(0, 12)}…</div>
                  </td>
                  <td style={{ ...S.td, color: "#94a3b8" }}>{u.name || "—"}</td>
                  <td style={S.td}>
                    <span style={S.badge(u.role === "admin" ? "#7c3aed" : "#475569")}>
                      {u.role === "admin" ? "Admin" : "User"}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: parseInt(u.data_count) > 0 ? "#4ade80" : "#475569", fontWeight: 600 }}>
                    {u.data_count}
                  </td>
                  <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td style={S.td}>
                    <Link href={`/admin/user/${u.id}`} style={S.link}>
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#475569" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><User size={32}/></div>
            <div>Нет зарегистрированных пользователей</div>
          </div>
        )}
      </main>
    </div>
  );
}
