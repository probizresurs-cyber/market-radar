"use client";

import React, { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { BarChart2, Target, Coins, Eye, Swords, Megaphone, TrendingUp } from "lucide-react";

type SpywordsDashboard = NonNullable<AnalysisResult["spywordsDashboard"]>;

interface Props {
  data: SpywordsDashboard;
}

const METRIC_HINTS: Record<string, string> = {
  "Ключей в органике": "Сколько уникальных запросов сайта показываются в выдаче поисковика",
  "Трафик из органики": "Оценка SpyWords о месячном бесплатном трафике из поиска",
  "Ключей в контексте": "Сколько запросов сайт выкупает в платной выдаче (Яндекс.Директ / Google Ads)",
  "Трафик из контекста": "Оценка месячного платного трафика из контекстной рекламы",
  "Бюджет на контекст": "Сколько сайт примерно тратит в месяц на платную рекламу (₽)",
  "Видимость": "Доля видимости домена в выдаче по отслеживаемым SpyWords запросам",
};

function fmt(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("ru-RU");
}

function fmtMoney(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${Math.round(n / 1000).toLocaleString("ru-RU")} тыс. ₽`;
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  const hint = METRIC_HINTS[label];
  return (
    <div style={{
      background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)",
      padding: "14px 16px", boxShadow: "var(--shadow)",
      display: "flex", flexDirection: "column", minHeight: 110,
    }}>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{icon} {label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? "var(--foreground)", lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function SpywordsBlock({ data }: Props) {
  const hasYandex = !!(data.overview?.yandex || (data.competitors?.yandex?.length) || (data.ads?.yandex?.length));
  const hasGoogle = !!(data.overview?.google || (data.competitors?.google?.length) || (data.ads?.google?.length));

  const [engine, setEngine] = useState<"yandex" | "google">(hasYandex ? "yandex" : "google");

  // Если совсем нет данных — не рендерим
  if (!hasYandex && !hasGoogle) return null;

  const ov  = engine === "yandex" ? data.overview?.yandex : data.overview?.google;
  const cmp = engine === "yandex" ? data.competitors?.yandex : data.competitors?.google;
  const ads = engine === "yandex" ? data.ads?.yandex : data.ads?.google;

  const engineLabel = engine === "yandex" ? "Яндекс" : "Google";
  const engineColor = engine === "yandex" ? "#FF5500" : "#4285F4";

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header + Yandex/Google toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={14} /> SpyWords — органика, реклама и конкуренты
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginLeft: 8 }}>
            дополнение к Keys.so
          </span>
        </div>
        {hasYandex && hasGoogle && (
          <div style={{ display: "inline-flex", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: 2 }}>
            <button
              type="button"
              onClick={() => setEngine("yandex")}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: engine === "yandex" ? "#FF5500" : "transparent",
                color: engine === "yandex" ? "#fff" : "var(--foreground-secondary)",
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Яндекс
            </button>
            <button
              type="button"
              onClick={() => setEngine("google")}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: engine === "google" ? "#4285F4" : "transparent",
                color: engine === "google" ? "#fff" : "var(--foreground-secondary)",
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Google
            </button>
          </div>
        )}
      </div>

      {/* Overview block */}
      {ov && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            ОБЗОР В {engineLabel.toUpperCase()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {ov.organicKeywords > 0 && (
              <MetricCard icon={<BarChart2 size={12} />} label="Ключей в органике" value={fmt(ov.organicKeywords)} accent="var(--success)" />
            )}
            {ov.organicTraffic > 0 && (
              <MetricCard icon={<TrendingUp size={12} />} label="Трафик из органики" value={`${fmt(ov.organicTraffic)} / мес`} />
            )}
            {ov.adKeywords > 0 && (
              <MetricCard icon={<Target size={12} />} label="Ключей в контексте" value={fmt(ov.adKeywords)} accent="var(--warning)" />
            )}
            {ov.adTraffic > 0 && (
              <MetricCard icon={<Megaphone size={12} />} label="Трафик из контекста" value={`${fmt(ov.adTraffic)} / мес`} />
            )}
            {ov.adBudget > 0 && (
              <MetricCard icon={<Coins size={12} />} label="Бюджет на контекст" value={fmtMoney(ov.adBudget)} accent="var(--destructive)" />
            )}
            {ov.visibility > 0 && (
              <MetricCard icon={<Eye size={12} />} label="Видимость" value={`${ov.visibility.toFixed(1)}%`} />
            )}
          </div>
        </div>
      )}

      {/* SEO competitors */}
      {cmp && cmp.length > 0 && (
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", padding: "14px 18px", boxShadow: "var(--shadow)", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Swords size={11} /> SEO-КОНКУРЕНТЫ В {engineLabel.toUpperCase()} (ПО SPYWORDS)
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cmp.slice(0, 8).map(c => (
              <div key={c.domain} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.domain}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--muted-foreground)" }}>
                  {c.commonKeywords > 0 && (
                    <span title="Общих ключей с вами">
                      <b style={{ color: engineColor }}>{fmt(c.commonKeywords)}</b> общих
                    </span>
                  )}
                  {c.totalKeywords > 0 && (
                    <span title="Всего ключей у конкурента">всего {fmt(c.totalKeywords)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top ads */}
      {ads && ads.length > 0 && (
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", padding: "14px 18px", boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Megaphone size={11} /> ТОП ОБЪЯВЛЕНИЙ В {engineLabel.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ads.slice(0, 6).map((a, i) => (
              <div key={`${a.keyword}-${i}`} style={{
                padding: "10px 12px",
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: engineColor, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {a.keyword}
                </div>
                {a.title && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>
                    {a.title}
                  </div>
                )}
                {a.description && (
                  <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
                    {a.description}
                  </div>
                )}
                {a.visibleUrl && (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                    {a.visibleUrl}
                    {typeof a.position === "number" && a.position > 0 && (
                      <span style={{ marginLeft: 8 }}>· позиция {a.position}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
