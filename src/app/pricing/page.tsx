"use client";

import { useEffect, useState } from "react";
import type { PricingItem } from "@/lib/partner-types";
import { formatPrice } from "@/lib/partner-types";

// ─── T-11: 3-tier product structure ──────────────────────────────────────────
type ProductType = "express_free" | "express_paid" | "full_month";

interface Product {
  key: ProductType;
  name: string;
  tagline: string;
  basePrice: number;        // rubles (display)
  originalPrice?: number;
  channel: string;
  accessDays: number;
  includes: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}

const PRODUCTS: Product[] = [
  {
    key: "express_free",
    name: "Бесплатный экспресс",
    tagline: "Отчёт в Telegram за 2 минуты",
    basePrice: 0,
    channel: "Telegram-бот",
    accessDays: 0,
    includes: [
      "Общий score сайта",
      "Ключевые инсайты",
      "5 категорий оценки",
      "Краткая база конкурентов",
    ],
    cta: "Получить в Telegram",
    href: "https://t.me/marketradar_bot",
  },
  {
    key: "express_paid",
    name: "Экспресс-отчёт на сайте",
    tagline: "Полный экспресс с сохранением",
    basePrice: 1,
    channel: "Сайт",
    accessDays: 0,
    includes: [
      "Всё из бесплатного",
      "Сохранение на email",
      "Удобный просмотр на сайте",
      "Готовый PDF-файл",
    ],
    cta: "Оформить за 1 ₽",
    href: "/express-report?checkout=express_paid",
    highlight: true,
  },
  {
    key: "full_month",
    name: "Полный отчёт + 30 дней",
    tagline: "Всё для роста в MarketRadar",
    basePrice: 2900,
    originalPrice: 4900,
    channel: "Платформа",
    accessDays: 30,
    includes: [
      "Все 15 решений и рекомендаций",
      "30 дней доступа в платформу",
      "Мониторинг 24/7",
      "Портрет ЦА, CJM, брендбук",
      "Battle cards для отдела продаж",
    ],
    cta: "Купить полный отчёт",
    href: "/?checkout=full_month",
  },
];

// ─── T-10: promo codes ───────────────────────────────────────────────────────
interface PromoCodeDef {
  code: string;
  discountType: "percent" | "fixed";
  value: number;        // for fixed: final price in rubles
  productType: ProductType;
  message: string;
}

const PROMOS: PromoCodeDef[] = [
  {
    code: "START",
    discountType: "fixed",
    value: 1,
    productType: "express_paid",
    message: "Промокод применён. Вы получите экспресс-отчёт за 1 ₽",
  },
];

// ─── T-12: 50% first-month discount tiers ────────────────────────────────────
interface TierDiscount {
  key: "mini" | "basic" | "pro" | "agency";
  name: string;
  original: number;
  discounted: number;
  star?: boolean;
}

const FIRST_MONTH_DISCOUNTS: TierDiscount[] = [
  { key: "mini", name: "MINI", original: 4900, discounted: 2450 },
  { key: "basic", name: "БАЗОВЫЙ", original: 9900, discounted: 4950 },
  { key: "pro", name: "PRO", original: 19900, discounted: 9950, star: true },
  { key: "agency", name: "AGENCY", original: 39900, discounted: 19950 },
];

function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

const GROUP_META: Record<string, { label: string; emoji: string; desc: string }> = {
  A: { label: "Лид-магниты", emoji: "🎁", desc: "Бесплатно — попробуйте без оплаты" },
  B: { label: "Микро-обновления", emoji: "🔄", desc: "Разовые обновления аналитики" },
  C: { label: "Глубокий анализ", emoji: "🔬", desc: "Подробные разовые исследования" },
  D: { label: "Производство контента", emoji: "✍️", desc: "Статьи, посты, лендинги, презентации" },
  E: { label: "Подписки и мониторинг", emoji: "📡", desc: "Постоянное наблюдение за рынком" },
};

const TABS = ["Все", "A", "B", "C", "D", "E"] as const;
type Tab = (typeof TABS)[number];

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Бесплатно", color: "#16a34a" },
  one_time: { label: "Разово", color: "#2563eb" },
  subscription: { label: "Подписка", color: "#7c3aed" },
};

