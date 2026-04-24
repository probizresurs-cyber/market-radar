"use client";

import React from "react";
import { BookOpen, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { CompanyStyleState } from "@/lib/company-style-types";

// Compact "style applied?" widget used inside SEO articles and other generators.
// Shows state at a glance + apply/not-apply toggle + deep-link to main style tab.
export function CompanyStylePanel({
  c,
  state,
  onChange,
  onOpenStyleTab,
}: {
  c: Colors;
  state: CompanyStyleState;
  onChange: (next: CompanyStyleState) => void;
  onOpenStyleTab?: () => void;
}) {
  const { docs, profile, applyToGeneration } = state;
  const hasDocs = docs.length > 0;
  const hasProfile = !!profile;

  let statusColor: string = c.textMuted;
  let statusBg: string = c.bgCard;
  let icon: React.ReactNode = <AlertCircle size={18} color={c.textMuted} />;
  let title = "Стиль компании не собран";
  let description = "Загрузите свои статьи, чтобы AI генерировал в вашей манере.";

  if (hasProfile) {
    statusColor = applyToGeneration ? c.accentGreen : c.accentWarm;
    statusBg = `${statusColor}14`;
    icon = <CheckCircle2 size={18} color={statusColor} />;
    title = applyToGeneration
      ? "Стиль компании применяется"
      : "Стиль собран, но НЕ применяется";
    description = applyToGeneration
      ? `AI будет писать в манере, извлечённой из ${profile!.basedOnDocIds.length} ваших документов.`
      : "Включите тумблер справа, чтобы AI использовал ваш стиль при генерации.";
  } else if (hasDocs) {
    statusColor = c.accentWarm;
    statusBg = `${c.accentWarm}14`;
    icon = <BookOpen size={18} color={statusColor} />;
    title = `Загружено ${docs.length} ${docs.length === 1 ? "материал" : "материала"}`;
    description = "Перейдите в «Стиль компании» и запустите анализ, чтобы применить стиль здесь.";
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", borderRadius: 12,
        background: statusBg,
        border: `1px solid ${statusColor}40`,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>

      {hasProfile && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: c.textPrimary, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={applyToGeneration}
            onChange={() => onChange({ ...state, applyToGeneration: !applyToGeneration })}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          Применять
        </label>
      )}

      {onOpenStyleTab && (
        <button
          onClick={onOpenStyleTab}
          style={{
            padding: "6px 12px", borderRadius: 8,
            background: "transparent", border: `1px solid ${statusColor}60`,
            color: statusColor, fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          Перейти <ExternalLink size={12} />
        </button>
      )}
    </div>
  );
}
