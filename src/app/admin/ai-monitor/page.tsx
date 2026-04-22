"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  header: { background: "#1a1f2e", borderBottom: "1px solid #2d3748", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  nav: { display: "flex", gap: 4, background: "#1a1f2e", padding: "8px 32px 0", borderBottom: "1px solid #2d3748", flexWrap: "wrap" as const } as React.CSSProperties,
  navLink: (active?: boolean) => ({ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: active ? "#7c3aed" : "#64748b", textDecoration: "none", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent" } as React.CSSProperties),
  main: { padding: "32px", maxWidth: 1200, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#f1f5f9" } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 } as React.CSSProperties,
  stat: { background: "#131720", border: "1px solid #2d3748", borderRadius: 10, padding: "16px 18px" } as React.CSSProperties,
  statNum: { fontSize: 28, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th: { textAlign: "left" as const, padding: "8px 10px", background: "#131720", color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, border: "1px solid #2d3748" },
  td: { padding: "8px 10px", border: "1px solid #1e2737", verticalAlign: "top" as const },
  badge: (color: string) => ({ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: color + "22", color, display: "inline-block" }),
  btn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  btnSm: (color = "#7c3aed") => ({ background: "none", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 } as React.CSSProperties),
  select: { background: "#0f1117", border: "1px solid #2d3748", borderRadius: 6, color: "#e2e8f0", padding: "6px 10px", fontSize: 13 } as React.CSSProperties,
};

const TABS = [
  { href: "/admin/dashboard", label: "Пользователи" },
  { href: "/admin/partners", label: "Партнёры" },
  { href: "/admin/pricing", label: "Тарифы" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/referrals", label: "Рефералки" },
  { href: "/admin/features", label: "Модули" },
  { href: "/admin/visits", label: "Посещаемость" },
  { href: "/admin/ai-monitor", label: "AI Monitor" },
];

interface UsageData {
  totals: { total_calls: number; successful: number; failed: number; total_tokens: number; avg_duration_ms: number; manipulation_count: number };
  by_group: { key: string; calls: number; tokens: number; errors: number }[];
  daily: { day: string; calls: number; tokens: number }[];
  rate_limit: { today_calls: number; daily_limit: number; remaining: number };
}

interface KeyStatus { name: string; envVar: string; configured: boolean; masked: string }
interface AiLog { id: string; user_id: string | null; user_email?: string; endpoint: string; model: string; total_tokens: number | null; duration_ms: number | null; success: boolean; manipulation_detected: boolean; error_message: string | null; created_at: string }

export default function AiMonitorPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [period, setPeriod] = useState("month");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  async function loadUsage(p = period) {
    setLoadingUsage(true);
    const r = await fetch(`/api/ai/usage?period=${p}&breakdown=endpoint`);
    const d = await r.json();
    if (d.ok) setUsage(d);
    setLoadingUsage(false);
  }

  async function loadKeys() {
    const r = await fetch("/api/ai/key");
    const d = await r.json();
    if (d.ok) setKeys(d.keys);
  }

  async function loadLogs() {
    const r = await fetch("/api/ai/log?limit=50");
    const d = await r.json();
    if (d.ok) setLogs(d.logs);
  }

  useEffect(() => {
    loadUsage();
    loadKeys();
    loadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function testProvider(provider: string) {
    setTesting(provider);
    setTestResult(null);
    const r = await fetch("/api/ai/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const d = await r.json();
    setTestResult(d);
    setTesting(null);
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={{ textDecoration: "none" }}><span style={S.logo}>MarketRadar Admin</span></Link>
      </header>
      <nav style={S.nav}>
        {TABS.map(t => <Link key={t.href} href={t.href} style={S.navLink(t.href === "/admin/ai-monitor")}>{t.label}</Link>)}
      </nav>

      <main style={S.main}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={S.h1}>AI Monitor</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select style={S.select} value={period} onChange={e => { setPeriod(e.target.value); loadUsage(e.target.value); }}>
              <option value="today">Сегодня</option>
              <option value="week">7 дней</option>
              <option value="month">30 дней</option>
              <option value="all">Всё время</option>
            </select>
            <button style={S.btn} onClick={() => { loadUsage(); loadLogs(); }}>↻ Обновить</button>
          </div>
        </div>

        {/* Totals */}
        {loadingUsage ? (
          <div style={{ color: "#475569", padding: "40px 0", textAlign: "center" }}>Загрузка...</div>
        ) : usage && (
          <>
            <div style={S.statGrid}>
              <div style={S.stat}><div style={S.statNum}>{usage.totals.total_calls.toLocaleString()}</div><div style={S.statLabel}>Всего вызовов</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#4ade80" }}>{usage.totals.successful.toLocaleString()}</div><div style={S.statLabel}>Успешных</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#ef4444" }}>{usage.totals.failed.toLocaleString()}</div><div style={S.statLabel}>Ошибок</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#f59e0b" }}>{(usage.totals.total_tokens / 1000).toFixed(1)}K</div><div style={S.statLabel}>Токенов</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: "#60a5fa" }}>{usage.totals.avg_duration_ms}ms</div><div style={S.statLabel}>Ср. время</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: usage.totals.manipulation_count > 0 ? "#ef4444" : "#4ade80" }}>{usage.totals.manipulation_count}</div><div style={S.statLabel}>Манипуляций</div></div>
            </div>

            {/* By endpoint */}
            {usage.by_group.length > 0 && (
              <div style={{ ...S.card, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>По эндпоинтам</div>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Эндпоинт</th>
                      <th style={S.th}>Вызовов</th>
                      <th style={S.th}>Токенов</th>
                      <th style={S.th}>Ошибок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.by_group.map((g, i) => (
                      <tr key={g.key} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                        <td style={{ ...S.td, fontFamily: "monospace", color: "#c084fc" }}>{g.key}</td>
                        <td style={S.td}>{g.calls}</td>
                        <td style={S.td}>{g.tokens.toLocaleString()}</td>
                        <td style={S.td}>{g.errors > 0 ? <span style={S.badge("#ef4444")}>{g.errors}</span> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* API Keys */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
            API-ключи
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btnSm()} onClick={() => testProvider("anthropic")} disabled={testing === "anthropic"}>
                {testing === "anthropic" ? "Тест..." : "✓ Тест Anthropic"}
              </button>
              <button style={S.btnSm("#60a5fa")} onClick={() => testProvider("openai")} disabled={testing === "openai"}>
                {testing === "openai" ? "Тест..." : "✓ Тест OpenAI"}
              </button>
            </div>
          </div>

          {testResult && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: testResult.ok ? "#4ade8022" : "#ef444422", color: testResult.ok ? "#4ade80" : "#ef4444", fontSize: 12, fontFamily: "monospace" }}>
              {JSON.stringify(testResult, null, 2)}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {keys.map(k => (
              <div key={k.envVar} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#131720", borderRadius: 8, border: `1px solid ${k.configured ? "#2d3748" : "#ef444444"}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{k.name}</div>
                  <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{k.envVar}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={S.badge(k.configured ? "#4ade80" : "#ef4444")}>{k.configured ? "OK" : "Missing"}</span>
                  <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{k.masked}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent logs */}
        {logs.length > 0 && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Последние вызовы AI</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Время</th>
                    <th style={S.th}>Пользователь</th>
                    <th style={S.th}>Эндпоинт</th>
                    <th style={S.th}>Модель</th>
                    <th style={S.th}>Токены</th>
                    <th style={S.th}>Время</th>
                    <th style={S.th}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} style={{ background: i % 2 === 0 ? "#131720" : "#0f1117" }}>
                      <td style={{ ...S.td, color: "#64748b", fontSize: 11 }}>{new Date(log.created_at).toLocaleString("ru-RU")}</td>
                      <td style={{ ...S.td, fontSize: 11, color: "#94a3b8" }}>{log.user_email || "—"}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "#c084fc", fontSize: 11 }}>{log.endpoint}</td>
                      <td style={{ ...S.td, fontSize: 11 }}>{log.model}</td>
                      <td style={S.td}>{log.total_tokens?.toLocaleString() || "—"}</td>
                      <td style={S.td}>{log.duration_ms ? `${log.duration_ms}ms` : "—"}</td>
                      <td style={S.td}>
                        {log.manipulation_detected
                          ? <span style={S.badge("#ef4444")}>⚠ Манипуляция</span>
                          : log.success
                          ? <span style={S.badge("#4ade80")}>OK</span>
                          : <span style={S.badge("#f59e0b")} title={log.error_message || ""}>Ошибка</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
