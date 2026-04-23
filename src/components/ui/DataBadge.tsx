"use client";

import React from "react";

/**
 * DataBadge — единый индикатор происхождения данных.
 *
 * Используется рядом с заголовками блоков по всей платформе,
 * чтобы пользователь сразу видел, откуда взяты цифры/тексты:
 *  - AI (blue): сгенерировано/оценено моделью (Claude / GPT-4o).
 *  - Real (green): реальные данные из открытого источника
 *    (DaData, Руспрофайл, hh.ru, Keys.so, Google, Yandex, 2GIS и т.д.).
 *
 * Пример:
 *   <DataBadge variant="real" source="DaData + Руспрофайл" />
 *   <DataBadge variant="ai" />
 *   <DataBadge variant="ai" source="Claude" />
 */
export function DataBadge({
  variant,
  source,
  title,
  compact,
}: {
  variant: "ai" | "real";
  source?: string;
  title?: string;
  compact?: boolean;
}) {
  const isAI = variant === "ai";
  const color = isAI ? "#3b82f6" : "#22a06b";
  const bg = isAI ? "rgba(59,130,246,0.12)" : "rgba(34,160,107,0.12)";
  const icon = isAI ? "✨" : "✓";
  const labelBase = isAI ? "AI" : "Реальные данные";
  const label = source ? `${labelBase}: ${source}` : labelBase;
  const tooltip = title ?? (isAI
    ? "Значение сгенерировано/оценено AI-моделью — может отличаться от факта."
    : `Реальные данные${source ? ` из ${source}` : ""} — подтверждённый внешний источник.`);
  return (
    <span
      title={tooltip}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color,
        background: bg,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        border: `1px solid ${color}33`,
      }}
    >
      <span style={{ fontSize: compact ? 9 : 10 }}>{icon}</span>
      {label}
    </span>
  );
}
