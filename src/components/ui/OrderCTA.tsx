"use client";

/**
 * OrderCTA — кнопка «Заказать у нас» на рекомендациях.
 *
 * Матчит категорию / текст рекомендации к сервису из каталога.
 * При клике открывает мини-модал с ценой и кнопкой «Подробнее».
 *
 * Используется в:
 * - DashboardView — список AI-рекомендаций
 * - InsightsView  — инсайты по SEO, контенту, офферу
 */

import React, { useState, useCallback } from "react";
import { X, ShoppingBag, ArrowRight } from "lucide-react";

// ─── Catalogue ────────────────────────────────────────────────────────────────

export interface ServiceItem {
  id: string;
  name: string;
  price: string;           // "14 900 ₽"
  priceNote?: string;      // "/мес" / "разово"
  description: string;     // one-liner
  emoji: string;
  keywords: string[];      // lowercase keywords for matching
}

export const SERVICE_CATALOG: ServiceItem[] = [
  {
    id: "seo-audit",
    name: "SEO-аудит",
    price: "49 900 ₽",
    priceNote: "разово",
    description: "Полный технический и контентный аудит с планом продвижения",
    emoji: "🔍",
    keywords: ["seo", "аудит", "keyword", "ключ", "meta", "title", "позиц", "поиск", "видимост", "трафик", "organic", "robots", "sitemap", "индекс"],
  },
  {
    id: "seo-articles",
    name: "SEO-статьи",
    price: "14 900 ₽",
    priceNote: "пакет 5 статей",
    description: "Оптимизированный контент для выхода в топ по целевым запросам",
    emoji: "📝",
    keywords: ["статья", "текст", "контент", "блог", "article", "content", "копирайт", "описани"],
  },
  {
    id: "content-factory",
    name: "Контент-завод",
    price: "19 900 ₽",
    priceNote: "/мес",
    description: "Посты, рилс, сторис — всё для ваших соцсетей под ключ",
    emoji: "🏭",
    keywords: ["smm", "соцсет", "инстаграм", "instagram", "вконтакте", "vk", "контент", "пост", "рилс", "рил", "reels", "сторис", "stories", "tg", "телеграм", "telegram", "публикац"],
  },
  {
    id: "landing",
    name: "Лендинг",
    price: "14 900 ₽",
    priceNote: "разово",
    description: "Продающая одностраничная страница под ключ",
    emoji: "🌐",
    keywords: ["сайт", "лендинг", "landing", "страниц", "конверс", "форма", "заявк", "cta", "кнопк", "сайт"],
  },
  {
    id: "presentation",
    name: "Бренд-презентация",
    price: "9 900 ₽",
    priceNote: "разово",
    description: "Профессиональная презентация для инвесторов, партнёров, клиентов",
    emoji: "🎨",
    keywords: ["бренд", "brand", "презентац", "presentation", "дизайн", "визуал", "стиль", "брендбук", "цвет", "шрифт"],
  },
  {
    id: "geo",
    name: "GEO-продвижение",
    price: "29 900 ₽",
    priceNote: "/мес",
    description: "Рейтинги на картах, отзывы, геолокационное присутствие",
    emoji: "📍",
    keywords: ["карт", "геo", "geo", "google maps", "yandex", "яндекс", "2гис", "2gis", "отзыв", "рейтинг", "rating", "maps", "геолокац"],
  },
];

// ─── Matching logic ───────────────────────────────────────────────────────────

/**
 * Return the best matching service for a recommendation text + category.
 * Returns null if confidence is too low.
 */
export function matchService(category: string, text: string): ServiceItem | null {
  const haystack = `${category} ${text}`.toLowerCase();

  let best: ServiceItem | null = null;
  let bestScore = 0;

  for (const svc of SERVICE_CATALOG) {
    let score = 0;
    for (const kw of svc.keywords) {
      if (haystack.includes(kw)) score += kw.length; // longer keyword → higher weight
    }
    if (score > bestScore) {
      bestScore = score;
      best = svc;
    }
  }

  // Require at least one keyword match (score > 0)
  return bestScore > 0 ? best : null;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function OrderModal({ svc, recText, onClose }: { svc: ServiceItem; recText: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--card)", borderRadius: 18, border: "1px solid var(--border)",
        width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 28 }}>{svc.emoji}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)" }}>{svc.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{svc.description}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 4, lineHeight: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Context */}
        <div style={{ margin: "16px 20px", padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
          <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Рекомендация</div>
          <div style={{ fontSize: 12, color: "var(--foreground-secondary)", lineHeight: 1.55 }}>{recText}</div>
        </div>

        {/* Price */}
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "var(--foreground)" }}>{svc.price}</span>
            {svc.priceNote && <span style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 3 }}>{svc.priceNote}</span>}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <a
              href="/pricing"
              style={{
                flex: 1, textAlign: "center", padding: "11px 0", borderRadius: 10,
                background: "var(--primary)", color: "#fff",
                textDecoration: "none", fontWeight: 700, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              Подробнее о тарифах <ArrowRight size={14} />
            </a>
            <button
              onClick={onClose}
              style={{ padding: "11px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground-secondary)", cursor: "pointer", fontSize: 13 }}
            >
              Закрыть
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
            Партнёрам: от 20% комиссии · Первый месяц — 1 ₽
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Button component ─────────────────────────────────────────────────────────

interface OrderCTAProps {
  /** recommendation category field */
  category: string;
  /** recommendation text — used for matching and modal context */
  text: string;
  /** optional override — skip matching, always use this service */
  serviceId?: string;
  /** compact mode: no label, icon only */
  compact?: boolean;
}

export function OrderCTA({ category, text, serviceId, compact }: OrderCTAProps) {
  const [open, setOpen] = useState(false);

  const svc = serviceId
    ? SERVICE_CATALOG.find(s => s.id === serviceId) ?? matchService(category, text)
    : matchService(category, text);

  // No match → render nothing
  if (!svc) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Заказать: ${svc.name} — ${svc.price}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: compact ? 0 : 5,
          padding: compact ? "4px 8px" : "5px 12px",
          borderRadius: 7,
          border: "1px solid rgba(99,102,241,0.3)",
          background: "rgba(99,102,241,0.07)",
          color: "var(--primary)",
          fontSize: 11, fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          lineHeight: "1.4",
          flexShrink: 0,
        }}
      >
        <ShoppingBag size={12} />
        {!compact && <span>Заказать</span>}
      </button>

      {open && <OrderModal svc={svc} recText={text} onClose={() => setOpen(false)} />}
    </>
  );
}
