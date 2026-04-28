"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { KeysoDashboardBlock } from "@/components/ui/KeysoDashboardBlock";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { FolderOpen } from "lucide-react";

export function PreviousAnalysesView({ c, history, currentAnalysis, onDeleteHistory }: {
  c: Colors;
  history: Array<AnalysisResult & { analyzedAt: string }>;
  currentAnalysis: AnalysisResult | null;
  onDeleteHistory?: (idx: number) => void;
}) {
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Предыдущие анализы</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 28px" }}>История предыдущих анализов компании</p>
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
          <div style={{ marginBottom: 16, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}>
            <FolderOpen size={48} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Нет предыдущих анализов</div>
          <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
            После повторного анализа компании предыдущие результаты сохраняются здесь
          </div>
        </div>
      </div>
    );
  }

  const compEntry = compareIdx !== null ? history[compareIdx] : null;

  const renderDelta = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff === 0) return <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>→ 0</span>;
    return (
      <span style={{ color: diff > 0 ? "var(--success)" : "var(--destructive)", fontSize: 12, fontWeight: 700 }}>
        {diff > 0 ? `↑ +${diff}` : `↓ ${diff}`}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 1000, padding: "0" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Предыдущие анализы</h1>
      <p style={{ color: "var(--foreground-secondary)", fontSize: 13, marginBottom: 20 }}>
        {history.length} сохранённых анализов. Нажмите «Сравнить» для детального сравнения с текущим.
      </p>

      {/* History cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {history.map((entry, i) => {
          const isExpanded = expandedIdx === i;
          const isCompare = compareIdx === i;
          return (
            <div key={i} style={{
              background: "var(--card)", borderRadius: 14, border: `1px solid ${isCompare ? "var(--primary)" : isExpanded ? "color-mix(in oklch, var(--primary) 38%, transparent)" : "var(--border)"}`,
              boxShadow: isCompare || isExpanded ? "var(--shadow-lg)" : "var(--shadow)", overflow: "hidden", transition: "box-shadow .15s",
            }}>
              {/* Card header — clickable to expand */}
              <div
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>{entry.company.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {new Date(entry.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} • {entry.company.url}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>Score: {entry.company.score}</span>
                    {entry.company.categories.slice(0, 4).map(cat => (
                      <span key={cat.name} style={{ fontSize: 11, color: "var(--foreground-secondary)", background: "var(--muted)", padding: "1px 6px", borderRadius: 4 }}>
                        {cat.icon} {cat.score}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={e => { e.stopPropagation(); setCompareIdx(isCompare ? null : i); }}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: `1px solid ${isCompare ? "var(--primary)" : "var(--border)"}`,
                      background: isCompare ? "var(--primary)" : "transparent", color: isCompare ? "#fff" : "var(--foreground)",
                      cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
                    }}
                  >
                    {isCompare ? "✓ Сравнение" : "Сравнить"}
                  </button>
                  {/* Delete button */}
                  {confirmDeleteIdx === i ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>Удалить?</span>
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteHistory?.(i); setConfirmDeleteIdx(null); if (compareIdx === i) setCompareIdx(null); if (expandedIdx === i) setExpandedIdx(null); }}
                        style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: "var(--destructive)", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                      >Да</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteIdx(null); }}
                        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontWeight: 600, fontSize: 11, cursor: "pointer" }}
                      >Нет</button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteIdx(i); }}
                      title="Удалить анализ"
                      style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid var(--border)`, background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}
                    >✕</button>
                  )}
                  <span style={{ fontSize: 16, color: "var(--muted-foreground)", userSelect: "none", width: 20, textAlign: "center" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid var(--border)`, padding: "16px 20px", background: "var(--background)", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Description */}
                  {entry.company.description && (
                    <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: 0, lineHeight: 1.6 }}>{entry.company.description}</p>
                  )}

                  {/* Categories grid */}
                  {entry.company.categories.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>КАТЕГОРИИ</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                        {entry.company.categories.map(cat => (
                          <div key={cat.name} style={{ background: "var(--card)", borderRadius: 10, padding: "10px 14px", border: `1px solid var(--border)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>{cat.icon} {cat.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{cat.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key metrics row */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {entry.social?.yandexRating > 0 && (
                      <div style={{ background: "var(--card)", borderRadius: 10, padding: "8px 14px", border: `1px solid var(--border)`, fontSize: 12 }}>
                        🟡 Яндекс: <b>{entry.social.yandexRating}★</b>
                      </div>
                    )}
                    {entry.social?.gisRating > 0 && (
                      <div style={{ background: "var(--card)", borderRadius: 10, padding: "8px 14px", border: `1px solid var(--border)`, fontSize: 12 }}>
                        🟢 2ГИС: <b>{entry.social.gisRating}★</b>
                      </div>
                    )}
                    {!!((entry.seo as Record<string, unknown>)?.loadTime) && (
                      <div style={{ background: "var(--card)", borderRadius: 10, padding: "8px 14px", border: `1px solid var(--border)`, fontSize: 12 }}>
                        ⚡ Сайт: <b>{String((entry.seo as Record<string, unknown>).loadTime)}</b>
                      </div>
                    )}
                    {entry.business?.employees && (
                      <div style={{ background: "var(--card)", borderRadius: 10, padding: "8px 14px", border: `1px solid var(--border)`, fontSize: 12 }}>
                        👥 <b>{entry.business.employees}</b> сотрудников
                      </div>
                    )}
                    {entry.business?.founded && (
                      <div style={{ background: "var(--card)", borderRadius: 10, padding: "8px 14px", border: `1px solid var(--border)`, fontSize: 12 }}>
                        📅 С <b>{entry.business.founded}</b>
                      </div>
                    )}
                    {entry.business?.revenue && (
                      <div style={{ background: "var(--card)", borderRadius: 10, padding: "8px 14px", border: `1px solid var(--border)`, fontSize: 12 }}>
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
                          <div style={{ background: "color-mix(in oklch, var(--success) 3%, transparent)", borderRadius: 10, padding: "12px 14px", border: `1px solid var(--success)20` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>СИЛЬНЫЕ СТОРОНЫ</div>
                            {strengths.slice(0, 3).map((s, si) => (
                              <div key={si} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 3 }}>✓ {s}</div>
                            ))}
                          </div>
                        )}
                        {weaknesses.length > 0 && (
                          <div style={{ background: "color-mix(in oklch, var(--destructive) 3%, transparent)", borderRadius: 10, padding: "12px 14px", border: `1px solid var(--destructive)20` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 6 }}>СЛАБЫЕ СТОРОНЫ</div>
                            {weaknesses.slice(0, 3).map((w, wi) => (
                              <div key={wi} style={{ fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 3 }}>✗ {w}</div>
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
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--foreground)" }}>
            Сравнение: Текущий vs {new Date(compEntry.analyzedAt).toLocaleDateString("ru-RU")}
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11 }}>МЕТРИКА</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid var(--border)`, color: "var(--primary)", fontWeight: 600, fontSize: 11 }}>ТЕКУЩИЙ</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11 }}>ПРЕДЫДУЩИЙ</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11 }}>ИЗМЕНЕНИЕ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontWeight: 600 }}>Общий Score</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontWeight: 700, color: "var(--primary)" }}>{currentAnalysis.company.score}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{compEntry.company.score}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{renderDelta(currentAnalysis.company.score, compEntry.company.score)}</td>
              </tr>
              {currentAnalysis.company.categories.map((cat, ci) => {
                const prevCat = compEntry.company.categories[ci];
                return (
                  <tr key={cat.name}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{cat.icon} {cat.name}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, fontWeight: 600, color: "var(--primary)" }}>{cat.score}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{prevCat?.score ?? "—"}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{prevCat ? renderDelta(cat.score, prevCat.score) : "—"}</td>
                  </tr>
                );
              })}
              {/* SEO metrics */}
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>SEO — трафик</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, color: "var(--primary)" }}>{currentAnalysis.seo.estimatedTraffic}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{compEntry.seo.estimatedTraffic}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>Яндекс.Карты</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, color: "var(--primary)" }}>{currentAnalysis.social.yandexRating > 0 ? `★${currentAnalysis.social.yandexRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{compEntry.social.yandexRating > 0 ? `★${compEntry.social.yandexRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>2ГИС</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)`, color: "var(--primary)" }}>{currentAnalysis.social.gisRating > 0 ? `★${currentAnalysis.social.gisRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>{compEntry.social.gisRating > 0 ? `★${compEntry.social.gisRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid var(--muted)` }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
