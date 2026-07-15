"use client";

import { useState } from "react";
import Link from "next/link";

interface PositionResult {
  keyword: string;
  position: number | null;
  status: "done" | "not_found" | "failed";
  errorMessage?: string;
}

interface CheckResponse {
  ok: boolean;
  batchId?: string;
  domain?: string;
  engine?: string;
  results?: PositionResult[];
  error?: string;
}

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" } as React.CSSProperties,
  header: {
    background: "#1a1f2e",
    borderBottom: "1px solid #2d3748",
    padding: "0 32px",
    height: 60,
    display: "flex",
    alignItems: "center",
    gap: 16,
  } as React.CSSProperties,
  logo: { fontSize: 20, fontWeight: 800, color: "#7c3aed", textDecoration: "none" } as React.CSSProperties,
  crumb: { fontSize: 13, color: "#64748b" } as React.CSSProperties,
  main: { padding: "32px", maxWidth: 980, margin: "0 auto" } as React.CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 24, lineHeight: 1.6 } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 24, marginBottom: 24 } as React.CSSProperties,
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  input: {
    width: "100%",
    background: "#0f1117",
    color: "#e2e8f0",
    border: "1px solid #2d3748",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    background: "#0f1117",
    color: "#e2e8f0",
    border: "1px solid #2d3748",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    minHeight: 160,
    fontFamily: "inherit",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  },
  row: { display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" as const },
  col: { flex: "1 1 220px", minWidth: 220 },
  select: {
    width: "100%",
    background: "#0f1117",
    color: "#e2e8f0",
    border: "1px solid #2d3748",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
  },
  hint: { fontSize: 12, color: "#475569", marginTop: 6 },
  button: (disabled: boolean) =>
    ({
      background: disabled ? "#334155" : "#7c3aed",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "12px 24px",
      fontSize: 14,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
    } as React.CSSProperties),
  error: {
    background: "#3f1d1d",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    marginBottom: 16,
  } as React.CSSProperties,
  progress: { fontSize: 13, color: "#94a3b8", marginTop: 12 } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: {
    textAlign: "left" as const,
    padding: "10px 12px",
    background: "#0f1117",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    borderBottom: "1px solid #2d3748",
  },
  td: { padding: "10px 12px", borderBottom: "1px solid #1e2737", verticalAlign: "top" as const, color: "#e2e8f0" },
  badge: (status: PositionResult["status"]) => {
    const colors: Record<PositionResult["status"], string> = {
      done: "#22c55e",
      not_found: "#94a3b8",
      failed: "#ef4444",
    };
    const labels: Record<PositionResult["status"], string> = {
      done: "найдено",
      not_found: "не найдено в топе",
      failed: "не удалось проверить",
    };
    return {
      style: {
        color: colors[status],
        fontWeight: 700,
        fontSize: 12,
      } as React.CSSProperties,
      label: labels[status],
    };
  },
};

const KEYWORD_PLACEHOLDER = "купить диван москва\nдиван недорого\nугловой диван цена";

export default function PositionCheckerClient() {
  const [domain, setDomain] = useState("");
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [engine, setEngine] = useState<"yandex" | "google">("yandex");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CheckResponse | null>(null);

  const keywordCount = keywordsRaw
    .split("\n")
    .map((k) => k.trim())
    .filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResponse(null);

    const keywords = Array.from(
      new Set(
        keywordsRaw
          .split("\n")
          .map((k) => k.trim())
          .filter(Boolean)
      )
    ).slice(0, 10);

    if (!domain.trim()) {
      setError("Укажите домен");
      return;
    }
    if (keywords.length === 0) {
      setError("Укажите хотя бы одно ключевое слово (по одному на строку)");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/check-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), keywords, engine, region: region.trim() || undefined }),
      });
      const data: CheckResponse = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || `Ошибка запроса (${r.status})`);
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить запрос");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/admin/dashboard" style={S.logo}>MarketRadar Admin</Link>
        <span style={S.crumb}>/ Position Checker</span>
      </header>

      <main style={S.main}>
        <div style={S.h1}>Проверка позиций в поиске</div>
        <div style={S.sub}>
          Живая проверка через headless-браузер (реальный запрос в Yandex/Google) — не оценка от AI.
          Проверка идёт последовательно по ключевым словам с паузами, чтобы снизить риск капчи; на 10
          слов может уйти 1.5-2 минуты. Если поисковик показал капчу или заблокировал запрос — строка будет
          помечена «не удалось проверить», позиция не выдумывается. Осторожный первый запуск: не больше
          3 проверок в день.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={S.card}>
            <div style={S.row}>
              <div style={S.col}>
                <label style={S.label}>Домен</label>
                <input
                  style={S.input}
                  placeholder="example.ru"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <div style={S.col}>
                <label style={S.label}>Поисковик</label>
                <select style={S.select} value={engine} onChange={(e) => setEngine(e.target.value as "yandex" | "google")}>
                  <option value="yandex">Yandex</option>
                  <option value="google">Google</option>
                </select>
              </div>
              <div style={S.col}>
                <label style={S.label}>Регион (опционально)</label>
                <input
                  style={S.input}
                  placeholder="Москва / ru / 213"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
                <div style={S.hint}>По умолчанию Москва (Yandex) / ru (Google)</div>
              </div>
            </div>

            <label style={S.label}>Ключевые слова (по одному на строку, максимум 10)</label>
            <textarea
              style={S.textarea}
              placeholder={KEYWORD_PLACEHOLDER}
              value={keywordsRaw}
              onChange={(e) => setKeywordsRaw(e.target.value)}
            />
            <div style={S.hint}>{keywordCount} / 10 ключевых слов</div>

            {error && <div style={{ ...S.error, marginTop: 16 }}>{error}</div>}

            <div style={{ marginTop: 16 }}>
              <button type="submit" style={S.button(loading)} disabled={loading}>
                {loading ? "Проверяем…" : "Проверить позиции"}
              </button>
              {loading && (
                <div style={S.progress}>
                  Идёт последовательная проверка — окно нельзя закрывать до завершения запроса.
                </div>
              )}
            </div>
          </div>
        </form>

        {response?.results && (
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {response.domain} · {response.engine === "yandex" ? "Yandex" : "Google"}
            </div>
            <div style={{ ...S.hint, marginBottom: 16 }}>batch {response.batchId}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Ключевое слово</th>
                    <th style={S.th}>Позиция</th>
                    <th style={S.th}>Статус</th>
                    <th style={S.th}>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.map((r, i) => {
                    const badge = S.badge(r.status);
                    return (
                      <tr key={`${r.keyword}-${i}`}>
                        <td style={{ ...S.td, fontWeight: 600 }}>{r.keyword}</td>
                        <td style={S.td}>{r.position ?? "—"}</td>
                        <td style={S.td}>
                          <span style={badge.style}>{badge.label}</span>
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: "#94a3b8" }}>{r.errorMessage ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
