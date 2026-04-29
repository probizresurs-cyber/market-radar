"use client";

import React, { useState } from "react";
import {
  FileText, AlertTriangle, Layers,
  Sparkles, ExternalLink, RefreshCw, TrendingDown,
} from "lucide-react";

interface TopPage { url: string; traffic: number; keysCount: number; topKeyword?: string; }
interface LostKeyword { keyword: string; oldPosition: number; newPosition: number | null; volume: number; }

interface InsightsData {
  topPages: TopPage[];
  lostKeywords: LostKeyword[];
}

type TabId = "pages" | "lost";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  countOf: (d: InsightsData) => number;
}

const TABS: Tab[] = [
  { id: "pages", label: "Топ страниц",      icon: <FileText size={14} />,     countOf: d => d.topPages.length },
  { id: "lost",  label: "Потерянные ключи", icon: <TrendingDown size={14} />, countOf: d => d.lostKeywords.length },
];

export function KeysoSiteInsightsBlock({ domain }: { domain: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("pages");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/keyso/site-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, base: "msk" }),
      });
      const json = await res.json();
      if (json.ok) {
        setData({
          topPages: json.topPages ?? [],
          lostKeywords: json.lostKeywords ?? [],
        });
        // Автоматически выбираем первый таб где есть данные
        const d = { topPages: json.topPages ?? [], lostKeywords: json.lostKeywords ?? [] };
        const firstNonEmpty = TABS.find(t => t.countOf(d) > 0);
        if (firstNonEmpty) setActiveTab(firstNonEmpty.id);
      } else {
        setError(json.error ?? "Не удалось получить данные");
      }
    } catch {
      setError("Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 22, boxShadow: "var(--shadow)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: data ? 16 : 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)15", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>SEO детали по сайту</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Топ страницы по органике и потерянные ключи — из Keys.so
            </div>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: loading ? "var(--muted)" : "var(--primary)",
            color: loading ? "var(--muted-foreground)" : "#fff",
            fontWeight: 700, fontSize: 13, cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          }}
        >
          {loading ? (
            <><RefreshCw size={13} style={{ animation: "ksib-spin 0.8s linear infinite" }} /> Загружаем…</>
          ) : data ? (
            <><RefreshCw size={13} /> Обновить</>
          ) : (
            <><Sparkles size={13} /> Загрузить детали</>
          )}
          <style>{`@keyframes ksib-spin { to { transform: rotate(360deg); } }`}</style>
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--destructive)15", color: "var(--destructive)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div style={{ marginTop: 14, padding: "16px", borderRadius: 12, background: "var(--background)", border: "1px dashed var(--border)", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
          Запросы к Keys.so — займёт несколько секунд
        </div>
      )}

      {data && (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: "var(--background)", marginBottom: 14, overflowX: "auto", flexWrap: "wrap" }}>
            {TABS.map((t) => {
              const count = t.countOf(data);
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  disabled={count === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 7, border: "none",
                    background: isActive ? "var(--card)" : "transparent",
                    color: count === 0 ? "var(--muted-foreground)" : isActive ? "var(--primary)" : "var(--foreground-secondary)",
                    fontWeight: isActive ? 700 : 600, fontSize: 12,
                    cursor: count === 0 ? "default" : "pointer",
                    boxShadow: isActive ? "var(--shadow)" : "none",
                    opacity: count === 0 ? 0.5 : 1,
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {t.icon}
                  {t.label}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                    background: isActive ? "var(--primary)15" : "var(--muted)",
                    color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                    minWidth: 14, textAlign: "center",
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Tab contents */}
          {activeTab === "pages" && <TopPagesTab pages={data.topPages} />}
          {activeTab === "lost" && <LostKeywordsTab items={data.lostKeywords} />}
        </>
      )}
    </div>
  );
}

// ─── Tab components ───────────────────────────────────────────────────────────

function TopPagesTab({ pages }: { pages: TopPage[] }) {
  if (!pages.length) return <EmptyState text="Keys.so не вернул топовых страниц по этому домену" />;
  const maxTraffic = Math.max(...pages.map(p => p.traffic), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pages.map((p, i) => (
        <div key={i} style={{ padding: "11px 14px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{
              fontSize: 13, color: "var(--primary)", textDecoration: "none", fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            }}>
              <ExternalLink size={11} />
              {p.url.replace(/^https?:\/\//, "").slice(0, 60)}{p.url.length > 70 ? "…" : ""}
            </a>
            <div style={{ display: "flex", gap: 10, flexShrink: 0, fontSize: 11, color: "var(--muted-foreground)" }}>
              <span><b style={{ color: "var(--foreground)" }}>{p.traffic.toLocaleString("ru-RU")}</b> трафик/мес</span>
              <span><b style={{ color: "var(--foreground)" }}>{p.keysCount}</b> ключей</span>
            </div>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--muted)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(p.traffic / maxTraffic) * 100}%`, background: "var(--primary)", borderRadius: 2 }} />
          </div>
          {p.topKeyword && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 5 }}>
              Топ ключ: <span style={{ color: "var(--foreground)" }}>{p.topKeyword}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LostKeywordsTab({ items }: { items: LostKeyword[] }) {
  if (!items.length) return <EmptyState text="Потерянных ключевых слов не найдено — позиции стабильны" success />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((k, i) => {
        const fell = k.newPosition === null
          ? "выпал из топ-100"
          : `с #${k.oldPosition} → #${k.newPosition}`;
        return (
          <div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: "color-mix(in oklch, var(--destructive) 4%, var(--background))", border: "1px solid color-mix(in oklch, var(--destructive) 25%, transparent)", display: "flex", alignItems: "center", gap: 10 }}>
            <TrendingDown size={14} style={{ color: "var(--destructive)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>«{k.keyword}»</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--destructive)", fontWeight: 700, whiteSpace: "nowrap" }}>{fell}</span>
            {k.volume > 0 && (
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{k.volume.toLocaleString("ru-RU")}/мес</span>
            )}
          </div>
        );
      })}
    </div>
  );
}


function EmptyState({ text, success = false }: { text: string; success?: boolean }) {
  return (
    <div style={{
      padding: "24px 16px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13,
      background: success ? "color-mix(in oklch, var(--success) 4%, transparent)" : "var(--background)",
      borderRadius: 10, border: "1px dashed var(--border)",
    }}>
      {success ? "✓ " : ""}{text}
    </div>
  );
}
