"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Gift } from "lucide-react";

interface SubscriptionState {
  plan: string;
  tokensUsed: number;
  tokensLimit: number;
  tokensLeft: number;
  daysLeft: number;
  hasAccess: boolean;
  isExpired: boolean;
  isExhausted: boolean;
  isAdmin?: boolean;
}

export function TrialBanner({ userId }: { userId: string | undefined }) {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = () => {
      fetch("/api/subscription", { cache: "no-store" })
        .then(r => r.json())
        .then(d => { if (!cancelled && d.ok) setSub(d); })
        .catch(() => { /* silent */ });
    };

    load();

    const handlePaywall = () => { load(); };
    window.addEventListener("mr:paywall", handlePaywall);

    return () => {
      cancelled = true;
      window.removeEventListener("mr:paywall", handlePaywall);
    };
    // re-fetch every time userId changes
  }, [userId]);

  if (!sub || sub.isAdmin || dismissed) return null;
  if (sub.plan !== "trial" && sub.hasAccess) return null;

  const usedPct = sub.tokensLimit > 0 ? Math.min(100, Math.round((sub.tokensUsed / sub.tokensLimit) * 100)) : 0;
  const warning = sub.isExpired || sub.isExhausted;
  const lowTokens = !warning && sub.tokensLeft < sub.tokensLimit * 0.15;
  const lowDays = !warning && sub.daysLeft <= 2;

  const bg = warning
    ? "color-mix(in srgb, var(--destructive) 12%, var(--card))"
    : (lowTokens || lowDays)
      ? "color-mix(in srgb, var(--warning) 14%, var(--card))"
      : "var(--card)";
  const borderColor = warning ? "var(--destructive)" : (lowTokens || lowDays) ? "var(--warning)" : "var(--border)";
  const accent = warning ? "var(--destructive)" : (lowTokens || lowDays) ? "var(--warning)" : "var(--primary)";

  const title = warning
    ? (sub.isExpired ? "Пробный период завершён" : "Лимит токенов исчерпан")
    : "Пробный период";

  const subtitle = warning
    ? "Оформите подписку, чтобы продолжить пользоваться AI-функциями."
    : `Осталось ${sub.daysLeft} ${plural(sub.daysLeft, "день", "дня", "дней")} · ${sub.tokensLeft.toLocaleString("ru-RU")} из ${sub.tokensLimit.toLocaleString("ru-RU")} токенов`;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 14,
      padding: "12px 16px",
      marginBottom: 18,
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "var(--shadow)",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `color-mix(in srgb, ${accent} 18%, transparent)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent,
      }}>{warning ? <AlertTriangle size={18} /> : <Gift size={18} />}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--foreground-secondary)", marginTop: 2 }}>{subtitle}</div>
        {!warning && (
          <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden", maxWidth: 420 }}>
            <div style={{ height: "100%", width: `${usedPct}%`, background: accent, transition: "width 0.3s" }} />
          </div>
        )}
      </div>

      {!warning && (
        <button
          onClick={() => setDismissed(true)}
          title="Скрыть"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--muted-foreground)", fontSize: 18, padding: 4, lineHeight: 1,
          }}
        >×</button>
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
