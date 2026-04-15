"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import type { SMMResult } from "@/lib/smm-types";

export function ReportsView({ c, data, taAnalysis, smmAnalysis }: { c: Colors; data: AnalysisResult | null; taAnalysis?: TAResult | null; smmAnalysis?: SMMResult | null }) {
  const [taExpanded, setTaExpanded] = useState(false);
  const [compExpanded, setCompExpanded] = useState(false);
  const [smmExpanded, setSmmExpanded] = useState(false);

  const handlePrintSMM = () => {
    const win = window.open("", "_blank");
    if (!win || !smmAnalysis) return;
    const platforms = smmAnalysis.platformStrategies.map(p => `
      <div style="margin-bottom:24px; padding:16px; border:1px solid #e0e3ef; border-radius:10px;">
        <h3 style="margin:0 0 8px;">${p.platformLabel}</h3>
        <p><b>Соответствие ЦА:</b> ${p.audienceFit}</p>
        <p><b>Форматы:</b> ${p.contentFormat}</p>
        <p><b>Частота:</b> ${p.postingFrequency}</p>
        <p><b>Тон голоса:</b> ${p.toneOfVoice}</p>
        <p><b>Контент-столпы:</b> ${(p.contentPillars ?? []).join(" · ")}</p>
        <p><b>Тактики роста:</b> ${(p.growthTactics ?? []).join("; ")}</p>
        <p><b>Примеры постов:</b><br>${(p.examplePosts ?? []).map((x, i) => `${i + 1}. ${x}`).join("<br><br>")}</p>
      </div>
    `).join("");
    win.document.write(`<html><head><title>СММ-стратегия — ${smmAnalysis.companyName}</title><style>body{font-family:sans-serif;padding:32px;max-width:900px;margin:0 auto;} h1,h2,h3{color:#1a1a2e;} p{line-height:1.6;color:#444;}</style></head><body><h1>СММ-стратегия — ${smmAnalysis.companyName}</h1><p style="color:#888;">${new Date(smmAnalysis.generatedAt).toLocaleDateString("ru-RU")}</p><h2>Архетип бренда</h2><p><b>${smmAnalysis.brandIdentity.archetype}</b> — ${smmAnalysis.brandIdentity.positioning}</p><p><b>УТП:</b> ${smmAnalysis.brandIdentity.uniqueValue}</p><h2>Большая идея</h2><p>${smmAnalysis.contentStrategy.bigIdea}</p><h2>Платформы</h2>${platforms}<h2>Quick wins</h2><ol>${smmAnalysis.quickWins.map(q => `<li>${q}</li>`).join("")}</ol><h2>План на 30 дней</h2><ol>${smmAnalysis.thirtyDayPlan.map(q => `<li>${q}</li>`).join("")}</ol></body></html>`);
    win.document.close();
    win.print();
  };

  const handlePrintTA = () => {
    const win = window.open("", "_blank");
    if (!win || !taAnalysis) return;
    const segs = taAnalysis.segments.map(s => `
      <div style="margin-bottom:24px; padding:16px; border:1px solid #e0e3ef; border-radius:10px;">
        <h3 style="margin:0 0 8px;">${s.isGolden ? "⭐ " : ""}${s.segmentName}</h3>
        <p><b>Persona:</b> ${s.demographics?.personaName ?? ""}, ${s.demographics?.age ?? ""}, ${s.demographics?.income ?? ""}</p>
        <p><b>Образ жизни:</b> ${s.demographics?.lifestyle ?? ""}</p>
        <p><b>Идентичность:</b> ${s.worldview?.identity ?? ""}</p>
        <p><b>Главные проблемы:</b> ${(s.mainProblems ?? []).join("; ")}</p>
        <p><b>Страхи:</b> ${(s.topFears ?? []).join("; ")}</p>
        <p><b>Возражения:</b> ${(s.topObjections ?? []).join("; ")}</p>
        <p><b>Идеальный результат:</b> ${s.magicTransformation ?? ""}</p>
      </div>
    `).join("");
    win.document.write(`<html><head><title>Отчёт ЦА — ${taAnalysis.companyName}</title><style>body{font-family:sans-serif;padding:32px;max-width:900px;margin:0 auto;} h1,h2,h3{color:#1a1a2e;} p{line-height:1.6;color:#444;}</style></head><body><h1>Анализ ЦА — ${taAnalysis.companyName}</h1><p style="color:#888;">${taAnalysis.niche} · ${new Date(taAnalysis.generatedAt).toLocaleDateString("ru-RU")}</p><h2>Общий вывод</h2><p>${taAnalysis.summary}</p><h2>Сегменты</h2>${segs}</body></html>`);
    win.document.close();
    win.print();
  };

  const handlePrintComp = () => {
    window.print();
  };

  if (!data && !taAnalysis && !smmAnalysis) {
    return (
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Отчёты</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Сначала запустите анализ</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Перейдите в «Новый анализ» и введите URL сайта</div>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const scoreColor = data ? (data.company.score >= 75 ? "#22a06b" : data.company.score >= 50 ? "#d4894e" : "#e34935") : "#e34935";

  return (
    <div style={{ maxWidth: 860 }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #mr-report, #mr-report * { visibility: visible !important; }
          #mr-report { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 24px !important; background: #fff !important; }
          .no-print { display: none !important; }
          @page { margin: 20mm; }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>Отчёты</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>Нажмите на отчёт, чтобы развернуть. Каждый отчёт можно скачать отдельно.</p>
      </div>

      {taAnalysis && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 16, overflow: "hidden" }}>
          {/* TA Report Header — click to expand */}
          <div
            onClick={() => setTaExpanded(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", cursor: "pointer", userSelect: "none" }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>🧠 Анализ ЦА — {taAnalysis.companyName}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{taAnalysis.niche} · {new Date(taAnalysis.generatedAt).toLocaleDateString("ru-RU")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); handlePrintTA(); }}
                className="no-print"
                style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                ↓ PDF
              </button>
              <span style={{ fontSize: 12, color: c.textMuted, transition: "transform 0.2s", display: "inline-block", transform: taExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
          </div>

          {/* TA Report Body */}
          {taExpanded && (
            <div style={{ borderTop: `1px solid ${c.border}`, padding: "20px 24px" }}>
              <div style={{ background: c.accent + "08", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 6 }}>ОБЩИЙ ВЫВОД</div>
                <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>{taAnalysis.summary}</p>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 12 }}>СЕГМЕНТЫ АУДИТОРИИ</div>

              {taAnalysis.segments.map((s, i) => (
                <div key={i} style={{ marginBottom: 20, padding: "16px 20px", border: `1px solid ${s.isGolden ? "#f59e0b40" : c.border}`, borderRadius: 12, background: s.isGolden ? "#f59e0b06" : c.bg }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    {s.isGolden && <span style={{ fontSize: 14 }}>⭐</span>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{s.segmentName}</div>
                    {s.isGolden && <span style={{ fontSize: 11, fontWeight: 600, background: "#f59e0b20", color: "#92400e", borderRadius: 6, padding: "2px 8px" }}>Золотой сегмент</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginBottom: 12 }}>
                    {s.demographics && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ПЕРСОНА</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>{s.demographics.personaName}</div>
                        {[{ l: "Возраст", v: s.demographics.age }, { l: "Доход", v: s.demographics.income }, { l: "Пол", v: s.demographics.genderRatio }].map(r => (
                          <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12 }}>
                            <span style={{ color: c.textMuted }}>{r.l}</span>
                            <span style={{ fontWeight: 600, color: c.textPrimary }}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.demographics?.lifestyle && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ОБРАЗ ЖИЗНИ</div>
                        <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{s.demographics.lifestyle}</p>
                      </div>
                    )}
                  </div>

                  {s.worldview?.identity && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>ИДЕНТИЧНОСТЬ</div>
                      <p style={{ fontSize: 12, color: c.textPrimary, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{s.worldview.identity}</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    {s.mainProblems?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#e34935", letterSpacing: "0.05em", marginBottom: 6 }}>ГЛАВНЫЕ БОЛИ</div>
                        {s.mainProblems.slice(0, 4).map((p, j) => (
                          <div key={j} style={{ fontSize: 12, color: c.textSecondary, padding: "3px 0", borderBottom: `1px solid ${c.borderLight}`, display: "flex", gap: 6 }}>
                            <span style={{ color: "#e34935", flexShrink: 0 }}>⚡</span>{p}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.topFears?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#e34935", letterSpacing: "0.05em", marginBottom: 6 }}>СТРАХИ</div>
                        {s.topFears.slice(0, 4).map((f, j) => (
                          <div key={j} style={{ fontSize: 12, color: c.textSecondary, padding: "3px 0", borderBottom: `1px solid ${c.borderLight}`, display: "flex", gap: 6 }}>
                            <span style={{ color: "#e34935", flexShrink: 0 }}>{j + 1}.</span>{f}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.topObjections?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.accentWarm, letterSpacing: "0.05em", marginBottom: 6 }}>ВОЗРАЖЕНИЯ</div>
                        {s.topObjections.slice(0, 4).map((o, j) => (
                          <div key={j} style={{ fontSize: 12, color: c.textSecondary, padding: "3px 0", borderBottom: `1px solid ${c.borderLight}`, display: "flex", gap: 6 }}>
                            <span style={{ color: c.accentWarm, flexShrink: 0 }}>{j + 1}.</span>{o}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.magicTransformation && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, letterSpacing: "0.05em", marginBottom: 6 }}>ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ</div>
                        <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{s.magicTransformation}</p>
                      </div>
                    )}
                  </div>

                  {s.worldview?.values?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ЦЕННОСТИ</div>
                      <div>{s.worldview.values.map((v, j) => (
                        <span key={j} style={{ display: "inline-block", background: c.accent + "15", color: c.accent, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600, marginRight: 5, marginBottom: 5 }}>{v}</span>
                      ))}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {smmAnalysis && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 16, overflow: "hidden" }}>
          <div
            onClick={() => setSmmExpanded(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", cursor: "pointer", userSelect: "none" }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>📱 СММ-стратегия — {smmAnalysis.companyName}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{smmAnalysis.brandIdentity.archetype} · {new Date(smmAnalysis.generatedAt).toLocaleDateString("ru-RU")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); handlePrintSMM(); }}
                className="no-print"
                style={{ background: "#ec4899", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                ↓ PDF
              </button>
              <span style={{ fontSize: 12, color: c.textMuted, transition: "transform 0.2s", display: "inline-block", transform: smmExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
          </div>

          {smmExpanded && (
            <div style={{ borderTop: `1px solid ${c.border}`, padding: "20px 24px" }}>
              <div style={{ background: "#ec489908", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 6 }}>АРХЕТИП И ПОЗИЦИОНИРОВАНИЕ</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ec4899", marginBottom: 6 }}>{smmAnalysis.brandIdentity.archetype}</div>
                <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: "0 0 8px" }}>{smmAnalysis.brandIdentity.positioning}</p>
                <p style={{ fontSize: 12, color: c.textPrimary, fontWeight: 600, lineHeight: 1.55, margin: 0 }}><b>УТП:</b> {smmAnalysis.brandIdentity.uniqueValue}</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 6 }}>БОЛЬШАЯ ИДЕЯ</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55, margin: "0 0 6px" }}>{smmAnalysis.contentStrategy.bigIdea}</p>
                <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{smmAnalysis.contentStrategy.contentMission}</p>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 12 }}>СТРАТЕГИИ ПО ПЛАТФОРМАМ</div>
              {smmAnalysis.platformStrategies.map((p, i) => (
                <div key={i} style={{ marginBottom: 16, padding: "14px 18px", border: `1px solid ${c.border}`, borderRadius: 12, background: c.bg }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>{p.platformLabel}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 12, marginBottom: 10 }}>
                    <div><b style={{ color: c.textMuted }}>Форматы:</b> <span style={{ color: c.textSecondary }}>{p.contentFormat}</span></div>
                    <div><b style={{ color: c.textMuted }}>Частота:</b> <span style={{ color: c.textSecondary }}>{p.postingFrequency}</span></div>
                    <div><b style={{ color: c.textMuted }}>Тон:</b> <span style={{ color: c.textSecondary }}>{p.toneOfVoice}</span></div>
                  </div>
                  {p.contentPillars?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>КОНТЕНТ-СТОЛПЫ</div>
                      <div>{p.contentPillars.map((cp, j) => (
                        <span key={j} style={{ display: "inline-block", background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, marginRight: 5, marginBottom: 4 }}>{cp}</span>
                      ))}</div>
                    </div>
                  )}
                  {p.examplePosts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginTop: 6, marginBottom: 6 }}>ПРИМЕРЫ ПОСТОВ</div>
                      {p.examplePosts.slice(0, 2).map((ex, j) => (
                        <div key={j} style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, padding: "6px 10px", background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 8, marginBottom: 6, whiteSpace: "pre-wrap" }}>{ex}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.05em", marginBottom: 8 }}>QUICK WINS</div>
                  {smmAnalysis.quickWins.map((q, i) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, padding: "4px 0", borderBottom: `1px solid ${c.borderLight}` }}>{i + 1}. {q}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.05em", marginBottom: 8 }}>ПЛАН НА 30 ДНЕЙ</div>
                  {smmAnalysis.thirtyDayPlan.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, padding: "4px 0", borderBottom: `1px solid ${c.borderLight}` }}>📅 {w}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {data && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadowLg, marginBottom: 16 }}>
          {/* Competitor Report Header — click to expand */}
          <div
            onClick={() => setCompExpanded(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", cursor: "pointer", userSelect: "none", background: `linear-gradient(135deg, ${c.accent}0f, ${c.bgCard})` }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.08em", marginBottom: 4 }}>MARKETRADAR · ОТЧЁТ ПО АНАЛИЗУ</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 2 }}>{data.company.name}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{data.company.url} · {today}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{data.company.score} <span style={{ fontSize: 14, fontWeight: 500, color: c.textMuted }}>из 100</span></div>
                <div style={{ fontSize: 11, color: c.textMuted }}>Общий score</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handlePrintComp(); }}
                className="no-print"
                style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                ↓ PDF
              </button>
              <span style={{ fontSize: 12, color: c.textMuted, transition: "transform 0.2s", display: "inline-block", transform: compExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
          </div>

          {/* Competitor Report Body */}
          {compExpanded && (
            <div id="mr-report">
              {/* Categories */}
              <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>ОЦЕНКИ ПО КАТЕГОРИЯМ</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Категория", "Вес", "Оценка", "Уровень"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {data.company.categories.map((cat, i) => {
                      const col = cat.score >= 75 ? "#22a06b" : cat.score >= 50 ? "#d4894e" : "#e34935";
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: c.textPrimary, fontWeight: 500 }}>{cat.icon} {cat.name}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: c.textSecondary }}>{cat.weight}%</td>
                          <td style={{ padding: "10px 12px", fontSize: 16, fontWeight: 800, color: col }}>{cat.score}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ width: 120, height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${cat.score}%`, background: col, borderRadius: 3 }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Keywords */}
              {(data.seo?.positions ?? []).length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔑 КЛЮЧЕВЫЕ СЛОВА</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["Ключевое слово", "Позиция", "Объём/мес"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.seo.positions.map((pos, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                          <td style={{ padding: "8px 12px", fontSize: 13, color: c.textPrimary }}>{pos.keyword}</td>
                          <td style={{ padding: "8px 12px", fontSize: 14, fontWeight: 700, color: pos.position <= 10 ? "#22a06b" : pos.position <= 30 ? "#d4894e" : c.textSecondary }}>#{pos.position}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, color: c.textSecondary }}>{pos.volume.toLocaleString("ru")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Business + SEO summary */}
              <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>🏢 БИЗНЕС-ПРОФИЛЬ</div>
                  {[
                    { l: "Сотрудников", v: data.business?.employees },
                    { l: "Выручка/год", v: data.business?.revenue },
                    { l: "Основана", v: data.business?.founded },
                    { l: "Трафик/мес", v: data.seo?.estimatedTraffic },
                    { l: "Возраст домена", v: data.seo?.domainAge },
                  ].map(({ l, v }) => v && v !== "—" ? (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12 }}>
                      <span style={{ color: c.textSecondary }}>{l}</span>
                      <span style={{ fontWeight: 600, color: c.textPrimary }}>{v}</span>
                    </div>
                  ) : null)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>📈 ПРОГНОЗ НИШИ</div>
                  {data.nicheForecast && <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: data.nicheForecast.trend === "growing" ? "#22a06b" : data.nicheForecast.trend === "declining" ? "#e34935" : "#d4894e", marginBottom: 6 }}>
                      {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%/год
                    </div>
                    <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, margin: "0 0 8px" }}>{data.nicheForecast.forecast}</p>
                  </>}
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ padding: "24px 32px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>💡 AI-РЕКОМЕНДАЦИИ</div>
                {data.recommendations.map((rec, i) => {
                  const col = rec.priority === "high" ? "#e34935" : rec.priority === "medium" ? "#e6a817" : "#22a06b";
                  const priorityLabel = rec.priority === "high" ? "Высокий" : rec.priority === "medium" ? "Средний" : "Низкий";
                  return (
                    <div key={i} style={{ padding: "14px 0", borderBottom: i < data.recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: col, background: col + "18", padding: "2px 8px", borderRadius: 5 }}>{priorityLabel}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: c.textMuted }}>{rec.category}</span>
                      </div>
                      <div style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5, paddingLeft: 16, marginBottom: 6 }}>{rec.text}</div>
                      <div style={{ paddingLeft: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#22a06b", background: "#22a06b12", padding: "3px 10px", borderRadius: 6 }}>Эффект: {rec.effect}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Insights */}
              {data.insights.length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🧠 AI-ИНСАЙТЫ</div>
                  {(() => {
                    const typeCfg: Record<string, { icon: string; label: string }> = {
                      niche: { icon: "🔭", label: "Пустая ниша" },
                      action: { icon: "🚀", label: "Топ-действие" },
                      battle: { icon: "⚔️", label: "Battle Card" },
                      copy: { icon: "✍️", label: "Копирайтинг" },
                      seo: { icon: "🔍", label: "SEO" },
                      offer: { icon: "🎯", label: "Оффер" },
                    };
                    return data.insights.map((ins, i) => {
                      const cfg = typeCfg[ins.type] ?? typeCfg.action;
                      const col = ins.type === "niche" ? c.accent : ins.type === "battle" ? "#ef4444" : ins.type === "copy" ? "#f59e0b" : ins.type === "offer" ? "#9b59b6" : "#10b981";
                      return (
                        <div key={i} style={{ padding: "10px 0", borderBottom: i < data.insights.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + "18", padding: "2px 8px", borderRadius: 5 }}>{cfg.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{ins.title}</span>
                          </div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, paddingLeft: 22 }}>{ins.text}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Copy improvements */}
              {(data.practicalAdvice?.copyImprovements ?? []).length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>✍️ ПРАВКИ ТЕКСТА САЙТА</div>
                  {data.practicalAdvice.copyImprovements.map((ci, i) => (
                    <div key={i} style={{ marginBottom: i < data.practicalAdvice.copyImprovements.length - 1 ? 16 : 0, paddingBottom: i < data.practicalAdvice.copyImprovements.length - 1 ? 16 : 0, borderBottom: i < data.practicalAdvice.copyImprovements.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#f59e0b18", padding: "2px 8px", borderRadius: 5 }}>{ci.element}</span>
                        <span style={{ fontSize: 11, color: c.textMuted }}>{ci.reason}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ padding: "8px 12px", background: "#ef444408", borderRadius: 8, border: "1px solid #ef444420" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", marginBottom: 4, letterSpacing: "0.06em" }}>СЕЙЧАС</div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, fontStyle: "italic" }}>{ci.current}</div>
                        </div>
                        <div style={{ padding: "8px 12px", background: "#10b98108", borderRadius: 8, border: "1px solid #10b98120" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", marginBottom: 4, letterSpacing: "0.06em" }}>ЗАМЕНИТЬ НА</div>
                          <div style={{ fontSize: 12, color: c.textPrimary, lineHeight: 1.5, fontWeight: 500 }}>{ci.suggested}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Offer analysis */}
              {data.practicalAdvice?.offerAnalysis?.currentOffer && data.practicalAdvice.offerAnalysis.currentOffer !== "—" && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🎯 ОФФЕР И ПОЗИЦИОНИРОВАНИЕ</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.06em" }}>ТЕКУЩИЙ ОФФЕР</div>
                    <div style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic", padding: "8px 12px", background: c.bg, borderRadius: 7, border: `1px solid ${c.borderLight}` }}>{data.practicalAdvice.offerAnalysis.currentOffer}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6, letterSpacing: "0.06em" }}>СЛАБЫЕ МЕСТА</div>
                      {data.practicalAdvice.offerAnalysis.weaknesses.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#ef4444" }}>✗</span>{w}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", marginBottom: 6, letterSpacing: "0.06em" }}>ЧТО ПОДЧЕРКНУТЬ</div>
                      {data.practicalAdvice.offerAnalysis.differentiators.map((d, i) => (
                        <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#10b981" }}>✓</span>{d}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#6366f108", borderRadius: 8, border: "1px solid #6366f120" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", marginBottom: 5, letterSpacing: "0.06em" }}>ПРЕДЛАГАЕМЫЙ ОФФЕР</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55 }}>{data.practicalAdvice.offerAnalysis.suggestedOffer}</div>
                  </div>
                </div>
              )}

              {/* Keyword gaps */}
              {(data.practicalAdvice?.keywordGaps ?? []).length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔑 НЕЗАНЯТЫЕ КЛЮЧЕВЫЕ СЛОВА</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["Ключевое слово", "Объём/мес", "Сложность", "Почему стоит занять"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "7px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.practicalAdvice.keywordGaps.map((kg, i) => {
                        const diffCol = kg.difficulty === "low" ? "#10b981" : kg.difficulty === "medium" ? "#f59e0b" : "#ef4444";
                        const diffLabel = kg.difficulty === "low" ? "Лёгкий" : kg.difficulty === "medium" ? "Средний" : "Сложный";
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: c.textPrimary, fontWeight: 500 }}>{kg.keyword}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: c.textSecondary }}>{kg.volume.toLocaleString("ru")}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: diffCol, background: diffCol + "18", padding: "2px 7px", borderRadius: 5 }}>{diffLabel}</span>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: c.textSecondary }}>{kg.opportunity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Perception */}
              {data.aiPerception && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🤖 ВОСПРИЯТИЕ НЕЙРОСЕТЯМИ</div>

                  {/* Presence + persona row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    {(() => {
                      const presenceCfg = {
                        strong: { label: "Хорошо известна", col: "#10b981" },
                        moderate: { label: "Частично известна", col: "#f59e0b" },
                        weak: { label: "Слабо известна", col: "#f59e0b" },
                        minimal: { label: "Почти не известна", col: "#ef4444" },
                      }[data.aiPerception.knowledgePresence] ?? { label: "—", col: c.textMuted };
                      return (
                        <span style={{ fontSize: 11, fontWeight: 700, color: presenceCfg.col, background: presenceCfg.col + "18", padding: "3px 12px", borderRadius: 20 }}>
                          AI-видимость: {presenceCfg.label}
                        </span>
                      );
                    })()}
                    <span style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic" }}>{data.aiPerception.persona}</span>
                  </div>

                  {/* Sample answer */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", marginBottom: 6, letterSpacing: "0.06em" }}>СИМУЛЯЦИЯ ОТВЕТА НЕЙРОСЕТИ</div>
                    <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.65, fontStyle: "italic", padding: "10px 14px", background: "#6366f106", borderRadius: 8, border: "1px solid #6366f115" }}>
                      {data.aiPerception.sampleAnswer}
                    </div>
                  </div>

                  {/* E-E-A-T + signals */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>E-E-A-T ОЦЕНКА</div>
                      {([
                        { key: "expertise" as const, label: "Экспертиза" },
                        { key: "experience" as const, label: "Опыт" },
                        { key: "authority" as const, label: "Авторитет" },
                        { key: "trust" as const, label: "Доверие" },
                      ]).map(({ key, label }) => {
                        const val = data.aiPerception.eeat[key];
                        const col = val >= 70 ? "#10b981" : val >= 45 ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 12, color: c.textSecondary }}>{label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{val}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: c.borderLight }}>
                              <div style={{ height: "100%", width: `${val}%`, background: col, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>АССОЦИАЦИИ</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        {data.aiPerception.associatedKeywords.map((kw, i) => (
                          <span key={i} style={{ fontSize: 11, color: "#818cf8", background: "#6366f112", padding: "3px 10px", borderRadius: 20, border: "1px solid #6366f120" }}>{kw}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>СИГНАЛЫ</div>
                      {data.aiPerception.contentSignals.map((s, i) => (
                        <div key={i} style={{ fontSize: 11, color: c.textSecondary, marginBottom: 5, display: "flex", gap: 6 }}>
                          <span style={{ color: "#f59e0b", flexShrink: 0 }}>◆</span>{s}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Improvement tips */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>КАК УЛУЧШИТЬ AI-ВИДИМОСТЬ</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {data.aiPerception.improvementTips.map((tip, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, background: "#6366f115", color: "#818cf8", fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>{tip}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SEO actions + Content ideas */}
              {((data.practicalAdvice?.seoActions ?? []).length > 0 || (data.practicalAdvice?.contentIdeas ?? []).length > 0) && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {(data.practicalAdvice?.seoActions ?? []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>⚡ БЫСТРЫЕ SEO-ПОБЕДЫ</div>
                        {data.practicalAdvice.seoActions.map((a, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#6366f115", color: "#818cf8", fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>{a}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(data.practicalAdvice?.contentIdeas ?? []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>💡 ИДЕИ КОНТЕНТА</div>
                        {data.practicalAdvice.contentIdeas.map((idea, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#10b98115", color: "#10b981", fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>{idea}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ padding: "16px 32px", borderTop: `1px solid ${c.border}`, background: c.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: c.textMuted }}>MarketRadar · company24.pro</span>
                <span style={{ fontSize: 11, color: c.textMuted }}>Сгенерировано {today}</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
