"use client";

import React from "react";

/**
 * Skeleton loaders — uniform "loading…" placeholders that match the
 * actual card layout, so the page doesn't visibly reflow when data
 * lands. Pulse animation defined in globals.css (.ds-skel-pulse).
 *
 *   <SkeletonCard lines={3} />
 *   <SkeletonRow width={120} />
 *   <SkeletonGrid columns={3} count={6} />
 */

export function SkeletonLine({ width = "100%", height = 14, radius = 6, style }: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="ds-skel-pulse"
      style={{
        width,
        height,
        background: "var(--border)",
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, height, withHeader = true }: {
  lines?: number;
  height?: number;
  withHeader?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        padding: 20,
        minHeight: height,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {withHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            className="ds-skel-pulse"
            style={{ width: 36, height: 36, borderRadius: 9, background: "var(--border)" }}
          />
          <SkeletonLine width="55%" height={16} />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? "78%" : "100%"}
          height={12}
        />
      ))}
    </div>
  );
}

export function SkeletonGrid({ minColWidth = 260, count = 6, cardHeight }: {
  minColWidth?: number;
  count?: number;
  cardHeight?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`,
        gap: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={3} height={cardHeight} />
      ))}
    </div>
  );
}
