"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { GeneratedPost, GeneratedReel } from "@/lib/content-types";
import { fmtNumber } from "@/components/views/GeneratedPostsView";

// ============================================================
// Content Analytics View
// ============================================================

interface PerformanceInsights {
  summary: string;
  topPillars: Array<{ name: string; avgER: number; totalReach: number; why: string }>;
  topFormats: Array<{ format: string; avgER: number; why: string }>;
  topHooks: Array<{ pattern: string; examples: string[]; why: string }>;
  underperformers: Array<{ what: string; metric: string; fix: string }>;
  recommendations: string[];
  nextWeekPlan: string[];
}

type AnalyticsRow = {
  id: string;
  kind: "post" | "reel";
  title: string;
  pillar: string;
  format: string;
  reach: number;
  engagement: number;
  er: number;
  leads: number;
  revenue: number;
  adSpend: number;
  romi: number | null;
  generatedAt: string;
};

export function buildAnalyticsRows(posts: GeneratedPost[], reels: GeneratedReel[]): AnalyticsRow[] {
  const rows: AnalyticsRow[] = [];
  for (const p of posts) {
    if (!p.metrics) continue;
    const m = p.metrics;
    const reach = m.reach ?? m.impressions ?? 0;
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const er = reach > 0 ? (eng / reach) * 100 : 0;
    const adSpend = m.adSpend ?? 0;
    const revenue = m.revenue ?? 0;
    rows.push({
      id: p.id, kind: "post", title: p.hook, pillar: p.pillar,
      format: p.body.includes("---") ? "carousel" : "single",
      reach, engagement: eng, er,
      leads: m.leads ?? 0, revenue, adSpend,
      romi: adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : null,
      generatedAt: p.generatedAt,
    });
  }
  for (const r of reels) {
    if (!r.metrics) continue;
    const m = r.metrics;
    const reach = m.reach ?? m.views ?? 0;
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const er = reach > 0 ? (eng / reach) * 100 : 0;
    const adSpend = m.adSpend ?? 0;
    const revenue = m.revenue ?? 0;
    rows.push({
      id: r.id, kind: "reel", title: r.title, pillar: r.pillar,
      format: `reel-${r.durationSec}s`,
      reach, engagement: eng, er,
      leads: m.leads ?? 0, revenue, adSpend,
      romi: adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : null,
      generatedAt: r.generatedAt,
    });
  }
  return rows;
}

