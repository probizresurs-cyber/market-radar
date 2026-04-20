"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { RadarChart } from "@/components/ui/RadarChart";

export function CompareView({ c, myCompany, competitors }: { c: Colors; myCompany: AnalysisResult | null; competitors: AnalysisResult[] }) {
  const [aiInsights, setAiInsights] = useState<null | { positioning: string; keyInsight: string; battleCards: Array<{ competitorName: string; youWin: string[]; theyWin: string[]; mainThreat: string; mainOpportunity: string; verdict: string; verdictColor: string }>; strategicRecs: string[]; marketGaps: string[]; seoGaps: string[] }>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!myCompany) return <div style={{ color: "var(--muted-foreground)", fontSize: 14 }}>Сначала проанализируйте свой сайт</div>;

  // Load offers from localStorage for all companies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadCachedOffers = (comp: AnalysisResult): any | null => {
    try {
      const key = `mr_offers_${comp.company.url || comp.company.name}`;
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  };

  const handleGenerateInsights = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/generate-competitor-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myCompany, competitors }),
      });
      const json = await res.json();
      if (json.ok) setAiInsights(json.data);
      else setAiError(json.error ?? "Ошибка генерации");
    } catch { setAiError("Ошибка сети"); }
    setAiLoading(false);
  };

  const trendIcon = (trend: string) => trend === "growing" ? "↑" : trend === "declining" ? "↓" : "→";
  const trendColor = (trend: string) => trend === "growing" ? "var(--success)" : trend === "declining" ? "var(--destructive)" : "var(--muted-foreground)";

  const allCols = [myCompany, ...competitors];
  const catNames = myCompany.company.categories.map(cat => cat.name);
  const rows = [
    { label: "Score", key: "score" },
    ...catNames.map((name, i) => ({ label: name, catIndex: i })),
  ];

  const getCellValue = (entity: AnalysisResult, row: typeof rows[number]): number => {
    if ('key' in row && row.key === "score") return entity.company.score;
    if ('catIndex' in row && row.catIndex !== undefined) return entity.company.categories[row.catIndex]?.score ?? 0;
    return 0;
  };

  const getMax = (row: typeof rows[number]) => Math.max(...allCols.map(e => getCellValue(e, row)));
  const getMin = (row: typeof rows[number]) => Math.min(...allCols.map(e => getCellValue(e, row)));

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>Сравнение</h1>

      {competitors.length === 0 ? (
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 40, textAlign: "center", boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Добавьте конкурентов для сравнения</div>
          <div style={{ fontSize: 13, color: "var(--foreground-secondary)" }}>Перейдите в раздел «Конкуренты» и добавьте сайты</div>
        </div>
      ) : (
        <>
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "auto", boxShadow: "var(--shadow)", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "14px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", position: "sticky", left: 0, background: "var(--card)", minWidth: 120 }}>
                    МЕТРИКА
                  </th>
                  {allCols.map((entity, i) => (
                    <th key={i} style={{ textAlign: "center", padding: "14px 12px", borderBottom: `2px solid var(--border)`, fontWeight: 600, fontSize: 12, color: i === 0 ? "var(--primary)" : "var(--foreground)", background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent", minWidth: 120 }}>
                      {i === 0 ? "Вы" : entity.company.name.length > 18 ? entity.company.name.slice(0, 18) + "…" : entity.company.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const maxVal = getMax(row);
                  const minVal = getMin(row);
                  return (
                    <tr key={ri}>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", position: "sticky", left: 0, background: "var(--card)" }}>
                        {row.label}
                      </td>
                      {allCols.map((entity, i) => {
                        const val = getCellValue(entity, row);
                        const isBest = val === maxVal && allCols.length > 1;
                        const isWorst = val === minVal && allCols.length > 1 && val !== maxVal;
                        return (
                          <td key={i} style={{
                            textAlign: "center", padding: "12px", borderBottom: `1px solid var(--muted)`,
                            fontWeight: isBest ? 700 : 400,
                            color: isBest ? "var(--success)" : isWorst ? "var(--destructive)" : "var(--foreground)",
                            background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent",
                          }}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Divider */}
                <tr><td colSpan={allCols.length + 1} style={{ padding: "4px 16px", background: "var(--sidebar-bg)", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>ФАКТИЧЕСКИЕ МЕТРИКИ</td></tr>
                {/* SEO Traffic */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>🔍 SEO-трафик</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, color: "var(--foreground)", background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                      {e.seo.estimatedTraffic || "—"}
                    </td>
                  ))}
                </tr>
                {/* Domain age */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>📅 Возраст домена</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, color: "var(--foreground)", background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                      {e.seo.archiveAgeYears ? `${e.seo.archiveAgeYears} лет` : e.seo.domainAge || "—"}
                    </td>
                  ))}
                </tr>
                {/* PageSpeed */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>⚡ PageSpeed</td>
                  {allCols.map((e, i) => {
                    const ps = e.seo.lighthouseScores?.performance;
                    const psColor = ps === undefined ? "var(--muted-foreground)" : ps >= 80 ? "var(--success)" : ps >= 50 ? "var(--warning)" : "var(--destructive)";
                    return (
                      <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, fontWeight: ps !== undefined ? 600 : 400, color: psColor, background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                        {ps !== undefined ? `${ps}/100` : "—"}
                      </td>
                    );
                  })}
                </tr>
                {/* Vacancies */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>👔 Вакансии</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, color: "var(--foreground)", background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                      {e.hiring.openVacancies > 0 ? `${e.hiring.openVacancies} ` : "0 "}
                      <span style={{ color: trendColor(e.hiring.trend), fontWeight: 700 }}>{trendIcon(e.hiring.trend)}</span>
                    </td>
                  ))}
                </tr>
                {/* Yandex rating */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>🗺️ Яндекс.Карты</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, color: e.social.yandexRating >= 4.5 ? "var(--success)" : e.social.yandexRating >= 3.5 ? "var(--warning)" : e.social.yandexRating > 0 ? "var(--destructive)" : "var(--muted-foreground)", fontWeight: e.social.yandexRating > 0 ? 600 : 400, background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                      {e.social.yandexRating > 0 ? `${e.social.yandexRating}★ (${e.social.yandexReviews})` : "—"}
                    </td>
                  ))}
                </tr>
                {/* 2GIS rating */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>📍 2GIS</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, color: e.social.gisRating >= 4.5 ? "var(--success)" : e.social.gisRating >= 3.5 ? "var(--warning)" : e.social.gisRating > 0 ? "var(--destructive)" : "var(--muted-foreground)", fontWeight: e.social.gisRating > 0 ? 600 : 400, background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                      {e.social.gisRating > 0 ? `${e.social.gisRating}★ (${e.social.gisReviews})` : "—"}
                    </td>
                  ))}
                </tr>
                {/* VK */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 500, color: "var(--foreground-secondary)", fontSize: 12, position: "sticky", left: 0, background: "var(--card)" }}>💙 ВКонтакте</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontSize: 12, color: "var(--foreground)", background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                      {e.social.vk ? `${e.social.vk.subscribers.toLocaleString("ru")} ` : "—"}
                      {e.social.vk && <span style={{ color: trendColor(e.social.vk.trend), fontWeight: 700 }}>{trendIcon(e.social.vk.trend)}</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Radar comparison */}
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.03em" }}>RADAR CHART</div>
            <RadarChart data={myCompany.company} competitors={competitors.map(c2 => c2.company)} c={c} size={280} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--primary)" }} /> Вы</span>
              {competitors.map((comp, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--foreground-secondary)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: ["var(--destructive)", "var(--warning)", "var(--success)", "var(--warning)", "var(--primary)"][i % 5] }} />
                  {comp.company.name.length > 15 ? comp.company.name.slice(0, 15) + "…" : comp.company.name}
                </span>
              ))}
            </div>
          </div>

          {/* Detailed SWOT per competitor */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 16 }}>⚔️ Анализ сильных и слабых сторон</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {competitors.map((comp, ci) => {
                const compColor = ["var(--destructive)", "var(--warning)", "var(--success)", "var(--warning)", "var(--primary)"][ci % 5];
                const myStrong = myCompany.company.categories.filter(cat => {
                  const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                  return cat.score > (compCat?.score ?? 0) + 5;
                });
                const myWeak = myCompany.company.categories.filter(cat => {
                  const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                  return cat.score < (compCat?.score ?? 0) - 5;
                });
                return (
                  <div key={ci} style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: compColor, flexShrink: 0 }} />
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>
                        Вы vs {comp.company.name}
                      </div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)" }}>
                        {myCompany.company.score} vs {comp.company.score} очков
                        {myCompany.company.score > comp.company.score
                          ? <span style={{ color: "var(--success)", fontWeight: 700 }}> (+{myCompany.company.score - comp.company.score})</span>
                          : myCompany.company.score < comp.company.score
                            ? <span style={{ color: "var(--destructive)", fontWeight: 700 }}> ({myCompany.company.score - comp.company.score})</span>
                            : <span style={{ color: "var(--muted-foreground)" }}> (=)</span>
                        }
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>💪 ВЫ ЛУЧШЕ В</div>
                        {myStrong.length > 0 ? myStrong.map(cat => {
                          const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                          return (
                            <div key={cat.name} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 6, display: "flex", justifyContent: "space-between", padding: "5px 10px", background: "color-mix(in oklch, var(--success) 3%, transparent)", borderRadius: 6 }}>
                              <span>{cat.icon} {cat.name}</span>
                              <span style={{ fontWeight: 700 }}><span style={{ color: "var(--success)" }}>{cat.score}</span> vs {compCat?.score ?? "—"}</span>
                            </div>
                          );
                        }) : <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Нет явного преимущества</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 8 }}>⚠️ КОНКУРЕНТ ЛУЧШЕ В</div>
                        {myWeak.length > 0 ? myWeak.map(cat => {
                          const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                          return (
                            <div key={cat.name} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 6, display: "flex", justifyContent: "space-between", padding: "5px 10px", background: "color-mix(in oklch, var(--destructive) 3%, transparent)", borderRadius: 6 }}>
                              <span>{cat.icon} {cat.name}</span>
                              <span style={{ fontWeight: 700 }}><span style={{ color: "var(--destructive)" }}>{cat.score}</span> vs {compCat?.score ?? "—"}</span>
                            </div>
                          );
                        }) : <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Нет слабых мест</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEO Keywords comparison */}
          {(() => {
            const allKeywords = new Map<string, Map<string, number>>();
            allCols.forEach(entity => {
              (entity.seo.positions ?? []).slice(0, 10).forEach(pos => {
                if (!allKeywords.has(pos.keyword)) allKeywords.set(pos.keyword, new Map());
                allKeywords.get(pos.keyword)!.set(entity.company.name, pos.position);
              });
            });
            const keywords = Array.from(allKeywords.entries()).slice(0, 15);
            if (keywords.length === 0) return null;
            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 16 }}>🔑 Сравнение SEO-позиций</div>
                <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "auto", boxShadow: "var(--shadow)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", position: "sticky", left: 0, background: "var(--card)" }}>КЛЮЧЕВОЕ СЛОВО</th>
                        {allCols.map((e, i) => (
                          <th key={i} style={{ textAlign: "center", padding: "12px", borderBottom: `2px solid var(--border)`, fontWeight: 600, fontSize: 11, color: i === 0 ? "var(--primary)" : "var(--foreground)", minWidth: 90 }}>
                            {i === 0 ? "Вы" : e.company.name.length > 14 ? e.company.name.slice(0, 14) + "…" : e.company.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map(([kw, posMap], ki) => (
                        <tr key={ki}>
                          <td style={{ padding: "9px 16px", borderBottom: `1px solid var(--muted)`, color: "var(--foreground-secondary)", position: "sticky", left: 0, background: "var(--card)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kw}</td>
                          {allCols.map((e, i) => {
                            const pos = posMap.get(e.company.name);
                            const posColor = pos === undefined ? "var(--muted-foreground)" : pos <= 3 ? "var(--success)" : pos <= 10 ? "var(--warning)" : "var(--foreground-secondary)";
                            return (
                              <td key={i} style={{ textAlign: "center", padding: "9px 12px", borderBottom: `1px solid var(--muted)`, color: posColor, fontWeight: pos !== undefined && pos <= 10 ? 700 : 400, background: i === 0 ? "color-mix(in oklch, var(--primary) 3%, transparent)" : "transparent" }}>
                                {pos !== undefined ? `#${pos}` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6, paddingLeft: 4 }}>
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>Зелёный</span> = ТОП-3 · <span style={{ color: "var(--warning)", fontWeight: 700 }}>Жёлтый</span> = ТОП-10 · «—» = нет в выдаче
                </div>
              </div>
            );
          })()}

          {/* AI Competitive Intelligence */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>🤖 AI Конкурентная разведка</div>
              {!aiInsights && (
                <button
                  onClick={handleGenerateInsights}
                  disabled={aiLoading}
                  style={{ padding: "8px 20px", background: aiLoading ? "var(--sidebar-bg)" : "var(--primary)", color: aiLoading ? "var(--muted-foreground)" : "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: aiLoading ? "not-allowed" : "pointer" }}
                >
                  {aiLoading ? "⏳ Анализирую…" : "✨ Сгенерировать анализ"}
                </button>
              )}
              {aiInsights && (
                <div style={{ textAlign: "right" }}>
                <button onClick={handleGenerateInsights} disabled={aiLoading} style={{ padding: "6px 14px", background: "transparent", color: "var(--muted-foreground)", border: `1px solid var(--border)`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                  🔄 Актуализировать
                </button>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Рекомендуем раз в 2 недели</div>
              </div>
              )}
            </div>
            {aiError && <div style={{ fontSize: 13, color: "var(--destructive)", padding: "10px 14px", background: "color-mix(in oklch, var(--destructive) 6%, transparent)", borderRadius: 10, marginBottom: 12 }}>{aiError}</div>}
            {!aiInsights && !aiLoading && (
              <div style={{ background: "var(--card)", borderRadius: 16, border: `1px dashed var(--border)`, padding: 32, textAlign: "center", boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground-secondary)", marginBottom: 6 }}>Claude проведёт глубокий анализ</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Батл-карты, стратегические рекомендации, пробелы рынка и SEO-гэпы</div>
              </div>
            )}
            {aiInsights && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Positioning + key insight */}
                <div style={{ background: "color-mix(in oklch, var(--primary) 6%, transparent)", borderRadius: 16, border: `1px solid var(--primary)30`, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 8, letterSpacing: "0.04em" }}>📍 ПОЗИЦИОНИРОВАНИЕ</div>
                  <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.6, marginBottom: 10 }}>{aiInsights.positioning}</div>
                  {aiInsights.keyInsight && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", background: "var(--card)", padding: "8px 14px", borderRadius: 8, borderLeft: `3px solid var(--primary)` }}>
                      💡 {aiInsights.keyInsight}
                    </div>
                  )}
                </div>

                {/* Battle cards */}
                {(aiInsights.battleCards ?? []).map((card, ci) => {
                  const compColor = ["var(--destructive)", "var(--warning)", "var(--success)", "var(--warning)"][ci % 4];
                  const verdictBg = card.verdictColor === "green" ? "var(--success)" : card.verdictColor === "red" ? "var(--destructive)" : "var(--warning)";
                  return (
                    <div key={ci} style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: compColor, flexShrink: 0 }} />
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>Вы vs {card.competitorName}</div>
                        <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fff", background: verdictBg, padding: "3px 10px", borderRadius: 20 }}>
                          {card.verdict}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>✅ ВЫ ВЫИГРЫВАЕТЕ</div>
                          {(card.youWin ?? []).map((w, i) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5, paddingLeft: 8, borderLeft: `2px solid var(--success)`, lineHeight: 1.4 }}>{w}</div>)}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 6 }}>❌ ОНИ ВЫИГРЫВАЮТ</div>
                          {(card.theyWin ?? []).map((w, i) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5, paddingLeft: 8, borderLeft: `2px solid var(--destructive)`, lineHeight: 1.4 }}>{w}</div>)}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ background: "color-mix(in oklch, var(--destructive) 3%, transparent)", borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 4 }}>⚠️ УГРОЗА</div>
                          <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.4 }}>{card.mainThreat}</div>
                        </div>
                        <div style={{ background: "color-mix(in oklch, var(--success) 3%, transparent)", borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>🎯 ВОЗМОЖНОСТЬ</div>
                          <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.4 }}>{card.mainOpportunity}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Strategic recs + market gaps + SEO gaps */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 16, boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 10, letterSpacing: "0.04em" }}>🎯 СТРАТЕГИЯ</div>
                    {(aiInsights.strategicRecs ?? []).map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: "var(--primary)", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{r}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 16, boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 10, letterSpacing: "0.04em" }}>💡 ПРОБЕЛЫ РЫНКА</div>
                    {(aiInsights.marketGaps ?? []).map((g, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: "var(--success)", flexShrink: 0 }}>○</span>{g}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 16, boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", marginBottom: 10, letterSpacing: "0.04em" }}>🔍 SEO-ГЭПЫ</div>
                    {(aiInsights.seoGaps ?? []).map((g, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: "var(--warning)", flexShrink: 0 }}>○</span>{g}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Offers comparison table */}
          {(() => {
            const myOffers = loadCachedOffers(myCompany);
            const competitorOffersList = competitors.map(comp => ({ comp, offers: loadCachedOffers(comp) }));
            if (!myOffers && competitorOffersList.every(x => !x.offers)) return null;

            // Build rows: each row is a parameter with values per column
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const getOfferRows = (offers: any | null) => {
              if (!offers) return { valueProposition: "—", pricingStrategy: "—", strengths: [], weaknesses: [], missingOffers: [] };
              return {
                valueProposition: offers.mainValueProposition ?? "—",
                pricingStrategy: offers.pricingStrategy ?? "—",
                strengths: (offers.strengths ?? []).slice(0, 3) as string[],
                weaknesses: (offers.weaknesses ?? []).slice(0, 3) as string[],
                missingOffers: (offers.missingOffers ?? []).slice(0, 3) as string[],
              };
            };

            const myData = getOfferRows(myOffers);
            const compDataList = competitorOffersList.map(x => getOfferRows(x.offers));
            const compColors = ["var(--destructive)", "var(--warning)", "var(--success)", "var(--warning)"];

            const rows: Array<{ param: string; myVal: string | string[]; compVals: Array<string | string[]>; isList?: boolean }> = [
              { param: "Ценностное предложение", myVal: myData.valueProposition, compVals: compDataList.map(d => d.valueProposition) },
              { param: "Ценовая стратегия", myVal: myData.pricingStrategy, compVals: compDataList.map(d => d.pricingStrategy) },
              { param: "Сильные стороны", myVal: myData.strengths, compVals: compDataList.map(d => d.strengths), isList: true },
              { param: "Слабые стороны", myVal: myData.weaknesses, compVals: compDataList.map(d => d.weaknesses), isList: true },
              { param: "Чего не хватает", myVal: myData.missingOffers, compVals: compDataList.map(d => d.missingOffers), isList: true },
            ];

            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 16 }}>🏷️ Сравнение офферов</div>
                <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid var(--border)`, boxShadow: "var(--shadow)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--background)" }}>
                        <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", width: 160 }}>ПАРАМЕТР</th>
                        <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid var(--border)`, color: "var(--primary)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em" }}>
                          ВЫ — {myCompany.company.name.length > 20 ? myCompany.company.name.slice(0, 20) + "…" : myCompany.company.name}
                        </th>
                        {competitors.map((comp, ci) => (
                          <th key={ci} style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid var(--border)`, color: compColors[ci % 4], fontWeight: 700, fontSize: 11, letterSpacing: "0.05em" }}>
                            {comp.company.name.length > 20 ? comp.company.name.slice(0, 20) + "…" : comp.company.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? "var(--card)" : "var(--muted)" }}>
                          <td style={{ padding: "12px 16px", borderBottom: `1px solid var(--border)`, fontWeight: 700, fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.03em", verticalAlign: "top" }}>
                            {row.param}
                          </td>
                          <td style={{ padding: "12px 16px", borderBottom: `1px solid var(--border)`, color: "var(--foreground)", verticalAlign: "top" }}>
                            {row.isList ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {(row.myVal as string[]).length > 0
                                  ? (row.myVal as string[]).map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", paddingLeft: 8, borderLeft: `2px solid var(--primary)` }}>{s}</div>)
                                  : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>—</span>}
                              </div>
                            ) : (
                              <span style={{ fontSize: 13, lineHeight: 1.45 }}>{row.myVal as string}</span>
                            )}
                          </td>
                          {compDataList.map((_, ci) => (
                            <td key={ci} style={{ padding: "12px 16px", borderBottom: `1px solid var(--border)`, color: "var(--foreground)", verticalAlign: "top" }}>
                              {competitorOffersList[ci].offers ? (
                                row.isList ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {(row.compVals[ci] as string[]).length > 0
                                      ? (row.compVals[ci] as string[]).map((s, i) => <div key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", paddingLeft: 8, borderLeft: `2px solid ${compColors[ci % 4]}` }}>{s}</div>)
                                      : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>—</span>}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 13, lineHeight: 1.45 }}>{row.compVals[ci] as string}</span>
                                )
                              ) : (
                                <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Не загружено</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Missing offers hint */}
                {myOffers?.missingOffers?.length > 0 && (
                  <div style={{ marginTop: 14, background: "color-mix(in oklch, var(--warning) 3%, transparent)", borderRadius: 12, padding: 16, border: `1px solid var(--warning)25` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)", marginBottom: 8 }}>💡 Что добавить в ваши офферы</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(myOffers.missingOffers ?? []).map((m: string, i: number) => (
                        <span key={i} style={{ fontSize: 12, color: "var(--foreground-secondary)", background: "var(--card)", padding: "4px 12px", borderRadius: 20, border: `1px solid var(--border)` }}>{m}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
