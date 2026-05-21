"use client";

import React from "react";

/**
 * Универсальный таб-переключатель для контент-сущностей:
 *   Черновики / Запланированные / Опубликованные
 * Используется в Posts/Stories/Carousels — единый UX.
 */

export type ContentStatus = "drafts" | "scheduled" | "published";

interface Props {
  value: ContentStatus;
  onChange: (s: ContentStatus) => void;
  counts: Record<ContentStatus, number>;
}

const LABELS: Record<ContentStatus, string> = {
  drafts: "Черновики",
  scheduled: "Запланированные",
  published: "Опубликованные",
};

export function StatusTabs({ value, onChange, counts }: Props) {
  const tabs: ContentStatus[] = ["drafts", "scheduled", "published"];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: value === t ? "1px solid var(--primary)" : "1px solid var(--border)",
            background: value === t ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
            color: value === t ? "var(--primary)" : "var(--foreground-secondary)",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {LABELS[t]}
          {counts[t] > 0 && (
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 8,
              background: value === t ? "var(--primary)" : "var(--muted)",
              color: value === t ? "#fff" : "var(--muted-foreground)",
              fontWeight: 700,
            }}>{counts[t]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Хелпер для вычисления статуса контент-сущности.
 *  Приоритет: manualStatus > publishStatus.* > scheduledFor > drafts. */
export function computeStatus<T extends {
  manualStatus?: ContentStatus;
  publishStatus?: { vk?: { ok: boolean }; telegram?: { ok: boolean } };
  scheduledFor?: string;
}>(item: T): ContentStatus {
  if (item.manualStatus) return item.manualStatus;
  if (item.publishStatus?.vk?.ok || item.publishStatus?.telegram?.ok) return "published";
  if (item.scheduledFor && new Date(item.scheduledFor) > new Date()) return "scheduled";
  return "drafts";
}
