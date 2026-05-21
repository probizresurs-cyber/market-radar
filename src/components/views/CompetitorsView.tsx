"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import { Users, Sparkles, Plus, Loader2 } from "lucide-react";

interface SuggestedCompetitor {
  domain: string;
  sources: ("organic" | "context" | "spywords-organic" | "spywords-adv")[];
  organicVisibility?: number;
  contextVisibility?: number;
  intersected?: number;
  similarity?: number;
  spywordsCommonKeys?: number;
  spywordsCompetitionLevel?: number;
}

export function CompetitorsView({ c, myCompany, competitors, onSelectCompetitor, onAddCompetitor, onDeleteCompetitor, isAnalyzing }: {
  c: Colors; myCompany: AnalysisResult | null; competitors: AnalysisResult[];
  onSelectCompetitor: (i: number) => void; onAddCompetitor: (url: string) => Promise<void>;
  onDeleteCompetitor?: (i: number) => void;
  isAnalyzing: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  // Keys.so auto-suggested competitors
  const [suggested, setSuggested] = useState<SuggestedCompetitor[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState<string | null>(null);
  const [autoFetchedFor, setAutoFetchedFor] = useState<string | null>(null);

  const fetchSuggested = React.useCallback(async () => {
    if (!myCompany?.company.url) return;
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await fetch("/api/keyso/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: myCompany.company.url, base: "msk", limit: 12 }),
      });
      const json = await res.json();
      if (json.ok) {
        // Исключить тех, кто уже добавлен и саму компанию
        const myDomain = myCompany.company.url.replace(/^www\./, "").toLowerCase();
        const existingDomains = new Set(competitors.map(c => c.company.url.replace(/^www\./, "").toLowerCase()));
        const filtered = (json.competitors as SuggestedCompetitor[]).filter(s => {
          const d = s.domain.toLowerCase();
          return d !== myDomain && !existingDomains.has(d);
        });
        setSuggested(filtered);
      } else {
        setSuggestError(json.error ?? "Не удалось получить данные");
      }
    } catch {
      setSuggestError("Ошибка запроса");
    } finally {
      setSuggestLoading(false);
    }
  }, [myCompany?.company.url, competitors]);

  // Auto-fetch suggested competitors on mount (and when myCompany changes)
  // — пользователю не нужно жать кнопку
  useEffect(() => {
    if (!myCompany?.company.url) return;
    if (autoFetchedFor === myCompany.company.url) return; // уже подгружено для этой компании
    setAutoFetchedFor(myCompany.company.url);
    fetchSuggested();
  }, [myCompany?.company.url, autoFetchedFor, fetchSuggested]);

  const handleAddSuggested = async (domain: string) => {
    setAddingDomain(domain);
    try {
      await onAddCompetitor(domain);
      setSuggested(prev => prev?.filter(s => s.domain !== domain) ?? null);
    } finally {
      setAddingDomain(null);
    }
  };

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

      {/* Глобальный баннер прогресса при добавлении из «Предлагаемых» */}
      {addingDomain && (
        <div style={{
          background: "color-mix(in oklch, var(--primary) 12%, transparent)",
          border: `1px solid color-mix(in oklch, var(--primary) 35%, transparent)`,
          borderRadius: 10, padding: "12px 16px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <Loader2 size={16} style={{ color: "var(--primary)", animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>Анализируем конкурента {addingDomain}…</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
              Это занимает 30-60 секунд: парсим сайт, тянем Keys.so + SpyWords + DaData + Yandex Maps. Можно продолжать работу, конкурент добавится в фоне.
            </div>
          </div>
        </div>
      )}

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

      {/* Suggested competitors from Keys.so */}
      {myCompany?.company.url && (
        <div style={{ background: "var(--card)", borderRadius: 14, border: `1px solid var(--border)`, padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: suggested ? 14 : 0, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)15", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>Предлагаемые конкуренты</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Реальные домены из Keys.so + SpyWords — ранжируются по тем же ключам</div>
              </div>
            </div>
            <button
              onClick={fetchSuggested}
              disabled={suggestLoading}
              style={{
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: suggestLoading ? "var(--muted)" : "var(--primary)",
                color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: suggestLoading ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              }}
            >
              {suggestLoading ? "Поиск…" : suggested ? "Обновить" : "Найти конкурентов"}
            </button>
          </div>

          {suggestError && (
            <div style={{ padding: "10px 14px", background: "var(--destructive)15", color: "var(--destructive)", borderRadius: 10, fontSize: 13 }}>
              {suggestError}
            </div>
          )}

          {suggested && suggested.length === 0 && (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
              {competitors.length > 0
                ? "Все найденные конкуренты уже добавлены вручную"
                : "Keys.so и SpyWords не вернули конкурентов по этому домену. Возможные причины:"}
              {competitors.length === 0 && (
                <ul style={{ textAlign: "left", margin: "8px auto", padding: "0 0 0 18px", maxWidth: 460, fontSize: 12 }}>
                  <li>Домен молодой или малопосещаемый — нет в базах</li>
                  <li>Брендовый трафик без SEO/PPC активности</li>
                  <li>Добавьте конкурентов вручную через кнопку «+ Добавить конкурента»</li>
                </ul>
              )}
            </div>
          )}

          {suggested && suggested.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {suggested.map((s) => {
                const inMany = s.sources.length >= 3;
                const hasKeyso = s.sources.includes("organic") || s.sources.includes("context");
                const hasSpywords = s.sources.includes("spywords-organic") || s.sources.includes("spywords-adv");
                return (
                  <div key={s.domain} style={{
                    background: "var(--background)", borderRadius: 10, border: `1px solid var(--border)`,
                    padding: "11px 13px", display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.domain}
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                        {s.sources.includes("organic") && (
                          <span title="Keys.so — SEO" style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", background: "#22c55e15", padding: "2px 6px", borderRadius: 4 }}>K.SEO</span>
                        )}
                        {s.sources.includes("context") && (
                          <span title="Keys.so — Я.Директ" style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "#f59e0b15", padding: "2px 6px", borderRadius: 4 }}>K.Дир</span>
                        )}
                        {s.sources.includes("spywords-organic") && (
                          <span title="SpyWords — органика" style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", background: "#6366f115", padding: "2px 6px", borderRadius: 4 }}>SW.SEO</span>
                        )}
                        {s.sources.includes("spywords-adv") && (
                          <span title="SpyWords — реклама" style={{ fontSize: 9, fontWeight: 700, color: "#ec4899", background: "#ec489915", padding: "2px 6px", borderRadius: 4 }}>SW.Рек</span>
                        )}
                        {inMany && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--primary)", background: "var(--primary)15", padding: "2px 6px", borderRadius: 4 }}>сильный</span>
                        )}
                        {hasKeyso && hasSpywords && !inMany && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--primary)", background: "var(--primary)15", padding: "2px 6px", borderRadius: 4 }}>2 источника</span>
                        )}
                        {(s.intersected ?? s.spywordsCommonKeys) !== undefined && (
                          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                            {(s.intersected ?? s.spywordsCommonKeys)?.toLocaleString("ru-RU")} общих ключей
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddSuggested(s.domain)}
                      disabled={addingDomain === s.domain || isAnalyzing}
                      title={`Добавить ${s.domain}`}
                      style={{
                        padding: "6px 10px", borderRadius: 8, border: `1px solid var(--primary)50`,
                        background: addingDomain === s.domain ? "var(--muted)" : "var(--primary)15",
                        color: "var(--primary)", fontWeight: 700, fontSize: 12,
                        cursor: addingDomain === s.domain || isAnalyzing ? "default" : "pointer",
                        display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                      }}
                    >
                      {addingDomain === s.domain
                        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Анализ…</>
                        : <><Plus size={13} /> Добавить</>}
                    </button>
                  </div>
                );
              })}
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
              <div key={i}
                style={{ background: "var(--card)", borderRadius: 14, padding: 16, border: `1px solid var(--border)`, transition: "box-shadow 0.2s, transform 0.2s", position: "relative" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                {/* Delete / confirm */}
                {confirmDeleteIdx === i ? (
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4, alignItems: "center", background: "var(--card)", border: `1px solid var(--border)`, borderRadius: 8, padding: "4px 8px", boxShadow: "var(--shadow)", zIndex: 5 }}>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Удалить?</span>
                    <button onClick={e => { e.stopPropagation(); onDeleteCompetitor?.(i); setConfirmDeleteIdx(null); }} style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: "var(--destructive)", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Да</button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteIdx(null); }} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid var(--border)`, background: "transparent", color: "var(--foreground-secondary)", fontSize: 11, cursor: "pointer" }}>Нет</button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteIdx(i); }}
                    title="Удалить конкурента"
                    style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 7, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, zIndex: 5, opacity: 0.7 }}
                  >✕</button>
                )}
                <div onClick={() => onSelectCompetitor(i)} style={{ cursor: "pointer" }}>
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
                </div>{/* end clickable wrapper */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
