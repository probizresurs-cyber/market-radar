"use client";

import React from "react";
import { Zap, Target, Hourglass, Ban } from "lucide-react";
import type { Recommendation } from "@/lib/types";

/**
 * Маленький бэдж приоритета Impact × Effort для строк рекомендаций.
 * Закрашен по квадранту: quick-win = зелёный, big-bet = индиго,
 * fill-in = серый, avoid = красный.
 *
 *   <EffortImpactBadge impact={4} effort={2} bucket="quick-win" />
 */
export function EffortImpactBadge({
  impact, effort, bucket, size = "sm",
}: {
  impact?: number;
  effort?: number;
  bucket?: Recommendation["effortImpactBucket"];
  size?: "sm" | "md";
}) {
  if (impact === undefined || effort === undefined) return null;

  const config: Record<NonNullable<Recommendation["effortImpactBucket"]>, {
    label: string;
    color: string;
    bg: string;
    icon: React.ReactNode;
    title: string;
  }> = {
    "quick-win": {
      label: "Quick win",
      color: "#16a34a",
      bg: "rgba(22,163,74,0.12)",
      icon: <Zap size={size === "sm" ? 11 : 13} />,
      title: "Высокий impact, низкий effort — делать в первую очередь",
    },
    "big-bet": {
      label: "Big bet",
      color: "#6366f1",
      bg: "rgba(99,102,241,0.12)",
      icon: <Target size={size === "sm" ? 11 : 13} />,
      title: "Высокий impact, большой effort — планировать стратегически",
    },
    "fill-in": {
      label: "Fill-in",
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.14)",
      icon: <Hourglass size={size === "sm" ? 11 : 13} />,
      title: "Невысокий impact, лёгко — делать в свободное время",
    },
    "avoid": {
      label: "Не делать",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.10)",
      icon: <Ban size={size === "sm" ? 11 : 13} />,
      title: "Невысокий impact, большой effort — избегать",
    },
  };

  const eff = bucket ?? "fill-in";
  const c = config[eff];
  const fontSize = size === "sm" ? 11 : 13;
  const padding = size === "sm" ? "3px 8px" : "4px 10px";

  return (
    <span
      title={c.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding,
        borderRadius: 7,
        background: c.bg,
        color: c.color,
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        cursor: "help",
      }}
    >
      {c.icon}
      <span>{c.label}</span>
      <span style={{ fontWeight: 600, opacity: 0.75 }}>
        · I{impact} · E{effort}
      </span>
    </span>
  );
}

/**
 * Кнопка «Приоритизировать AI» — дёргает /api/prioritize-recommendations
 * и обновляет каждую recommendation в-place. Не блокирует UI.
 */
export function PrioritizeButton({
  recommendations,
  companyName,
  niche,
  onUpdate,
  size = "sm",
}: {
  recommendations: Recommendation[];
  companyName?: string;
  niche?: string;
  onUpdate: (prioritized: Recommendation[]) => void;
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const allScored = recommendations.every(r => r.impact !== undefined && r.effort !== undefined);

  const handleClick = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/prioritize-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendations, companyName, niche }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ошибка");
      onUpdate(j.prioritized as Recommendation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={loading || recommendations.length === 0}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: size === "sm" ? "6px 12px" : "8px 16px",
          borderRadius: 8,
          border: "1px dashed var(--primary)",
          background: "color-mix(in oklch, var(--primary) 6%, transparent)",
          color: "var(--primary)",
          fontSize: size === "sm" ? 12 : 13,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          opacity: loading || recommendations.length === 0 ? 0.6 : 1,
          fontFamily: "inherit",
        }}
      >
        <Zap size={size === "sm" ? 12 : 14} />
        {loading
          ? "AI оценивает…"
          : allScored
          ? "Переоценить приоритеты"
          : "AI: Impact × Effort"}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: "var(--destructive)" }}>{error}</span>
      )}
    </div>
  );
}
