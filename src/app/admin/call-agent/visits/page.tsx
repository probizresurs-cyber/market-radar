"use client";

import { useEffect, useState } from "react";

const ACCENT = "#0ea5e9";

const S = {
  main: { padding: "32px" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 28 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 } as React.CSSProperties,
  kpiCard: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20 } as React.CSSProperties,
  kpiLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 } as React.CSSProperties,
  kpiValue: { fontSize: 32, fontWeight: 800, color: "#f1f5f9" } as React.CSSProperties,
  kpiSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 14 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", background: "#0f1117", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid #2d3748" } as React.CSSProperties,
  td: { padding: "10px 12px", borderBottom: "1px solid #1e2737", verticalAlign: "top" as const, color: "#e2e8f0" } as React.CSSProperties,
  tdNum: { padding: "10px 12px", borderBottom: "1px solid #1e2737", fontWeight: 700, color: ACCENT, textAlign: "right" as const } as React.CSSProperties,
  barWrap: { height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" as const, minWidth: 80 } as React.CSSProperties,
  empty: { textAlign: "center" as const, padding: "60px 0", color: "#475569", fontSize: 14 } as React.CSSProperties,
  errBox: { background: "#ef444415", border: "1px solid #ef444444", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#ef4444", marginBottom: 20 } as React.CSSProperties,
};

interface DailyRow {
  date: string;
  calls_count: number;
  active_tenants: number;
  analyzed: number;
}

interface Totals {
  total_calls_30d: number;
  total_tenants: number;
  total_analyzed: number;
  total_users: number;
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export default function CAVisitsPage() {
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/call-agent/stats");
      const d = await r.json();
      if (d.ok) {
        setDaily(d.daily ?? []);
        setTotals(d.totals ?? null);
      } else {
        setError(d.error || "Ошибка загрузки данных");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const displayDaily = daily.slice(0, 14);
  const maxCalls = Math.max(1, ...displayDaily.map((r) => r.calls_count));

  return (
    <main style={S.main}>
      <div style={S.h1}>Посещаемость Call-Agent</div>
      <div style={S.sub}>Статистика звонков и активности за последние 30 дней.</div>

      {error && <div style={S.errBox}>{error}</div>}

      {/* KPI плитки */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>Звонков за 30 дней</div>
          <div style={{ ...S.kpiValue, color: ACCENT }}>
            {loading ? "—" : (totals?.total_calls_30d ?? 0).toLocaleString("ru-RU")}
          </div>
          <div style={S.kpiSub}>все статусы</div>
        </div>
        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>Уникальных тенантов</div>
          <div style={{ ...S.kpiValue, color: "#a78bfa" }}>
            {loading ? "—" : totals?.total_tenants ?? 0}
          </div>
          <div style={S.kpiSub}>активны в этом периоде</div>
        </div>
        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>Проанализировано</div>
          <div style={{ ...S.kpiValue, color: "#4ade80" }}>
            {loading ? "—" : (totals?.total_analyzed ?? 0).toLocaleString("ru-RU")}
          </div>
          <div style={S.kpiSub}>статус done</div>
        </div>
        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>Пользователей</div>
          <div style={{ ...S.kpiValue, color: "#f59e0b" }}>
            {loading ? "—" : totals?.total_users ?? 0}
          </div>
          <div style={S.kpiSub}>активных аккаунтов</div>
        </div>
      </div>

      {/* Таблица по дням */}
      <div style={S.card}>
        <div style={S.cardTitle}>Активность по дням (последние 14 дней)</div>
        {loading ? (
          <div style={S.empty}>Загрузка...</div>
        ) : displayDaily.length === 0 ? (
          <div style={S.empty}>Данных пока нет. Убедитесь, что Call-Agent доступен.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Дата</th>
                  <th style={{ ...S.th, textAlign: "right" as const }}>Звонков</th>
                  <th style={{ ...S.th, textAlign: "right" as const }}>Тенантов</th>
                  <th style={{ ...S.th, textAlign: "right" as const }}>Проанализировано</th>
                  <th style={{ ...S.th, width: "35%" }}>График</th>
                </tr>
              </thead>
              <tbody>
                {displayDaily.map((row) => {
                  const pct = (row.calls_count / maxCalls) * 100;
                  const analPct = row.calls_count > 0 ? (row.analyzed / row.calls_count) * 100 : 0;
                  return (
                    <tr key={row.date}>
                      <td style={{ ...S.td, whiteSpace: "nowrap" as const, color: "#94a3b8" }}>
                        {fmtDate(row.date)}
                      </td>
                      <td style={S.tdNum}>{row.calls_count.toLocaleString("ru-RU")}</td>
                      <td style={{ ...S.tdNum, color: "#a78bfa" }}>{row.active_tenants}</td>
                      <td style={{ ...S.tdNum, color: "#4ade80" }}>{row.analyzed.toLocaleString("ru-RU")}</td>
                      <td style={S.td}>
                        <div style={S.barWrap}>
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 4,
                              background: `linear-gradient(90deg, ${ACCENT} ${analPct.toFixed(0)}%, #2d3748 ${analPct.toFixed(0)}%)`,
                              width: `${Math.max(2, pct)}%`,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                          {pct.toFixed(0)}% от пика · {analPct.toFixed(0)}% проанализировано
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
