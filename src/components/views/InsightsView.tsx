"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { Search, Rocket, Swords, PenLine, Target, AlertTriangle, TrendingUp } from "lucide-react";
import { OrderCTA } from "@/components/ui/OrderCTA";

export function InsightsView({ c, data, competitors }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const typeConfig: Record<string, { icon: React.ReactElement; label: string; color: string }> = {
    niche: { icon: <Search size={16} />, label: "Пустая ниша", color: "var(--primary)" },
    action: { icon: <Rocket size={16} />, label: "Топ-действие", color: "var(--success)" },
    battle: { icon: <Swords size={16} />, label: "Battle Card", color: "var(--destructive)" },
    copy: { icon: <PenLine size={16} />, label: "Копирайтинг", color: "var(--warning)" },
    seo: { icon: <Search size={16} />, label: "SEO-возможность", color: "var(--primary)" },
    offer: { icon: <Target size={16} />, label: "Оффер", color: "#9b59b6" },
  };

  const pa = data.practicalAdvice;
  const difficultyConfig: Record<string, { label: string; color: string }> = {
    low: { label: "Лёгкий", color: "var(--success)" },
    medium: { label: "Средний", color: "var(--warning)" },
    high: { label: "Сложный", color: "var(--destructive)" },
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>AI-инсайты</h1>

      {/* ── Инсайты ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        {data.insights.map((ins, i) => {
          const cfg = typeConfig[ins.type] ?? typeConfig.action;
          return (
            <div key={i} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 18, boxShadow: "var(--shadow)", borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: cfg.color, display: "inline-flex" }}>{cfg.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.color + "15", padding: "2px 9px", borderRadius: 6 }}>{cfg.label}</span>
                </div>
                <OrderCTA category={ins.type} text={`${ins.title} ${ins.text}`} compact />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 5 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55 }}>{ins.text}</div>
            </div>
          );
        })}
      </div>

      {/* ── Копирайтинг: до / после ── */}
      {(pa?.copyImprovements ?? []).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="Текст сайта: конкретные правки">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "color-mix(in oklch, var(--warning) 6%, transparent)", border: `1px solid var(--warning)25` }}>
              <span style={{ flexShrink: 0, display: "inline-flex", color: "var(--warning)" }}><AlertTriangle size={16} /></span>
              <span style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--warning)" }}>Это примеры формулировок от AI</strong> — не копируйте их дословно. Замените выделенные цифры, сроки и детали на актуальные данные вашей компании. Используйте как шаблон для собственного текста.
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pa.copyImprovements.map((ci, i) => (
                <div key={i} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)" }}>
                  <div style={{ padding: "10px 16px", background: "color-mix(in oklch, var(--warning) 6%, transparent)", borderBottom: `1px solid var(--border)`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", background: "color-mix(in oklch, var(--warning) 13%, transparent)", padding: "2px 9px", borderRadius: 6 }}>{ci.element}</span>
                    <span style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>{ci.reason}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                    <div style={{ padding: "14px 16px", borderRight: `1px solid var(--muted)` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--destructive)", marginBottom: 6, letterSpacing: "0.06em" }}>СЕЙЧАС</div>
                      <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5, fontStyle: "italic" }}>{ci.current}</div>
                    </div>
                    <div style={{ padding: "14px 16px", background: "color-mix(in oklch, var(--success) 2%, transparent)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", marginBottom: 4, letterSpacing: "0.06em" }}>ПРИМЕР ЗАМЕНЫ</div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 6, fontStyle: "italic" }}>адаптируйте под реальные данные</div>
                      <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5, fontWeight: 500 }}>{ci.suggested}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Оффер и позиционирование ── */}
      {pa?.offerAnalysis && pa.offerAnalysis.currentOffer !== "—" && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="Оффер и позиционирование">
            <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ТЕКУЩИЙ ОФФЕР</div>
                <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5, padding: "10px 14px", background: "var(--background)", borderRadius: 8, border: `1px solid var(--muted)`, fontStyle: "italic" }}>
                  {pa.offerAnalysis.currentOffer}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 8, letterSpacing: "0.05em" }}>СЛАБЫЕ МЕСТА</div>
                  {pa.offerAnalysis.weaknesses.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 6, lineHeight: 1.4 }}>
                      <span style={{ color: "var(--destructive)", flexShrink: 0, marginTop: 1 }}>✗</span>{w}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8, letterSpacing: "0.05em" }}>ЧТО ПОДЧЕРКНУТЬ</div>
                  {pa.offerAnalysis.differentiators.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 6, lineHeight: 1.4 }}>
                      <span style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }}>✓</span>{d}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: `linear-gradient(135deg, ${"#9b59b6"}0f, var(--primary)08)`, borderRadius: 10, padding: "14px 16px", border: `1px solid ${"#9b59b6"}30` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9b59b6", marginBottom: 8, letterSpacing: "0.05em" }}>ПРЕДЛАГАЕМЫЙ ОФФЕР</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.55 }}>{pa.offerAnalysis.suggestedOffer}</div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Незанятые ключевые слова ── */}
      {(pa?.keywordGaps ?? []).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="Незанятые ключевые слова">
            <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--background)" }}>
                  {["Ключевое слово", "Объём/мес", "Сложность", "Почему стоит занять"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {pa.keywordGaps.map((kg, i) => {
                    const diff = difficultyConfig[kg.difficulty] ?? difficultyConfig.medium;
                    return (
                      <tr key={i} style={{ borderBottom: i < pa.keywordGaps.length - 1 ? `1px solid var(--muted)` : "none" }}>
                        <td style={{ padding: "11px 16px", color: "var(--foreground)", fontWeight: 500 }}>{kg.keyword}</td>
                        <td style={{ padding: "11px 16px", color: "var(--foreground-secondary)", fontWeight: 600 }}>{kg.volume.toLocaleString("ru")}</td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: diff.color, background: diff.color + "18", padding: "2px 8px", borderRadius: 5 }}>{diff.label}</span>
                        </td>
                        <td style={{ padding: "11px 16px", color: "var(--foreground-secondary)", fontSize: 12 }}>{kg.opportunity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── SEO-действия + Идеи контента ── */}
      {((pa?.seoActions ?? []).length > 0 || (pa?.contentIdeas ?? []).length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 28 }}>
          {(pa?.seoActions ?? []).length > 0 && (
            <CollapsibleSection c={c} title="Быстрые SEO-победы">
              {pa.seoActions.map((action, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "color-mix(in oklch, var(--primary) 8%, transparent)", color: "var(--primary)", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{action}</div>
                </div>
              ))}
            </CollapsibleSection>
          )}
          {(pa?.contentIdeas ?? []).length > 0 && (
            <CollapsibleSection c={c} title="Идеи контента">
              {pa.contentIdeas.map((idea, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "color-mix(in oklch, var(--success) 8%, transparent)", color: "var(--success)", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{idea}</div>
                </div>
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ── Battle Cards ── */}
      {competitors.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="Battle Cards — сравнение с конкурентами">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {competitors.map((comp, i) => {
                const myScores = data.company.categories;
                const theirScores = comp.company.categories;
                const gaps = myScores.map((cat, ci) => ({
                  name: cat.name, icon: cat.icon,
                  me: cat.score, them: theirScores[ci]?.score ?? 0,
                  diff: cat.score - (theirScores[ci]?.score ?? 0),
                }));
                const iWin = gaps.filter(g => g.diff > 0);
                const iLose = gaps.filter(g => g.diff < 0);
                return (
                  <div key={i} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)" }}>
                    <div style={{ padding: "12px 20px", borderBottom: `1px solid var(--border)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>Вы vs {comp.company.name}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>Вы: {data.company.score}</span>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>/</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground-secondary)" }}>Они: {comp.company.score}</span>
                      </div>
                    </div>
                    <div style={{ padding: 16 }}>
                      {/* Category bars comparison */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                        {gaps.map(g => (
                          <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 80, fontSize: 12, color: "var(--foreground-secondary)", flexShrink: 0 }}>{g.icon} {g.name}</div>
                            <div style={{ flex: 1, position: "relative", height: 8, background: "var(--muted)", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${g.me}%`, background: "color-mix(in oklch, var(--primary) 50%, transparent)", borderRadius: 4 }} />
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${g.them}%`, background: "color-mix(in oklch, var(--destructive) 31%, transparent)", borderRadius: 4, mixBlendMode: "multiply" as const }} />
                            </div>
                            <div style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 700, color: g.diff > 0 ? "var(--success)" : g.diff < 0 ? "var(--destructive)" : "var(--muted-foreground)", flexShrink: 0 }}>
                              {g.diff > 0 ? `+${g.diff}` : g.diff}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                        <div>
                          <div style={{ color: "var(--success)", fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: "0.04em" }}>ВЫ ВПЕРЕДИ</div>
                          {iWin.length > 0 ? iWin.map(g => (
                            <div key={g.name} style={{ color: "var(--foreground-secondary)", marginBottom: 3 }}>{g.icon} {g.name}: <strong style={{ color: "var(--success)" }}>+{g.diff}</strong></div>
                          )) : <div style={{ color: "var(--muted-foreground)" }}>Нет преимуществ</div>}
                        </div>
                        <div>
                          <div style={{ color: "var(--destructive)", fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: "0.04em" }}>НУЖНО ДОГНАТЬ</div>
                          {iLose.length > 0 ? iLose.map(g => (
                            <div key={g.name} style={{ color: "var(--foreground-secondary)", marginBottom: 3 }}>{g.icon} {g.name}: <strong style={{ color: "var(--destructive)" }}>{g.diff}</strong></div>
                          )) : <div style={{ color: "var(--muted-foreground)" }}>Нет отставаний</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Прогноз ниши ── */}
      {data.nicheForecast && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="Прогноз ниши">
            <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: data.nicheForecast.trend === "growing" ? "var(--success)" : data.nicheForecast.trend === "declining" ? "var(--destructive)" : "var(--warning)" }}>
                  {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%/год
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{data.nicheForecast.timeframe}</div>
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>{data.nicheForecast.direction}</div>
                </div>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--muted)", overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.abs(data.nicheForecast.trendPercent) * 5)}%`, background: data.nicheForecast.trend === "growing" ? "var(--success)" : data.nicheForecast.trend === "declining" ? "var(--destructive)" : "var(--warning)", borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: "0 0 14px" }}>{data.nicheForecast.forecast}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8, letterSpacing: "0.05em" }}>ВОЗМОЖНОСТИ</div>
                  {data.nicheForecast.opportunities.map((o, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5 }}>
                      <span style={{ color: "var(--success)", flexShrink: 0 }}>✓</span>{o}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 8, letterSpacing: "0.05em" }}>УГРОЗЫ</div>
                  {data.nicheForecast.threats.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 5 }}>
                      <span style={{ color: "var(--destructive)", flexShrink: 0 }}>✗</span>{t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── AI-восприятие ── */}
      {data.aiPerception && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="Как нейросети видят вашу компанию">
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>Восприятие ChatGPT / Claude / Gemini на основе публичного информационного следа компании</div>

            {/* Presence badge + persona */}
            <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                {(() => {
                  const p2 = data.aiPerception.knowledgePresence;
                  const cfg = {
                    strong: { label: "Хорошо известна", color: "var(--success)", bg: "color-mix(in oklch, var(--success) 9%, transparent)", icon: "●" },
                    moderate: { label: "Частично известна", color: "var(--warning)", bg: "color-mix(in oklch, var(--warning) 9%, transparent)", icon: "◐" },
                    weak: { label: "Слабо известна", color: "var(--warning)", bg: "color-mix(in oklch, var(--warning) 9%, transparent)", icon: "◔" },
                    minimal: { label: "Почти не известна", color: "var(--destructive)", bg: "color-mix(in oklch, var(--destructive) 9%, transparent)", icon: "○" },
                  }[p2] ?? { label: "Неизвестно", color: "var(--muted-foreground)", bg: "var(--muted)", icon: "?" };
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, color: cfg.color }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "4px 12px", borderRadius: 20 }}>
                        AI-видимость: {cfg.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div style={{ fontSize: 12, color: "var(--foreground-secondary)", fontStyle: "italic", marginBottom: 0 }}>
                {data.aiPerception.persona}
              </div>
            </div>

            {/* Simulated AI answer */}
            <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 12 }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid var(--muted)`, display: "flex", alignItems: "center", gap: 10, background: "color-mix(in oklch, var(--primary) 3%, transparent)" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>Симуляция ответа нейросети</span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>— «Расскажи о {data.company.name}»</span>
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.7, background: "var(--background)", borderRadius: 10, padding: "14px 16px", border: `1px solid var(--muted)`, fontStyle: "italic" }}>
                  {data.aiPerception.sampleAnswer}
                </div>
              </div>
            </div>

            {/* E-E-A-T + Keywords side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
              {/* E-E-A-T */}
              <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 18, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 14, letterSpacing: "0.06em" }}>E-E-A-T ОЦЕНКА</div>
                {([
                  { key: "expertise", label: "Экспертиза", desc: "Глубина и точность контента" },
                  { key: "experience", label: "Опыт", desc: "Реальный опыт первого лица" },
                  { key: "authority", label: "Авторитет", desc: "Упоминания в внешних источниках" },
                  { key: "trust", label: "Доверие", desc: "Прозрачность и достоверность" },
                ] as { key: keyof typeof data.aiPerception.eeat; label: string; desc: string }[]).map(({ key, label, desc }) => {
                  const val = data.aiPerception.eeat[key];
                  const col = val >= 70 ? "var(--success)" : val >= 45 ? "var(--warning)" : "var(--destructive)";
                  return (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{label}</span>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 6 }}>{desc}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{val}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "var(--muted)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${val}%`, background: col, borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Associated keywords + content signals */}
              <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 18, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.06em" }}>АССОЦИАЦИИ НЕЙРОСЕТЕЙ</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
                  {data.aiPerception.associatedKeywords.map((kw, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 500, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 7%, transparent)", padding: "4px 12px", borderRadius: 20, border: `1px solid var(--primary)20` }}>{kw}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.06em" }}>СИГНАЛЫ, ФОРМИРУЮЩИЕ МНЕНИЕ</div>
                {data.aiPerception.contentSignals.map((sig, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--foreground-secondary)", marginBottom: 7, lineHeight: 1.45 }}>
                    <span style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }}>◆</span>{sig}
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement tips */}
            <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 18, boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.06em" }}>КАК УЛУЧШИТЬ AI-ВИДИМОСТЬ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                {data.aiPerception.improvementTips.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "#6366f115", color: "#818cf8", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Заезженные формулировки ── */}
      <CollapsibleSection c={c} title="Заезженные формулировки в нише">
        <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 12 }}>
            Фразы, которые используют все — замените их конкретикой:
          </div>
          {[
            "«Индивидуальный подход» — используют все. Замените на конкретные цифры и кейсы.",
            "«Команда профессионалов» — расскажите о реальном опыте, сертификатах и результатах.",
            "«Комплексные решения» — опишите конкретный стек, сроки и методологию.",
            "«Гарантия качества» — покажите цифры: SLA, процент повторных клиентов, отзывы.",
          ].map((cl, i, arr) => (
            <div key={i} style={{ fontSize: 13, color: "var(--foreground)", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid var(--muted)` : "none", lineHeight: 1.45 }}>
              {cl}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
