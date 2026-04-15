"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { KeysoDashboardData } from "@/lib/types";

export function KeysoDashboardBlock({ c, dash }: {
  c: Colors;
  dash?: { yandex?: KeysoDashboardData; google?: KeysoDashboardData } | null;
}) {
  const y = dash?.yandex;
  const g = dash?.google;

  // Check if we actually have meaningful data
  const hasData = (d?: KeysoDashboardData | null) =>
    d && (d.traffic > 0 || d.pagesInOrganic > 0 || d.top10 || d.top50 || d.backlinks || d.dr);

  if (!hasData(y) && !hasData(g)) {
    return (
      <div style={{ background: c.bgCard, borderRadius: 14, border: `1px dashed ${c.border}`, padding: 20, textAlign: "center", color: c.textMuted, fontSize: 13, boxShadow: c.shadow, marginBottom: 16 }}>
        Данных по этому домену в базе Key.so не найдено — попробуйте запустить новый анализ
      </div>
    );
  }

  const d = y ?? g!;

  const MetricCard = ({ icon, label, value, color }: { icon: string; label: string; value: number | string | undefined; color?: string }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: "12px 16px", boxShadow: c.shadow }}>
        <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 6 }}>{icon} {label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: color ?? c.textPrimary }}>
          {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Позиции в поиске */}
      {(d.top1 || d.top3 || d.top5 || d.top10 || d.top50) ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 10 }}>ЗАПРОСЫ САЙТА (ЯНДЕКС)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "В топ 1", val: d.top1 },
              { label: "В топ 3", val: d.top3 },
              { label: "В топ 5", val: d.top5 },
              { label: "В топ 10", val: d.top10 },
              { label: "В топ 50", val: d.top50 },
              ...(d.aiMentions ? [{ label: "ИИ-ответы Алисы", val: d.aiMentions }] : []),
            ].filter(x => x.val).map(x => (
              <div key={x.label} style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 16px", boxShadow: c.shadow, minWidth: 80, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.accent }}>{x.val}</div>
                <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{x.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Органика */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 10 }}>ОРГАНИЧЕСКАЯ ВЫДАЧА</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          <MetricCard icon="📊" label="Трафик с поиска" value={d.traffic} color={c.accentGreen} />
          <MetricCard icon="📄" label="Страниц в выдаче" value={d.pagesInOrganic} />
          <MetricCard icon="👁️" label="Видимость" value={d.visibility} />
          <MetricCard icon="🎯" label="Рекл. запросов" value={d.adKeys} />
        </div>
      </div>

      {/* Ссылки */}
      {(d.backlinks || d.dr || d.referringDomains) ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 10 }}>ССЫЛКИ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
            <MetricCard icon="🔗" label="Входящие ссылки" value={d.backlinks} />
            <MetricCard icon="↗️" label="Исходящие ссылки" value={d.outboundLinks} />
            <MetricCard icon="⭐" label="DR (рейтинг домена)" value={d.dr} color={c.accentWarm} />
            <MetricCard icon="🌐" label="Ссылающихся доменов" value={d.referringDomains} />
            <MetricCard icon="🖥️" label="Исходящих доменов" value={d.outboundDomains} />
            <MetricCard icon="📡" label="Ссылок по IP" value={d.ipLinks} />
          </div>
        </div>
      ) : null}

      {/* Конкуренты */}
      {d.competitors && d.competitors.length > 0 && (
        <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: "14px 18px", boxShadow: c.shadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 10 }}>⚔️ КОНКУРЕНТЫ В ОРГАНИКЕ</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {d.competitors.map(comp => (
              <span key={comp} style={{ background: c.bg, border: `1px solid ${c.borderLight}`, padding: "4px 10px", borderRadius: 8, fontSize: 12, color: c.textSecondary, fontWeight: 500 }}>{comp}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
