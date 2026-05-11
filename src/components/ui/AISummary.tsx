"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, AlertTriangle, TrendingUp, CheckCircle2, RefreshCw } from "lucide-react";

/**
 * AISummary — компактный AI-вывод поверх дашборда: «что важно прямо
 * сейчас + одно действие на сегодня». Закрывает P0-пробел из аудита
 * платформы (юзер тонет в цифрах, не понимает что делать).
 *
 *   <AISummary dashboard="company" data={analysisResult} />
 *
 * Кэширует ответ в localStorage по ключу (dashboard, hashOfData),
 * чтобы не дёргать AI на каждый ререндер. Кнопка «Обновить» — перегенерация.
 */
type Dashboard = "company" | "ta" | "smm" | "reviews";
type Priority = "low" | "medium" | "high";

interface SummaryCache {
  summary: string;
  priority: Priority;
  generatedAt: string;
  dataHash: string;
}

// Дешёвый детерминированный хэш — без crypto, просто чтобы различать снимки.
function hashOf(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function priorityStyle(p: Priority) {
  if (p === "high") {
    return {
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.30)",
      accent: "#ef4444",
      icon: <AlertTriangle size={18} />,
      label: "Срочно",
    };
  }
  if (p === "medium") {
    return {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.30)",
      accent: "#f59e0b",
      icon: <TrendingUp size={18} />,
      label: "Точка роста",
    };
  }
  return {
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.30)",
    accent: "#22c55e",
    icon: <CheckCircle2 size={18} />,
    label: "Стабильно",
  };
}

export function AISummary({
  dashboard,
  data,
  title,
  userId,
}: {
  dashboard: Dashboard;
  data: unknown;
  title?: string;
  userId?: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const cacheKey = `mr_aisum_${dashboard}${userId ? `_${userId}` : ""}`;
  const dataHash = hashOf(data);

  async function fetchSummary(force = false) {
    if (!data) return;
    // Кэш
    if (!force && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as SummaryCache;
          if (cached.dataHash === dataHash) {
            setSummary(cached.summary);
            setPriority(cached.priority);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    if (inflight.current) inflight.current.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard, data }),
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Ошибка генерации");
      setSummary(json.summary);
      setPriority(json.priority || "medium");
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            summary: json.summary,
            priority: json.priority || "medium",
            generatedAt: new Date().toISOString(),
            dataHash,
          } as SummaryCache),
        );
      } catch { /* ignore */ }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataHash]);

  if (!data) return null;

  const ps = priorityStyle(priority);

  return (
    <div
      style={{
        background: ps.bg,
        border: `1px solid ${ps.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 20,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${ps.accent}1c`,
          color: ps.accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {summary ? ps.icon : <Sparkles size={18} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: ps.accent,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            AI · {summary ? ps.label : "анализирует"}
          </span>
          {title && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--foreground-secondary)",
              }}
            >
              · {title}
            </span>
          )}
        </div>
        {loading && !summary && (
          <div
            style={{
              fontSize: 14,
              color: "var(--foreground-secondary)",
              fontStyle: "italic",
              lineHeight: 1.55,
            }}
          >
            Собираю вывод по вашим данным…
          </div>
        )}
        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#ef4444",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
        {summary && (
          <div
            style={{
              fontSize: 14.5,
              color: "var(--foreground)",
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            {summary}
          </div>
        )}
      </div>
      <button
        onClick={() => fetchSummary(true)}
        disabled={loading}
        aria-label="Обновить вывод"
        title="Перегенерировать вывод"
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 8px",
          color: "var(--foreground-secondary)",
          cursor: loading ? "wait" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: "inherit",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <RefreshCw size={14} className={loading ? "mr-spin" : ""} />
      </button>
    </div>
  );
}
