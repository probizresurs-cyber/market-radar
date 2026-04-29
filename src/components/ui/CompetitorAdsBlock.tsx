"use client";

import React, { useState } from "react";
import { Megaphone, ExternalLink, Sparkles, AlertTriangle } from "lucide-react";

interface Ad {
  title?: string;
  text?: string;
  url?: string;
  visibility?: number;
  position?: number;
}

interface Props {
  domain: string;
}

/**
 * Блок «Объявления Я.Директ конкурента» — реальные тексты + посадочные.
 * Используется в CompetitorProfileView.
 */
export function CompetitorAdsBlock({ domain }: Props) {
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/keyso/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, base: "msk", limit: 15 }),
      });
      const json = await res.json();
      if (json.ok) setAds(json.ads);
      else setError(json.error ?? "Не удалось получить данные");
    } catch {
      setError("Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 22, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ads ? 16 : 0, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b15", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
            <Megaphone size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>Реклама конкурента в Я.Директ</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Реальные объявления, заголовки и посадочные страницы
            </div>
          </div>
        </div>
        <button
          onClick={fetchAds}
          disabled={loading}
          style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: loading ? "var(--muted)" : "#f59e0b",
            color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}
        >
          <Sparkles size={13} /> {loading ? "Загружаем…" : ads ? "Обновить" : "Показать рекламу"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--destructive)15", color: "var(--destructive)", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {ads && ads.length === 0 && (
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
          Этот конкурент сейчас не размещает рекламу в Я.Директ (или Keys.so не нашёл данных).
        </div>
      )}

      {ads && ads.length > 0 && (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {ads.map((ad, i) => (
              <div key={i} style={{
                background: "var(--background)", borderRadius: 12, border: `1px solid var(--border)`,
                padding: "14px 16px", borderLeft: "3px solid #f59e0b",
              }}>
                {ad.title && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 6, lineHeight: 1.35 }}>
                    {ad.title}
                  </div>
                )}
                {ad.text && (
                  <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 8, lineHeight: 1.55 }}>
                    {ad.text}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {ad.url && (
                    <a
                      href={ad.url.startsWith("http") ? ad.url : `https://${ad.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12, color: "#f59e0b", textDecoration: "none",
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: "#f59e0b15", padding: "3px 10px", borderRadius: 6, fontWeight: 600,
                      }}
                    >
                      <ExternalLink size={11} />
                      {ad.url.replace(/^https?:\/\//, "").slice(0, 50)}{ad.url.length > 50 ? "…" : ""}
                    </a>
                  )}
                  {ad.position !== undefined && (
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Позиция: {ad.position}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#f59e0b08", border: "1px solid #f59e0b25", borderRadius: 10, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.6 }}>
            💡 Используйте эти заголовки и УТП в ваших Battle Cards — отдел продаж сможет точно отстраиваться от того, что обещают конкуренты.
          </div>
        </>
      )}
    </div>
  );
}
