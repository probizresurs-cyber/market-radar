"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { KeysoDashboardBlock } from "@/components/ui/KeysoDashboardBlock";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CategoryCard } from "@/components/ui/CategoryCard";

export function PreviousAnalysesView({ c, history, currentAnalysis }: {
  c: Colors;
  history: Array<AnalysisResult & { analyzedAt: string }>;
  currentAnalysis: AnalysisResult | null;
}) {
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div style={{ maxWidth: 900, padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>Предыдущие анализы</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Пока нет предыдущих анализов</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>После повторного анализа компании предыдущие результаты сохраняются здесь</div>
        </div>
      </div>
    );
  }

  const compEntry = compareIdx !== null ? history[compareIdx] : null;

  const renderDelta = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff === 0) return <span style={{ color: c.textMuted, fontSize: 12 }}>→ 0</span>;
    return (
      <span style={{ color: diff > 0 ? c.accentGreen : c.accentRed, fontSize: 12, fontWeight: 700 }}>
        {diff > 0 ? `↑ +${diff}` : `↓ ${diff}`}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 1000, padding: "0" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Предыдущие анализы</h1>
      <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 20 }}>
        {history.length} сохранённых анализов. Нажмите «Сравнить» для детального сравнения с текущим.
      </p>

      {/* History cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {history.map((entry, i) => {
          const isExpanded = expandedIdx === i;
          const isCompare = compareIdx === i;
          return (
            <div key={i} style={{
              background: c.bgCard, borderRadius: 14, border: `1px solid ${isCompare ? c.accent : isExpanded ? c.accent + "60" : c.border}`,
              boxShadow: isCompare || isExpanded ? c.shadowLg : c.shadow, overflow: "hidden", transition: "box-shadow .15s",
            }}>
              {/* Card header — clickable to expand */}
              <div
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: c.textPrimary }}>{entry.company.name}</div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                    {new Date(entry.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} • {entry.company.url}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.accent }}>Score: {entry.company.score}</span>
                    {entry.company.categories.slice(0, 4).map(cat => (
                      <span key={cat.name} style={{ fontSize: 11, color: c.textSecondary, background: c.borderLight, padding: "1px 6px", borderRadius: 4 }}>
                        {cat.icon} {cat.score}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={e => { e.stopPropagation(); setCompareIdx(isCompare ? null : i); }}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: `1px solid ${isCompare ? c.accent : c.border}`,
                      background: isCompare ? c.accent : "transparent", color: isCompare ? "#fff" : c.textPrimary,
                      cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
                    }}
                  >
                    {isCompare ? "✓ Сравнение" : "Сравнить"}
                  </button>
                  <span style={{ fontSize: 16, color: c.textMuted, userSelect: "none", width: 20, textAlign: "center" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${c.border}`, padding: "16px 20px", background: c.bg, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Description */}
                  {entry.company.description && (
                    <p style={{ fontSize: 13, color: c.textSecondary, margin: 0, lineHeight: 1.6 }}>{entry.company.description}</p>
                  )}

                  {/* Categories grid */}
                  {entry.company.categories.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>КАТЕГОРИИ</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                        {entry.company.categories.map(cat => (
                          <div key={cat.name} style={{ background: c.bgCard, borderRadius: 10, padding: "10px 14px", border: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: c.textSecondary }}>{cat.icon} {cat.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>{cat.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key metrics row */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {entry.social?.yandexRating > 0 && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        🟡 Яндекс: <b>{entry.social.yandexRating}★</b>
                      </div>
                    )}
                    {entry.social?.gisRating > 0 && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        🟢 2ГИС: <b>{entry.social.gisRating}★</b>
                      </div>
                    )}
                    {!!((entry.seo as Record<string, unknown>)?.loadTime) && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        ⚡ Сайт: <b>{String((entry.seo as Record<string, unknown>).loadTime)}</b>
                      </div>
                    )}
                    {entry.business?.employees && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        👥 <b>{entry.business.employees}</b> сотрудников
                      </div>
                    )}
                    {entry.business?.founded && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        📅 С <b>{entry.business.founded}</b>
                      </div>
                    )}
                    {entry.business?.revenue && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        💰 <b>{entry.business.revenue}</b>
                      </div>
                    )}
                  </div>

                  {/* Strengths / weaknesses */}
                  {(() => {
                    const co = entry.company as Record<string, unknown>;
                    const strengths = Array.isArray(co.strengths) ? co.strengths as string[] : [];
                    const weaknesses = Array.isArray(co.weaknesses) ? co.weaknesses as string[] : [];
                    if (strengths.length === 0 && weaknesses.length === 0) return null;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {strengths.length > 0 && (
                          <div style={{ background: c.accentGreen + "08", borderRadius: 10, padding: "12px 14px", border: `1px solid ${c.accentGreen}20` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 6 }}>СИЛЬНЫЕ СТОРОНЫ</div>
                            {strengths.slice(0, 3).map((s, si) => (
                              <div key={si} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 3 }}>✓ {s}</div>
                            ))}
                          </div>
                        )}
                        {weaknesses.length > 0 && (
                          <div style={{ background: c.accentRed + "08", borderRadius: 10, padding: "12px 14px", border: `1px solid ${c.accentRed}20` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 6 }}>СЛАБЫЕ СТОРОНЫ</div>
                            {weaknesses.slice(0, 3).map((w, wi) => (
                              <div key={wi} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 3 }}>✗ {w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      {compEntry && currentAnalysis && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>
            Сравнение: Текущий vs {new Date(compEntry.analyzedAt).toLocaleDateString("ru-RU")}
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>МЕТРИКА</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.accent, fontWeight: 600, fontSize: 11 }}>ТЕКУЩИЙ</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>ПРЕДЫДУЩИЙ</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>ИЗМЕНЕНИЕ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600 }}>Общий Score</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 700, color: c.accent }}>{currentAnalysis.company.score}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.company.score}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{renderDelta(currentAnalysis.company.score, compEntry.company.score)}</td>
              </tr>
              {currentAnalysis.company.categories.map((cat, ci) => {
                const prevCat = compEntry.company.categories[ci];
                return (
                  <tr key={cat.name}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{cat.icon} {cat.name}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.accent }}>{cat.score}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{prevCat?.score ?? "—"}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{prevCat ? renderDelta(cat.score, prevCat.score) : "—"}</td>
                  </tr>
                );
              })}
              {/* SEO metrics */}
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>SEO — трафик</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, color: c.accent }}>{currentAnalysis.seo.estimatedTraffic}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.seo.estimatedTraffic}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>Яндекс.Карты</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, color: c.accent }}>{currentAnalysis.social.yandexRating > 0 ? `★${currentAnalysis.social.yandexRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.social.yandexRating > 0 ? `★${compEntry.social.yandexRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>2ГИС</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, color: c.accent }}>{currentAnalysis.social.gisRating > 0 ? `★${currentAnalysis.social.gisRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.social.gisRating > 0 ? `★${compEntry.social.gisRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
