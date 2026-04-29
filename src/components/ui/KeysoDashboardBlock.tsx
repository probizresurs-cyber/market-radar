"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { KeysoDashboardData, SeoPosition } from "@/lib/types";
import { BarChart2, FileText, Eye, Target, Link2, TrendingUp, Star, Globe, Monitor, Radio, Swords, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export interface KeysoRefreshResult {
  keysoDashboard: { yandex?: KeysoDashboardData; google?: KeysoDashboardData };
  positions: SeoPosition[];
  googlePositions: SeoPosition[];
  refreshedAt: string;
}

// Короткое описание для каждой метрики — отображается постоянно,
// чтобы пользователь не гадал, что значит столбец.
const METRIC_EXPLANATIONS: Record<string, string> = {
  "Трафик с поиска": "Оценочное количество переходов из поисковых систем в месяц по всем ключевым запросам сайта",
  "Страниц в выдаче": "Количество страниц сайта, которые показываются в органической поисковой выдаче",
  "Видимость": "Доля показов сайта по всем отслеживаемым запросам относительно максимально возможного",
  "Рекл. запросов": "Количество запросов, по которым сайт также рекламируется в платной выдаче",
  "Входящие ссылки": "Общее количество внешних ссылок, ведущих на сайт с других доменов",
  "Исходящие ссылки": "Количество ссылок с сайта на внешние ресурсы",
  "В топ 1": "Количество запросов, по которым сайт занимает первую позицию в поиске",
  "В топ 3": "Количество запросов, по которым сайт находится в топ-3 поисковой выдачи",
  "В топ 5": "Количество запросов в топ-5 поисковой выдачи",
  "В топ 10": "Количество запросов в топ-10 (первая страница) поисковой выдачи",
  "В топ 50": "Количество запросов в топ-50 поисковой выдачи",
  "DR (рейтинг домена)": "Авторитетность домена по шкале Ahrefs от 0 до 100. Чем выше — тем больше доверие поисковиков",
  "ИИ-ответы Алисы": "Количество запросов, в ответах на которые Яндекс Алиса упоминает ваш сайт",
  "Ссылающихся доменов": "Количество уникальных доменов, которые ссылаются на ваш сайт",
  "Исходящих доменов": "Количество уникальных доменов, на которые ссылается сайт",
  "Ссылок по IP": "Количество ссылок с IP-адресов, связанных с сайтом (proxy-метрика спам-активности)",
};

export function KeysoDashboardBlock({ c, dash, domain, onRefresh }: {
  c: Colors;
  dash?: { yandex?: KeysoDashboardData; google?: KeysoDashboardData } | null;
  /** Если указан — показывается кнопка «Обновить» вверху блока */
  domain?: string;
  /** Callback с новыми данными после успешного обновления через /api/keyso/refresh */
  onRefresh?: (result: KeysoRefreshResult) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!domain || !onRefresh) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/keyso/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (json.ok) {
        onRefresh(json as KeysoRefreshResult);
        setRefreshedAt(json.refreshedAt);
        // Reset success indicator after 4 seconds
        setTimeout(() => setRefreshedAt(prev => prev === json.refreshedAt ? null : prev), 4000);
      } else {
        setRefreshError(json.error ?? "Ошибка обновления");
      }
    } catch {
      setRefreshError("Не удалось связаться с Keys.so");
    } finally {
      setRefreshing(false);
    }
  };

  const y = dash?.yandex;
  const g = dash?.google;

  // Check if we actually have meaningful data
  const hasData = (d?: KeysoDashboardData | null) =>
    d && (d.traffic > 0 || d.pagesInOrganic > 0 || d.top10 || d.top50 || d.backlinks || d.dr);

  if (!hasData(y) && !hasData(g)) {
    return (
      <div style={{ background: "var(--card)", borderRadius: 14, border: `1px dashed var(--border)`, padding: 20, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, boxShadow: "var(--shadow)", marginBottom: 16 }}>
        Данных по этому домену в базе Key.so не найдено — попробуйте запустить новый анализ
      </div>
    );
  }

  const d = y ?? g!;

  const MetricCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string | undefined; color?: string }) => {
    if (!value && value !== 0) return null;
    const explanation = METRIC_EXPLANATIONS[label];
    return (
      <div style={{
        background: "var(--card)", borderRadius: 12, border: `1px solid var(--border)`,
        padding: "14px 16px", boxShadow: "var(--shadow)",
        display: "flex", flexDirection: "column", minHeight: 110,
      }}>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{icon} {label}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: color ?? "var(--foreground)", lineHeight: 1.1 }}>
          {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
        </div>
        {explanation && (
          <div style={{
            marginTop: 8, fontSize: 11, color: "var(--muted-foreground)",
            lineHeight: 1.45,
          }}>
            {explanation}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Main header with optional refresh button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={14} />Key.so — данные о поисковом трафике
          </span>
        </div>
        {domain && onRefresh && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {refreshError && (
              <span style={{ fontSize: 11, color: "var(--destructive)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={12} /> {refreshError}
              </span>
            )}
            {refreshedAt && !refreshError && (
              <span style={{ fontSize: 11, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={12} /> Обновлено
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Обновить только данные Keys.so без перезапуска полного анализа"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8,
                border: `1px solid var(--border)`,
                background: refreshing ? "var(--muted)" : "var(--card)",
                color: refreshing ? "var(--muted-foreground)" : "var(--foreground-secondary)",
                fontWeight: 600, fontSize: 12,
                cursor: refreshing ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <RefreshCw size={12} style={{ animation: refreshing ? "ksb-spin 0.8s linear infinite" : "none" }} />
              {refreshing ? "Обновление…" : "Обновить"}
            </button>
            <style>{`@keyframes ksb-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>

      {/* Позиции в поиске */}
      {(d.top1 || d.top3 || d.top5 || d.top10 || d.top50) ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>ПОЗИЦИИ В ПОИСКЕ</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
          }}>
            {[
              { label: "В топ 1", val: d.top1 },
              { label: "В топ 3", val: d.top3 },
              { label: "В топ 5", val: d.top5 },
              { label: "В топ 10", val: d.top10 },
              { label: "В топ 50", val: d.top50 },
              ...(d.aiMentions ? [{ label: "ИИ-ответы Алисы", val: d.aiMentions }] : []),
            ].filter(x => x.val).map(x => {
              const explanation = METRIC_EXPLANATIONS[x.label];
              return (
                <div key={x.label} style={{
                  background: "var(--card)", border: `1px solid var(--border)`,
                  borderRadius: 10, padding: "12px 16px", boxShadow: "var(--shadow)",
                  display: "flex", flexDirection: "column", minHeight: 110,
                }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "var(--primary)", lineHeight: 1.1 }}>{x.val}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, fontWeight: 600 }}>{x.label}</div>
                  {explanation && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
                      {explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Органика */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>ОРГАНИЧЕСКАЯ ВЫДАЧА</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          <MetricCard icon={<BarChart2 size={12}/>} label="Трафик с поиска" value={d.traffic} color={"var(--success)"} />
          <MetricCard icon={<FileText size={12}/>} label="Страниц в выдаче" value={d.pagesInOrganic} />
          <MetricCard icon={<Eye size={12}/>} label="Видимость" value={d.visibility} />
          <MetricCard icon={<Target size={12}/>} label="Рекл. запросов" value={d.adKeys} />
        </div>
      </div>

      {/* Ссылки */}
      {(d.backlinks || d.dr || d.referringDomains) ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>ССЫЛКИ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            <MetricCard icon={<Link2 size={12}/>} label="Входящие ссылки" value={d.backlinks} />
            <MetricCard icon={<TrendingUp size={12}/>} label="Исходящие ссылки" value={d.outboundLinks} />
            <MetricCard icon={<Star size={12}/>} label="DR (рейтинг домена)" value={d.dr} color={"var(--warning)"} />
            <MetricCard icon={<Globe size={12}/>} label="Ссылающихся доменов" value={d.referringDomains} />
            <MetricCard icon={<Monitor size={12}/>} label="Исходящих доменов" value={d.outboundDomains} />
            <MetricCard icon={<Radio size={12}/>} label="Ссылок по IP" value={d.ipLinks} />
          </div>
        </div>
      ) : null}

      {/* Конкуренты */}
      {d.competitors && d.competitors.length > 0 && (
        <div style={{ background: "var(--card)", borderRadius: 12, border: `1px solid var(--border)`, padding: "14px 18px", boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Swords size={11} />КОНКУРЕНТЫ В ОРГАНИКЕ
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {d.competitors.map(comp => (
              <span key={comp} style={{ background: "var(--background)", border: `1px solid var(--muted)`, padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "var(--foreground-secondary)", fontWeight: 500 }}>{comp}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
