"use client";

import { useState, useEffect } from "react";
import {
  Moon, Sun, Send, Users, BarChart2, Globe, Zap, ClipboardList,
  Star, Briefcase, Share2, Eye, Swords, ArrowRight, ChevronDown,
  Radio, Building2, MessagesSquare, Check, ShieldCheck, Target,
  Map, Palette, TrendingUp, X, FileText, Info,
} from "lucide-react";
import type { Colors, Theme } from "@/lib/colors";
import { VisitTracker } from "@/components/VisitTracker";

/**
 * MarketRadar landing page — 7 semantic blocks, SEO+GEO optimized.
 *
 * Block order:
 *  1. HERO               — pain-driven headline + CTAs + key facts
 *  2. WHAT PLATFORM DOES — 6 feature categories (30+ sources in one dashboard)
 *  3. GEO                — visibility in ChatGPT / Алиса / Gemini (critical for SEO+GEO)
 *  4. HOW IT WORKS       — 3 steps
 *  5. PRICING            — one-off report + 4 subscriptions
 *  6. FAQ                — 8 questions, rendered inside <details> + JSON-LD FAQPage
 *                         (critical: Яндекс.Нейро and Google AI Overviews pull answers from here)
 *  7. CTA + FOOTER       — final conversion + links + partner program condensed
 *
 * Design constraints:
 *  - Dark theme is primary; light mode supported via user toggle.
 *  - No emoji characters anywhere — every glyph is a lucide icon.
 *  - Visual style preserved from previous version (gradient accents, card grids, sticky nav).
 */