export function ContentAnalyticsView({ c, posts, reels, companyName }: {
  c: Colors;
  posts: GeneratedPost[];
  reels: GeneratedReel[];
  companyName: string;
}) {
  const [periodDays, setPeriodDays] = useState<number>(0); // 0 = all time
  const [filterKind, setFilterKind] = useState<"all" | "post" | "reel">("all");
  const [sortBy, setSortBy] = useState<"er" | "reach" | "romi" | "revenue" | "date">("er");
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const allRows = buildAnalyticsRows(posts, reels);

  // Apply period filter
  const periodRows = periodDays === 0
    ? allRows
    : allRows.filter(r => {
        const ageMs = Date.now() - new Date(r.generatedAt).getTime();
        return ageMs <= periodDays * 24 * 60 * 60 * 1000;
      });

  // Apply kind filter
  const filteredRows = filterKind === "all" ? periodRows : periodRows.filter(r => r.kind === filterKind);

  // Sort
  const sortedRows = [...filteredRows].sort((a, b) => {
    switch (sortBy) {
      case "reach": return b.reach - a.reach;
      case "romi": return (b.romi ?? -Infinity) - (a.romi ?? -Infinity);
      case "revenue": return b.revenue - a.revenue;
      case "date": return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      default: return b.er - a.er;
    }
  });

  // KPI aggregation
  const totalReach = filteredRows.reduce((s, r) => s + r.reach, 0);
  const totalEng = filteredRows.reduce((s, r) => s + r.engagement, 0);
  const avgER = totalReach > 0 ? (totalEng / totalReach) * 100 : 0;
  const totalLeads = filteredRows.reduce((s, r) => s + r.leads, 0);
  const totalRevenue = filteredRows.reduce((s, r) => s + r.revenue, 0);
  const totalSpend = filteredRows.reduce((s, r) => s + r.adSpend, 0);
  const totalROMI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;
  const totalCPL = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : 0;

  const handleAnalyze = async () => {
    setLoadingInsights(true);
    setInsightsError(null);
    try {
      const res = await fetch("/api/analyze-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: posts.filter(p => p.metrics),
          reels: reels.filter(r => r.metrics),
          companyName,
        }),
      });
      const json = await res.json() as { ok: boolean; data?: PerformanceInsights; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      setInsights(json.data ?? null);
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoadingInsights(false);
    }
  };

  if (allRows.length === 0) {
    return (
      <div style={{ maxWidth: 800 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>📊 Аналитика контента</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow, marginTop: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14, color: c.textSecondary, marginBottom: 6 }}>Пока нет публикаций с метриками</div>
          <div style={{ fontSize: 12, color: c.textMuted }}>
            Откройте «Готовые посты» или «Готовые видео», нажмите 📊 на карточке и бросьте скрин статистики — GPT-4o распознает все цифры.
          </div>
        </div>
      </div>
    );
  }

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  const KpiCell = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div style={{ flex: "1 1 140px", padding: "12px 14px", background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? c.textPrimary, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>📊 Аналитика контента</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{filteredRows.length} публикаций с метриками · {allRows.length - filteredRows.length} вне фильтра</p>
      </div>

      {/* Period & filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {([[0, "Всё время"], [7, "7 дней"], [30, "30 дней"], [90, "90 дней"]] as const).map(([days, label]) => (
          <button key={days} onClick={() => setPeriodDays(days)}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${periodDays === days ? "#f59e0b" : c.border}`,
              background: periodDays === days ? "#f59e0b15" : c.bg, color: periodDays === days ? "#f59e0b" : c.textSecondary,
              fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
        <div style={{ width: 1, background: c.borderLight, margin: "0 4px" }} />
        {([["all", "Всё"], ["post", "Посты"], ["reel", "Рилсы"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilterKind(k)}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${filterKind === k ? c.accent : c.border}`,
              background: filterKind === k ? c.accent + "15" : c.bg, color: filterKind === k ? c.accent : c.textSecondary,
              fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCell label="ОХВАТ" value={fmtNumber(totalReach)} sub={`${filteredRows.length} публикаций`} />
        <KpiCell label="ВОВЛЕЧЕНИЕ" value={fmtNumber(totalEng)} sub={`ER ${avgER.toFixed(2)}%`} />
        <KpiCell label="ЛИДЫ" value={String(totalLeads)} sub={totalCPL > 0 ? `CPL ${totalCPL.toFixed(0)} ₽` : undefined} />
        <KpiCell label="ВЫРУЧКА" value={`${fmtNumber(totalRevenue)} ₽`} />
        <KpiCell label="РЕКЛАМА" value={`${fmtNumber(totalSpend)} ₽`} />
        <KpiCell label="ROMI" value={totalROMI != null ? `${totalROMI.toFixed(0)}%` : "—"} color={totalROMI != null ? (totalROMI >= 0 ? "#22c55e" : c.accentRed) : undefined} />
      </div>

      {/* AI insights block */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary }}>🤖 AI-разбор аналитики</div>
            <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>GPT-4o проанализирует все метрики и даст конкретные рекомендации</div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loadingInsights}
            style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: loadingInsights ? c.borderLight : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: loadingInsights ? c.textMuted : "#fff", fontSize: 12, fontWeight: 800, cursor: loadingInsights ? "not-allowed" : "pointer",
              boxShadow: loadingInsights ? "none" : "0 4px 14px #6366f140" }}>
            {loadingInsights ? "⏳ Анализирую…" : insights ? "🔄 Перезапустить анализ" : "🤖 Разобрать аналитику"}
          </button>
        </div>
        {insightsError && <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 10 }}>❌ {insightsError}</div>}
        {insights && <InsightsDisplay c={c} insights={insights} />}
      </Card>

      {/* Sort selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>СОРТИРОВКА:</span>
        {([["er", "ER"], ["reach", "Охват"], ["romi", "ROMI"], ["revenue", "Выручка"], ["date", "Дата"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSortBy(k)}
            style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${sortBy === k ? c.accent : c.border}`,
              background: sortBy === k ? c.accent + "15" : "transparent", color: sortBy === k ? c.accent : c.textSecondary,
              fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: c.bg, borderBottom: `1px solid ${c.borderLight}` }}>
                {["Тип", "Заголовок", "Пиллар", "Формат", "Охват", "ER", "Лиды", "Выручка", "ROMI"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const erColor = row.er >= avgER * 1.3 ? "#22c55e" : row.er < avgER * 0.7 ? c.accentRed : c.textSecondary;
                const romiColor = row.romi == null ? c.textMuted : row.romi >= 100 ? "#22c55e" : row.romi >= 0 ? c.textSecondary : c.accentRed;
                return (
                  <tr key={row.id} style={{ borderBottom: i < sortedRows.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: row.kind === "reel" ? "#ec489918" : "#f59e0b18",
                        color: row.kind === "reel" ? "#ec4899" : "#f59e0b" }}>
                        {row.kind === "reel" ? "REEL" : "POST"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", color: c.textPrimary, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</td>
                    <td style={{ padding: "9px 12px", color: c.textSecondary }}>{row.pillar}</td>
                    <td style={{ padding: "9px 12px", color: c.textMuted, fontSize: 10 }}>{row.format}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: c.textPrimary, fontFamily: "monospace" }}>{fmtNumber(row.reach)}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: erColor, fontFamily: "monospace" }}>{row.er.toFixed(1)}%</td>
                    <td style={{ padding: "9px 12px", color: c.textSecondary, fontFamily: "monospace" }}>{row.leads || "—"}</td>
                    <td style={{ padding: "9px 12px", color: c.textSecondary, fontFamily: "monospace" }}>{row.revenue > 0 ? fmtNumber(row.revenue) + " ₽" : "—"}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: romiColor, fontFamily: "monospace" }}>{row.romi != null ? row.romi.toFixed(0) + "%" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function InsightsDisplay({ c, insights }: { c: Colors; insights: PerformanceInsights }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ padding: "10px 14px", background: "#6366f10c", borderRadius: 8, border: "1px solid #6366f125", fontSize: 12, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55 }}>
        💡 {insights.summary}
      </div>

      {insights.topPillars?.length > 0 && (
        <Section title="🏆 ТОП КОНТЕНТ-СТОЛПЫ">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {insights.topPillars.map((p, i) => (
              <div key={i} style={{ padding: 12, background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 6 }}>
                  ER <b style={{ color: "#22c55e" }}>{p.avgER?.toFixed?.(1) ?? p.avgER}%</b> · охват <b>{fmtNumber(p.totalReach)}</b>
                </div>
                <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.5 }}>{p.why}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {insights.topFormats?.length > 0 && (
        <Section title="📐 ТОП ФОРМАТЫ">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {insights.topFormats.map((f, i) => (
              <div key={i} style={{ padding: "8px 12px", background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}>{f.format} <span style={{ color: "#22c55e" }}>{f.avgER?.toFixed?.(1) ?? f.avgER}%</span></div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{f.why}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {insights.topHooks?.length > 0 && (
        <Section title="🪝 РАБОЧИЕ КРЮЧКИ">
          {insights.topHooks.map((h, i) => (
            <div key={i} style={{ padding: 10, background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>{h.pattern}</div>
              {h.examples?.length > 0 && (
                <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 4, fontStyle: "italic" }}>
                  {h.examples.map(e => `«${e}»`).join(" · ")}
                </div>
              )}
              <div style={{ fontSize: 11, color: c.textSecondary }}>{h.why}</div>
            </div>
          ))}
        </Section>
      )}

      {insights.underperformers?.length > 0 && (
        <Section title="⚠️ ЧТО НЕ РАБОТАЕТ">
          {insights.underperformers.map((u, i) => (
            <div key={i} style={{ padding: 10, background: c.accentRed + "08", borderRadius: 8, border: `1px solid ${c.accentRed}25`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 3 }}>{u.what}</div>
              <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 3 }}>метрика: {u.metric}</div>
              <div style={{ fontSize: 11, color: c.textSecondary }}>👉 {u.fix}</div>
            </div>
          ))}
        </Section>
      )}

      {insights.recommendations?.length > 0 && (
        <Section title="🎯 РЕКОМЕНДАЦИИ">
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {insights.recommendations.map((r, i) => (
              <li key={i} style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, marginBottom: 4 }}>{r}</li>
            ))}
          </ol>
        </Section>
      )}

      {insights.nextWeekPlan?.length > 0 && (
        <Section title="📅 ПЛАН НА СЛЕДУЮЩУЮ НЕДЕЛЮ">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
            {insights.nextWeekPlan.map((d, i) => (
              <div key={i} style={{ padding: "8px 10px", background: c.bg, borderRadius: 7, border: `1px solid ${c.borderLight}`, fontSize: 11, color: c.textSecondary }}>{d}</div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================
// ROI Calculator View
// ============================================================

export function ROICalculatorView({ c, posts, reels }: {
  c: Colors;
  posts: GeneratedPost[];
  reels: GeneratedReel[];
}) {
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [avgCheck, setAvgCheck] = useState<number>(0);
  const [marginPct, setMarginPct] = useState<number>(40);
  const [postsPerMonth, setPostsPerMonth] = useState<number>(20);

  const rows = buildAnalyticsRows(posts, reels);
  const withSpend = rows.filter(r => r.adSpend > 0 && r.leads > 0);
  const withRevenue = rows.filter(r => r.revenue > 0 && r.adSpend > 0);

  // Historical averages
  const avgCPL = withSpend.length > 0
    ? withSpend.reduce((s, r) => s + r.adSpend / r.leads, 0) / withSpend.length
    : 0;
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const conversionRate = totalLeads > 0 && rows.reduce((s, r) => s + r.reach, 0) > 0
    ? (totalLeads / rows.reduce((s, r) => s + r.reach, 0)) * 100
    : 0;
  const avgRevenuePerLead = totalLeads > 0 ? totalRevenue / totalLeads : 0;
  const historicalROMI = withRevenue.length > 0
    ? (withRevenue.reduce((s, r) => s + r.revenue, 0) - withRevenue.reduce((s, r) => s + r.adSpend, 0))
        / withRevenue.reduce((s, r) => s + r.adSpend, 0) * 100
    : null;

  // Forecast
  const forecastLeads = avgCPL > 0 && monthlyBudget > 0 ? Math.round(monthlyBudget / avgCPL) : 0;
  const forecastRevenue = avgCheck > 0 ? forecastLeads * avgCheck : 0;
  const forecastProfit = forecastRevenue * (marginPct / 100) - monthlyBudget;
  const forecastROMI = monthlyBudget > 0 ? (forecastProfit / monthlyBudget) * 100 : 0;
  const breakEvenLeads = avgCheck > 0 && marginPct > 0
    ? Math.ceil(monthlyBudget / (avgCheck * (marginPct / 100)))
    : 0;

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary,
    fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box", fontFamily: "monospace",
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>💰 ROI калькулятор</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>
          Прогноз окупаемости на основе ваших исторических метрик
        </p>
      </div>

      {/* Historical KPI */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 8 }}>📈 ВАШИ ИСТОРИЧЕСКИЕ ПОКАЗАТЕЛИ</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "СРЕДНИЙ CPL", value: avgCPL > 0 ? `${avgCPL.toFixed(0)} ₽` : "—", sub: `${withSpend.length} публикаций` },
            { label: "КОНВЕРСИЯ", value: conversionRate > 0 ? `${conversionRate.toFixed(2)}%` : "—", sub: "охват → лид" },
            { label: "ВЫРУЧКА/ЛИД", value: avgRevenuePerLead > 0 ? `${avgRevenuePerLead.toFixed(0)} ₽` : "—" },
            { label: "ROMI ИСТОРИЧ.", value: historicalROMI != null ? `${historicalROMI.toFixed(0)}%` : "—",
              color: historicalROMI != null ? (historicalROMI >= 0 ? "#22c55e" : c.accentRed) : undefined },
          ].map((k, i) => (
            <div key={i} style={{ flex: "1 1 160px", padding: "12px 14px", background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color ?? c.textPrimary }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Inputs + Forecast */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, color: c.textPrimary, marginBottom: 14 }}>📥 Параметры на месяц</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle}>БЮДЖЕТ НА ПРОДВИЖЕНИЕ (₽)</label>
              <input type="number" value={monthlyBudget || ""} onChange={e => setMonthlyBudget(Number(e.target.value) || 0)} placeholder="100000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>СРЕДНИЙ ЧЕК (₽)</label>
              <input type="number" value={avgCheck || ""} onChange={e => setAvgCheck(Number(e.target.value) || 0)} placeholder="15000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>МАРЖИНАЛЬНОСТЬ (%)</label>
              <input type="number" value={marginPct || ""} onChange={e => setMarginPct(Number(e.target.value) || 0)} placeholder="40" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>ПУБЛИКАЦИЙ В МЕСЯЦ</label>
              <input type="number" value={postsPerMonth || ""} onChange={e => setPostsPerMonth(Number(e.target.value) || 0)} placeholder="20" style={inputStyle} />
            </div>
          </div>
          {avgCPL === 0 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#f59e0b15", borderRadius: 7, fontSize: 11, color: c.textSecondary }}>
              ⚠️ Внесите метрики хотя бы по 3-5 публикациям с указанием рекламного бюджета и лидов — иначе прогноз будет нулевым.
            </div>
          )}
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${c.bgCard}, #6366f108)` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: c.textPrimary, marginBottom: 14 }}>🎯 Прогноз на месяц</div>
          <div style={{ display: "grid", gap: 12 }}>
            <ForecastRow c={c} label="Прогноз лидов" value={forecastLeads > 0 ? String(forecastLeads) : "—"} sub={avgCPL > 0 ? `при CPL ${avgCPL.toFixed(0)} ₽` : ""} />
            <ForecastRow c={c} label="Прогноз выручки" value={forecastRevenue > 0 ? `${fmtNumber(forecastRevenue)} ₽` : "—"} sub={avgCheck > 0 ? `${forecastLeads} лидов × ${avgCheck} ₽` : ""} />
            <ForecastRow c={c} label="Чистая прибыль" value={forecastProfit !== 0 ? `${fmtNumber(Math.round(forecastProfit))} ₽` : "—"}
              color={forecastProfit > 0 ? "#22c55e" : forecastProfit < 0 ? c.accentRed : undefined}
              sub={`${marginPct}% маржи − реклама`} />
            <ForecastRow c={c} label="ROMI" value={monthlyBudget > 0 ? `${forecastROMI.toFixed(0)}%` : "—"}
              color={forecastROMI > 0 ? "#22c55e" : forecastROMI < 0 ? c.accentRed : undefined} />
            <div style={{ height: 1, background: c.borderLight, margin: "4px 0" }} />
            <ForecastRow c={c} label="Точка безубыточности" value={breakEvenLeads > 0 ? `${breakEvenLeads} лидов` : "—"}
              sub={avgCheck > 0 && marginPct > 0 ? "минимум для окупаемости" : ""} />
            <ForecastRow c={c} label="Цена 1 публикации" value={postsPerMonth > 0 && monthlyBudget > 0 ? `${(monthlyBudget / postsPerMonth).toFixed(0)} ₽` : "—"} />
          </div>
        </Card>
      </div>

      {/* Hint */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>💡 Как читать прогноз</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: c.textSecondary, lineHeight: 1.7 }}>
          <li>Прогноз построен на <b>ваших</b> реальных метриках, а не на средних по рынку</li>
          <li>Если ROMI отрицательный — нужно либо снижать CPL (улучшать креативы), либо повышать средний чек</li>
          <li>Точка безубыточности — сколько лидов нужно, чтобы маржа покрыла рекламу</li>
          <li>Чем больше публикаций с метриками вы внесёте — тем точнее прогноз</li>
        </ul>
      </Card>
    </div>
  );
}

export function ForecastRow({ c, label, value, sub, color }: { c: Colors; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: 11, color: c.textSecondary, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? c.textPrimary, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}
