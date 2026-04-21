"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Gift } from "lucide-react";

interface SubscriptionState {
  plan: string;
  tokensUsed: number;
  tokensLimit: number;
  tokensLeft: number;
  daysLeft: number;
  hoursLeft: number;
  totalHoursLeft: number;
  msLeft: number;
  planExpiresAt: string | null;
  hasAccess: boolean;
  isExpired: boolean;
  isExhausted: boolean;
  isAdmin?: boolean;
}

export function TrialBanner({ userId }: { userId: string | undefined }) {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Client-side tick — пересчитываем оставшееся время каждую минуту,
  // чтобы счётчик визуально уменьшался без запроса к серверу.
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const load = () => {
      fetch("/api/subscription", { cache: "no-store" })
        .then(r => r.json())
        .then(d => { if (!cancelled && d.ok) setSub(d); })
        .catch(() => { /* silent */ });
    };

    load();

    // Immediate refresh when access is blocked (402)
    const handlePaywall = () => { load(); };

    // Debounced refresh after a successful AI call (tokens were consumed)
    const handleTokensUsed = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { load(); }, 1500);
    };

    // Tick every 60s so "Xч Yм" visibly decreases during the session
    const tickInterval = setInterval(() => setNowTick(Date.now()), 60_000);
    // Full refresh from server every 15 minutes (in case tokens/plan changed elsewhere)
    const refreshInterval = setInterval(load, 15 * 60_000);

    window.addEventListener("mr:paywall", handlePaywall);
    window.addEventListener("mr:tokens-used", handleTokensUsed);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(tickInterval);
      clearInterval(refreshInterval);
      window.removeEventListener("mr:paywall", handlePaywall);
      window.removeEventListener("mr:tokens-used", handleTokensUsed);
    };
    // re-fetch every time userId changes
  }, [userId]);

  if (!sub || sub.isAdmin || dismissed) return null;
  if (sub.plan !== "trial" && sub.hasAccess) return null;

  // Пересчитываем оставшееся время на клиенте (чтобы счётчик тикал без сервера).
  // Используем planExpiresAt как источник истины, падаем на серверные поля если null.
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  const MIN = 60 * 1000;
  const expiresMs = sub.planExpiresAt ? new Date(sub.planExpiresAt).getTime() : null;
  const liveMs = expiresMs !== null ? Math.max(0, expiresMs - nowTick) : sub.msLeft ?? 0;
  const liveDays = Math.floor(liveMs / DAY);
  const liveHoursInDay = Math.floor((liveMs % DAY) / HOUR);
  const liveTotalHours = Math.floor(liveMs / HOUR);
  const liveMinutes = Math.floor((liveMs % HOUR) / MIN);
  const liveIsExpired = liveMs <= 0;

  const usedPct = sub.tokensLimit > 0 ? Math.min(100, Math.round((sub.tokensUsed / sub.tokensLimit) * 100)) : 0;
  const warning = liveIsExpired || sub.isExpired || sub.isExhausted;
  const lowTokens = !warning && sub.tokensLeft < sub.tokensLimit * 0.15;
  const lowDays = !warning && liveDays < 2;

  const bg = warning
    ? "color-mix(in srgb, var(--destructive) 12%, var(--card))"
    : (lowTokens || lowDays)
      ? "color-mix(in srgb, var(--warning) 14%, var(--card))"
      : "var(--card)";
  const borderColor = warning ? "var(--destructive)" : (lowTokens || lowDays) ? "var(--warning)" : "var(--border)";
  const accent = warning ? "var(--destructive)" : (lowTokens || lowDays) ? "var(--warning)" : "var(--primary)";

  const title = warning
    ? (liveIsExpired || sub.isExpired ? "Пробный период завершён" : "Лимит токенов исчерпан")
    : "Пробный период";

  // Форматирование оставшегося времени:
  // >= 1 дня     → "6 дней 14 ч"
  // < 1 дня       → "14 ч 23 мин"
  // < 1 часа     → "42 мин"
  const timeLabel = liveIsExpired
    ? "0 дней"
    : liveDays >= 1
      ? `${liveDays} ${plural(liveDays, "день", "дня", "дней")} ${liveHoursInDay} ч`
      : liveTotalHours >= 1
        ? `${liveTotalHours} ч ${liveMinutes} мин`
        : `${liveMinutes} мин`;

  const subtitle = warning
    ? "Оформите подписку, чтобы продолжить пользоваться AI-функциями."
    : `Осталось ${timeLabel} · ${sub.tokensLeft.toLocaleString("ru-RU")} из ${sub.tokensLimit.toLocaleString("ru-RU")} токенов`;

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
