"use client";

import React from "react";
import { Inbox } from "lucide-react";

/**
 * EmptyState — uniform "no data yet" block used across dashboards.
 *
 * Replaces dozens of ad-hoc empty placeholders that were either bare text
 * ("Нет данных") or emoji-icon-plus-paragraph cards in inconsistent
 * dimensions/spacing.
 *
 *   <EmptyState
 *     icon={<Users size={28} />}
 *     title="Сначала запустите анализ ЦА"
 *     description="Перейдите в «Новый анализ ЦА» — портрет соберётся за 3 минуты"
 *     action={{ label: "Запустить анализ", onClick: () => goTo("ta-new") }}
 *   />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 16,
        border: "1px dashed var(--border)",
        padding: compact ? "32px 20px" : "56px 32px",
        textAlign: "center",
        maxWidth: 540,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "var(--primary)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        {icon ?? <Inbox size={compact ? 22 : 28} />}
      </div>
      <div
        style={{
          fontSize: compact ? 16 : 18,
          fontWeight: 700,
          color: "var(--foreground)",
          marginBottom: description ? 8 : 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 14,
            color: "var(--foreground-secondary)",
            lineHeight: 1.55,
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          {description}
        </div>
      )}
      {(action || secondaryAction) && (
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          {action && (
            <button
              onClick={action.onClick}
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "11px 22px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 12px rgba(124,58,237,0.25)",
              }}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                background: "transparent",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "11px 22px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
