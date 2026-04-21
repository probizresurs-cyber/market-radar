"use client";

import { useEffect } from "react";

/**
 * Фиксирует визит в activity_logs один раз на сессию в рамках одного source.
 * Если пользователь повторно заходит на платформу/лендинг в рамках того же
 * sessionStorage — не отправляем дубль (чтобы не шумело).
 */
export function VisitTracker({ source }: { source: "landing" | "platform" }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `mr_visit_logged_${source}`;
    // Лог один раз за сессию браузера (sessionStorage чистится при закрытии вкладки/окна)
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");

    const body = {
      source,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || "",
      utm: (() => {
        const p = new URLSearchParams(window.location.search);
        const utm: Record<string, string> = {};
        ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(k => {
          const v = p.get(k);
          if (v) utm[k] = v;
        });
        return utm;
      })(),
    };

    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => { /* tracking — silent */ });
  }, [source]);

  return null;
}
