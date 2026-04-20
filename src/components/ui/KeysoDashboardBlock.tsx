"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { KeysoDashboardData } from "@/lib/types";
import { BarChart2, FileText, Eye, Target, Link2, TrendingUp, Star, Globe, Monitor, Radio, Swords } from "lucide-react";

const METRIC_EXPLANATIONS: Record<string, string> = {
  "Трафик с поиска": "Оценочное количество переходов из поисковых систем в месяц по всем ключевым запросам сайта",
  "Страниц в выдаче": "Количество страниц сайта, которые показываются в органической поисковой выдаче",
  "Видимость": "Доля показов сайта по всем отслеживаемым запросам относительно максимально возможного",
  "Рекл. запросов": "Количество запросов, по которым сайт также рекламируется в платной выдаче",
  "Входящие ссылки": "Общее количество внешних ссылок, ведущих на сайт с других доменов",
  "В топ 1": "Количество запросов, по которым сайт занимает первую позицию в поиске",
  "В топ 3": "Количество запросов, по которым сайт находится в топ-3 поисковой выдачи",
  "В топ 5": "Количество запросов в топ-5 поисковой выдачи",
  "В топ 10": "Количество запросов в топ-10 (первая страница) поисковой выдачи",
  "В топ 50": "Количество запросов в топ-50 поисковой выдачи",
  "DR (рейтинг домена)": "Авторитетность домена по шкале Ahrefs от 0 до 100. Чем выше — тем больше доверие поисковиков",
  "ИИ-ответы Алисы": "Количество запросов, в ответах на которые Яндекс Алиса упоминает ваш сайт",
  "Ссылающихся доменов": "Количество уникальных доменов, которые ссылаются на ваш сайт",
};

export function KeysoDashboardBlock({ c, dash }: {
  c: Colors;
  dash?: { yandex?: KeysoDashboardData; google?: KeysoDashboardData } | null;
}) {
  const y = dash?.yandex;
  const g = dash?.google;
  const [activeMetric, setActiveMetric] = useState<string | null>(null);

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
    const isActive = activeMetric === label;
    return (
      <div
        onClick={() => setActiveMetric(isActive ? null : label)}
        style={{ background: "var(--card)", borderRadius: 12, border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`, padding: "12px 16px", boxShadow: "var(--shadow)", cursor: explanation ? "pointer" : "default", transition: "border-color 0.15s ease" }}
      >
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}><span style={{display:"inline-flex",alignItems:"center",gap:5}}>{icon} {label}</span></div>
        <div style={{ fontSize: 20, fontWeight: 800, color: color ?? "var(--foreground)" }}>
          {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
        </div>
        {isActive && explanation && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.5, borderTop: `1px solid var(--muted)`, paddingTop: 8 }}>
            {explanation}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Main header */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 14 }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><BarChart2 size={14}/>Key.so — данные о поисковом трафике</span></div>

      {/* Позиции в поиске */}
      {(d.top1 || d.top3 || d.top5 || d.top10 || d.top50) ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}>ПОЗИЦИИ В ПОИСКЕ</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "В топ 1", val: d.top1 },
              { label: "В топ 3", val: d.top3 },
              { label: "В топ 5", val: d.top5 },
              { label: "В топ 10", val: d.top10 },
              { label: "В топ 50", val: d.top50 },
              ...(d.aiMentions ? [{ label: "ИИ-ответы Алисы", val: d.aiMentions }] : []),
            ].filter(x => x.val).map(x => {
              const explanation = METRIC_EXPLANATIONS[x.label];
              const isActive = activeMetric === x.label;
              return (
                <div key={x.label}
                  onClick={() => setActiveMetric(isActive ? null : x.label)}
                  style={{ background: "var(--card)", border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`, borderRadius: 10, padding: "8px 16px", boxShadow: "var(--shadow)", minWidth: 80, textAlign: "center", cursor: explanation ? "pointer" : "default", transition: "border-color 0.15s ease" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>{x.val}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{x.label}</div>
                  {isActive && explanation && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--foreground-secondary)", lineHeight: 1.5, borderTop: `1px solid var(--muted)`, paddingTop: 6, textAlign: "left" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 10 }}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Swords size={11}/>КОНКУРЕНТЫ В ОРГАНИКЕ</span></div>
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
