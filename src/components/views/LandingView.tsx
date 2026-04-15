"use client";

import { useState } from "react";
import type { Colors, Theme } from "@/lib/colors";

export function LandingView({ c, theme, setTheme, onAnalyze }: {
  c: Colors;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onAnalyze: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAnalyze(url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--background)", fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>MR</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, color: "var(--foreground)", lineHeight: 1.1 }}>MarketRadar</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Узнайте всё о своих конкурентах за 10 минут</div>
        </div>
      </div>
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "32px 36px", width: "100%", maxWidth: 520, boxShadow: "var(--shadow-lg)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: "0 0 6px" }}>Проанализируйте любой сайт</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 24px" }}>Введите URL — мы оценим SEO, соцсети, контент и дадим конкретные рекомендации</p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="example.ru" disabled={loading}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${error ? c.accentRed : "var(--border)"}`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={loading || !url.trim()}
              style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", opacity: loading || !url.trim() ? 0.65 : 1, fontFamily: "inherit" }}>
              {loading ? "Анализ…" : "Анализировать →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: c.accentRed, fontSize: 13 }}>{error}</div>}
        </form>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginTop: 24 }}>
          {[{ i: "🔍", t: "SEO-аудит" }, { i: "📱", t: "Соцсети" }, { i: "✏️", t: "Анализ контента" }, { i: "⚙️", t: "Технологии" }, { i: "👥", t: "HR-бренд" }, { i: "💡", t: "AI-рекомендации" }].map(({ i, t }) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-foreground)" }}><span>{i}</span><span>{t}</span></div>
          ))}
        </div>
      </div>
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ marginTop: 20, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 13, fontFamily: "inherit" }}>
        {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
      </button>
    </div>
  );
}
