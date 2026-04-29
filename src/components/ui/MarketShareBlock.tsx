"use client";

import React, { useState } from "react";
import { PieChart, Sparkles, AlertTriangle } from "lucide-react";

interface Share {
  domain: string;
  share: number;
  visibility: number;
  traffic?: number;
}

interface Props {
  /** Текущая компания (наш домен) */
  myDomain: string;
  /** Домены конкурентов */
  competitorDomains: string[];
}

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6"];

export function MarketShareBlock({ myDomain, competitorDomains }: Props) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShares = async () => {
    setLoading(true);
    setError(null);
    try {
      const domains = [myDomain, ...competitorDomains].filter(Boolean).slice(0, 15);
      const res = await fetch("/api/keyso/market-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, base: "msk" }),
      });
      const json = await res.json();
      if (json.ok) {
        setShares(json.shares);
      } else {
        setError(json.error ?? "Не удалось получить данные");
      }
    } catch {
      setError("Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  const myDomainNorm = myDomain.replace(/^www\./, "").toLowerCase();

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 22, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: shares ? 18 : 0, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)15", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <PieChart size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>Доли рынка в нише</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Видимость в Яндексе у вас и конкурентов · по данным Keys.so
            </div>
          </div>
        </div>
        <button
          onClick={fetchShares}
          disabled={loading || competitorDomains.length === 0}
          style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: loading || competitorDomains.length === 0 ? "var(--muted)" : "var(--primary)",
            color: loading || competitorDomains.length === 0 ? "var(--muted-foreground)" : "#fff",
            fontWeight: 700, fontSize: 13,
            cursor: loading || competitorDomains.length === 0 ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}
        >
          <Sparkles size={13} /> {loading ? "Считаем…" : shares ? "Пересчитать" : "Посчитать доли"}
        </button>
      </div>

      {competitorDomains.length === 0 && !shares && (
        <div style={{ marginTop: 14, padding: "12px 16px", background: "var(--muted)", borderRadius: 10, fontSize: 13, color: "var(--muted-foreground)" }}>
          Сначала добавьте конкурентов — потом сможем посчитать доли рынка.
        </div>
      )}

      {error && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--destructive)15", color: "var(--destructive)", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {shares && shares.length > 0 && (
        <>
          {/* Bar chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shares.map((s, i) => {
              const color = PALETTE[i % PALETTE.length];
              const isMe = s.domain.replace(/^www\./, "").toLowerCase() === myDomainNorm;
              return (
                <div key={s.domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: isMe ? "var(--primary)" : color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: isMe ? 800 : 600, color: isMe ? "var(--primary)" : "var(--foreground)" }}>
                        {s.domain}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", background: "var(--primary)15", padding: "2px 7px", borderRadius: 5 }}>
                          ВЫ
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: isMe ? "var(--primary)" : "var(--foreground)" }}>
                      {s.share}%
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--muted)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${s.share}%`,
                        background: isMe ? "var(--primary)" : color,
                        borderRadius: 4,
                        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          <div style={{ marginTop: 18, padding: "12px 16px", background: "var(--primary)08", border: "1px solid var(--primary)20", borderRadius: 10, fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.6 }}>
            {(() => {
              const me = shares.find(s => s.domain.replace(/^www\./, "").toLowerCase() === myDomainNorm);
              const leader = shares[0];
              if (!me) {
                return (
                  <>Ваш домен не входит в топ Keys.so по этой нише. Это означает что у вас низкая SEO-видимость относительно конкурентов — нужно работать над ключевыми словами и контентом.</>
                );
              }
              const myPos = shares.findIndex(s => s.domain.replace(/^www\./, "").toLowerCase() === myDomainNorm) + 1;
              if (me.domain === leader.domain) {
                return (
                  <>Вы <b>лидер ниши</b> с долей <b>{me.share}%</b>. Удерживайте позиции — мониторьте ключевые слова и реагируйте на падения.</>
                );
              }
              const gap = Math.round((leader.share - me.share) * 10) / 10;
              return (
                <>Вы на <b>{myPos}-м месте</b> с долей <b>{me.share}%</b>. Лидер — <b>{leader.domain}</b> ({leader.share}%). Разрыв — {gap} п.п. видимости.</>
              );
            })()}
          </div>
        </>
      )}

      {shares && shares.length === 0 && (
        <div style={{ marginTop: 14, padding: "16px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
          Keys.so не вернул данных — возможно у этих доменов нет SEO-видимости в выбранном регионе.
        </div>
      )}
    </div>
  );
}
