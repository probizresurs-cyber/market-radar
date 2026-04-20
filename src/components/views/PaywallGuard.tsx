"use client";

import React, { useEffect, useState } from "react";
import { Lock, X } from "lucide-react";

/**
 * Global 402 Payment Required handler.
 * - Monkey-patches window.fetch to intercept 402 responses from AI endpoints
 * - Shows a paywall modal when the trial is exhausted / expired
 * - Dispatches a "mr:paywall" event that TrialBanner listens to for refresh
 *
 * Mount once near the top of the app tree.
 */
export function PaywallGuard() {
  const [state, setState] = useState<{
    open: boolean;
    reason: string;
    message: string;
  }>({ open: false, reason: "", message: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Guard against double-patching during HMR
    if ((window as unknown as { __mrFetchPatched?: boolean }).__mrFetchPatched) return;
    (window as unknown as { __mrFetchPatched?: boolean }).__mrFetchPatched = true;

    const originalFetch = window.fetch.bind(window);

    // Routes that consume tokens — used to trigger TrialBanner refresh on success
    const AI_ROUTE_RE = /\/api\/(analyze|generate-|suggest-|check-tov|expand-prompt|extract-)/;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);

      // Derive request URL for pattern matching
      const rawUrl =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof URL
          ? args[0].href
          : args[0] instanceof Request
          ? args[0].url
          : "";

      if (res.status === 402) {
        // Clone so the caller can still read the body
        try {
          const clone = res.clone();
          const data = await clone.json().catch(() => null) as
            | { error?: string; reason?: string }
            | null;
          const reason = data?.reason ?? "limit";
          const message = data?.error ?? "Пробный доступ завершён";
          setState({ open: true, reason, message });
          // Notify other components (e.g. TrialBanner) to refresh subscription state
          window.dispatchEvent(new CustomEvent("mr:paywall", { detail: { reason, message } }));
        } catch {
          setState({
            open: true,
            reason: "limit",
            message: "Пробный доступ завершён",
          });
        }
      } else if (res.ok && AI_ROUTE_RE.test(rawUrl)) {
        // Successful AI call — tokens were consumed; tell TrialBanner to refresh
        window.dispatchEvent(new CustomEvent("mr:tokens-used"));
      }

      return res;
    };
  }, []);

  if (!state.open) return null;

  const title =
    state.reason === "expired"
      ? "Пробный период завершён"
      : state.reason === "exhausted"
      ? "Лимит токенов исчерпан"
      : "Доступ ограничен";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in srgb, var(--foreground) 42%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={() => setState(s => ({ ...s, open: false }))}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          padding: "28px 26px 22px",
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          position: "relative",
        }}
      >
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => setState(s => ({ ...s, open: false }))}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--muted-foreground)",
            padding: 6,
            display: "flex",
          }}
        >
          <X size={16} />
        </button>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "color-mix(in srgb, var(--primary) 16%, transparent)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Lock size={24} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.5, marginBottom: 18 }}>
          {state.message}. Чтобы продолжить пользоваться AI-функциями, оформите подписку.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/?billing=1";
            }}
            style={{
              flex: 1,
              minWidth: 140,
              background: "var(--primary)",
              color: "var(--primary-foreground, #fff)",
              border: "none",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Оформить подписку
          </button>
          <button
            type="button"
            onClick={() => setState(s => ({ ...s, open: false }))}
            style={{
              background: "transparent",
              color: "var(--foreground-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
