"use client";

import React from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";

interface Props {
  c: Colors;
  myCompany: AnalysisResult | null;
}

/**
 * AI Видимость — модуль в разработке.
 * Здесь будет анализ присутствия бренда в ответах AI-ассистентов:
 * ChatGPT, Perplexity, Claude, Gemini и т.д.
 */
export function AIVisibilityView({ c, myCompany }: Props) {
  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, var(--primary), var(--primary-hover, #5b21b6))`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            👁️
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
              AI Видимость
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              {myCompany?.company.name ?? "Ваша компания"}
            </p>
          </div>
        </div>
      </div>

      {/* Coming soon card */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 40,
        textAlign: "center",
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>
          Модуль в разработке
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.65, maxWidth: 480, margin: "0 auto 28px" }}>
          AI Видимость покажет, насколько хорошо ваш бренд представлен в ответах AI-ассистентов —
          ChatGPT, Perplexity, Claude, Gemini. Вы узнаете, упоминают ли AI-системы вашу компанию
          при запросах в вашей нише, и как улучшить это присутствие.
        </p>

        {/* Feature list */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", textAlign: "left", marginBottom: 28 }}>
          {[
            { icon: "🔍", title: "AI-упоминания", desc: "Сколько раз AI-системы называют вас при поиске" },
            { icon: "📊", title: "Share of Voice", desc: "Доля упоминаний vs конкуренты в AI-ответах" },
            { icon: "💬", title: "Контекст ответов", desc: "В каком контексте AI называет ваш бренд" },
            { icon: "📈", title: "Рекомендации", desc: "Как повысить видимость в LLM-поиске (GEO)" },
          ].map((feat, i) => (
            <div key={i} style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{feat.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>{feat.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.45 }}>{feat.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--primary)15",
          border: "1px solid var(--primary)40",
          borderRadius: 10, padding: "10px 20px",
          fontSize: 13, color: "var(--primary)", fontWeight: 600,
        }}>
          <span>⏳</span>
          Ожидайте в следующем обновлении
        </div>
      </div>

      {/* What is GEO */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        marginTop: 16,
        boxShadow: "var(--shadow)",
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: "0 0 10px" }}>
          Что такое GEO (Generative Engine Optimization)?
        </h3>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.65, margin: 0 }}>
          GEO — новое направление маркетинга: оптимизация бренда для появления в ответах генеративных AI.
          В отличие от классического SEO (оптимизация для поисковиков), GEO фокусируется на том,
          чтобы ChatGPT, Perplexity, Claude и другие LLM называли ваш бренд в ответах на запросы
          вашей целевой аудитории. По данным исследований, до 40% B2B-решений в 2025 году принимаются
          с участием AI-ассистентов.
        </p>
      </div>
    </div>
  );
}