export function LandingPageView({ c, theme, setTheme, onRegister, onLogin }: {
  c: Colors;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onRegister: () => void;
  onLogin: () => void;
}) {
  void c;
  const [url, setUrl] = useState("");
  const TG_BOT = "https://t.me/market_radar1_bot";
  const TG_CHANNEL = "https://t.me/company24pro";
  const TG_PARTNER_BOT = "https://t.me/market_radar1_bot";

  // Force dark theme on first landing visit if user hasn't chosen yet —
  // dark is the primary marketing aesthetic for MarketRadar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("mr_theme");
      if (!saved) setTheme("dark");
    } catch { /* ignore */ }
  }, [setTheme]);

  // ── Scroll-reveal for cards/metrics below the fold ──────────────────────
  // Mirrors the owner-dashboard pattern (mrFadeUp with staggered delays),
  // but triggers only when the element enters the viewport so everything
  // feels "alive" as the user scrolls down the landing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll<HTMLElement>(".lp-reveal");
    if (!els.length) return;
    if (prefersReduced) {
      els.forEach(el => el.classList.add("lp-reveal-in"));
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-reveal-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  function handleUrlAnalyze() {
    if (url.trim()) onRegister();
  }

  const isDark = theme === "dark";
  const bg = isDark ? "#0a0b0f" : "#ffffff";
  const fg = isDark ? "#f1f5f9" : "#0f172a";
  const muted = isDark ? "#64748b" : "#64748b";
  const card = isDark ? "#111318" : "#f8fafc";
  const border = isDark ? "#1e2433" : "#e2e8f0";
  const accent = "#6366f1";
  const accentLight = isDark ? "#6366f118" : "#6366f10d";

  // Neon palette borrowed from the owner dashboard — used for glow accents
  const neonCyan = "#4FC3F7";
  const neonMagenta = "#D500F9";
  const neonGreen = "#69FF47";
  const neonRed = "#FF5252";

  // ── FAQ data (used both for render and JSON-LD schema) ──────────────────
  const faqItems: Array<{ q: string; a: string }> = [
    {
      q: "Что такое MarketRadar?",
      a: "MarketRadar — это AI-платформа, которая объединяет данные из 40+ сервисов (Keys.so, Руспрофайл, Яндекс.Карты, 2ГИС, Google Maps, hh.ru, ChatGPT, Claude, Gemini, Perplexity, Яндекс.Алиса) в единый дашборд о вашем бизнесе. За 3 минуты собираем полную картину бизнеса и даём готовый план роста.",
    },
    {
      q: "Что такое GEO-оптимизация и зачем она нужна?",
      a: "GEO (Generative Engine Optimization) — продвижение контента для попадания в ответы нейросетей: ChatGPT, Claude, Perplexity, Gemini, Яндекс.Алисы. В 2026 году 40% запросов в Google и 35% запросов в Яндексе закрываются AI-ответом без клика на сайт. Если вашего бренда нет в этих ответах — вас не видят миллионы потенциальных клиентов. MarketRadar проверяет упоминаемость в 5 нейросетях и даёт план попадания в AI-выдачу.",
    },
    {
      q: "Как попасть в ответы ChatGPT и Алисы?",
      a: "Нужно структурировать контент в формате FAQ, настроить файл llms.txt, получать упоминания в авторитетных СМИ, работать с Schema.org-разметкой (особенно FAQPage и Organization), усиливать E-E-A-T-сигналы. MarketRadar сам диагностирует, каких элементов не хватает, и даёт список правок по приоритету эффекта.",
    },
    {
      q: "Чем MarketRadar отличается от Keys.so, SpyWords, Similarweb?",
      a: "Keys.so, SpyWords и подобные сервисы — это источники SEO-данных, которые MarketRadar использует внутри платформы. Они дают цифры только по одному направлению. MarketRadar собирает данные из этих сервисов плюс Руспрофайла, Карт, hh.ru, нейросетей и формирует единый дашборд с готовыми выводами, Battle cards, CJM и брендбуком.",
    },
    {
      q: "Сколько времени занимает анализ?",
      a: "Первый полный отчёт — 3 минуты. Анализ с 30 конкурентами — до 10 минут. Бесплатный базовый Score через Telegram-бот — 30 секунд.",
    },
    {
      q: "Сколько стоит сервис?",
      a: "Разовый отчёт — 2 900 ₽ (по промокоду от 1 ₽). Подписки: MINI — 4 900 ₽/мес, Базовый — 9 900 ₽/мес, PRO — 19 900 ₽/мес, Agency — 39 900 ₽/мес, Enterprise — от 99 900 ₽/мес.",
    },
    {
      q: "Какие источники данных используются?",
      a: "Более 30 источников: Keys.so, Яндекс, Google, Яндекс.Карты, 2ГИС, Google Maps, ВКонтакте, Telegram, Одноклассники, YouTube, hh.ru, SuperJob, Руспрофайл, DaData, ЕГРЮЛ, ChatGPT, Claude, Gemini, Perplexity, Яндекс.Алиса.",
    },
    {
      q: "Есть ли бесплатный вариант попробовать?",
      a: "Да — бесплатный базовый Score через Telegram-бот @market_radar1_bot. Пришлите URL сайта — получите общую оценку бизнеса и список ключевых проблем за 30 секунд, без регистрации и кредитной карты.",
    },
    {
      q: "Чем экспресс-отчёт отличается от полного?",
      a: "Экспресс-отчёт (бесплатно в Telegram или за 1 ₽ по промокоду START) показывает Score, 3–5 главных инсайтов и детализацию по категориям. Полный отчёт (2 900 ₽ вместо 4 900) даёт портрет ЦА, Customer Journey Map, брендбук, решения всех рекомендаций и 30 дней доступа в платформу с мониторингом 24/7.",
    },
  ];

  const faqPageSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };

  // T-38 — Schema.org SoftwareApplication JSON-LD
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MarketRadar",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://marketradar24.ru",
    description:
      "AI-платформа для анализа бизнеса, конкурентов и видимости в нейросетях. 40+ источников данных, 30+ точек роста в отчёте, проверка в ChatGPT, Claude, Gemini, Perplexity, Алисе.",
    offers: {
      "@type": "Offer",
      price: "2900",
      priceCurrency: "RUB",
    },
    provider: {
      "@type": "Organization",
      name: "Company24.pro",
      url: "https://company24.pro",
    },
  };

  // ── Platform feature categories (block 2) ───────────────────────────────
  const featureCategories = [
    {
      icon: <BarChart2 size={22} />,
      title: "SEO и видимость в поиске",
      desc: "Keys.so: позиции в Яндексе и Google, ключевые слова, ссылочная масса. Технический SEO-аудит. Анализ поисковой выдачи.",
      ac: neonCyan,
    },
    {
      icon: <Star size={22} />,
      title: "Репутация на картах",
      desc: "Яндекс.Карты, 2ГИС, Google Maps. Рейтинги, отзывы, тональность, сравнение с конкурентами по каждой локации.",
      ac: "#FFB547",
    },
    {
      icon: <Building2 size={22} />,
      title: "Бизнес-данные и команда",
      desc: "Руспрофайл, DaData, ЕГРЮЛ — финансы и юр.данные. hh.ru и SuperJob — открытые вакансии, зарплаты, HR-бренд.",
      ac: neonGreen,
    },
    {
      icon: <Share2 size={22} />,
      title: "Соцсети и контент",
      desc: "ВКонтакте, Telegram, Одноклассники, YouTube, VK Видео — аудитория, активность, форматы, упоминания бренда.",
      ac: "#FF4FBF",
    },
    {
      icon: <Eye size={22} />,
      title: "Видимость в нейросетях",
      desc: "ChatGPT, Claude, Gemini, Perplexity, Яндекс.Алиса — проверка, попадаете ли вы в ответы AI по ключевым запросам клиентов.",
      ac: neonMagenta,
    },
    {
      icon: <Swords size={22} />,
      title: "Конкурентная разведка",
      desc: "Парсинг сайтов конкурентов — офферы, цены, структура. Battle cards, карта Customer Journey, брендбук, план роста.",
      ac: neonRed,
    },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: fg, minHeight: "100vh", overflowX: "hidden" }}>
      <VisitTracker source="landing" />

      {/* JSON-LD FAQPage — critical for Яндекс.Нейро and Google AI Overviews */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      {/* JSON-LD SoftwareApplication (T-38) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .lp-btn { transition: all 0.15s ease; cursor: pointer; }
        .lp-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .lp-btn:active { transform: translateY(0); }
        .lp-card { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; }
        .lp-card:hover { transform: translateY(-4px); }

        /* ── Entry animations (dashboard-style cascade) ── */
        @keyframes lp-fade { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lp-fade-in { from{opacity:0} to{opacity:1} }
        @keyframes lp-scale-in { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes lp-bar-grow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        .lp-fade { animation: lp-fade 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
        .lp-fade-up { opacity: 0; animation: lp-fade 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
        .lp-scale-in { animation: lp-scale-in 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both; }

        /* Scroll-revealed entry — triggered via IntersectionObserver.
           Uses an animation (not transition) so per-element stagger via
           animation-delay doesn't interfere with hover transitions. */
        @keyframes lp-reveal { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .lp-reveal { opacity: 0; }
        .lp-reveal.lp-reveal-in { animation: lp-reveal 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both; }

        /* ── Neon glow ring that breathes ── */
        @keyframes lp-neon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.55), 0 0 18px 0 rgba(99,102,241,0.25); }
          50%      { box-shadow: 0 0 0 10px rgba(99,102,241,0), 0 0 26px 2px rgba(99,102,241,0.15); }
        }
        .lp-pulse-dot { animation: lp-neon-pulse 2.2s ease-in-out infinite; }

        @keyframes lp-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .lp-float { animation: lp-float 6s ease-in-out infinite; }

        /* Slow hue-shifting gradient behind hero headline */
        @keyframes lp-hue {
          0%   { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(30deg); }
        }
        .lp-gradient-text { animation: lp-hue 8s ease-in-out infinite alternate; }

        /* Sweep shimmer across card top accent lines */
        @keyframes lp-sweep {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .lp-card-accent {
          background: linear-gradient(90deg, transparent 0%, currentColor 20%, currentColor 50%, currentColor 80%, transparent 100%);
          background-size: 200% 100%;
          animation: lp-sweep 4.5s linear infinite;
        }

        /* Neon glow on icon chips in the 'Что делает платформа' grid */
        .lp-icon-chip { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .lp-card:hover .lp-icon-chip { transform: scale(1.08) rotate(-3deg); }

        /* Hero grid — animated scroll for that "scanning radar" feel */
        @keyframes lp-grid-drift {
          0%   { background-position: 0 0, 0 0; }
          100% { background-position: 48px 48px, 48px 48px; }
        }
        .lp-hero-grid { animation: lp-grid-drift 24s linear infinite; }

        .lp-faq summary::-webkit-details-marker { display: none; }
        .lp-faq summary { list-style: none; }
        .lp-faq summary:hover { color: #a5b4fc; }
        .lp-faq[open] .lp-faq-chevron { transform: rotate(180deg); }
        .lp-faq[open] { border-color: rgba(99,102,241,0.35) !important; box-shadow: 0 0 0 1px rgba(99,102,241,0.15), 0 0 28px -8px rgba(99,102,241,0.35); }

        /* Stat numbers — stronger neon tint */
        .lp-neon-text {
          background: linear-gradient(135deg, #a5b4fc 0%, #22d3ee 50%, #a78bfa 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-float, .lp-pulse-dot, .lp-gradient-text, .lp-card-accent, .lp-hero-grid { animation: none !important; }
        }

        @media (max-width: 640px) {
          .lp-hero-btns { flex-direction: column !important; }
          .lp-plans { grid-template-columns: 1fr !important; }
          .lp-services { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .lp-url-row { flex-direction: column !important; }
          .lp-stats-strip { gap: 20px !important; }
          .lp-stats-strip > div { padding: 12px 14px !important; border-left: none !important; }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 60, borderBottom: `1px solid ${border}`, background: bg + "f0", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${accent},#818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>MR</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>MarketRadar</span>
        </div>
        <div className="nav-links" style={{ display: "flex", gap: 28, fontSize: 13, color: muted }}>
          <a href="#features" style={{ color: muted, textDecoration: "none" }}>Возможности</a>
          <a href="#geo" style={{ color: muted, textDecoration: "none" }}>Нейросети</a>
          <a href="#how" style={{ color: muted, textDecoration: "none" }}>Как работает</a>
          <a href="#pricing" style={{ color: muted, textDecoration: "none" }}>Тарифы</a>
          <a href="#faq" style={{ color: muted, textDecoration: "none" }}>FAQ</a>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="lp-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ background: "none", border: `1px solid ${border}`, borderRadius: 7, padding: "5px 9px", color: muted, fontSize: 14, fontFamily: "inherit" }} aria-label="Переключить тему">
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button className="lp-btn" onClick={onLogin} style={{ background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: fg, fontFamily: "inherit" }}>
            Войти
          </button>
          <button className="lp-btn" onClick={onRegister} style={{ background: accent, border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "inherit", boxShadow: `0 2px 12px ${accent}50` }}>
            Попробовать
          </button>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 1. HERO                                                 */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "88px 20px 64px", position: "relative", overflow: "hidden" }}>
        {/* Animated neon grid — brighter than the previous subtle version */}
        <div
          className="lp-hero-grid"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: isDark
              ? `linear-gradient(rgba(99,102,241,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.14) 1px, transparent 1px)`
              : `linear-gradient(rgba(99,102,241,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.10) 1px, transparent 1px)`,
            backgroundSize: "48px 48px, 48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 45%, #000 45%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, #000 45%, transparent 80%)",
            pointerEvents: "none",
          }}
        />
        {/* Bright neon glow pools */}
        <div style={{ position: "absolute", top: "10%", left: "12%", width: 620, height: 620, borderRadius: "50%", background: `${accent}26`, filter: "blur(140px)", pointerEvents: "none" }} className="lp-float" />
        <div style={{ position: "absolute", top: "0%", right: "10%", width: 460, height: 460, borderRadius: "50%", background: `${neonMagenta}18`, filter: "blur(120px)", pointerEvents: "none" }} className="lp-float" />
        <div style={{ position: "absolute", bottom: "-10%", left: "35%", width: 520, height: 520, borderRadius: "50%", background: `${neonCyan}14`, filter: "blur(130px)", pointerEvents: "none" }} />

        <div className="lp-fade" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto" }}>
          {/* Radar-style live badge (T-05: увеличен шрифт и паддинги) */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: `${neonGreen}12`, color: "#6ee7b7", borderRadius: 999, padding: "10px 22px 10px 14px", fontSize: 15, fontWeight: 600, marginBottom: 30, border: `1px solid ${neonGreen}40`, boxShadow: `0 0 24px ${neonGreen}25` }}>
            <span className="lp-pulse-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: neonGreen, display: "inline-block" }} />
            Радар активен · сканируем 40+ источников в реальном времени
          </div>

          {/* H1 — SEO-критичный заголовок, растянут на всю ширину */}
          <h1 style={{ fontSize: "clamp(38px,6.4vw,76px)", fontWeight: 900, lineHeight: 1.04, margin: "0 auto 26px", maxWidth: 1100, letterSpacing: "-0.035em" }}>
            Узнайте, где вы теряете клиентов{" "}
            <span
              className="lp-gradient-text"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${neonMagenta} 35%, ${neonCyan} 70%, #a5b4fc 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                display: "inline-block",
              }}
            >
              и где можете зарабатывать больше
            </span>
          </h1>

          <p style={{ fontSize: 18, color: muted, maxWidth: 760, margin: "0 auto 36px", lineHeight: 1.6 }}>
            MarketRadar просканирует ваш бизнес, конкурентов и рынок за 3 минуты.
            Отчёт на 30+ страниц с планом роста — без дорогих исследований за 300 тысяч и недель ожидания.
          </p>

          {/* T-03 + T-04 — Primary CTA: URL form + inline price block */}
          <div style={{ maxWidth: 620, margin: "0 auto 14px" }}>
            <div className="lp-url-row" style={{ display: "flex", gap: 8, background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "8px 8px 8px 18px", boxShadow: `0 2px 20px ${accent}15`, alignItems: "center" }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUrlAnalyze()}
                placeholder="Введите URL вашего сайта..."
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, color: fg, outline: "none", fontFamily: "inherit", minWidth: 0, padding: "8px 0" }}
              />
              <button className="lp-btn" onClick={handleUrlAnalyze} style={{ background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "13px 26px", fontWeight: 700, fontSize: 15, fontFamily: "inherit", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `0 4px 18px ${accent}60` }}>
                Получить экспресс-отчёт
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* T-04 — strike-through price + "первые клиенты" disclaimer */}
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: fg, letterSpacing: "-0.03em" }}>2 900 ₽</span>
            <span style={{ fontSize: 20, color: muted, textDecoration: "line-through" }}>4 900 ₽</span>
            <span style={{ fontSize: 13, color: muted }}>— цена для первых клиентов</span>
          </div>

          <div style={{ fontSize: 12, color: muted, marginBottom: 18 }}>
            Полный отчёт + 30 дней в платформе · PDF навсегда
          </div>

          {/* T-03 — Telegram secondary link */}
          <div style={{ fontSize: 13, color: muted }}>
            Предпочитаете Telegram?{" "}
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>
              @market_radar1_bot
            </a>
          </div>

          {/* T-07 — Disclaimer: real data only (цветные кружки-дивы, без emoji) */}
          <div className="lp-reveal" style={{ marginTop: 34, maxWidth: 680, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", gap: 14, background: `${neonGreen}08`, border: `1px solid ${neonGreen}30`, borderRadius: 14, padding: "14px 18px", textAlign: "left" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${neonGreen}20`, border: `1px solid ${neonGreen}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 14px ${neonGreen}40` }}>
              <ShieldCheck size={18} style={{ color: neonGreen }} />
            </div>
            <div style={{ fontSize: 13.5, color: fg, lineHeight: 1.55 }}>
              <strong style={{ color: fg }}>Только реальные данные</strong> из API и парсинга. Без AI-фантазий.
              Каждое утверждение маркируется:
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: neonGreen, display: "inline-block" }} /> факт
              </span>,
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#60a5fa", display: "inline-block" }} /> AI-гипотеза
              </span>,
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#facc15", display: "inline-block" }} /> оценка
              </span>.
            </div>
          </div>

          {/* T-06 — Key facts strip: 3 мин / 40+ / 30+ / 6, цифры крупнее */}
          <div className="lp-stats-strip" style={{ display: "flex", justifyContent: "center", marginTop: 48, flexWrap: "wrap", borderTop: `1px solid ${border}`, paddingTop: 44 }}>
            {[
              { num: "3 мин", label: "первый отчёт", color: neonCyan },
              { num: "40+", label: "источников данных", color: neonGreen },
              { num: "30+", label: "точек роста в отчёте", color: "#FFB547" },
              { num: "6", label: "нейросетей проверяем", color: neonMagenta },
            ].map(({ num, label, color }, i) => (
              <div key={label} className="lp-fade-up" style={{ textAlign: "center", padding: "12px 36px", borderLeft: i > 0 ? `1px solid ${border}` : "none", animationDelay: `${200 + i * 120}ms` }}>
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.035em", color, textShadow: `0 0 22px ${color}55`, lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* T-08 — Company24 ecosystem footer micro-line */}
          <div style={{ fontSize: 12, color: muted, marginTop: 28, textAlign: "center" }}>
            Продукт экосистемы{" "}
            <a href="https://company24.pro" target="_blank" rel="noopener noreferrer" style={{ color: muted, textDecoration: "underline" }}>
              Company24.pro
            </a>
            {" "}— AI Business OS для вашего бизнеса 24/7
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 2. WHAT MARKETRADAR DOES — 6 feature categories          */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "72px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ВОЗМОЖНОСТИ ПЛАТФОРМЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>30+ источников в одном дашборде</h2>
          <p style={{ fontSize: 15, color: muted, margin: "0 auto", maxWidth: 600 }}>
            Обычно маркетолог вручную собирает данные из 10–15 сервисов в Excel. MarketRadar делает это автоматически и формирует выводы.
          </p>
        </div>

        {/* T-15 — бегущая строка ниш (перемещена сюда, т.к. появляется после hero) */}
        <div className="lp-reveal" style={{ marginBottom: 44, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: "22px 0", overflow: "hidden", position: "relative", marginLeft: "-20px", marginRight: "-20px" }}>
          <div
            style={{
              display: "flex",
              gap: 36,
              whiteSpace: "nowrap",
              animation: "lp-marquee 65s linear infinite",
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%)",
              maskImage: "linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%)",
            }}
          >
            {[...Array(2)].map((_, dup) => (
              <div key={dup} style={{ display: "flex", gap: 36, flexShrink: 0 }}>
                {[
                  "интернет-магазины", "маркетплейсы", "одежда", "косметика", "мебель",
                  "рестораны", "кафе", "гостиницы", "салоны красоты", "фитнес-клубы",
                  "стоматологии", "клиники", "косметологии", "языковые школы",
                  "онлайн-курсы", "застройщики", "ремонт квартир", "автосервисы",
                  "digital-агентства", "юридические услуги",
                ].map((niche, i) => (
                  <span key={`${dup}-${i}`} style={{ fontSize: 16, color: muted, letterSpacing: "-0.01em", display: "inline-flex", alignItems: "center", gap: 36 }}>
                    {niche}
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: accent }} />
                  </span>
                ))}
              </div>
            ))}
          </div>
          <style>{`@keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
          <div style={{ textAlign: "center", fontSize: 12.5, color: muted, marginTop: 14 }}>
            Анализируем более 80 ниш бизнеса. AI автоматически определяет специфику вашей.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
          {featureCategories.map(({ icon, title, desc, ac }, i) => (
            <div
              key={title}
              className="lp-card lp-reveal"
              style={{
                background: card,
                borderRadius: 20,
                border: `1px solid ${border}`,
                padding: "26px 22px",
                position: "relative",
                overflow: "hidden",
                animationDelay: `${i * 90}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${ac}60`;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${ac}35, 0 12px 40px -12px ${ac}60, 0 0 50px -20px ${ac}90`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="lp-card-accent" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, color: ac }} />
              <div
                className="lp-icon-chip"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: `${ac}20`,
                  border: `1px solid ${ac}55`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: ac,
                  marginBottom: 16,
                  boxShadow: `0 0 20px ${ac}35, inset 0 0 12px ${ac}20`,
                }}
              >{icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* T-16 — Готовые артефакты в отчёте (6 карточек)          */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="artifacts" style={{ padding: "56px 20px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ЧТО ПОЛУЧАЕТЕ В ОТЧЁТЕ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Готовые артефакты, а не сырые данные</h2>
          <p style={{ fontSize: 15, color: muted, margin: "0 auto", maxWidth: 620 }}>
            Всё, что можно сразу использовать в работе: от стратегического обзора до листовок для отдела продаж.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {[
            { icon: <Target size={22} />, title: "Score", desc: "Оценка бизнеса 0–100 по 5–7 категориям с разбивкой по подметрикам.", color: neonCyan },
            { icon: <Users size={22} />, title: "Портрет ЦА", desc: "Персона, ценности, страхи, возражения и язык клиента.", color: neonMagenta },
            { icon: <Map size={22} />, title: "Customer Journey Map", desc: "Путь клиента на 7 этапов с болями и точками контакта.", color: "#60a5fa" },
            { icon: <Palette size={22} />, title: "Брендбук", desc: "Цвета, шрифты, тон голоса и формулы для постов.", color: "#f472b6" },
            { icon: <Swords size={22} />, title: "Battle cards", desc: "Для отдела продаж: как работать с возражениями против конкурентов.", color: neonRed },
            { icon: <TrendingUp size={22} />, title: "План роста", desc: "30+ рекомендаций с приоритетом по эффекту и сложности.", color: neonGreen },
          ].map(({ icon, title, desc, color }, i) => (
            <div
              key={title}
              className="lp-card lp-reveal"
              style={{ background: card, borderRadius: 16, border: `1px solid ${border}`, padding: "22px 20px", animationDelay: `${i * 80}ms` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}55`;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 12px 30px -14px ${color}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="lp-icon-chip" style={{ width: 42, height: 42, borderRadius: 11, background: `${color}20`, border: `1px solid ${color}50`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: `0 0 16px ${color}35` }}>{icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div className="lp-reveal" style={{ marginTop: 28, textAlign: "center" }}>
          <button onClick={onRegister} className="lp-btn" style={{ background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "12px 26px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `0 4px 18px ${accent}55` }}>
            Запустить анализ <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* T-17 — Почему не Excel?                                  */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "56px 20px", maxWidth: 900, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ background: `linear-gradient(145deg, ${neonRed}08, transparent)`, borderRadius: 24, border: `1px solid ${neonRed}22`, padding: "40px 36px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fca5a5", letterSpacing: "0.12em", marginBottom: 12 }}>АЛЬТЕРНАТИВА ВРУЧНУЮ</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 22px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Да, можно собрать всё вручную. Но это…
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "20–40 часов каждый месяц (ваше время стоит денег)",
              "Данные устаревают через неделю после сбора",
              "Нет анализа — только цифры, выводы делаете сами",
              "Нет сравнения с ТОП-10% ниши",
              "Нет видимости в нейросетях — этого никто вручную не сделает",
              "Нельзя быстро перегенерировать отчёт в том же формате",
            ].map((item) => (
              <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, color: fg, lineHeight: 1.55 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${neonRed}18`, border: `1px solid ${neonRed}50`, color: neonRed, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <X size={14} />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: "18px 20px", borderRadius: 14, background: `${neonGreen}10`, border: `1px solid ${neonGreen}30`, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${neonGreen}20`, color: neonGreen, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={18} />
            </div>
            <div style={{ fontSize: 14.5, color: fg, lineHeight: 1.55 }}>
              <strong style={{ color: "#6ee7b7" }}>MarketRadar делает это автоматически</strong> — за 3 минуты. И обновляется 24/7 без вашего участия.
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* T-18 — Маркеры достоверности                            */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "48px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>МАРКЕРЫ ДОСТОВЕРНОСТИ</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Каждое утверждение — с маркером</h2>
          <p style={{ fontSize: 14.5, color: muted, margin: "0 auto", maxWidth: 560 }}>
            Мы не продаём AI-фантазии под видом аналитики. В отчёте вы видите, откуда взята каждая цифра.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {[
            {
              color: neonGreen,
              label: "ФАКТ",
              desc: "Данные из API и парсинга (Keys.so, Руспрофайл, карты, нейросети). Ссылка на источник и дата обновления.",
            },
            {
              color: "#60a5fa",
              label: "AI-ГИПОТЕЗА",
              desc: "Сгенерировано AI по архетипу ЦА и паттернам ниши. Требует проверки в CustDev.",
            },
            {
              color: "#facc15",
              label: "ОЦЕНКА",
              desc: "Среднее по нише или расчёт с допущениями. Укажите свои цифры — пересчитаем точнее.",
            },
          ].map(({ color, label, desc }, i) => (
            <div
              key={label}
              className="lp-card lp-reveal"
              style={{ background: card, borderRadius: 16, border: `1px solid ${color}30`, padding: "22px 22px", animationDelay: `${i * 100}ms`, boxShadow: `inset 0 0 0 1px ${color}10` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: color, boxShadow: `0 0 14px ${color}80` }} />
                <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: "0.1em" }}>{label}</span>
              </div>
              <div style={{ fontSize: 13.5, color: muted, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 3. GEO — Visibility in AI search engines                 */}
      {/*    (major SEO+GEO focus; also has its own H2 keyword)    */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="geo" style={{ padding: "64px 20px", maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <div style={{ background: `linear-gradient(145deg,${accent}10,#8b5cf608)`, borderRadius: 28, border: `1px solid ${accent}25`, padding: "52px 40px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-30%", right: "-10%", width: 440, height: 440, borderRadius: "50%", background: `${accent}12`, filter: "blur(100px)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.12em", marginBottom: 14, background: `${accent}18`, padding: "5px 14px", borderRadius: 20, border: `1px solid ${accent}30` }}>
                <Radio size={11} /> GEO-ПРОДВИЖЕНИЕ
              </div>
              <h2 style={{ fontSize: "clamp(28px,3.5vw,40px)", fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                Как попасть в ответы <span style={{ color: "#a5b4fc" }}>ChatGPT</span>, <span style={{ color: "#a5b4fc" }}>Алисы</span> и <span style={{ color: "#a5b4fc" }}>Gemini</span>
              </h2>
              <p style={{ fontSize: 15, color: muted, maxWidth: 680, margin: "0 auto", lineHeight: 1.65 }}>
                Generative Engine Optimization — продвижение сайта для попадания в ответы нейросетей. В 2026 году это новый канал трафика, который растёт в разы быстрее классического SEO.
              </p>
            </div>

            {/* T-23 — Critical stats, цифры крупнее, подписи крупнее */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, marginBottom: 36 }}>
              {[
                { num: "40%", label: "запросов в Google закрываются AI-ответом без клика на сайт", color: neonCyan },
                { num: "35%", label: "запросов в Яндексе идут через Алису и Нейро", color: neonMagenta },
                { num: "250%", label: "рост AI-трафика год к году — это следующий канал продаж", color: neonGreen },
              ].map(({ num, label, color }, i) => (
                <div
                  key={num}
                  className="lp-card lp-reveal"
                  style={{
                    background: card,
                    borderRadius: 16,
                    border: `1px solid ${color}30`,
                    padding: "24px 24px",
                    boxShadow: `0 0 24px -12px ${color}80, inset 0 1px 0 ${color}20`,
                    animationDelay: `${100 + i * 120}ms`,
                  }}
                >
                  <div style={{ fontSize: 56, fontWeight: 900, color, letterSpacing: "-0.04em", marginBottom: 8, textShadow: `0 0 22px ${color}55`, lineHeight: 1 }}>{num}</div>
                  <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.55 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* What MarketRadar checks and does — 3 cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {[
                {
                  icon: <Eye size={18} />,
                  title: "Проверка пятью нейросетями",
                  desc: "Запускаем 20+ типовых запросов клиентов в ChatGPT, Claude, Perplexity, Gemini, Алису. Показываем: попадаете ли в ответ, на каком месте, в каком контексте.",
                  color: neonCyan,
                },
                {
                  icon: <Swords size={18} />,
                  title: "Конкуренты в AI-выдаче",
                  desc: "Видите компании, которые уже занимают позиции в ответах нейросетей по вашим запросам. Понимаете, у кого учиться.",
                  color: neonMagenta,
                },
                {
                  icon: <ClipboardList size={18} />,
                  title: "План попадания в AI-ответы",
                  desc: "Конкретные шаги: настройка llms.txt, структурирование FAQ, размещения в СМИ, Schema.org-разметка, E-E-A-T-сигналы.",
                  color: neonGreen,
                },
              ].map(({ icon, title, desc, color }, i) => (
                <div
                  key={title}
                  className="lp-card lp-reveal"
                  style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: "18px 20px", animationDelay: `${i * 120}ms` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${color}55`;
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 12px 32px -14px ${color}80`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div
                      className="lp-icon-chip"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        background: `${color}20`,
                        border: `1px solid ${color}50`,
                        color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 0 16px ${color}40`,
                      }}
                    >{icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: muted, lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              {/* T-24 — button now opens onsite form (URL input), не Telegram */}
              <button onClick={onRegister} className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 30px", fontSize: 15, fontWeight: 700, boxShadow: `0 4px 20px ${accent}50`, fontFamily: "inherit", cursor: "pointer" }}>
                <Eye size={16} />
                Проверить упоминания в нейросетях
              </button>
              {/* T-25 — крупнее, italic, светлее */}
              <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 16, maxWidth: 620, margin: "16px auto 0", fontStyle: "italic", lineHeight: 1.6 }}>
                Классические SEO-агентства пока не умеют делать GEO системно. MarketRadar — один из первых сервисов в России, который автоматизирует продвижение в нейросетях.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 4. T-19 — Три шага до результата (горизонтально, со скринами) */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: "64px 20px", maxWidth: 1180, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>КАК ЭТО РАБОТАЕТ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Три шага до результата</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
          {[
            {
              n: "01",
              icon: <Globe size={22} />,
              title: "Введите URL сайта",
              desc: "Вставьте адрес — AI определит тип бизнеса и начнёт анализ. Бесплатный базовый скан — через Telegram-бот.",
              color: neonCyan,
              screen: (
                <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#0e1119", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", width: "86%" }}>
                  <Globe size={14} style={{ color: neonCyan }} />
                  <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: "-0.01em" }}>example.ru</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ background: accent, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#fff" }}>Анализ</div>
                </div>
              ),
            },
            {
              n: "02",
              icon: <Zap size={22} />,
              title: "AI анализирует",
              desc: "Собираем данные из 40+ источников за 3 минуты: SEO, соцсети, карты, вакансии, нейросети, юр.данные.",
              color: neonMagenta,
              screen: (
                <div style={{ width: "86%" }}>
                  {["SEO · Keys.so", "Карты · Google/2ГИС", "Нейросети · ChatGPT, Алиса", "Репутация · отзывы"].map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: muted, marginBottom: 6 }}>
                      <span className="lp-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: i === 3 ? "#64748b" : neonGreen, animationDelay: `${i * 300}ms` }} />
                      {s}
                    </div>
                  ))}
                </div>
              ),
            },
            {
              n: "03",
              icon: <ClipboardList size={22} />,
              title: "Получите отчёт",
              desc: "30+ рекомендаций с приоритетами. Score, ЦА, CJM, брендбук, Battle cards, план на 30 дней.",
              color: neonGreen,
              screen: (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", width: "86%", height: 60 }}>
                  {[36, 52, 28, 64, 80, 48, 72].map((h, i) => (
                    <div key={i} style={{ flex: 1, background: `linear-gradient(180deg, ${neonGreen}, ${accent})`, height: `${h}%`, borderRadius: 3, opacity: 0.85 }} />
                  ))}
                </div>
              ),
            },
          ].map(({ n, icon, title, desc, color, screen }, i) => (
            <div
              key={n}
              className="lp-card lp-reveal"
              style={{
                background: card,
                borderRadius: 20,
                border: `1px solid ${border}`,
                padding: 0,
                overflow: "hidden",
                animationDelay: `${i * 120}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}55`;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 14px 40px -14px ${color}70`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ aspectRatio: "16/9", background: `linear-gradient(135deg, ${color}08, ${color}02)`, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${color}10 1px, transparent 1px), linear-gradient(90deg, ${color}10 1px, transparent 1px)`, backgroundSize: "22px 22px", opacity: 0.6 }} />
                <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center" }}>
                  {screen}
                </div>
              </div>
              <div style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}20`, border: `1px solid ${color}50`, color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px ${color}30` }}>{icon}</div>
                  <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: "0.08em" }}>ШАГ {n}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>{title}</div>
                <div style={{ fontSize: 13.5, color: muted, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 5. PRICING — 1-off + 4 subscriptions                    */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "64px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ТАРИФЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Начните с разового отчёта</h2>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Или сразу с подпиской — с мониторингом изменений 24/7</p>
        </div>

        {/* One-off row — highlighted banner */}
        <div className="lp-card lp-reveal" style={{ background: `linear-gradient(135deg,${accent}18,#8b5cf610)`, borderRadius: 18, border: `1px solid ${accent}40`, padding: "22px 26px", marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.08em", marginBottom: 4 }}>РАЗОВЫЙ ОТЧЁТ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: fg, letterSpacing: "-0.02em", marginBottom: 4 }}>
              2 900 ₽ · по промокоду от 1 ₽
            </div>
            <div style={{ fontSize: 13, color: muted }}>1 компания, 5 конкурентов, все модули. PDF навсегда, онлайн-доступ 7 дней.</div>
          </div>
          <button onClick={onRegister} className="lp-btn" style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Получить отчёт <ArrowRight size={14} />
          </button>
        </div>

        <div className="lp-plans" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            { name: "Mini", price: "4 900 ₽", period: "/мес", features: ["1 компания", "10 конкурентов", "4 полных анализа", "Мониторинг 24/7"], highlight: false, cta: "Начать", tag: "" },
            { name: "Базовый", price: "9 900 ₽", period: "/мес", features: ["3 компании", "30 конкурентов", "12 анализов", "Battle cards + алерты"], highlight: false, cta: "Начать", tag: "" },
            { name: "PRO", price: "19 900 ₽", period: "/мес", features: ["10 компаний", "100 конкурентов", "20 анализов", "API + приоритет"], highlight: true, cta: "Начать", tag: "Популярный" },
            { name: "Agency", price: "39 900 ₽", period: "/мес", features: ["50 компаний", "1000 конкурентов", "60 анализов", "White-label"], highlight: false, cta: "Начать", tag: "" },
          ].map((plan, i) => (
            <div key={plan.name} className="lp-card lp-reveal" style={{
              background: plan.highlight ? `linear-gradient(145deg,${accent},#4f46e5)` : card,
              borderRadius: 20,
              border: `1px solid ${plan.highlight ? accent : border}`,
              padding: "26px 20px",
              position: "relative",
              boxShadow: plan.highlight ? `0 8px 40px ${accent}40` : "none",
              animationDelay: `${i * 110}ms`,
            }}>
              {plan.tag && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", borderRadius: 20, padding: "3px 14px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {plan.tag}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.65)" : muted, marginBottom: 12, letterSpacing: "0.06em" }}>{plan.name.toUpperCase()}</div>
              {/* T-20 — цена в одну строку (₽ + /мес вместе) */}
              <div style={{ marginBottom: 22, display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: plan.highlight ? "#fff" : fg, letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontSize: 15, color: plan.highlight ? "rgba(255,255,255,0.6)" : muted, fontWeight: 600 }}>{plan.period}</span>
              </div>
              {/* T-21 — галочки крупнее (16) и текст 14 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: plan.highlight ? "rgba(255,255,255,0.9)" : fg, lineHeight: 1.45 }}>
                    <Check size={16} style={{ color: plan.highlight ? "#a5b4fc" : accent, flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </div>
                ))}
              </div>
              <button className="lp-btn" onClick={onRegister} style={{ width: "100%", background: plan.highlight ? "#fff" : accent, color: plan.highlight ? accent : "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* T-22 — Enterprise в отдельный блок */}
        <div className="lp-reveal" style={{ marginTop: 40, padding: "32px 36px", background: `linear-gradient(145deg, ${accent}15, ${neonMagenta}08)`, borderRadius: 22, border: `1px solid ${accent}35` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}30`, border: `1px solid ${accent}55`, color: "#a5b4fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={22} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>ENTERPRISE</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: fg, letterSpacing: "-0.03em", marginBottom: 14 }}>
                от 99 900 ₽<span style={{ fontSize: 16, color: muted, fontWeight: 600 }}>/мес</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                {[
                  "Неограниченные компании и конкуренты",
                  "On-premise развёртывание",
                  "Индивидуальные интеграции",
                  "SLA, выделенный менеджер",
                ].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: fg }}>
                    <Check size={16} style={{ color: "#a5b4fc", flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ background: "transparent", color: fg, border: `1.5px solid ${accent}`, borderRadius: 12, padding: "14px 26px", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              Связаться с отделом продаж <ArrowRight size={14} />
            </a>
          </div>
        </div>

        {/* T-22 — Скидки за предоплату (отдельный блок) */}
        <div className="lp-reveal" style={{ marginTop: 18, padding: "22px 26px", background: card, borderRadius: 16, border: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 14, fontWeight: 700, color: fg }}>
            <Info size={16} style={{ color: "#a5b4fc" }} />
            Скидки при длительной оплате
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              { pct: "−5%", note: "3 месяца", color: muted },
              { pct: "−10%", note: "6 месяцев", color: "#a5b4fc" },
              { pct: "−20%", note: "12 месяцев", color: neonGreen },
            ].map(({ pct, note, color }) => (
              <div key={note} style={{ textAlign: "center", padding: "14px 8px", background: isDark ? "#0e1119" : "#ffffff", borderRadius: 12, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: "-0.02em", marginBottom: 2 }}>{pct}</div>
                <div style={{ fontSize: 13, color: muted }}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 6. FAQ — critical for GEO (JSON-LD above)               */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: "64px 20px", maxWidth: 820, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ВОПРОСЫ И ОТВЕТЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Часто задаваемые вопросы</h2>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Ответы на вопросы о платформе, GEO-оптимизации и тарифах</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqItems.map(({ q, a }, idx) => (
            <details
              key={idx}
              className="lp-faq lp-reveal"
              style={{
                background: card,
                borderRadius: 14,
                border: `1px solid ${border}`,
                padding: "18px 22px",
                animationDelay: `${idx * 70}ms`,
              }}
            >
              <summary style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
                color: fg,
                letterSpacing: "-0.005em",
                gap: 14,
              }}>
                <span>{q}</span>
                <ChevronDown size={18} className="lp-faq-chevron" style={{ color: muted, flexShrink: 0, transition: "transform 0.2s" }} />
              </summary>
              <div style={{
                fontSize: 15,
                color: "#cbd5e1",
                lineHeight: 1.7,
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${border}`,
              }}>
                {a}
              </div>
            </details>
          ))}
        </div>

        {/* T-30 — Мини-плашка партнёрской программы (расширенная) */}
        <div id="partner" className="lp-reveal" style={{ marginTop: 44, background: `linear-gradient(135deg, ${accent}18, ${neonMagenta}0c)`, borderRadius: 22, border: `1px solid ${accent}35`, padding: "28px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `${accent}25`, color: "#a5b4fc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 20px ${accent}40` }}>
              <Users size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.1em", marginBottom: 6 }}>ПАРТНЁРСКАЯ ПРОГРАММА</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: fg, marginBottom: 6, letterSpacing: "-0.01em" }}>
                20% комиссии с каждого платежа · до 50% для интеграторов
              </div>
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>
                Клиент получает скидку 10%. Выплаты ежемесячно от 3 000 ₽.
              </div>
            </div>
            <a href={TG_PARTNER_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: "#fff", borderRadius: 12, padding: "13px 26px", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: `0 4px 20px ${accent}55` }}>
              Узнать подробнее <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 7. FINAL CTA + FOOTER                                   */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "72px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center,${accent}12 0%,transparent 70%)` }} />
        <div className="lp-reveal" style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 900, margin: "0 0 14px", letterSpacing: "-0.03em", maxWidth: 680, marginLeft: "auto", marginRight: "auto", lineHeight: 1.15 }}>
            Начните с бесплатного Score — получите картину за 60 секунд
          </h2>
          <p style={{ fontSize: 15, color: muted, margin: "0 0 32px" }}>Пришлите URL в Telegram-бот — без регистрации и кредитной карты</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#2AABEE", color: "#fff", borderRadius: 12, padding: "14px 30px", fontWeight: 700, fontSize: 15, textDecoration: "none", fontFamily: "inherit" }}>
              <Send size={18} />
              Бесплатный Score в Telegram
            </a>
            <button className="lp-btn" onClick={onRegister} style={{ background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 30px", fontWeight: 700, fontSize: 15, fontFamily: "inherit", boxShadow: `0 4px 24px ${accent}50`, display: "inline-flex", alignItems: "center", gap: 8 }}>
              Полный отчёт за 2 900 ₽ <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER — T-31: 4 колонки Продукт / Компания / Контакты / Документы */}
      <footer style={{ borderTop: `1px solid ${border}`, padding: "48px 32px 28px", maxWidth: 1180, margin: "0 auto" }}>
        {/* Brand row */}
        <div style={{ marginBottom: 32, maxWidth: 420 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${accent},#818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>MR</div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>MarketRadar</span>
          </div>
          <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>
            Радар вашего бизнеса, рынка и конкурентов. Продукт экосистемы{" "}
            <a href="https://company24.pro" target="_blank" rel="noopener noreferrer" style={{ color: muted, textDecoration: "underline" }}>Company24.pro</a>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>ПРОДУКТ</div>
            {[
              { label: "Возможности", href: "#features" },
              { label: "GEO-продвижение", href: "#geo" },
              { label: "Тарифы", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map(({ label, href }) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <a href={href} style={{ fontSize: 13, color: muted, textDecoration: "none" }}>{label}</a>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>КОМПАНИЯ</div>
            {[
              { label: "О MarketRadar", href: "#features" },
              { label: "Партнёрам", href: "#partner" },
              { label: "Бренд Company24", href: "https://company24.pro", external: true },
            ].map(({ label, href, external }) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  style={{ fontSize: 13, color: muted, textDecoration: "none" }}
                >
                  {label}
                </a>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>КОНТАКТЫ</div>
            <div style={{ marginBottom: 8 }}>
              <a href={TG_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Send size={13} /> Канал @company24pro
              </a>
            </div>
            <div style={{ marginBottom: 8 }}>
              <a href={TG_BOT} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MessagesSquare size={13} /> Поддержка в боте
              </a>
            </div>
            <div>
              <a href="mailto:support@marketradar24.ru" style={{ fontSize: 13, color: muted, textDecoration: "none" }}>
                support@marketradar24.ru
              </a>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>ДОКУМЕНТЫ</div>
            <div style={{ marginBottom: 8 }}>
              <a href="/oferta" style={{ fontSize: 13, color: muted, textDecoration: "none" }}>Публичная оферта</a>
            </div>
            <div style={{ marginBottom: 8 }}>
              <a href="/privacy" style={{ fontSize: 13, color: muted, textDecoration: "none" }}>Политика конфиденциальности</a>
            </div>
            <div>
              <a href="/terms" style={{ fontSize: 13, color: muted, textDecoration: "none" }}>Пользовательское соглашение</a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 12, color: muted }}>
          <div>© 2026 MarketRadar · Company24.pro · Все права защищены</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <a href={TG_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Send size={12} /> Telegram
            </a>
            <a href="#pricing" style={{ color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Briefcase size={12} /> Тарифы
            </a>
            <a href="#partner" style={{ color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Users size={12} /> Партнёрам
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
