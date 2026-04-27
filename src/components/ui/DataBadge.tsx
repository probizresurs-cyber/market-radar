"use client";

import React from "react";

/**
 * DataBadge — единый индикатор происхождения данных.
 *
 * Используется рядом с заголовками блоков по всей платформе,
 * чтобы пользователь сразу видел, откуда взяты цифры/тексты:
 *  - real (зелёный, ✓) — реальные данные из открытого источника
 *    (DaData, Руспрофайл, hh.ru, Keys.so, Google, Yandex, 2GIS и т.д.).
 *  - ai (голубой, ✨) — AI-гипотеза, сгенерирована моделью.
 *    Требует валидации (например, через CustDev).
 *  - estimate (жёлтый, ⌖) — оценка: среднее по нише или диапазон.
 *    Конкретные цифры клиента могут отличаться.
 *
 * Пример:
 *   <DataBadge variant="real" source="DaData + Руспрофайл" />
 *   <DataBadge variant="ai" source="Claude" />
 *   <DataBadge variant="estimate" source="среднее по нише" />
 */

export type DataBadgeVariant = "real" | "ai" | "estimate";

const PALETTE: Record<DataBadgeVariant, {
  color: string;
  bg: string;
  icon: string;
  label: string;
  tooltip: string;
}> = {
  real: {
    color: "#22a06b",
    bg: "rgba(34,160,107,0.12)",
    icon: "✓",
    label: "Факт",
    tooltip: "Реальные данные — подтверждённый внешний источник.",
  },
  ai: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    icon: "✨",
    label: "AI-гипотеза",
    tooltip:
      "Сгенерировано AI на основе архетипа и публичных данных. Рекомендуем проверить в CustDev.",
  },
  estimate: {
    color: "#d97706",
    bg: "rgba(245,158,11,0.14)",
    icon: "⌖",
    label: "Оценка",
    tooltip:
      "Среднее по нише или расчёт с допущениями. Ваши фактические цифры могут отличаться.",
  },
};

export function DataBadge({
  variant,
  source,
  title,
  compact,
}: {
  variant: DataBadgeVariant;
  source?: string;
  title?: string;
  compact?: boolean;
}) {
  const p = PALETTE[variant];
  const label = source ? `${p.label}: ${source}` : p.label;
  const tooltip =
    title ?? (source ? `${p.tooltip} Источник: ${source}.` : p.tooltip);

  return (
    <span
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color: p.color,
        background: p.bg,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        border: `1px solid ${p.color}33`,
      }}
    >
      <span style={{ fontSize: compact ? 9 : 10 }}>{p.icon}</span>
      {label}
    </span>
  );
}
