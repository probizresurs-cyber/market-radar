"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RangeStats {
  p25: number;
  p50: number;
  p75: number;
  top10?: number;
}

export interface NicheBenchmark {
  niche: string;
  overallScore: RangeStats;
  er: RangeStats;
  avgRating: RangeStats;
  seoTop10: RangeStats;
  topInsight: string;
  generatedAt: string;
}

/**
 * Hook: загружает бенчмарк по нише (cached в localStorage 12 часов
 * + серверный in-memory 30 мин). На пустой нише не дёргает.
 */
export function useNicheBenchmark(niche: string | undefined): NicheBenchmark | null {
  const [bench, setBench] = useState<NicheBenchmark | null>(null);

  useEffect(() => {
    if (!niche || !niche.trim()) return;
    const cacheKey = `mr_niche_bench_${niche.toLowerCase().trim().slice(0, 80)}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: NicheBenchmark; ts: number };
        // 12 часов клиентский кэш
        if (Date.now() - parsed.ts < 12 * 60 * 60 * 1000) {
          setBench(parsed.data);
          return;
        }
      }
    } catch { /* ignore */ }

    fetch("/api/niche-benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche }),
    })
      .then(r => r.json())
      .then(j => {
        if (!j.ok || !j.benchmark) return;
        setBench(j.benchmark as NicheBenchmark);
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: j.benchmark, ts: Date.now() }),
          );
        } catch { /* ignore */ }
      })
      .catch(() => { /* ignore */ });
  }, [niche]);

  return bench;
}

/**
 * Маленький бэдж: «выше / ниже / равно среднему по нише» по метрике.
 * Принимает значение пользователя + RangeStats (например, benchmark.overallScore).
 *
 *   <BenchmarkBadge value={68} stats={bench.overallScore} unit="" />
 */
export function BenchmarkBadge({
  value,
  stats,
  unit = "",
  formatValue,
  compact,
}: {
  value: number;
  stats?: RangeStats;
  unit?: string;
  formatValue?: (n: number) => string;
  compact?: boolean;
}) {
  if (!stats) return null;
  const fmt = formatValue ?? ((n: number) => `${n}${unit}`);
  const delta = value - stats.p50;
  // Считаем "сильно выше" если выше p75, "выше" если выше p50, "ниже p50",
  // "сильно ниже" если ниже p25.
  let tier: "top" | "high" | "low" | "bottom" | "mid";
  if (value >= (stats.top10 ?? stats.p75)) tier = "top";
  else if (value >= stats.p75) tier = "high";
  else if (value <= stats.p25) tier = "bottom";
  else if (value < stats.p50) tier = "low";
  else tier = "mid";

  const cfg = {
    top:    { color: "#16a34a", bg: "rgba(22,163,74,0.14)",    icon: <TrendingUp size={11} />, label: "Топ-10% ниши" },
    high:   { color: "#16a34a", bg: "rgba(22,163,74,0.10)",    icon: <TrendingUp size={11} />, label: "Выше среднего" },
    mid:    { color: "#6366f1", bg: "rgba(99,102,241,0.10)",   icon: <Minus size={11} />,      label: "Уровень ниши" },
    low:    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   icon: <TrendingDown size={11} />, label: "Ниже среднего" },
    bottom: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",    icon: <TrendingDown size={11} />, label: "В нижней четверти" },
  }[tier];

  return (
    <span
      title={`Ниша: ${fmt(stats.p25)} (25%) → ${fmt(stats.p50)} (медиана) → ${fmt(stats.p75)} (75%)${stats.top10 ? ` → ${fmt(stats.top10)} (топ)` : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: compact ? "2px 7px" : "3px 9px",
        borderRadius: 7,
        background: cfg.bg,
        color: cfg.color,
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        letterSpacing: "-0.005em",
        cursor: "help",
      }}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
      {!compact && (
        <span style={{ fontWeight: 600, opacity: 0.8 }}>
          · ваш {fmt(value)} vs медиана {fmt(stats.p50)}
          {delta > 0 ? " (+" + (delta).toFixed(value < 10 ? 1 : 0) + ")" : delta < 0 ? " (" + delta.toFixed(value < 10 ? 1 : 0) + ")" : ""}
        </span>
      )}
    </span>
  );
}
