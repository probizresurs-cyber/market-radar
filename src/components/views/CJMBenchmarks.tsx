"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

export function CJMView({ c, data, isGenerating, onGenerate, myCompany, taAnalysis, error }: {
  c: Colors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  isGenerating: boolean;
  onGenerate: () => void;
  myCompany: AnalysisResult | null;
  taAnalysis: unknown;
  error?: string | null;
}) {
  const emotionColor = (valence: string) => {
    if (valence === "positive") return "var(--success)";
    if (valence === "negative") return "var(--destructive)";
    if (valence === "mixed") return "var(--warning)";
    return "var(--foreground-secondary)";
  };

  const stageColors = ["var(--primary)", "#8b5cf6", "#3b82f6", "#f59e0b", "var(--success)", "#14b8a6", "#ec4899"];

  if (!myCompany) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--foreground-secondary)" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Сначала проанализируйте компанию</div>
    </div>
  );

  if (!data) return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Customer Journey Map</h1>
      <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 28px" }}>
        AI построит карту пути клиента — от первого контакта с брендом до повторных покупок и рекомендаций.
        {!!taAnalysis && <span style={{ color: "var(--success)" }}> Данные ЦА будут учтены.</span>}
      </p>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 32, boxShadow: "var(--shadow)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
        <div style={{ fontSize: 14, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 24px" }}>
          Карта включает 7 этапов: точки касания, эмоции клиента, боли на каждом шаге и возможности для улучшения
        </div>
        <button onClick={onGenerate} disabled={isGenerating}
          style={{ padding: "13px 36px", borderRadius: 12, border: "none", background: isGenerating ? "var(--muted-foreground)" : "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "⏳ Генерирую CJM… (30-60 сек)" : "🗺️ Построить Customer Journey Map"}
        </button>
        {isGenerating && <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>Анализирую путь клиента на основе данных компании{taAnalysis ? " и ЦА" : ""}…</p>}
        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "color-mix(in oklch, var(--destructive) 8%, transparent)", border: `1px solid var(--destructive)40`, color: "var(--destructive)", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stages: any[] = data.stages ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)" }}>Customer Journey Map</h1>
          <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: 0 }}>{data.companyName}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <button onClick={onGenerate} disabled={isGenerating}
            style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--muted-foreground)", fontSize: 12, fontWeight: 600, cursor: isGenerating ? "wait" : "pointer" }}>
            {isGenerating ? "⏳ Обновляю…" : "🔄 Актуализировать"}
          </button>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Рекомендуем раз в квартал</div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "color-mix(in oklch, var(--warning) 8%, transparent)", border: `1px solid var(--warning)40`, color: "var(--warning)", fontSize: 12 }}>
          ⚠️ При актуализации возникла ошибка — показаны предыдущие данные. Попробуйте ещё раз.
        </div>
      )}

      {/* Horizontal journey line */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, overflowX: "auto", paddingBottom: 8 }}>
        {stages.map((stage, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 120 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: stageColors[i % stageColors.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 6px", boxShadow: `0 2px 8px ${stageColors[i % stageColors.length]}40` }}>
                {stage.emoji}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>{stage.name}</div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{stage.duration}</div>
            </div>
            {i < stages.length - 1 && (
              <div style={{ width: 24, height: 2, background: `linear-gradient(to right, ${stageColors[i % stageColors.length]}, ${stageColors[(i + 1) % stageColors.length]})`, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Stage cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stages.map((stage, i) => (
          <div key={i} style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)" }}>
            {/* Stage header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid var(--muted)`, background: stageColors[i % stageColors.length] + "08" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: stageColors[i % stageColors.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{stage.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{stage.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{stage.goal}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: emotionColor(stage.emotionValence), background: emotionColor(stage.emotionValence) + "15", padding: "3px 10px", borderRadius: 20 }}>{stage.emotion}</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", background: "var(--background)", padding: "3px 10px", borderRadius: 20, border: `1px solid var(--border)` }}>{stage.duration}</span>
              </div>
            </div>

            {/* Stage body */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
              {/* Touchpoints */}
              <div style={{ padding: "14px 18px", borderRight: `1px solid var(--muted)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.04em" }}>📍 ТОЧКИ КАСАНИЯ</div>
                {(stage.touchpoints ?? []).map((tp: { icon: string; channel: string; action: string }, j: number) => (
                  <div key={j} style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--foreground-secondary)" }}>
                    <span style={{ flexShrink: 0 }}>{tp.icon}</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{tp.channel}</strong> — {tp.action}</span>
                  </div>
                ))}
              </div>

              {/* Customer thoughts */}
              <div style={{ padding: "14px 18px", borderRight: `1px solid var(--muted)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.04em" }}>💭 МЫСЛИ КЛИЕНТА</div>
                {(stage.customerThoughts ?? []).map((t: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid ${stageColors[i % stageColors.length]}40` }}>«{t}»</div>
                ))}
              </div>

              {/* Pain points */}
              <div style={{ padding: "14px 18px", borderRight: `1px solid var(--muted)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 8, letterSpacing: "0.04em" }}>⚠️ БАРЬЕРЫ</div>
                {(stage.painPoints ?? []).map((p: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid var(--destructive)40` }}>{p}</div>
                ))}
              </div>

              {/* Opportunities */}
              <div style={{ padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8, letterSpacing: "0.04em" }}>💡 ВОЗМОЖНОСТИ</div>
                {(stage.opportunities ?? []).map((o: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5, paddingLeft: 10, borderLeft: `2px solid var(--success)40` }}>{o}</div>
                ))}
                {stage.kpi && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--primary)", fontWeight: 600, background: "color-mix(in oklch, var(--primary) 6%, transparent)", padding: "4px 10px", borderRadius: 6 }}>
                    📈 KPI: {stage.kpi}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Benchmarks View
// ============================================================

export function BenchmarksView({ c, data, isGenerating, onGenerate, myCompany, error }: {
  c: Colors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  isGenerating: boolean;
  onGenerate: () => void;
  myCompany: AnalysisResult | null;
  error?: string | null;
}) {
  if (!myCompany) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--foreground-secondary)" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Сначала проанализируйте компанию</div>
    </div>
  );

  if (!data) return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Отраслевые бенчмарки</h1>
      <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 28px" }}>
        AI сравнит показатели компании со средними по нише на российском рынке и найдёт зоны роста.
      </p>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 32, boxShadow: "var(--shadow)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 14, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 24px" }}>
          Получите сравнение по 6+ категориям, рыночные метрики (CAC, LTV, конверсия) и приоритизированные точки роста
        </div>
        <button onClick={onGenerate} disabled={isGenerating}
          style={{ padding: "13px 36px", borderRadius: 12, border: "none", background: isGenerating ? "var(--muted-foreground)" : "linear-gradient(135deg, #0ea5e9, #38bdf8)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating ? "wait" : "pointer" }}>
          {isGenerating ? "⏳ Анализирую рынок… (30-60 сек)" : "📊 Сгенерировать бенчмарки"}
        </button>
        {isGenerating && <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>Сравниваю с отраслевыми стандартами…</p>}
        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "color-mix(in oklch, var(--destructive) 8%, transparent)", border: `1px solid var(--destructive)40`, color: "var(--destructive)", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );

  const verdictColor = (v: string) => {
    if (v?.includes("Лидер") || v?.includes("выше")) return "var(--success)";
    if (v?.includes("Отстающий") || v?.includes("ниже")) return "var(--destructive)";
    return "var(--warning)";
  };

  const ob = data.overallBenchmark ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catBench: any[] = data.categoryBenchmarks ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mktMetrics: any[] = data.marketMetrics ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const growthOps: any[] = data.growthOpportunities ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)" }}>Отраслевые бенчмарки</h1>
          <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: 0 }}>{data.niche}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <button onClick={onGenerate} disabled={isGenerating}
            style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--card)", color: "var(--muted-foreground)", fontSize: 12, fontWeight: 600, cursor: isGenerating ? "wait" : "pointer" }}>
            {isGenerating ? "⏳ Обновляю…" : "🔄 Актуализировать"}
          </button>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Рекомендуем раз в месяц</div>
        </div>
      </div>

      {data.summary && (
        <div style={{ background: "color-mix(in oklch, var(--primary) 3%, transparent)", borderRadius: 12, padding: "14px 18px", border: `1px solid var(--primary)20`, marginBottom: 24, fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6 }}>
          {data.summary}
        </div>
      )}

      {/* Overall score block */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Ваш Score", value: ob.companyScore, color: "var(--primary)", big: true },
          { label: "Среднее по нише", value: ob.nicheAverage, color: "var(--foreground-secondary)" },
          { label: "Лидер рынка", value: ob.nicheLeader, color: "var(--success)" },
          { label: "Нижняя граница", value: ob.nicheBottom, color: "var(--destructive)" },
          { label: "Перцентиль", value: ob.percentile ? `${ob.percentile}%` : "—", color: "var(--warning)" },
        ].map((item, i) => (
          <div key={i} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: "16px 18px", boxShadow: "var(--shadow)", textAlign: "center" }}>
            <div style={{ fontSize: item.big ? 28 : 22, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.value ?? "—"}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>{item.label}</div>
          </div>
        ))}
        {ob.verdict && (
          <div style={{ background: verdictColor(ob.verdict) + "12", borderRadius: 14, border: `2px solid ${verdictColor(ob.verdict)}30`, padding: "16px 18px", boxShadow: "var(--shadow)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: verdictColor(ob.verdict) }}>{ob.verdict}</div>
          </div>
        )}
      </div>

      {/* Category benchmarks */}
      {catBench.length > 0 && (
        <CollapsibleSection c={c} title="📈 Бенчмарки по категориям">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {catBench.map((cat, i) => {
              const gapPositive = (cat.gap ?? 0) >= 0;
              const barWidth = Math.min(100, Math.max(2, cat.companyScore ?? 0));
              const avgBarWidth = Math.min(100, Math.max(2, cat.nicheAverage ?? 0));
              return (
                <div key={i} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 18px", border: `1px solid var(--border)`, boxShadow: "var(--shadow)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>{cat.icon} {cat.categoryName}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: gapPositive ? "var(--success)" : "var(--destructive)" }}>
                        {gapPositive ? "+" : ""}{cat.gap}
                      </span>
                      <span style={{ fontSize: 10, background: (cat.priority === "high" ? "var(--destructive)" : cat.priority === "medium" ? "var(--warning)" : "var(--success)") + "15", padding: "2px 8px", borderRadius: 6, fontWeight: 600, color: cat.priority === "high" ? "var(--destructive)" : cat.priority === "medium" ? "var(--warning)" : "var(--success)" }}>
                        {cat.priority === "high" ? "Высокий приоритет" : cat.priority === "medium" ? "Средний" : "Низкий"}
                      </span>
                    </div>
                  </div>
                  {/* Bar comparison */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--primary)", width: 50, flexShrink: 0, fontWeight: 600 }}>Вы {cat.companyScore}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barWidth}%`, background: "var(--primary)", borderRadius: 3, transition: "width 0.5s" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--muted-foreground)", width: 50, flexShrink: 0 }}>Avg {cat.nicheAverage}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${avgBarWidth}%`, background: "var(--muted-foreground)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                  {cat.insight && <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.4, paddingLeft: 10, borderLeft: `2px solid var(--primary)30` }}>{cat.insight}</div>}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Market metrics */}
      {mktMetrics.length > 0 && (
        <CollapsibleSection c={c} title="💹 Рыночные метрики">
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--background)" }}>
                  {["Метрика", "Среднее по нише", "Топ-игроки", "Ваша оценка"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mktMetrics.map((m, i) => (
                  <tr key={i} style={{ borderBottom: i < mktMetrics.length - 1 ? `1px solid var(--muted)` : "none" }}>
                    <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 600 }}>{m.icon} {m.metric}</td>
                    <td style={{ padding: "10px 16px", color: "var(--foreground-secondary)" }}>{m.nicheAverage}</td>
                    <td style={{ padding: "10px 16px", color: "var(--success)", fontWeight: 600 }}>{m.topPlayers}</td>
                    <td style={{ padding: "10px 16px", color: "var(--primary)", fontWeight: 600 }}>{m.yourEstimate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Growth opportunities */}
      {growthOps.length > 0 && (
        <CollapsibleSection c={c} title="🚀 Точки роста">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
            {growthOps.map((op, i) => {
              const impactColor = op.potentialImpact === "high" ? "var(--success)" : op.potentialImpact === "medium" ? "var(--warning)" : "var(--muted-foreground)";
              const effortColor = op.effort === "low" ? "var(--success)" : op.effort === "medium" ? "var(--warning)" : "var(--destructive)";
              return (
                <div key={i} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 18, boxShadow: "var(--shadow)" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{op.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>{op.title}</div>
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5, marginBottom: 10 }}>{op.description}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: impactColor, background: impactColor + "12", padding: "2px 8px", borderRadius: 6 }}>
                      Эффект: {op.potentialImpact === "high" ? "Высокий" : op.potentialImpact === "medium" ? "Средний" : "Низкий"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: effortColor, background: effortColor + "12", padding: "2px 8px", borderRadius: 6 }}>
                      Усилия: {op.effort === "low" ? "Низкие" : op.effort === "medium" ? "Средние" : "Высокие"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Niche insights */}
      {(data.nicheInsights ?? []).length > 0 && (
        <CollapsibleSection c={c} title="🔭 Инсайты по нише">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {(data.nicheInsights as string[]).map((ins, i) => (
              <div key={i} style={{ background: "var(--card)", borderRadius: 12, padding: "12px 16px", border: `1px solid var(--border)`, fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--primary)", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                {ins}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
