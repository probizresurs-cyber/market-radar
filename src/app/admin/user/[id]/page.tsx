import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface UserRow { id: string; email: string; name: string | null; role: string; created_at: string; }
interface DataRow { key: string; value: unknown; }

// Known data keys and their labels
const KEY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  "mr_company":         { label: "Анализ компании",     icon: "🏢", color: "#7c3aed" },
  "mr_competitors":     { label: "Конкуренты",           icon: "⚔️",  color: "#2563eb" },
  "mr_ta":              { label: "Анализ ЦА",             icon: "👥", color: "#059669" },
  "mr_smm":             { label: "SMM-анализ",            icon: "📱", color: "#d97706" },
  "mr_content":         { label: "Контент-план",          icon: "📝", color: "#dc2626" },
  "mr_brandbook":       { label: "Брендбук",              icon: "🎨", color: "#7c3aed" },
  "mr_seo":             { label: "SEO-статьи",            icon: "✍️",  color: "#0891b2" },
  "mr_analysis_history":{ label: "История анализов",     icon: "📊", color: "#64748b" },
  "mr_stories":         { label: "Сторис",                icon: "📲", color: "#f59e0b" },
  "mr_brandsug":        { label: "Рекомендации бренда",  icon: "💡", color: "#8b5cf6" },
};

function getKeyInfo(key: string) {
  for (const [prefix, info] of Object.entries(KEY_LABELS)) {
    if (key.startsWith(prefix)) return info;
  }
  return { label: key, icon: "📄", color: "#475569" };
}

function summarize(value: unknown): string {
  if (!value || typeof value !== "object") return String(value).slice(0, 200);
  const v = value as Record<string, unknown>;

  // Analysis result — company
  if (v.company && typeof v.company === "object") {
    const c = v.company as Record<string, unknown>;
    return `Компания: ${c.name || "—"} · Score: ${c.score ?? "—"} · ${String(c.description || "").slice(0, 80)}`;
  }
  // Array of competitors
  if (Array.isArray(value)) {
    const names = value.map((x: unknown) => {
      if (x && typeof x === "object") {
        const xr = x as Record<string, unknown>;
        const c = xr.company as Record<string, unknown> | undefined;
        return c?.name || xr.name || "?";
      }
      return "?";
    }).slice(0, 5);
    return `${value.length} элементов: ${names.join(", ")}`;
  }
  // Content plan
  if (v.plan && Array.isArray(v.plan)) return `Контент-план: ${v.plan.length} постов`;
  if (v.articles && Array.isArray(v.articles)) return `${v.articles.length} статей`;
  if (v.segments && Array.isArray(v.segments)) return `ЦА: ${v.segments.length} сегментов`;
  return JSON.stringify(value).slice(0, 200) + "…";
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", gap: 16 } as React.CSSProperties,
  logo: { fontSize: 18, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  back: { color: "#64748b", textDecoration: "none", fontSize: 13 } as React.CSSProperties,
  main: { padding: "32px" } as React.CSSProperties,
  userCard: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20 } as React.CSSProperties,
  avatar: { width: 52, height: 52, borderRadius: "50%", background: "#7c3aed22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 } as React.CSSProperties,
  email: { fontSize: 18, fontWeight: 700, color: "#f1f5f9" } as React.CSSProperties,
  meta: { fontSize: 12, color: "#64748b", marginTop: 3 } as React.CSSProperties,
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block", marginLeft: 8 }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 } as React.CSSProperties,
  dataCard: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, overflow: "hidden" } as React.CSSProperties,
  cardHeader: (color: string) => ({ padding: "12px 16px", background: color + "18", borderBottom: "1px solid " + color + "30", display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties),
  cardTitle: { fontWeight: 700, fontSize: 13, color: "#e2e8f0" } as React.CSSProperties,
  cardBody: { padding: "14px 16px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 } as React.CSSProperties,
  raw: { marginTop: 8, padding: "8px 10px", background: "#0f1117", borderRadius: 6, fontFamily: "monospace", fontSize: 11, color: "#64748b", maxHeight: 120, overflow: "auto" } as React.CSSProperties,
  roleBtn: (active: boolean) => ({
    padding: "5px 14px", borderRadius: 6, border: "1px solid " + (active ? "#7c3aed" : "#2d3748"),
    background: active ? "#7c3aed22" : "none", color: active ? "#7c3aed" : "#64748b",
    cursor: "pointer", fontSize: 12, fontWeight: 600,
  } as React.CSSProperties),
  h2: { fontSize: 14, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 14 },
};

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/admin/login");

  await initDb();
  const users = await query<UserRow>("SELECT id, email, name, role, created_at FROM users WHERE id = $1", [id]);
  const user = users[0];
  if (!user) notFound();

  const dataRows = await query<DataRow>("SELECT key, value FROM user_data WHERE user_id = $1 ORDER BY key", [id]);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}>⚡ Admin</div>
        <Link href="/admin/dashboard" style={S.back}>← Все пользователи</Link>
      </header>

      <main style={S.main}>
        {/* User card */}
        <div style={S.userCard}>
          <div style={S.avatar}>👤</div>
          <div style={{ flex: 1 }}>
            <div style={S.email}>
              {user.email}
              <span style={S.badge(user.role === "admin" ? "#7c3aed" : "#475569")}>
                {user.role === "admin" ? "Admin" : "User"}
              </span>
            </div>
            {user.name && <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{user.name}</div>}
            <div style={S.meta}>
              ID: {user.id} · Зарегистрирован: {new Date(user.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}
              · Данных на сервере: {dataRows.length}
            </div>
          </div>
          {/* Role toggle form */}
          <RoleForm userId={user.id} currentRole={user.role} />
        </div>

        {/* Data blocks */}
        {dataRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div>У пользователя нет синхронизированных данных на сервере</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Данные хранятся в localStorage браузера пользователя</div>
          </div>
        ) : (
          <>
            <div style={S.h2}>{dataRows.length} блоков данных</div>
            <div style={S.grid}>
              {dataRows.map(row => {
                const info = getKeyInfo(row.key);
                const summary = summarize(row.value);
                return (
                  <div key={row.key} style={S.dataCard}>
                    <div style={S.cardHeader(info.color)}>
                      <span>{info.icon}</span>
                      <span style={S.cardTitle}>{info.label}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569" }}>{row.key}</span>
                    </div>
                    <div style={S.cardBody}>
                      <div>{summary}</div>
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer", color: "#475569", fontSize: 11 }}>Raw JSON</summary>
                        <pre style={S.raw}>{JSON.stringify(row.value, null, 2).slice(0, 2000)}</pre>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Client component for role change
function RoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  // Using a native form POST to avoid "use client" in server page
  return (
    <form action="/api/admin/set-role" method="POST" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" name="role" value={currentRole === "admin" ? "user" : "admin"}
        style={{
          padding: "6px 16px", borderRadius: 6, border: "1px solid #2d3748",
          background: currentRole === "admin" ? "#dc262622" : "#7c3aed22",
          color: currentRole === "admin" ? "#f87171" : "#7c3aed",
          cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}
      >
        {currentRole === "admin" ? "Снять Admin" : "Назначить Admin"}
      </button>
    </form>
  );
}
