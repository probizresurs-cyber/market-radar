"use client";

import React from "react";
import { Users } from "lucide-react";
import type { TAResult, TASegment } from "@/lib/ta-types";

/**
 * Выбор аватара ЦА (сегмента из анализа) для генерации контента.
 * Рендерится только если анализ ЦА сделан и в нём есть сегменты — иначе null,
 * ничего не требует и не ломает существующие формы.
 *
 * value = id сегмента или null («все сегменты» — прежнее поведение без
 * таргетинга). Выбранный TASegment родитель передаёт в generate-* роут
 * полем taSegment.
 */
export function SegmentSelect({ taResult, value, onChange, style }: {
  taResult: TAResult | null | undefined;
  value: number | null;
  onChange: (segmentId: number | null, segment: TASegment | null) => void;
  style?: React.CSSProperties;
}) {
  const segments = taResult?.segments ?? [];
  if (!segments.length) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
      <Users size={14} style={{ color: "var(--muted-foreground, #6b7280)", flexShrink: 0 }} />
      <select
        value={value ?? ""}
        onChange={(e) => {
          const id = e.target.value === "" ? null : Number(e.target.value);
          onChange(id, id === null ? null : segments.find(s => s.id === id) ?? null);
        }}
        title="Для какого аватара ЦА писать"
        style={{
          height: 34, padding: "0 10px", fontSize: 13, borderRadius: 8,
          border: "1px solid var(--border, #d1d5db)", background: "var(--background, #fff)",
          color: "var(--foreground, #111827)", maxWidth: 260, cursor: "pointer",
        }}
      >
        <option value="">Аватар: все сегменты</option>
        {segments.map(s => (
          <option key={s.id} value={s.id}>
            {s.isGolden ? "★ " : ""}{s.segmentName}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Хук с локальным состоянием выбора — чтобы каждая форма не дублировала одно и то же. */
export function useSegmentSelect(taResult: TAResult | null | undefined) {
  const [segmentId, setSegmentId] = React.useState<number | null>(null);
  const segment = React.useMemo(
    () => taResult?.segments?.find(s => s.id === segmentId) ?? null,
    [taResult, segmentId],
  );
  return { segmentId, segment, setSegmentId };
}
