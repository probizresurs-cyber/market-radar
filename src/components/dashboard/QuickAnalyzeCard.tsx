"use client";

/**
 * QuickAnalyzeCard — встраивается в дашборд руководителя.
 *
 * Юзер вводит URL → POST /api/analyze → показывает короткое summary
 * (Score, ключевые проблемы, первое действие) прямо в карточке, без
 * перехода на основной дашборд. Полный отчёт открывается отдельной
 * кнопкой (только в private mode).
 *
 * Цель — позволить руководителю быстро прогнать любой сайт (например
 * конкурента или партнёра) без перехода в основное приложение.
 */

import React, { useState } from "react";
import { Search, Loader2, ExternalLink, TrendingUp, AlertTriangle } from "lucide-react";

interface QuickAnalysis {
  name: string;
  url: string;
  score: number;
  niche?: string;
  categories?: Array<{ name: string; score: number }>;
  topRecommendation?: string;
}

export function QuickAnalyzeCard({
  paletteVars,
  onOpenFullDashboard,
}: {
  paletteVars: {
    bgCard: string;
    bgSecondary: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    borderTertiary: string;
    primary: string;
    primaryHover: string;
    red: string;
    redBg: string;
    green: string;
  };
  /** Только в private — public mode не имеет основного приложения. */
  onOpenFullDashboard?: () => void;
}) {
  const p = paletteVars;
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickAnalysis | null>(null);

  const normalizeUrl = (u: string): string => {
    const t = u.trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
  };

  const handleAnalyze = async () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("Введите URL");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа");
      const data = json.data;
      const topRec =
        Array.isArray(data?.recommendations) && data.recommendations.length > 0
          ? typeof data.recommendations[0] === "string"
            ? data.recommendations[0]
            : data.recommendations[0]?.text
          : undefined;
      setResult({
        name: data?.company?.name ?? "Без названия",
        url: data?.company?.url ?? normalized,
        score: data?.company?.score ?? 0,
        niche: data?.company?.niche,
        categories: Array.isArray(data?.categories)
          ? data.categories.slice(0, 4).map((c: { name: string; score: number }) => ({ name: c.name, score: c.score }))
          : [],
        topRecommendation: topRec,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 75 ? p.green : s >= 50 ? "#F59E0B" : p.red;

  return (
    <div className="mr-card" style={{
      padding: 22, marginBottom: 20,
      background: `linear-gradient(135deg, ${p.bgCard} 60%, ${p.primary}08 100%)`,
      border: `1px solid ${p.primary}25`,
      borderRadius: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${p.primary}20`, color: p.primary,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Search size={17} strokeWidth={2.2} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: p.textPrimary, letterSpacing: -0.2 }}>
            Быстрый анализ любого сайта
          </div>
          <div style={{ fontSize: 12, color: p.textSecondary, marginTop: 2 }}>
            Проверить конкурента, партнёра или собственный лендинг — за 30 секунд
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !loading) handleAnalyze(); }}
          placeholder="example.ru или https://example.ru"
          disabled={loading}
          style={{
            flex: 1, minWidth: 220,
            padding: "11px 14px", borderRadius: 9,
            border: `1.5px solid ${error ? p.red : p.borderTertiary}`,
            background: p.bgSecondary, color: p.textPrimary,
            fontSize: 14, outline: "none",
            fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          style={{
            padding: "11px 20px", borderRadius: 9, border: "none",
            background: loading || !url.trim() ? p.borderTertiary : p.primary,
            color: "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: loading || !url.trim() ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "inherit",
          }}
        >
          {loading
            ? <><Loader2 size={14} className="mr-spin" /> Анализирую…</>
            : <><Search size={14} /> Анализ</>}
        </button>
      </div>

      {error && (
        <div style={{
          padding: "9px 13px", borderRadius: 8,
          background: p.redBg, color: p.red,
          fontSize: 13, marginBottom: 6,
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 12, padding: 16, borderRadius: 11,
          background: p.bgSecondary,
          border: `1px solid ${p.borderTertiary}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: p.textPrimary, marginBottom: 4 }}>
                {result.name}
              </div>
              <div style={{ fontSize: 12, color: p.textTertiary, marginBottom: 6 }}>
                {result.url} {result.niche && `· ${result.niche}`}
              </div>
            </div>
            <div style={{
              padding: "8px 14px", borderRadius: 10,
              background: `${scoreColor(result.score)}18`,
              border: `1px solid ${scoreColor(result.score)}40`,
              textAlign: "center", minWidth: 80,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.textTertiary, letterSpacing: "0.05em" }}>SCORE</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: scoreColor(result.score), lineHeight: 1, marginTop: 2 }}>
                {result.score}
              </div>
            </div>
          </div>

          {result.categories && result.categories.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {result.categories.map((cat, i) => (
                <div key={i} style={{
                  padding: "5px 11px", borderRadius: 7,
                  background: p.bgCard, border: `1px solid ${p.borderTertiary}`,
                  fontSize: 12, color: p.textSecondary,
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  {cat.name}: <b style={{ color: scoreColor(cat.score) }}>{cat.score}</b>
                </div>
              ))}
            </div>
          )}

          {result.topRecommendation && (
            <div style={{
              marginTop: 12, padding: "10px 12px", borderRadius: 9,
              background: p.bgCard, borderLeft: `3px solid ${scoreColor(result.score)}`,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              {result.score < 60
                ? <AlertTriangle size={14} style={{ color: p.red, flexShrink: 0, marginTop: 2 }} />
                : <TrendingUp size={14} style={{ color: p.green, flexShrink: 0, marginTop: 2 }} />}
              <div style={{ fontSize: 13, color: p.textPrimary, lineHeight: 1.5 }}>
                <b style={{ color: p.textTertiary, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
                  Первое действие
                </b>
                {result.topRecommendation}
              </div>
            </div>
          )}

          {onOpenFullDashboard && (
            <button
              onClick={onOpenFullDashboard}
              style={{
                marginTop: 12, padding: "9px 16px", borderRadius: 9,
                border: `1px solid ${p.primary}`, background: "transparent",
                color: p.primary, fontSize: 12.5, fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: "inherit",
              }}
            >
              Открыть полный отчёт <ExternalLink size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
