"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, ExternalLink, ArrowLeft, RefreshCcw, Phone } from "lucide-react";

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
  updatedAt: string;
}

interface CARef {
  id?: string | number;
  code?: string;
  name?: string;
  created_at?: string;
  used_count?: number;
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed", display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  navRow: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  navLink: (active?: boolean) => ({
    padding: "8px 16px", fontSize: 13, fontWeight: 600,
    color: active ? "#7c3aed" : "#64748b",
    textDecoration: "none",
    borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent",
  } as React.CSSProperties),
  main: { padding: "32px", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  crossNav: { display: "flex", gap: 12, marginBottom: 20, alignItems: "center" } as React.CSSProperties,
  crossBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, color: "#cbd5e1", textDecoration: "none", fontSize: 13, fontWeight: 600 } as React.CSSProperties,
  crossBtnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "1px solid #7c3aed", borderRadius: 8, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 24 } as React.CSSProperties,
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 } as React.CSSProperties,
  stat: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  statNum: { fontSize: 32, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } as React.CSSProperties,
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#f1f5f9" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", background: "#13182a", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", border: "1px solid #2d3748" },
  td: { padding: "10px 14px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  refreshBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" } as React.CSSProperties,
  emptyMsg: { textAlign: "center" as const, padding: 40, color: "#64748b", fontSize: 13 },
  errBox: { background: "#3b0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13 } as React.CSSProperties,
  warnBox: { background: "#3a2f12", border: "1px solid #a16207", color: "#fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13 } as React.CSSProperties,
};

// MarketRadar admin tabs — duplicated here for visual consistency with sibling
// admin pages (which inline TABS rather than importing AdminNav).
const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/leads", label: "Лиды" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
  { href: "/admin/promo-reels", label: "Промо-рилсы" },
  { href: "/admin/call-agent", label: "Call-Agent" },
];

