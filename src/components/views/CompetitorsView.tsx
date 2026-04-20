"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { Users } from "lucide-react";

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
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Конкуренты</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "4px 0 0" }}>Отслеживаемых конкурентов: {competitors.length}</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>+</span> Добавить конкурента
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 20, marginBottom: 16, boxShadow: "var(--shadow)" }}>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Введите URL сайта конкурента" disabled={isAnalyzing}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${error ? "var(--destructive)" : "var(--border)"}`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={isAnalyzing || !url.trim()}
              style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: isAnalyzing || !url.trim() ? 0.65 : 1 }}>
              {isAnalyzing ? "Анализ…" : "Добавить"}
            </button>
          </form>
          {error && <div style={{ marginTop: 8, color: "var(--destructive)", fontSize: 13 }}>{error}</div>}
          {isAnalyzing && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <style>{`@keyframes mr-spin3 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 14, height: 14, border: `2px solid var(--muted)`, borderTop: `2px solid var(--primary)`, borderRadius: "50%", animation: "mr-spin3 1s linear infinite" }} />
              <span style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>Анализируем конкурента…</span>
            </div>
          )}
        </div>
      )}

      {competitors.length === 0 ? (
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
          <div style={{ marginBottom: 16, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}>
            <Users size={48} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Конкуренты ещё не добавлены</div>
          <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
            Добавьте URL сайта конкурента, чтобы увидеть сравнительный анализ
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #3b82f6, #60a5fa)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #3b82f640" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Users size={16} /> Добавить конкурента
            </span>
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {competitors.map((comp, i) => {
            const sc = comp.company.score;
            return (
              <div key={i} onClick={() => onSelectCompetitor(i)}
                style={{ background: "var(--card)", borderRadius: 14, padding: 16, border: `1px solid var(--border)`, cursor: "pointer", transition: "box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--foreground)" }}>{comp.company.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {comp.company.url}
                      {comp.analyzedAt && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
                          · {new Date(comp.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: (sc >= 70 ? "var(--success)" : "var(--warning)") + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: sc >= 70 ? "var(--success)" : "var(--warning)" }}>
                    {sc}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {comp.company.categories.map(cat => (
                    <span key={cat.name} style={{ fontSize: 11, color: "var(--foreground-secondary)", background: "var(--muted)", padding: "2px 8px", borderRadius: 6 }}>
                      {cat.icon} {cat.score}
                    </span>
                  ))}
                </div>
                {/* Map ratings */}
                {((comp.social?.yandexRating ?? 0) > 0 || (comp.social?.gisRating ?? 0) > 0) && (
                  <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `1px solid var(--border)` }}>
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
