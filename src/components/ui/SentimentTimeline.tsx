"use client";

import React, { useMemo } from "react";
import type { Review } from "@/lib/review-types";

/**
 * SentimentTimeline — динамика тональности отзывов по месяцам.
 * Закрывает P0-пробел «Нет sentiment timeline» из аудита Reviews.
 *
 * Группирует входящие отзывы по YYYY-MM, считает: avg rating, %
 * позитивных (>=4), % негативных (<=2), общее количество. Рендерит
 * SVG-чарт (столбцы) + аннотация изменения тренда.
 *
 *   <SentimentTimeline reviews={reviews} />
 */
function parseDate(s: string): Date | null {
  // ISO
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // "12 января 2024", "12.01.2024", "01/12/2024" — fallback к Date.parse уже сделан.
  return null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const ru = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${ru[m - 1]} ${String(y).slice(2)}`;
}

interface MonthlyStats {
  key: string;
  date: Date;
  count: number;
  avgRating: number;
  positivePct: number;
  negativePct: number;
}

export function SentimentTimeline({ reviews }: { reviews: Review[] }) {
  const stats = useMemo<MonthlyStats[]>(() => {
    const byMonth = new Map<string, Review[]>();
    for (const r of reviews) {
      const d = parseDate(r.date);
      if (!d) continue;
      const k = monthKey(d);
      const arr = byMonth.get(k) ?? [];
      arr.push(r);
      byMonth.set(k, arr);
    }
    const out: MonthlyStats[] = [];
    for (const [k, arr] of byMonth.entries()) {
      const ratings = arr.map(r => r.rating).filter(r => r > 0 && r <= 5);
      if (ratings.length === 0) continue;
      const avg = ratings.reduce((s, x) => s + x, 0) / ratings.length;
      const pos = ratings.filter(r => r >= 4).length;
      const neg = ratings.filter(r => r <= 2).length;
      out.push({
        key: k,
        date: new Date(k + "-01T00:00:00"),
        count: ratings.length,
        avgRating: avg,
        positivePct: (pos / ratings.length) * 100,
        negativePct: (neg / ratings.length) * 100,
      });
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out;
  }, [reviews]);

  if (stats.length < 2) {
    // Меньше 2 месяцев данных — timeline бессмысленен
    return (
      <div style={{
        padding: "14px 16px", background: "var(--card)",
        border: "1px dashed var(--border)", borderRadius: 12,
        fontSize: 13, color: "var(--muted-foreground)", textAlign: "center",
      }}>
        Динамика появится, когда наберётся отзывов хотя бы за 2 месяца.
        Сейчас отзывов с распознанной датой: {stats.reduce((s, m) => s + m.count, 0)}.
      </div>
    );
  }

  const maxCount = Math.max(...stats.map(s => s.count), 1);
  const last = stats[stats.length - 1];
  const prev = stats[stats.length - 2];
  const ratingDelta = last.avgRating - prev.avgRating;
  const trendArrow = ratingDelta > 0.1 ? "↗" : ratingDelta < -0.1 ? "↘" : "→";
  const trendColor = ratingDelta > 0.1 ? "#16a34a" : ratingDelta < -0.1 ? "#ef4444" : "var(--muted-foreground)";

  // Layout
  const W = 720;
  const H = 200;
  const padX = 40;
  const padY = 24;
  const colW = (W - padX * 2) / stats.length;
  const innerH = H - padY * 2;

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)", letterSpacing: -0.2, marginBottom: 4 }}>
            Динамика по месяцам
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {stats.length} {stats.length === 1 ? "месяц" : stats.length < 5 ? "месяца" : "месяцев"} · всего отзывов с датой: {stats.reduce((s, m) => s + m.count, 0)}
          </div>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: `${trendColor}1a`,
        }}>
          <span style={{ fontSize: 18, color: trendColor, fontWeight: 800 }}>{trendArrow}</span>
          <span style={{ fontSize: 12, color: trendColor, fontWeight: 700 }}>
            {ratingDelta > 0 ? "+" : ""}{ratingDelta.toFixed(2)} ★ к предыдущему месяцу
          </span>
        </div>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", minWidth: 400 }}
        >
          {/* Grid */}
          {[0, 0.5, 1].map((p, i) => (
            <line
              key={i}
              x1={padX}
              x2={W - padX}
              y1={padY + innerH * p}
              y2={padY + innerH * p}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          ))}
          {/* Rating axis labels */}
          <text x={4} y={padY + 4} fontSize="10" fill="var(--muted-foreground)">5★</text>
          <text x={4} y={padY + innerH / 2 + 4} fontSize="10" fill="var(--muted-foreground)">3★</text>
          <text x={4} y={padY + innerH + 4} fontSize="10" fill="var(--muted-foreground)">1★</text>

          {/* Bars + dots */}
          {stats.map((s, i) => {
            const cx = padX + colW * (i + 0.5);
            // Bars: positive stacked above zero line; negative inverted
            const barW = Math.min(28, colW * 0.5);
            const posH = (s.positivePct / 100) * innerH;
            const negH = (s.negativePct / 100) * innerH;
            // Rating dot — Y by avg rating (1-5 → top=5)
            const ratingY = padY + innerH - ((s.avgRating - 1) / 4) * innerH;
            // Count badge above
            const countTextY = padY - 4;
            return (
              <g key={s.key}>
                {/* Bar positive — bottom */}
                <rect
                  x={cx - barW / 2}
                  y={padY + innerH - posH}
                  width={barW / 2 - 1}
                  height={posH}
                  fill="#16a34a"
                  opacity={0.75}
                  rx="2"
                />
                {/* Bar negative — bottom (red) */}
                <rect
                  x={cx + 1}
                  y={padY + innerH - negH}
                  width={barW / 2 - 1}
                  height={negH}
                  fill="#ef4444"
                  opacity={0.75}
                  rx="2"
                />
                {/* Rating dot */}
                <circle cx={cx} cy={ratingY} r="4.5" fill="var(--primary)" stroke="#fff" strokeWidth="2" />
                {/* Count label above */}
                {s.count >= 3 && (
                  <text x={cx} y={countTextY} fontSize="10" fill="var(--muted-foreground)" textAnchor="middle">
                    n={s.count}
                  </text>
                )}
                {/* Month label below */}
                <text x={cx} y={H - 4} fontSize="10" fill="var(--muted-foreground)" textAnchor="middle">
                  {monthLabel(s.key)}
                </text>
              </g>
            );
          })}
          {/* Trend line — соединяет средние рейтинги */}
          <polyline
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            opacity="0.4"
            points={stats
              .map((s, i) => {
                const cx = padX + colW * (i + 0.5);
                const ratingY = padY + innerH - ((s.avgRating - 1) / 4) * innerH;
                return `${cx},${ratingY}`;
              })
              .join(" ")}
          />
        </svg>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--muted-foreground)", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, background: "#16a34a", borderRadius: 2, opacity: 0.75 }} /> % позитивных (4-5★)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, background: "#ef4444", borderRadius: 2, opacity: 0.75 }} /> % негативных (1-2★)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, background: "var(--primary)", borderRadius: "50%" }} /> средний рейтинг
        </span>
        {maxCount >= 5 && (
          <span>· Максимум в месяц: {maxCount} отзывов</span>
        )}
      </div>
    </div>
  );
}
