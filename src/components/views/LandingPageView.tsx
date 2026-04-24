"use client";

import { useState, useEffect } from "react";
import {
  Moon, Sun, Send, Users, BarChart2, Target, Bot, Globe, Zap, ClipboardList,
  Star, Briefcase, Share2, Eye, Swords, ArrowRight, Sparkles, ChevronDown,
  TrendingUp, Radio, Building2, MapPin, MessagesSquare, Check,
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

  // ── FAQ data (used both for render and JSON-LD schema) ──────────────────
  const faqItems: Array<{ q: string; a: string }> = [
    {
      q: "Что такое MarketRadar?",
      a: "MarketRadar — это AI-платформа, которая объединяет данные из 30+ сервисов (Key.so, Руспрофайл, Яндекс.Карты, 2ГИС, Google Maps, hh.ru, ChatGPT, Claude, Gemini, Перплексити, Яндекс.Алиса) в единый дашборд о вашем бизнесе. За 3 минуты собираем картину по 7 направлениям и даём готовый план роста.",
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
      a: "Более 30 источников: Key.so, Яндекс, Google, Яндекс.Карты, 2ГИС, Google Maps, ВКонтакте, Telegram, Одноклассники, YouTube, hh.ru, SuperJob, Руспрофайл, DaData, ЕГРЮЛ, ChatGPT, Claude, Gemini, Perplexity, Яндекс.Алиса.",
    },
    {
      q: "Есть ли бесплатный вариант попробовать?",
      a: "Да — бесплатный базовый Score через Telegram-бот @market_radar1_bot. Пришлите URL сайта — получите общую оценку бизнеса и список ключевых проблем за 30 секунд, без регистрации и кредитной карты.",
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

  // ── Platform feature categories (block 2) ───────────────────────────────
  const featureCategories = [
    {
      icon: <BarChart2 size={22} />,
      title: "SEO и видимость в поиске",
      desc: "Key.so: позиции в Яндексе и Google, ключевые слова, ссылочная масса. Технический SEO-аудит. Анализ поисковой выдачи.",
      ac: "#6366f1",
    },
    {
      icon: <Star size={22} />,
      title: "Репутация на картах",
      desc: "Яндекс.Карты, 2ГИС, Google Maps. Рейтинги, отзывы, тональность, сравнение с конкурентами по каждой локации.",
      ac: "#f59e0b",
    },
    {
      icon: <Building2 size={22} />,
      title: "Бизнес-данные и команда",
      desc: "Руспрофайл, DaData, ЕГРЮЛ — финансы и юр.данные. hh.ru и SuperJob — открытые вакансии, зарплаты, HR-бренд.",
      ac: "#10b981",
    },
    {
      icon: <Share2 size={22} />,
      title: "Соцсети и контент",
      desc: "ВКонтакте, Telegram, Одноклассники, YouTube, VK Видео — аудитория, активность, форматы, упоминания бренда.",
      ac: "#ec4899",
    },
    {
      icon: <Eye size={22} />,
      title: "Видимость в нейросетях",
      desc: "ChatGPT, Claude, Gemini, Perplexity, Яндекс.Алиса — проверка, попадаете ли вы в ответы AI по ключевым запросам клиентов.",
      ac: "#8b5cf6",
    },
    {
      icon: <Swords size={22} />,
      title: "Конкурентная разведка",
      desc: "Парсинг сайтов конкурентов — офферы, цены, структура. Battle cards, карта Customer Journey, брендбук, план роста.",
      ac: "#ef4444",
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .lp-btn { transition: all 0.15s ease; cursor: pointer; }
        .lp-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .lp-btn:active { transform: translateY(0); }
        .lp-card { transition: transform 0.18s, box-shadow 0.18s; }
        .lp-card:hover { transform: translateY(-3px); }
        @keyframes lp-fade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .lp-fade { animation: lp-fade 0.5s ease both; }
        .lp-faq summary::-webkit-details-marker { display: none; }
        .lp-faq summary { list-style: none; }
        .lp-faq[open] .lp-faq-chevron { transform: rotate(180deg); }
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
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${border} 1px,transparent 1px),linear-gradient(90deg,${border} 1px,transparent 1px)`, backgroundSize: "48px 48px", opacity: 0.5 }} />
        <div style={{ position: "absolute", top: "15%", left: "20%", width: 560, height: 560, borderRadius: "50%", background: `${accent}12`, filter: "blur(120px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "5%", right: "15%", width: 300, height: 300, borderRadius: "50%", background: "#818cf80d", filter: "blur(80px)", pointerEvents: "none" }} />

        <div className="lp-fade" style={{ position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${accent}15`, color: "#818cf8", borderRadius: 24, padding: "5px 16px 5px 8px", fontSize: 12, fontWeight: 600, marginBottom: 28, border: `1px solid ${accent}25` }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Sparkles size={10} />
            </div>
            Powered by Claude AI · Company24.pro
          </div>

          {/* H1 — SEO-критичный заголовок */}
          <h1 style={{ fontSize: "clamp(34px,5.5vw,64px)", fontWeight: 900, lineHeight: 1.06, margin: "0 auto 22px", maxWidth: 820, letterSpacing: "-0.03em" }}>
            Узнайте, где вы теряете клиентов
            <br />
            <span style={{ background: `linear-gradient(135deg,${accent},#818cf8,#a5b4fc)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              и где можете зарабатывать больше
            </span>
          </h1>

          <p style={{ fontSize: 17, color: muted, maxWidth: 620, margin: "0 auto 36px", lineHeight: 1.65 }}>
            MarketRadar просканирует ваш бизнес, конкурентов и рынок за 3 минуты.
            Отчёт на 30+ страниц с планом роста — без дорогих исследований за 300 тысяч и недель ожидания.
          </p>

          {/* Primary CTA — Telegram bot (free entry point) */}
          <div style={{ marginBottom: 14 }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#2AABEE", color: "#fff", borderRadius: 14, padding: "15px 34px", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 24px #2AABEE50", fontFamily: "inherit" }}>
              <Send size={18} />
              Бесплатный Score через Telegram
            </a>
          </div>

          {/* Alt CTA — URL input */}
          <div style={{ maxWidth: 540, margin: "0 auto 12px" }}>
            <div className="lp-url-row" style={{ display: "flex", gap: 8, background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "6px 6px 6px 16px", boxShadow: `0 2px 16px ${accent}10` }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUrlAnalyze()}
                placeholder="Введите URL вашего сайта..."
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: fg, outline: "none", fontFamily: "inherit", minWidth: 0 }}
              />
              <button className="lp-btn" onClick={handleUrlAnalyze} style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 14, fontFamily: "inherit", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Полный отчёт за 2 900 ₽
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: muted }}>Разовая покупка · PDF навсегда · Онлайн-доступ 7 дней</div>

          {/* Key facts strip */}
          <div className="lp-stats-strip" style={{ display: "flex", justifyContent: "center", marginTop: 56, flexWrap: "wrap", borderTop: `1px solid ${border}`, paddingTop: 40 }}>
            {[
              { num: "3 мин", label: "первый отчёт" },
              { num: "30+", label: "источников данных" },
              { num: "20+", label: "точек роста в отчёте" },
              { num: "5", label: "нейросетей проверяем" },
            ].map(({ num, label }, i) => (
              <div key={label} style={{ textAlign: "center", padding: "12px 32px", borderLeft: i > 0 ? `1px solid ${border}` : "none" }}>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: fg }}>{num}</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 2. WHAT MARKETRADAR DOES — 6 feature categories          */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "72px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ВОЗМОЖНОСТИ ПЛАТФОРМЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>30+ источников в одном дашборде</h2>
          <p style={{ fontSize: 15, color: muted, margin: "0 auto", maxWidth: 600 }}>
            Обычно маркетолог вручную собирает данные из 10–15 сервисов в Excel. MarketRadar делает это автоматически и формирует выводы.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
          {featureCategories.map(({ icon, title, desc, ac }) => (
            <div key={title} className="lp-card" style={{ background: card, borderRadius: 20, border: `1px solid ${border}`, padding: "26px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${ac}80,transparent)` }} />
              <div style={{ width: 46, height: 46, borderRadius: 13, background: `${ac}18`, border: `1px solid ${ac}30`, display: "flex", alignItems: "center", justifyContent: "center", color: ac, marginBottom: 16 }}>{icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* What you get as artifacts */}
        <div style={{ marginTop: 32, padding: "22px 26px", background: accentLight, borderRadius: 16, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: fg, lineHeight: 1.6, maxWidth: 720 }}>
            <span style={{ fontWeight: 700 }}>Готовые артефакты в отчёте:</span> Score по 7 направлениям, портрет целевой аудитории,
            Customer Journey Map, Battle cards для отдела продаж, брендбук, план роста с приоритетами.
          </div>
          <button onClick={onRegister} className="lp-btn" style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Запустить анализ <ArrowRight size={14} />
          </button>
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
            <div style={{ textAlign: "center", marginBottom: 40 }}>
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

            {/* Critical stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 36 }}>
              {[
                { num: "40%", label: "запросов в Google закрываются AI-ответом без клика на сайт" },
                { num: "35%", label: "запросов в Яндексе идут через Алису и Нейро" },
                { num: "250%", label: "рост AI-трафика год к году — это следующий канал продаж" },
              ].map(({ num, label }) => (
                <div key={num} style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: "18px 20px" }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: "#a5b4fc", letterSpacing: "-0.03em", marginBottom: 4 }}>{num}</div>
                  <div style={{ fontSize: 12, color: muted, lineHeight: 1.55 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* What MarketRadar checks and does */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {[
                {
                  icon: <Eye size={18} />,
                  title: "Упоминаемость в 5 нейросетях",
                  desc: "Запускаем 20+ типовых запросов клиентов в ChatGPT, Claude, Perplexity, Gemini, Алису. Показываем: попадаете ли в ответ, на каком месте, в каком контексте.",
                },
                {
                  icon: <Swords size={18} />,
                  title: "Конкуренты в AI-выдаче",
                  desc: "Видите компании, которые уже занимают позиции в ответах нейросетей по вашим запросам. Понимаете, у кого учиться.",
                },
                {
                  icon: <ClipboardList size={18} />,
                  title: "План попадания в AI-ответы",
                  desc: "Конкретные шаги: настройка llms.txt, структурирование FAQ, размещения в СМИ, Schema.org-разметка, E-E-A-T-сигналы.",
                },
                {
                  icon: <TrendingUp size={18} />,
                  title: "Еженедельный мониторинг",
                  desc: "Отслеживаем динамику упоминаний после внедрения правок. Видите рост или падение в графиках.",
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="lp-card" style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}18`, color: "#a5b4fc", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: muted, lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: accent, color: "#fff", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: `0 4px 20px ${accent}50`, fontFamily: "inherit" }}>
                <Send size={16} />
                Проверить упоминания в ChatGPT через Telegram
              </a>
              <div style={{ fontSize: 11.5, color: muted, marginTop: 10, maxWidth: 520, margin: "10px auto 0" }}>
                Классические SEO-агентства пока не умеют делать GEO системно. MarketRadar — один из первых сервисов в России, который автоматизирует продвижение в нейросетях.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 4. HOW IT WORKS — 3 steps                                */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: "64px 20px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>КАК ЭТО РАБОТАЕТ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Три шага до плана роста</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { n: "01", icon: <Globe size={20} />, title: "Введите URL сайта", desc: "Вставьте адрес — платформа автоматически определит тип бизнеса и соберёт данные из 30+ источников. Бесплатный базовый скан доступен через Telegram-бот." },
            { n: "02", icon: <Zap size={20} />, title: "AI анализирует", desc: "Claude AI обрабатывает SEO, тексты, соцсети, вакансии, отзывы на картах, юр.данные и видимость в нейросетях. Занимает ~3 минуты для стандартного анализа." },
            { n: "03", icon: <ClipboardList size={20} />, title: "Получите отчёт с приоритетами", desc: "30+ рекомендаций с приоритетом по эффекту и сложности. Score по 7 направлениям. Сравнение с ТОП-10% ниши. План внедрения на 30 дней." },
          ].map(({ n, icon, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: 20, alignItems: "flex-start", background: card, borderRadius: 16, border: `1px solid ${border}`, padding: "22px 24px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: accentLight, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.05em" }}>{n}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</span>
                </div>
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
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ТАРИФЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Начните с разового отчёта</h2>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Или сразу с подпиской — с мониторингом изменений 24/7</p>
        </div>

        {/* One-off row — highlighted banner */}
        <div className="lp-card" style={{ background: `linear-gradient(135deg,${accent}18,#8b5cf610)`, borderRadius: 18, border: `1px solid ${accent}40`, padding: "22px 26px", marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
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
          ].map(plan => (
            <div key={plan.name} className="lp-card" style={{
              background: plan.highlight ? `linear-gradient(145deg,${accent},#4f46e5)` : card,
              borderRadius: 20,
              border: `1px solid ${plan.highlight ? accent : border}`,
              padding: "26px 20px",
              position: "relative",
              boxShadow: plan.highlight ? `0 8px 40px ${accent}40` : "none",
            }}>
              {plan.tag && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", borderRadius: 20, padding: "3px 14px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {plan.tag}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.65)" : muted, marginBottom: 8, letterSpacing: "0.06em" }}>{plan.name.toUpperCase()}</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: plan.highlight ? "#fff" : fg, letterSpacing: "-0.03em" }}>{plan.price}</span>
              </div>
              <div style={{ fontSize: 12, color: plan.highlight ? "rgba(255,255,255,0.5)" : muted, marginBottom: 20 }}>{plan.period}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.85)" : muted }}>
                    <Check size={14} style={{ color: plan.highlight ? "#a5b4fc" : accent, flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </div>
                ))}
              </div>
              <button className="lp-btn" onClick={onRegister} style={{ width: "100%", background: plan.highlight ? "#fff" : accent, color: plan.highlight ? accent : "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: muted }}>
          Enterprise от 99 900 ₽/мес · скидки за предоплату (3 мес −5%, 6 мес −10%, 12 мес −20%)
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 6. FAQ — critical for GEO (JSON-LD above)               */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: "64px 20px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ВОПРОСЫ И ОТВЕТЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Часто задаваемые вопросы</h2>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Ответы на вопросы о платформе, GEO-оптимизации и тарифах</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqItems.map(({ q, a }, idx) => (
            <details
              key={idx}
              className="lp-faq"
              style={{
                background: card,
                borderRadius: 14,
                border: `1px solid ${border}`,
                padding: "18px 22px",
                transition: "border-color 0.15s",
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
                fontSize: 13.5,
                color: muted,
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

        {/* Partner program — compact banner after FAQ */}
        <div id="partner" style={{ marginTop: 40, background: `linear-gradient(135deg,${accent}15,#818cf808)`, borderRadius: 20, border: `1px solid ${accent}25`, padding: "26px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: `${accent}25`, color: "#a5b4fc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.08em", marginBottom: 2 }}>ПАРТНЁРСКАЯ ПРОГРАММА</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: fg, marginBottom: 4, letterSpacing: "-0.01em" }}>
                20% комиссии с каждого платежа · до 50% для интеграторов
              </div>
              <div style={{ fontSize: 13, color: muted }}>Клиент получает скидку 10%. Выплаты ежемесячно от 3 000 ₽.</div>
            </div>
          </div>
          <a href={TG_PARTNER_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: "#fff", borderRadius: 10, padding: "11px 22px", fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <Send size={14} /> Стать партнёром
          </a>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 7. FINAL CTA + FOOTER                                   */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "72px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center,${accent}12 0%,transparent 70%)` }} />
        <div style={{ position: "relative", zIndex: 1 }}>
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

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${border}`, padding: "40px 32px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${accent},#818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 10 }}>MR</div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>MarketRadar</span>
            </div>
            <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>
              Радар вашего бизнеса, рынка и конкурентов. Продукт экосистемы Company24.pro
            </div>
          </div>

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
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>КОНТАКТЫ</div>
            <div style={{ marginBottom: 8 }}>
              <a href={TG_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Send size={13} /> Канал @company24pro
              </a>
            </div>
            <div style={{ marginBottom: 8 }}>
              <a href={TG_PARTNER_BOT} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Users size={13} /> Партнёрам
              </a>
            </div>
            <div>
              <a href={TG_BOT} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MessagesSquare size={13} /> Поддержка в боте
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