function roleColor(role: string): string {
  switch (role) {
    case "owner": return "#a855f7";
    case "admin": return "#7c3aed";
    case "head":  return "#0ea5e9";
    case "manager": return "#4ade80";
    default: return "#64748b";
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CallAgentAdminPage() {
  const [users, setUsers] = useState<CAUser[]>([]);
  const [refs, setRefs] = useState<CARef[]>([]);
  const [refsNotice, setRefsNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [uRes, rRes] = await Promise.all([
        fetch("/api/admin/call-agent/users", { cache: "no-store" }),
        fetch("/api/admin/call-agent/refs",  { cache: "no-store" }),
      ]);
      const uData = await uRes.json().catch(() => ({}));
      const rData = await rRes.json().catch(() => ({}));

      if (!uRes.ok || !uData.ok) {
        setErr(uData.error || `HTTP ${uRes.status}`);
        setUsers([]);
      } else {
        setUsers(Array.isArray(uData.items) ? uData.items : []);
      }

      if (rRes.ok && rData.ok) {
        setRefs(Array.isArray(rData.items) ? rData.items : []);
        setRefsNotice(rData.notice || null);
      } else {
        setRefs([]);
        setRefsNotice(rData.error || `HTTP ${rRes.status}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const tenants = new Set(users.map(u => u.tenantId)).size;
  const owners = users.filter(u => u.role === "owner").length;

  // External URL to Call-Agent itself. Sane default: same host, /call-agent/dashboard
  // (deployment uses APP_BASE_URL https://staging.marketradar24.ru/call-agent in CA).
  // If served from a different domain, user can adjust manually.
  const caUrl = "/call-agent/dashboard";

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}><Zap size={18} /> MarketRadar Admin</div>
        <Link href="/admin/dashboard" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>
          ← К списку пользователей
        </Link>
      </header>

      <nav style={S.navRow}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/call-agent")}>
            {t.label}
          </Link>
        ))}
      </nav>

      <main style={S.main}>
        <div style={S.crossNav}>
          <Link href="/admin/dashboard" style={S.crossBtn}>
            <ArrowLeft size={14} /> MarketRadar
          </Link>
          <a href={caUrl} target="_blank" rel="noreferrer" style={S.crossBtnPrimary}>
            <Phone size={14} /> Открыть Call-Agent <ExternalLink size={12} />
          </a>
          <button onClick={load} style={S.refreshBtn} disabled={loading}>
            <RefreshCcw size={14} /> {loading ? "Загрузка..." : "Обновить"}
          </button>
        </div>

        <div style={S.h1}>Админка Call-Agent</div>
        <div style={S.sub}>
          Управление пользователями и реф-ссылками отдельного продукта (анализ звонков).
          Данные получены через защищённый shared-secret API.
        </div>

        {err && (
          <div style={S.errBox}>
            <strong>Не удалось загрузить пользователей:</strong> {err}
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
              Проверьте: (1) Call-Agent поднят и доступен по <code>CA_BASE_URL</code>;
              (2) переменные <code>CA_ADMIN_TOKEN</code> в .env обоих приложений совпадают.
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={S.statRow}>
          <div style={S.stat}>
            <div style={S.statNum}>{totalUsers}</div>
            <div style={S.statLabel}>Всего пользователей</div>
          </div>
          <div style={S.stat}>
            <div style={S.statNum}>{activeUsers}</div>
            <div style={S.statLabel}>Активных</div>
          </div>
          <div style={S.stat}>
            <div style={S.statNum}>{tenants}</div>
            <div style={S.statLabel}>Тенантов</div>
          </div>
          <div style={S.stat}>
            <div style={S.statNum}>{owners}</div>
            <div style={S.statLabel}>Владельцев</div>
          </div>
        </div>

        {/* Users table */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}>Пользователи Call-Agent</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Создание/редактирование пользователей пока выполняется внутри Call-Agent
              (<a href="/call-agent/settings/users" target="_blank" rel="noreferrer" style={{ color: "#7c3aed" }}>Настройки → Пользователи</a>).
            </div>
          </div>
          {loading ? (
            <div style={S.emptyMsg}>Загрузка...</div>
          ) : users.length === 0 && !err ? (
            <div style={S.emptyMsg}>Пользователей пока нет.</div>
          ) : users.length === 0 ? (
            <div style={S.emptyMsg}>—</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Логин</th>
                    <th style={S.th}>Имя</th>
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Роль</th>
                    <th style={S.th}>Тенант</th>
                    <th style={S.th}>Bitrix ID</th>
                    <th style={S.th}>Статус</th>
                    <th style={S.th}>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                      <td style={{ ...S.td, fontWeight: 600, color: "#e2e8f0" }}>{u.login}</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{u.name || "—"}</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{u.email || "—"}</td>
                      <td style={S.td}>
                        <span style={S.badge(roleColor(u.role))}>{u.role}</span>
                      </td>
                      <td style={{ ...S.td, color: "#cbd5e1" }}>
                        {u.tenantName || `#${u.tenantId}`}
                      </td>
                      <td style={{ ...S.td, color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>
                        {u.bitrixManagerId || "—"}
                      </td>
                      <td style={S.td}>
                        {u.isActive
                          ? <span style={S.badge("#4ade80")}>Активен</span>
                          : <span style={S.badge("#64748b")}>Выкл.</span>}
                      </td>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Referrals */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}>Реф-ссылки Call-Agent</div>
            <button
              style={{ ...S.refreshBtn, opacity: 0.5, cursor: "not-allowed" }}
              disabled
              title="Создание реф-ссылок Call-Agent появится в следующей итерации"
            >
              + Создать реф-ссылку
            </button>
          </div>

          {refsNotice && (
            <div style={S.warnBox}>
              <strong>Реф-ссылки в Call-Agent пока не реализованы.</strong>
              <div style={{ fontSize: 11, marginTop: 6, opacity: 0.9 }}>
                Для запуска нужна миграция: добавить таблицу <code>referrals</code> в
                <code> src/db/schema.ts</code> и реализовать GET/POST в
                <code> src/app/api/admin/refs/route.ts</code>. Сейчас MarketRadar-страница
                подключена «вхолостую» — UI готов, данные подцепятся автоматически
                как только эндпоинт начнёт отдавать список.
              </div>
            </div>
          )}

          {refs.length === 0 ? (
            <div style={S.emptyMsg}>Пока нет реф-ссылок.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Код</th>
                    <th style={S.th}>Название</th>
                    <th style={S.th}>Создан</th>
                    <th style={S.th}>Использовано</th>
                  </tr>
                </thead>
                <tbody>
                  {refs.map((r, i) => (
                    <tr key={String(r.id ?? i)} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                      <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700 }}>{r.code || "—"}</td>
                      <td style={S.td}>{r.name || "—"}</td>
                      <td style={S.td}>{fmtDate(r.created_at)}</td>
                      <td style={S.td}>{r.used_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
