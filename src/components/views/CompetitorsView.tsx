"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";

export function CompetitorsView({ c, myCompany, competitors, onSelectCompetitor, onAddCompetitor, isAnalyzing }: {
  c: Colors; myCompany: AnalysisResult | null; competitors: AnalysisResult[];
  onSelectCompetitor: (i: number) => void; onAddCompetitor: (url: string) => Promise<void>; isAnalyzing: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    try {
      await onAddCompetitor(url.trim());
      setUrl("");
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Конкуренты</h1>
          <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>{competitors.length} из 3 (Free). Добавьте ещё за ₽100/мес</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>+</span> Добавить конкурента
        </button>
      </div>

      {showAdd && (
        <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, marginBottom: 16, boxShadow: c.shadow }}>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Введите URL сайта конкурента" disabled={isAnalyzing}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${error ? c.accentRed : c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={isAnalyzing || !url.trim()}
              style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: isAnalyzing || !url.trim() ? 0.65 : 1 }}>
              {isAnalyzing ? "Анализ…" : "Добавить"}
            </button>
          </form>
          {error && <div style={{ marginTop: 8, color: c.accentRed, fontSize: 13 }}>{error}</div>}
          {isAnalyzing && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <style>{`@keyframes mr-spin3 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 14, height: 14, border: `2px solid ${c.borderLight}`, borderTop: `2px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin3 1s linear infinite" }} />
              <span style={{ fontSize: 12, color: c.textSecondary }}>Анализируем конкурента…</span>
            </div>
          )}
        </div>
      )}

      {competitors.length === 0 ? (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Конкуренты ещё не добавлены</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Добавьте URL сайта конкурента, чтобы увидеть сравнительный анализ</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {competitors.map((comp, i) => {
            const sc = comp.company.score;
            return (
              <div key={i} onClick={() => onSelectCompetitor(i)}
                style={{ background: c.bgCard, borderRadius: 14, padding: 16, border: `1px solid ${c.border}`, cursor: "pointer", transition: "box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = c.shadowLg; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: c.textPrimary }}>{comp.company.name}</div>
                    <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{comp.company.url}</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: (sc >= 70 ? c.accentGreen : c.accentWarm) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: sc >= 70 ? c.accentGreen : c.accentWarm }}>
                    {sc}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {comp.company.categories.map(cat => (
                    <span key={cat.name} style={{ fontSize: 11, color: c.textSecondary, background: c.borderLight, padding: "2px 8px", borderRadius: 6 }}>
                      {cat.icon} {cat.score}
                    </span>
                  ))}
                </div>
                {/* Map ratings */}
                {((comp.social?.yandexRating ?? 0) > 0 || (comp.social?.gisRating ?? 0) > 0) && (
                  <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `1px solid ${c.border}` }}>
                    {(comp.social?.yandexRating ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: "#FC3F1D", fontWeight: 600 }}>
                        Я.К: ★{comp.social.yandexRating.toFixed(1)} ({comp.social.yandexReviews})
                      </span>
                    )}
                    {(comp.social?.gisRating ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: "#04AE30", fontWeight: 600 }}>
                        2ГИС: ★{comp.social.gisRating.toFixed(1)} ({comp.social.gisReviews})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
