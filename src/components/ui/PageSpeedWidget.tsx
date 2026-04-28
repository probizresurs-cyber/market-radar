"use client";

import React from "react";

interface CWVMetric {
  value: number;
  display: string;
  score: number;
}

interface LighthouseScores {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices?: number;
  lcp?: CWVMetric;
  fcp?: CWVMetric;
  cls?: CWVMetric;
  tbt?: CWVMetric;
  si?:  CWVMetric;
  tti?: CWVMetric;
}

interface Props {
  scores: LighthouseScores;
  url?: string;
}

// Color thresholds matching Google PageSpeed
function scoreColor(score: number): string {
  if (score >= 90) return "#0cce6b"; // green
  if (score >= 50) return "#ffa400"; // orange
  return "#ff4e42";                   // red
}

function cwvColor(score: number): string {
  if (score >= 0.9) return "#0cce6b";
  if (score >= 0.5) return "#ffa400";
  return "#ff4e42";
}

function cwvLabel(score: number): string {
  if (score >= 0.9) return "Хорошо";
  if (score >= 0.5) return "Улучшить";
  return "Плохо";
}

// SVG ring gauge — like PageSpeed Insights
function ScoreGauge({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        {/* Arc */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        {/* Score text — counter-rotate so it's upright */}
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
          fill={color} fontSize={size < 72 ? 18 : 22} fontWeight={700} fontFamily="inherit">
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

// Single CWV row metric
function CWVRow({ label, metric, good, poor }: {
  label: string;
  metric?: CWVMetric;
  good: string;
  poor: string;
}) {
  if (!metric) return null;
  const color = cwvColor(metric.score);
  const tag = cwvLabel(metric.score);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "var(--foreground)" }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>({good} — хорошо, {poor} — плохо)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{metric.display}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
          background: color + "22", color,
        }}>{tag}</span>
      </div>
    </div>
  );
}

export function PageSpeedWidget({ scores, url }: Props) {
  const gauges = [
    { score: scores.performance,   label: "Производительность" },
    { score: scores.accessibility, label: "Доступность" },
    { score: scores.bestPractices ?? 0, label: "Best Practices" },
    { score: scores.seo,           label: "SEO" },
  ].filter(g => g.score > 0);

  const hasCWV = scores.lcp || scores.fcp || scores.cls || scores.tbt;

  const overall = scores.performance;
  const overallColor = scoreColor(overall);

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>
            Скорость сайта
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Google PageSpeed Insights · Мобильные
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
            background: overallColor + "20", color: overallColor,
            border: `1px solid ${overallColor}40`,
          }}>
            {overall >= 90 ? "Хорошо" : overall >= 50 ? "Требует улучшений" : "Плохо"}
          </div>
          {url && (
            <a href={`https://pagespeed.web.dev/report?url=https://${url}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none", opacity: 0.85 }}>
              Полный отчёт →
            </a>
          )}
        </div>
      </div>

      {/* 4 gauge rings */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${gauges.length}, 1fr)`, gap: 8, marginBottom: hasCWV ? 20 : 0 }}>
        {gauges.map(g => (
          <ScoreGauge key={g.label} score={g.score} label={g.label} />
        ))}
      </div>

      {/* Core Web Vitals */}
      {hasCWV && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.07em", marginBottom: 8 }}>
            CORE WEB VITALS
          </div>
          <CWVRow label="LCP" metric={scores.lcp} good="≤2.5s" poor=">4s" />
          <CWVRow label="FCP" metric={scores.fcp} good="≤1.8s" poor=">3s" />
          <CWVRow label="CLS" metric={scores.cls} good="≤0.1"  poor=">0.25" />
          <CWVRow label="TBT" metric={scores.tbt} good="≤200ms" poor=">600ms" />
          <CWVRow label="Speed Index" metric={scores.si}  good="≤3.4s" poor=">5.8s" />
        </div>
      )}
    </div>
  );
}
