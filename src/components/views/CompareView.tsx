"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { RadarChart } from "@/components/ui/RadarChart";

export function CompareView({ c, myCompany, competitors }: { c: Colors; myCompany: AnalysisResult | null; competitors: AnalysisResult[] }) {
  const [aiInsights, setAiInsights] = useState<null | { positioning: string; keyInsight: string; battleCards: Array<{ competitorName: string; youWin: string[]; theyWin: string[]; mainThreat: string; mainOpportunity: string; verdict: string; verdictColor: string }>; strategicRecs: string[]; marketGaps: string[]; seoGaps: string[] }>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!myCompany) return <div style={{ color: c.textMuted, fontSize: 14 }}>Сначала проанализируйте свой сайт</div>;

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
  const trendColor = (trend: string) => trend === "growing" ? c.accentGreen : trend === "declining" ? c.accentRed : c.textMuted;

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
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Сравнение</h1>

      {competitors.length === 0 ? (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Добавьте конкурентов для сравнения</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Перейдите в раздел «Конкуренты» и добавьте сайты</div>
        </div>
      ) : (
        <>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "auto", boxShadow: c.shadow, marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "14px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", position: "sticky", left: 0, background: c.bgCard, minWidth: 120 }}>
                    МЕТРИКА
                  </th>
                  {allCols.map((entity, i) => (
                    <th key={i} style={{ textAlign: "center", padding: "14px 12px", borderBottom: `2px solid ${c.border}`, fontWeight: 600, fontSize: 12, color: i === 0 ? c.accent : c.textPrimary, background: i === 0 ? c.accent + "08" : "transparent", minWidth: 120 }}>
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
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, position: "sticky", left: 0, background: c.bgCard }}>
                        {row.label}
                      </td>
                      {allCols.map((entity, i) => {
                        const val = getCellValue(entity, row);
                        const isBest = val === maxVal && allCols.length > 1;
                        const isWorst = val === minVal && allCols.length > 1 && val !== maxVal;
                        return (
                          <td key={i} style={{
                            textAlign: "center", padding: "12px", borderBottom: `1px solid ${c.borderLight}`,
                            fontWeight: isBest ? 700 : 400,
                            color: isBest ? c.accentGreen : isWorst ? c.accentRed : c.textPrimary,
                            background: i === 0 ? c.accent + "08" : "transparent",
                          }}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Divider */}
                <tr><td colSpan={allCols.length + 1} style={{ padding: "4px 16px", background: c.bgSidebar, fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>ФАКТИЧЕСКИЕ МЕТРИКИ</td></tr>
                {/* SEO Traffic */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>🔍 SEO-трафик</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, color: c.textPrimary, background: i === 0 ? c.accent + "08" : "transparent" }}>
                      {e.seo.estimatedTraffic || "—"}
                    </td>
                  ))}
                </tr>
                {/* Domain age */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>📅 Возраст домена</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, color: c.textPrimary, background: i === 0 ? c.accent + "08" : "transparent" }}>
                      {e.seo.archiveAgeYears ? `${e.seo.archiveAgeYears} лет` : e.seo.domainAge || "—"}
                    </td>
                  ))}
                </tr>
                {/* PageSpeed */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>⚡ PageSpeed</td>
                  {allCols.map((e, i) => {
                    const ps = e.seo.lighthouseScores?.performance;
                    const psColor = ps === undefined ? c.textMuted : ps >= 80 ? c.accentGreen : ps >= 50 ? c.accentYellow : c.accentRed;
                    return (
                      <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, fontWeight: ps !== undefined ? 600 : 400, color: psColor, background: i === 0 ? c.accent + "08" : "transparent" }}>
                        {ps !== undefined ? `${ps}/100` : "—"}
                      </td>
                    );
                  })}
                </tr>
                {/* Vacancies */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>👔 Вакансии</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, color: c.textPrimary, background: i === 0 ? c.accent + "08" : "transparent" }}>
                      {e.hiring.openVacancies > 0 ? `${e.hiring.openVacancies} ` : "0 "}
                      <span style={{ color: trendColor(e.hiring.trend), fontWeight: 700 }}>{trendIcon(e.hiring.trend)}</span>
                    </td>
                  ))}
                </tr>
                {/* Yandex rating */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>🗺️ Яндекс.Карты</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, color: e.social.yandexRating >= 4.5 ? c.accentGreen : e.social.yandexRating >= 3.5 ? c.accentYellow : e.social.yandexRating > 0 ? c.accentRed : c.textMuted, fontWeight: e.social.yandexRating > 0 ? 600 : 400, background: i === 0 ? c.accent + "08" : "transparent" }}>
                      {e.social.yandexRating > 0 ? `${e.social.yandexRating}★ (${e.social.yandexReviews})` : "—"}
                    </td>
                  ))}
                </tr>
                {/* 2GIS rating */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>📍 2GIS</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, color: e.social.gisRating >= 4.5 ? c.accentGreen : e.social.gisRating >= 3.5 ? c.accentYellow : e.social.gisRating > 0 ? c.accentRed : c.textMuted, fontWeight: e.social.gisRating > 0 ? 600 : 400, background: i === 0 ? c.accent + "08" : "transparent" }}>
                      {e.social.gisRating > 0 ? `${e.social.gisRating}★ (${e.social.gisReviews})` : "—"}
                    </td>
                  ))}
                </tr>
                {/* VK */}
                <tr>
                  <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, fontSize: 12, position: "sticky", left: 0, background: c.bgCard }}>💙 ВКонтакте</td>
                  {allCols.map((e, i) => (
                    <td key={i} style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12, color: c.textPrimary, background: i === 0 ? c.accent + "08" : "transparent" }}>
                      {e.social.vk ? `${e.social.vk.subscribers.toLocaleString("ru")} ` : "—"}
                      {e.social.vk && <span style={{ color: trendColor(e.social.vk.trend), fontWeight: 700 }}>{trendIcon(e.social.vk.trend)}</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Radar comparison */}
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>RADAR CHART</div>
            <RadarChart data={myCompany.company} competitors={competitors.map(c2 => c2.company)} c={c} size={280} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> Вы</span>
              {competitors.map((comp, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: c.textSecondary }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm, c.accent][i % 5] }} />
                  {comp.company.name.length > 15 ? comp.company.name.slice(0, 15) + "…" : comp.company.name}
                </span>
              ))}
            </div>
          </div>

          {/* Detailed SWOT per competitor */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 16 }}>⚔️ Анализ сильных и слабых сторон</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {competitors.map((comp, ci) => {
                const compColor = [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm, c.accent][ci % 5];
                const myStrong = myCompany.company.categories.filter(cat => {
                  const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                  return cat.score > (compCat?.score ?? 0) + 5;
                });
                const myWeak = myCompany.company.categories.filter(cat => {
                  const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                  return cat.score < (compCat?.score ?? 0) - 5;
                });
                return (
                  <div key={ci} style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: compColor, flexShrink: 0 }} />
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>
                        Вы vs {comp.company.name}
                      </div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: c.textMuted }}>
                        {myCompany.company.score} vs {comp.company.score} очков
                        {myCompany.company.score > comp.company.score
                          ? <span style={{ color: c.accentGreen, fontWeight: 700 }}> (+{myCompany.company.score - comp.company.score})</span>
                          : myCompany.company.score < comp.company.score
                            ? <span style={{ color: c.accentRed, fontWeight: 700 }}> ({myCompany.company.score - comp.company.score})</span>
                            : <span style={{ color: c.textMuted }}> (=)</span>
                        }
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 8 }}>💪 ВЫ ЛУЧШЕ В</div>
                        {myStrong.length > 0 ? myStrong.map(cat => {
                          const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                          return (
                            <div key={cat.name} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 6, display: "flex", justifyContent: "space-between", padding: "5px 10px", background: c.accentGreen + "08", borderRadius: 6 }}>
                              <span>{cat.icon} {cat.name}</span>
                              <span style={{ fontWeight: 700 }}><span style={{ color: c.accentGreen }}>{cat.score}</span> vs {compCat?.score ?? "—"}</span>
                            </div>
                          );
                        }) : <div style={{ fontSize: 12, color: c.textMuted }}>Нет явного преимущества</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 8 }}>⚠️ КОНКУРЕНТ ЛУЧШЕ В</div>
                        {myWeak.length > 0 ? myWeak.map(cat => {
                          const compCat = comp.company.categories.find(cc => cc.name === cat.name);
                          return (
                            <div key={cat.name} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 6, display: "flex", justifyContent: "space-between", padding: "5px 10px", background: c.accentRed + "08", borderRadius: 6 }}>
                              <span>{cat.icon} {cat.name}</span>
                              <span style={{ fontWeight: 700 }}><span style={{ color: c.accentRed }}>{cat.score}</span> vs {compCat?.score ?? "—"}</span>
                            </div>
                          );
                        }) : <div style={{ fontSize: 12, color: c.textMuted }}>Нет слабых мест</div>}
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
                <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 16 }}>🔑 Сравнение SEO-позиций</div>
                <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "auto", boxShadow: c.shadow }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", position: "sticky", left: 0, background: c.bgCard }}>КЛЮЧЕВОЕ СЛОВО</th>
                        {allCols.map((e, i) => (
                          <th key={i} style={{ textAlign: "center", padding: "12px", borderBottom: `2px solid ${c.border}`, fontWeight: 600, fontSize: 11, color: i === 0 ? c.accent : c.textPrimary, minWidth: 90 }}>
                            {i === 0 ? "Вы" : e.company.name.length > 14 ? e.company.name.slice(0, 14) + "…" : e.company.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map(([kw, posMap], ki) => (
                        <tr key={ki}>
                          <td style={{ padding: "9px 16px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, position: "sticky", left: 0, background: c.bgCard, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kw}</td>
                          {allCols.map((e, i) => {
                            const pos = posMap.get(e.company.name);
                            const posColor = pos === undefined ? c.textMuted : pos <= 3 ? c.accentGreen : pos <= 10 ? c.accentYellow : c.textSecondary;
                            return (
                              <td key={i} style={{ textAlign: "center", padding: "9px 12px", borderBottom: `1px solid ${c.borderLight}`, color: posColor, fontWeight: pos !== undefined && pos <= 10 ? 700 : 400, background: i === 0 ? c.accent + "08" : "transparent" }}>
                                {pos !== undefined ? `#${pos}` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: c.textMuted, marginTop: 6, paddingLeft: 4 }}>
                  <span style={{ color: c.accentGreen, fontWeight: 700 }}>Зелёный</span> = ТОП-3 · <span style={{ color: c.accentYellow, fontWeight: 700 }}>Жёлтый</span> = ТОП-10 · «—» = нет в выдаче
                </div>
              </div>
            );
          })()}

          {/* AI Competitive Intelligence */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>🤖 AI Конкурентная разведка</div>
              {!aiInsights && (
                <button
                  onClick={handleGenerateInsights}
                  disabled={aiLoading}
                  style={{ padding: "8px 20px", background: aiLoading ? c.bgSidebar : c.accent, color: aiLoading ? c.textMuted : "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: aiLoading ? "not-allowed" : "pointer" }}
                >
                  {aiLoading ? "⏳ Анализирую…" : "✨ Сгенерировать анализ"}
                </button>
              )}
              {aiInsights && (
                <button onClick={handleGenerateInsights} disabled={aiLoading} style={{ padding: "6px 14px", background: "transparent", color: c.textMuted, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                  🔄 Обновить
                </button>
              )}
            </div>
            {aiError && <div style={{ fontSize: 13, color: c.accentRed, padding: "10px 14px", background: c.accentRed + "10", borderRadius: 10, marginBottom: 12 }}>{aiError}</div>}
            {!aiInsights && !aiLoading && (
              <div style={{ background: c.bgCard, borderRadius: 16, border: `1px dashed ${c.border}`, padding: 32, textAlign: "center", boxShadow: c.shadow }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.textSecondary, marginBottom: 6 }}>Claude проведёт глубокий анализ</div>
                <div style={{ fontSize: 12, color: c.textMuted }}>Батл-карты, стратегические рекомендации, пробелы рынка и SEO-гэпы</div>
              </div>
            )}
            {aiInsights && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Positioning + key insight */}
                <div style={{ background: c.accent + "10", borderRadius: 16, border: `1px solid ${c.accent}30`, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, marginBottom: 8, letterSpacing: "0.04em" }}>📍 ПОЗИЦИОНИРОВАНИЕ</div>
                  <div style={{ fontSize: 14, color: c.textPrimary, lineHeight: 1.6, marginBottom: 10 }}>{aiInsights.positioning}</div>
                  {aiInsights.keyInsight && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.accent, background: c.bgCard, padding: "8px 14px", borderRadius: 8, borderLeft: `3px solid ${c.accent}` }}>
                      💡 {aiInsights.keyInsight}
                    </div>
                  )}
                </div>

                {/* Battle cards */}
                {(aiInsights.battleCards ?? []).map((card, ci) => {
                  const compColor = [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm][ci % 4];
                  const verdictBg = card.verdictColor === "green" ? c.accentGreen : card.verdictColor === "red" ? c.accentRed : c.accentYellow;
                  return (
                    <div key={ci} style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: compColor, flexShrink: 0 }} />
                        <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>Вы vs {card.competitorName}</div>
                        <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fff", background: verdictBg, padding: "3px 10px", borderRadius: 20 }}>
                          {card.verdict}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 6 }}>✅ ВЫ ВЫИГРЫВАЕТЕ</div>
                          {(card.youWin ?? []).map((w, i) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 5, paddingLeft: 8, borderLeft: `2px solid ${c.accentGreen}`, lineHeight: 1.4 }}>{w}</div>)}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 6 }}>❌ ОНИ ВЫИГРЫВАЮТ</div>
                          {(card.theyWin ?? []).map((w, i) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 5, paddingLeft: 8, borderLeft: `2px solid ${c.accentRed}`, lineHeight: 1.4 }}>{w}</div>)}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ background: c.accentRed + "08", borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 4 }}>⚠️ УГРОЗА</div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.4 }}>{card.mainThreat}</div>
                        </div>
                        <div style={{ background: c.accentGreen + "08", borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 4 }}>🎯 ВОЗМОЖНОСТЬ</div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.4 }}>{card.mainOpportunity}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Strategic recs + market gaps + SEO gaps */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, marginBottom: 10, letterSpacing: "0.04em" }}>🎯 СТРАТЕГИЯ</div>
                    {(aiInsights.strategicRecs ?? []).map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: c.accent, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{r}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 10, letterSpacing: "0.04em" }}>💡 ПРОБЕЛЫ РЫНКА</div>
                    {(aiInsights.marketGaps ?? []).map((g, i) => (
                      <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: c.accentGreen, flexShrink: 0 }}>○</span>{g}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.accentYellow, marginBottom: 10, letterSpacing: "0.04em" }}>🔍 SEO-ГЭПЫ</div>
                    {(aiInsights.seoGaps ?? []).map((g, i) => (
                      <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8, display: "flex", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: c.accentYellow, flexShrink: 0 }}>○</span>{g}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Offers comparison */}
          {(() => {
            const myOffers = loadCachedOffers(myCompany);
            const competitorOffers = competitors.map(comp => ({ comp, offers: loadCachedOffers(comp) })).filter(x => x.offers);
            if (!myOffers && competitorOffers.length === 0) return null;
            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 16 }}>🏷️ Сравнение офферов</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(allCols.length, 3)}, 1fr)`, gap: 14 }}>
                  {/* My company offers */}
                  <div style={{ background: c.bgCard, borderRadius: 14, border: `2px solid ${c.accent}40`, padding: 18, boxShadow: c.shadow }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 12 }}>ВЫ — {myCompany.company.name}</div>
                    {myOffers ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, marginBottom: 6, lineHeight: 1.4 }}>{myOffers.mainValueProposition}</div>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 10 }}>{myOffers.pricingStrategy}</div>
                        {(myOffers.strengths ?? []).slice(0, 3).map((s: string, i: number) => (
                          <div key={i} style={{ fontSize: 11, color: c.textSecondary, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${c.accentGreen}` }}>✓ {s}</div>
                        ))}
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: c.textMuted }}>Офферы не загружены. Откройте «Дашборд» для загрузки.</div>
                    )}
                  </div>
                  {/* Competitor offers */}
                  {competitors.map((comp, ci) => {
                    const compOffers = loadCachedOffers(comp);
                    const compColor = [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm][ci % 4];
                    return (
                      <div key={ci} style={{ background: c.bgCard, borderRadius: 14, border: `2px solid ${compColor}30`, padding: 18, boxShadow: c.shadow }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: compColor, marginBottom: 12 }}>
                          {comp.company.name.length > 20 ? comp.company.name.slice(0, 20) + "…" : comp.company.name}
                        </div>
                        {compOffers ? (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, marginBottom: 6, lineHeight: 1.4 }}>{compOffers.mainValueProposition}</div>
                            <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 10 }}>{compOffers.pricingStrategy}</div>
                            {(compOffers.strengths ?? []).slice(0, 3).map((s: string, i: number) => (
                              <div key={i} style={{ fontSize: 11, color: c.textSecondary, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${compColor}` }}>✓ {s}</div>
                            ))}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: c.textMuted }}>Откройте профиль конкурента для загрузки офферов.</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Missing offers comparison */}
                {myOffers?.missingOffers?.length > 0 && (
                  <div style={{ marginTop: 14, background: c.accentWarm + "08", borderRadius: 12, padding: 16, border: `1px solid ${c.accentWarm}25` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.accentWarm, marginBottom: 8 }}>💡 Что добавить в ваши офферы</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(myOffers.missingOffers ?? []).map((m: string, i: number) => (
                        <span key={i} style={{ fontSize: 12, color: c.textSecondary, background: c.bgCard, padding: "4px 12px", borderRadius: 20, border: `1px solid ${c.border}` }}>{m}</span>
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
