"use client";

import React, { useState } from "react";
import { TrendingUp, Search, RefreshCw, ExternalLink, Calendar, Loader2 } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

interface TrendItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  description?: string;
}

const SOURCE_OPTIONS = [
  { id: "yandex_news", label: "Google News RU" },
  { id: "google_news_en", label: "Google News EN" },
  { id: "habr", label: "Habr" },
  { id: "vc", label: "VC.ru" },
  { id: "cossa", label: "Cossa" },
];

function timeAgo(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ч назад`;
  return `${Math.round(diff / 86400)} д назад`;
}

export function ContentTrendsView({ analysis }: { analysis: AnalysisResult | null }) {
  const defaultQuery = analysis?.company?.description?.split("\n")[0]?.slice(0, 80) || analysis?.company?.name || "";
  const [query, setQuery] = useState(defaultQuery);
  const [sources, setSources] = useState<string[]>(["yandex_news", "habr", "vc"]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ query: string; total: number; items: TrendItem[] } | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const toggleSource = (id: string) => {
    setSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/content/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), sources }),
      });
      const data = await res.json();
      if (data.ok) setResult(data.result);
      else setErr(data.error || "Ошибка");
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  const displayedItems = result
    ? (filter === "all" ? result.items : result.items.filter(i => i.source.toLowerCase().includes(filter)))
    : [];

  const allSources = result
    ? Array.from(new Set(result.items.map(i => i.source)))
    : [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
          <TrendingUp size={22} /> Тренды по нише
        </div>
        <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
          Актуальные публикации из Habr, VC.ru, Cossa, Google News — для идей контента
        </div>
      </div>

      {/* Search panel */}
      <div className="ds-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            className="ds-input"
            style={{ flex: 1 }}
            placeholder="Тема или ниша (например: маркетинг, SaaS, автоматизация)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run()}
          />
          <button
            className="ds-btn ds-btn-primary"
            onClick={run}
            disabled={loading || !query.trim() || sources.length === 0}
            style={{ minWidth: 120 }}
          >
            {loading
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Ищем…</>
              : <><Search size={14} /> Найти тренды</>
            }
          </button>
        </div>

        {/* Source toggles */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SOURCE_OPTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => toggleSource(s.id)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s",
                background: sources.includes(s.id) ? "var(--primary)" : "var(--card)",
                color: sources.includes(s.id) ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {err && <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 10 }}>{err}</div>}
      </div>

      {/* Results */}
      {result && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 15 }}>
              {result.total} публикаций по «{result.query}»
            </div>
            <button
              className="ds-btn ds-btn-secondary"
              style={{ fontSize: 12, gap: 6, display: "flex", alignItems: "center" }}
              onClick={run}
            >
              <RefreshCw size={12} /> Обновить
            </button>
          </div>

          {/* Source filter tabs */}
          {allSources.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              <button
                onClick={() => setFilter("all")}
                style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer", background: filter === "all" ? "var(--primary)" : "var(--card)", color: filter === "all" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
              >Все ({result.total})</button>
              {allSources.map(src => (
                <button
                  key={src}
                  onClick={() => setFilter(filter === src.toLowerCase() ? "all" : src.toLowerCase())}
                  style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer", background: filter === src.toLowerCase() ? "var(--primary)" : "var(--card)", color: filter === src.toLowerCase() ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                >
                  {src} ({result.items.filter(i => i.source === src).length})
                </button>
              ))}
            </div>
          )}

          {/* Articles list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayedItems.length === 0 && (
              <div className="ds-card" style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "40px 0", fontSize: 13 }}>
                Ничего не найдено. Попробуйте другой запрос или источники.
              </div>
            )}
            {displayedItems.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <div
                  className="ds-card"
                  style={{
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                    padding: "14px 16px",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.4, marginBottom: 5 }}>
                        {item.title}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: 8 }}>
                          {item.description.slice(0, 180)}{item.description.length > 180 ? "…" : ""}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: "var(--primary)15", color: "var(--primary)" }}>
                          {item.source}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted-foreground)" }}>
                          <Calendar size={10} /> {timeAgo(item.publishedAt)}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 2 }} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="ds-card" style={{ textAlign: "center", padding: "48px 0" }}>
          <TrendingUp size={40} style={{ color: "var(--muted-foreground)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>Мониторинг трендов</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 360, margin: "0 auto" }}>
            Введите тему или нишу — получите свежие публикации из ведущих IT- и маркетинговых изданий. Идеально для планирования актуального контента.
          </div>
        </div>
      )}
    </div>
  );
}