// Popular / highlighted items
const POPULAR_IDS_NAMES = [
  "MarketRadar Бизнес",
  "MarketRadar Про",
  "Подписка: 20 статей/мес",
  "Углублённый SMM (до 10 конкурентов + стратегия)",
];

export default function PricingPage() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Все");
  const [isDark] = useState(false);

  // ─── T-10 promo state ──────────────────────────────────────────────────────
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeDef | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const match = PROMOS.find((p) => p.code === code);
    if (!match) {
      setAppliedPromo(null);
      setPromoError("Промокод не найден");
      return;
    }
    setAppliedPromo(match);
    setPromoError(null);
  };
  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  };

  // Show upgrade card if URL contains ?product=full or ?from=<express id> or user has an express report in storage
  const [showUpgrade, setShowUpgrade] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("product") === "full" || q.get("from")) {
        setShowUpgrade(true);
        return;
      }
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mr_express_")) {
          setShowUpgrade(true);
          return;
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d.items || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeTab === "Все" ? items : items.filter((i) => i.price_group === activeTab);

  const grouped: Record<string, PricingItem[]> = {};
  for (const item of filtered) {
    if (!grouped[item.price_group]) grouped[item.price_group] = [];
    grouped[item.price_group].push(item);
  }

  const bg = isDark ? "#0f172a" : "#f8fafc";
  const card = isDark ? "#1e293b" : "#ffffff";
  const text = isDark ? "#f1f5f9" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#334155" : "#e2e8f0";
  const accent = "#6366f1";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
        padding: "60px 24px 48px",
        textAlign: "center",
        color: "#fff",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, opacity: 0.8, marginBottom: 12, textTransform: "uppercase" }}>
          MarketRadar
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15 }}>
          Тарифы и стоимость
        </h1>
        <p style={{ fontSize: 18, opacity: 0.9, maxWidth: 560, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Гибкие тарифы для малого бизнеса, агентств и крупных компаний.
          Начните бесплатно — платите только за то, что нужно.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 32, padding: "10px 20px", fontSize: 15 }}>
          🎁 Первый анализ, 3 конкурента и 5 постов — <strong>бесплатно</strong>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, padding: "24px 24px 0", maxWidth: 1200, margin: "0 auto", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px",
              borderRadius: 24,
              border: "2px solid",
              borderColor: activeTab === tab ? accent : border,
              background: activeTab === tab ? accent : card,
              color: activeTab === tab ? "#fff" : text,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab === "Все" ? "Все тарифы" : `${GROUP_META[tab]?.emoji} Группа ${tab}`}
          </button>
        ))}
      </div>

      {/* ─── T-11: 3-tier product structure ─────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 0" }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            Как начать с MarketRadar
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: muted }}>
            Три варианта — от бесплатного экспресса до полного доступа в платформу
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {PRODUCTS.map((p) => {
            const promoApplies = appliedPromo && appliedPromo.productType === p.key;
            const effectivePrice = promoApplies
              ? appliedPromo!.value
              : p.basePrice;
            const priceChanged = promoApplies && effectivePrice !== p.basePrice;
            return (
              <div
                key={p.key}
                style={{
                  background: card,
                  border: `2px solid ${p.highlight ? accent : border}`,
                  borderRadius: 20,
                  padding: 28,
                  position: "relative",
                  boxShadow: p.highlight
                    ? `0 8px 32px ${accent}30`
                    : "0 1px 4px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {p.highlight && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: 20,
                      background: accent,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1,
                      padding: "4px 12px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                    }}
                  >
                    По промокоду
                  </div>
                )}

                <div style={{ fontSize: 12, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  {p.channel} · {p.accessDays > 0 ? `${p.accessDays} дней доступа` : "разово"}
                </div>

                <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                  {p.name}
                </h3>
                <div style={{ fontSize: 14, color: muted, marginBottom: 20 }}>
                  {p.tagline}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
                  {effectivePrice === 0 ? (
                    <span style={{ fontSize: 36, fontWeight: 800, color: "#16a34a" }}>
                      Бесплатно
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 36, fontWeight: 800, color: priceChanged ? "#16a34a" : accent }}>
                        {fmtRub(effectivePrice)}
                      </span>
                      {p.originalPrice && p.originalPrice > effectivePrice && (
                        <span style={{ fontSize: 18, color: muted, textDecoration: "line-through" }}>
                          {fmtRub(p.originalPrice)}
                        </span>
                      )}
                      {priceChanged && (
                        <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
                          промокод {appliedPromo!.code}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1 }}>
                  {p.includes.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: text,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={p.href}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "12px 20px",
                    borderRadius: 12,
                    background: p.highlight ? accent : (p.key === "full_month" ? `linear-gradient(135deg, ${accent}, #8b5cf6)` : card),
                    color: p.highlight || p.key === "full_month" ? "#fff" : accent,
                    border: p.highlight || p.key === "full_month" ? "none" : `2px solid ${accent}`,
                    fontWeight: 700,
                    fontSize: 15,
                    textDecoration: "none",
                    boxShadow: p.key === "full_month" ? `0 4px 16px ${accent}40` : "none",
                  }}
                >
                  {p.cta}
                </a>
              </div>
            );
          })}
        </div>

        {/* ─── T-10: promo code input ───────────────────────────────────── */}
        <div
          style={{
            marginTop: 20,
            background: appliedPromo ? "#16a34a10" : card,
            border: `1px solid ${appliedPromo ? "#16a34a40" : border}`,
            borderRadius: 16,
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: text }}>
            {appliedPromo ? "🎉" : "🎟"} Есть промокод?
          </div>

          {appliedPromo ? (
            <>
              <div style={{ fontSize: 14, color: "#16a34a", fontWeight: 600, flex: 1, minWidth: 200 }}>
                {appliedPromo.message}
              </div>
              <button
                onClick={clearPromo}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: card,
                  color: text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Сбросить
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  setPromoError(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }}
                placeholder="Например, START"
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${promoError ? "#dc2626" : border}`,
                  background: "#fff",
                  color: text,
                  fontSize: 14,
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              />
              <button
                onClick={applyPromo}
                disabled={!promoInput.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: promoInput.trim() ? accent : border,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: promoInput.trim() ? "pointer" : "not-allowed",
                }}
              >
                Применить
              </button>
              {promoError && (
                <div style={{ fontSize: 13, color: "#dc2626", width: "100%" }}>
                  {promoError}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── T-12: 50% first-month discount upgrade card ──────────────── */}
        {showUpgrade && (
          <div
            style={{
              marginTop: 32,
              background: `linear-gradient(135deg, ${accent}15, #8b5cf620)`,
              border: `2px solid ${accent}50`,
              borderRadius: 20,
              padding: "32px 28px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -14,
                left: 24,
                background: `linear-gradient(135deg, ${accent}, #8b5cf6)`,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "6px 14px",
                borderRadius: 20,
                textTransform: "uppercase",
              }}
            >
              ⭐ Специальное предложение
            </div>

            <h3 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>
              Первый месяц любого тарифа — скидка 50%
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: muted, maxWidth: 620 }}>
              Продлите доступ к MarketRadar по специальной цене — скидка действует до окончания текущего периода.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {FIRST_MONTH_DISCOUNTS.map((t) => (
                <div
                  key={t.key}
                  style={{
                    background: card,
                    border: `1px solid ${t.star ? accent : border}`,
                    borderRadius: 14,
                    padding: 18,
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: muted, letterSpacing: 1, marginBottom: 8 }}>
                    {t.name} {t.star && <span style={{ color: accent }}>⭐</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: accent }}>
                      {fmtRub(t.discounted)}
                    </span>
                    <span style={{ fontSize: 13, color: muted, textDecoration: "line-through" }}>
                      {fmtRub(t.original)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 12 }}>
                    −50% · первый месяц
                  </div>
                  <a
                    href={`/?checkout=${t.key}&promo=FIRSTMONTH50`}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: t.star ? accent : "transparent",
                      color: t.star ? "#fff" : accent,
                      border: `1px solid ${accent}`,
                      fontWeight: 700,
                      fontSize: 13,
                      textDecoration: "none",
                    }}
                  >
                    Выбрать
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: muted }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <div>Загрузка тарифов...</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: muted }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div>Тарифы пока не опубликованы</div>
          </div>
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, groupItems]) => {
            const meta = GROUP_META[group];
            return (
              <div key={group} style={{ marginBottom: 48 }}>
                {/* Group header */}
                <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `linear-gradient(135deg, ${accent}20, ${accent}40)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>
                      {meta?.emoji}
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                        Группа {group} — {meta?.label}
                      </h2>
                      <div style={{ fontSize: 14, color: muted, marginTop: 2 }}>{meta?.desc}</div>
                    </div>
                  </div>
                </div>

                {/* Items grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 16,
                }}>
                  {groupItems.map((item) => {
                    const isPopular = POPULAR_IDS_NAMES.includes(item.name);
                    const badge = TYPE_BADGE[item.type];
                    return (
                      <div
                        key={item.id}
                        style={{
                          background: card,
                          borderRadius: 16,
                          border: `2px solid ${isPopular ? accent : border}`,
                          padding: 24,
                          position: "relative",
                          boxShadow: isPopular ? `0 4px 24px ${accent}30` : "0 1px 4px rgba(0,0,0,0.06)",
                          transition: "transform 0.15s, box-shadow 0.15s",
                        }}
                      >
                        {isPopular && (
                          <div style={{
                            position: "absolute", top: -12, right: 20,
                            background: accent, color: "#fff",
                            fontSize: 11, fontWeight: 700, letterSpacing: 1,
                            padding: "4px 12px", borderRadius: 20,
                            textTransform: "uppercase",
                          }}>
                            Популярно
                          </div>
                        )}

                        {/* Type badge */}
                        <div style={{ marginBottom: 12 }}>
                          <span style={{
                            display: "inline-block",
                            background: `${badge.color}15`,
                            color: badge.color,
                            fontSize: 12, fontWeight: 600,
                            padding: "3px 10px", borderRadius: 20,
                            border: `1px solid ${badge.color}30`,
                          }}>
                            {badge.label}
                          </span>
                        </div>

                        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
                          {item.name}
                        </h3>

                        {item.description && (
                          <p style={{ margin: "0 0 16px", fontSize: 13, color: muted, lineHeight: 1.5 }}>
                            {item.description}
                          </p>
                        )}

                        {/* Price */}
                        <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 6 }}>
                          {item.type === "free" ? (
                            <span style={{ fontSize: 28, fontWeight: 800, color: "#16a34a" }}>Бесплатно</span>
                          ) : (
                            <>
                              <span style={{ fontSize: 28, fontWeight: 800, color: accent }}>
                                {formatPrice(item.price_amount)}
                              </span>
                              {item.type === "subscription" && (
                                <span style={{ fontSize: 14, color: muted }}>/мес</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* CTA section */}
        {!loading && items.length > 0 && (
          <div style={{
            marginTop: 48,
            background: `linear-gradient(135deg, ${accent}15, #8b5cf620)`,
            borderRadius: 24,
            padding: "48px 32px",
            textAlign: "center",
            border: `1px solid ${accent}30`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
            <h2 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 800 }}>
              Начните бесплатно сегодня
            </h2>
            <p style={{ margin: "0 0 28px", fontSize: 16, color: muted, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              Создайте аккаунт и сразу получите бесплатный анализ компании,
              ЦА и трёх конкурентов — без карты.
            </p>
            <a
              href="/"
              style={{
                display: "inline-block",
                background: `linear-gradient(135deg, ${accent}, #8b5cf6)`,
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                padding: "14px 36px",
                borderRadius: 32,
                textDecoration: "none",
                boxShadow: `0 4px 20px ${accent}50`,
              }}
            >
              Попробовать бесплатно →
            </a>
            <div style={{ marginTop: 16, fontSize: 13, color: muted }}>
              По вопросам корпоративных планов — напишите нам
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
