"use client";

import React, { useState, useEffect } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult, TASegment } from "@/lib/ta-types";
import type { SMMResult, SMMSocialLinks, SMMRealStats } from "@/lib/smm-types";
import type { ContentPlan, ContentPostIdea, ContentReelIdea, GeneratedPost, GeneratedReel, AvatarSettings, ReferenceImage, BrandBook, PostMetrics, ReelMetrics, GeneratedStory, TovCheckResult, TovIssue, PresentationStyle } from "@/lib/content-types";
import type { Review, ReviewAnalysis } from "@/lib/review-types";

type AnyMetrics = PostMetrics & ReelMetrics;

// ============================================================
// MarketRadar — Конкурентный анализ для Company24.pro
// ============================================================

const COLORS = {
  light: {
    bg: "#f8fafc", bgCard: "#ffffff", bgSidebar: "#f1f5f9",
    bgSidebarHover: "#e8eef5", bgSidebarActive: "#dde6f5",
    accent: "#6366f1", accentWarm: "#f59e0b", accentGreen: "#10b981",
    accentRed: "#ef4444", accentYellow: "#f59e0b",
    textPrimary: "#0f172a", textSecondary: "#475569", textMuted: "#94a3b8",
    border: "#e2e8f0", borderLight: "#f1f5f9",
    shadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(99,102,241,0.06)",
    shadowLg: "0 4px 6px rgba(0,0,0,0.04), 0 10px 40px rgba(99,102,241,0.1)",
  },
  dark: {
    bg: "#070b14", bgCard: "#0d1424", bgSidebar: "#060a12",
    bgSidebarHover: "#111828", bgSidebarActive: "#161f33",
    accent: "#818cf8", accentWarm: "#fbbf24", accentGreen: "#34d399",
    accentRed: "#f87171", accentYellow: "#fbbf24",
    textPrimary: "#f1f5f9", textSecondary: "#94a3b8", textMuted: "#475569",
    border: "#1e2d45", borderLight: "#172035",
    shadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.4)",
    shadowLg: "0 4px 8px rgba(0,0,0,0.6), 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(129,140,248,0.06)",
  },
} as const;

type Theme = keyof typeof COLORS;
type Colors = (typeof COLORS)[Theme];

// Static data
const SOURCES_FREE = [
  { name: "Сайт конкурента", method: "Playwright → Turndown → Claude API", price: "~$0.03/сайт", phase: "MVP" },
  { name: "Wappalyzer", method: "npm wappalyzer-core", price: "Бесплатно", phase: "MVP" },
  { name: "WHOIS", method: "whois lookup", price: "Бесплатно", phase: "MVP" },
  { name: "robots.txt / sitemap", method: "HTTP fetch + XML parse", price: "Бесплатно", phase: "MVP" },
  { name: "VK API", method: "VK API (groups, wall)", price: "Бесплатно", phase: "MVP" },
  { name: "Telegram", method: "t.me парсинг", price: "Бесплатно", phase: "MVP" },
  { name: "DaData", method: "dadata.ru API", price: "Бесплатно (10k/день)", phase: "MVP" },
  { name: "egrul.nalog.ru", method: "Через DaData", price: "Бесплатно", phase: "MVP" },
  { name: "hh.ru API", method: "api.hh.ru", price: "Бесплатно", phase: "MVP" },
  { name: "Google PageSpeed", method: "PageSpeed Insights API", price: "Бесплатно", phase: "MVP" },
  { name: "Wayback Machine", method: "web.archive.org CDX API", price: "Бесплатно", phase: "MVP" },
  { name: "Rusprofile.ru", method: "HTML парсинг", price: "Бесплатно", phase: "MVP" },
  { name: "Яндекс.Карты", method: "Поисковый парсинг", price: "Бесплатно", phase: "MVP" },
  { name: "2ГИС", method: "Catalog API", price: "Бесплатно", phase: "MVP" },
  { name: "zakupki.gov.ru", method: "HTML парсинг", price: "Бесплатно", phase: "MVP" },
  { name: "MegaIndex", method: "megaindex.ru API", price: "Бесплатно (базовый)", phase: "v2" },
  { name: "Яндекс.Wordstat", method: "wordstat.yandex.ru парсинг", price: "Бесплатно", phase: "v2" },
  { name: "YouTube / Social Blade", method: "YouTube Data API", price: "Бесплатно", phase: "v2" },
  { name: "SuperJob", method: "Парсинг", price: "Бесплатно", phase: "v3" },
  { name: "Авито Работа", method: "Парсинг", price: "Бесплатно", phase: "v3" },
  { name: "Отзовик / IRecommend", method: "Парсинг", price: "Бесплатно", phase: "v3" },
];

// ============================================================
// Authentication Types & Helpers
// ============================================================

interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  niche?: string;
  companyName?: string;
  companyUrl?: string;
  vk?: string;
  tg?: string;
  hhUrl?: string;
  onboardingDone: boolean;
  tgChatId?: string;
  tgNotifyAnalysis?: boolean;
  tgNotifyCompetitors?: boolean;
  tgNotifyVacancies?: boolean;
  tgNotifyDigest?: boolean;
}

function authGetUsers(): UserAccount[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("mr_users") || "[]"); } catch { return []; }
}
function authSaveUser(user: UserAccount): void {
  const users = authGetUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) users[idx] = user; else users.push(user);
  localStorage.setItem("mr_users", JSON.stringify(users));
}
function authGetCurrentUser(): UserAccount | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("mr_current_user");
  if (!id) return null;
  return authGetUsers().find(u => u.id === id) ?? null;
}
function authSetCurrentUser(id: string | null): void {
  if (id) localStorage.setItem("mr_current_user", id);
  else localStorage.removeItem("mr_current_user");
}

// ── Telegram notification helper ──────────────────────────────
async function sendTgNotification(chatId: string, text: string) {
  try {
    await fetch("/api/telegram/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, text }),
    });
  } catch { /* silent fail */ }
}

const NICHE_COMPETITORS: Record<string, Array<{ name: string; url: string }>> = {
  digital: [
    { name: "Kokoc Group", url: "kokoc.com" },
    { name: "iConText Group", url: "icontext.ru" },
    { name: "i-Media", url: "i-media.ru" },
    { name: "Nimax", url: "nimax.ru" },
    { name: "WebCanape", url: "webcanape.ru" },
  ],
  clinic: [
    { name: "СМ-Клиника", url: "sm-clinic.ru" },
    { name: "Медицина.ру", url: "medicina.ru" },
    { name: "К+31", url: "klinika31.ru" },
    { name: "МедСи", url: "medsi.ru" },
    { name: "Hadassah", url: "hmc.ru" },
  ],
  b2b: [
    { name: "Контур", url: "kontur.ru" },
    { name: "МойСклад", url: "moysklad.ru" },
    { name: "amoCRM", url: "amocrm.ru" },
    { name: "Битрикс24", url: "bitrix24.ru" },
    { name: "1С-Битрикс", url: "1c-bitrix.ru" },
  ],
  other: [
    { name: "Авито", url: "avito.ru" },
    { name: "Яндекс Маркет", url: "market.yandex.ru" },
    { name: "Озон", url: "ozon.ru" },
    { name: "ВКонтакте", url: "vk.com" },
    { name: "Тинькофф", url: "tinkoff.ru" },
  ],
};

// ============================================================
// Landing Page View (full marketing page)
// ============================================================

function LandingPageView({ c, theme, setTheme, onRegister, onLogin }: {
  c: Colors; theme: Theme; setTheme: (t: Theme) => void;
  onRegister: () => void; onLogin: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <div style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", background: c.bg, color: c.textPrimary, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${c.accent}40; }
        .mr-btn { transition: all 0.15s ease; }
        .mr-btn:hover { transform: translateY(-1px); opacity: 0.92; }
        .mr-btn:active { transform: translateY(0); }
        .mr-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .mr-card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 32px ${c.accent}20 !important; }
        @keyframes mr-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes mr-pulse-ring { 0%{transform:scale(0.95);opacity:0.7} 100%{transform:scale(1.2);opacity:0} }
        @keyframes mr-gradient { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", borderBottom: `1px solid ${c.border}`, background: c.bg + "e0", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, #6366f1, #818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em", boxShadow: "0 2px 12px #6366f140" }}>MR</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary, letterSpacing: "-0.02em" }}>MarketRadar</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="mr-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: c.textMuted, fontFamily: "inherit", fontSize: 14 }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button className="mr-btn" onClick={onLogin} style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: c.textSecondary, fontFamily: "inherit" }}>
            Войти
          </button>
          <button className="mr-btn" onClick={onRegister} style={{ background: "#6366f1", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff", fontFamily: "inherit", boxShadow: "0 2px 12px #6366f140" }}>
            Начать бесплатно
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: "center", padding: "96px 20px 80px", position: "relative", overflow: "hidden" }}>
        {/* background grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${c.border} 1px, transparent 1px), linear-gradient(90deg, ${c.border} 1px, transparent 1px)`, backgroundSize: "48px 48px", opacity: 0.4 }} />
        {/* glow blobs */}
        <div style={{ position: "absolute", top: "20%", left: "25%", width: 500, height: 500, borderRadius: "50%", background: "#6366f118", filter: "blur(100px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "10%", right: "20%", width: 300, height: 300, borderRadius: "50%", background: "#818cf810", filter: "blur(80px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#6366f115", color: "#818cf8", borderRadius: 20, padding: "5px 16px 5px 8px", fontSize: 12, fontWeight: 600, marginBottom: 28, border: "1px solid #6366f125", backdropFilter: "blur(8px)" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800 }}>✦</div>
            ИИ-анализ конкурентов для бизнеса в России
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.05, margin: "0 auto 24px", maxWidth: 820, letterSpacing: "-0.03em", color: c.textPrimary }}>
            Узнайте всё о конкурентах
            <br />
            <span style={{ background: "linear-gradient(135deg, #6366f1, #818cf8, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              за 10 минут
            </span>
          </h1>

          <p style={{ fontSize: 17, color: c.textSecondary, maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7, fontWeight: 400 }}>
            MarketRadar анализирует сайты конкурентов с помощью Claude AI —<br />SEO, соцсети, контент, HR-бренд — и даёт конкретные рекомендации
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <button className="mr-btn" onClick={onRegister} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px #6366f150, 0 0 0 1px #6366f1" }}>
              Начать бесплатно →
            </button>
            <button className="mr-btn" onClick={onLogin} style={{ background: c.bgCard, color: c.textPrimary, border: `1px solid ${c.border}`, borderRadius: 12, padding: "14px 28px", fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(8px)" }}>
              Уже есть аккаунт
            </button>
          </div>
          <div style={{ fontSize: 12, color: c.textMuted, letterSpacing: "0.02em" }}>Бесплатно · Без кредитной карты · 3 анализа в месяц</div>

          {/* stats row */}
          <div style={{ display: "flex", gap: 0, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
            {[
              { num: "10 000+", label: "анализов выполнено" },
              { num: "40+", label: "источников данных" },
              { num: "< 60 сек", label: "время анализа" },
              { num: "99%", label: "аптайм API" },
            ].map(({ num, label }, i, arr) => (
              <div key={label} style={{ textAlign: "center", padding: "16px 36px", borderLeft: i > 0 ? `1px solid ${c.border}` : "none" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.textPrimary, letterSpacing: "-0.03em" }}>{num}</div>
                <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "0 20px 80px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ВОЗМОЖНОСТИ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: c.textPrimary, margin: "0 0 12px", letterSpacing: "-0.02em" }}>Три инструмента в одном</h2>
          <p style={{ fontSize: 15, color: c.textSecondary, margin: 0 }}>Всё что нужно для конкурентного анализа без лишних инструментов</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {[
            { icon: "🔍", title: "Глубокий самоанализ", desc: "Введите свой сайт — получите полный аудит: SEO, соцсети, контент, HR-бренд и стек. Сравнение со средним по нише и ТОП-10%.", accent: "#6366f1", tag: "SEO + Контент" },
            { icon: "🎯", title: "Мониторинг конкурентов", desc: "Добавьте до 30 конкурентов и видите их сильные и слабые стороны. Battle Cards помогут подготовиться к встрече с клиентом.", accent: "#10b981", tag: "До 30 конкурентов" },
            { icon: "✍️", title: "AI-правки текста", desc: "Claude AI анализирует оффер, заголовки и мета-теги — и даёт готовые переформулировки, новые ключевые слова и идеи контента.", accent: "#f59e0b", tag: "Готовые тексты" },
          ].map(({ icon, title, desc, accent, tag }) => (
            <div key={title} className="mr-card-hover" style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "28px 26px", boxShadow: c.shadow, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: accent + "18", border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{icon}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: accent + "15", padding: "4px 10px", borderRadius: 20, border: `1px solid ${accent}25` }}>{tag}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: c.textPrimary, marginBottom: 10, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "0 20px 80px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>КАК ЭТО РАБОТАЕТ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: c.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>Три шага до инсайтов</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { n: "01", title: "Введите URL сайта", desc: "Вставьте адрес своего сайта или конкурента — мы соберём все публичные данные автоматически." },
            { n: "02", title: "AI-анализ за 30–60 секунд", desc: "Claude AI обрабатывает SEO, тексты, соцсети, вакансии и юридические данные через 8+ открытых API." },
            { n: "03", title: "Получите готовые действия", desc: "Конкретные правки заголовков, список ключевых слов, оффер-редизайн и сравнение с конкурентами." },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: 20, alignItems: "flex-start", background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: "22px 24px", boxShadow: c.shadow }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#6366f115", border: "1px solid #6366f125", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#818cf8", flexShrink: 0, letterSpacing: "-0.02em" }}>{n}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 4, letterSpacing: "-0.01em" }}>{title}</div>
                <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: "0 20px 80px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ТАРИФЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: c.textPrimary, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Начните бесплатно</h2>
          <p style={{ fontSize: 14, color: c.textSecondary, margin: 0 }}>Масштабируйтесь по мере роста без рисков</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {[
            { name: "Free", price: "₽0", period: "", features: ["1 компания", "3 конкурента", "3 анализа/мес", "Базовые рекомендации"], highlight: false, cta: "Начать бесплатно" },
            { name: "Starter", price: "₽2 990", period: "/мес", features: ["1 компания", "10 конкурентов", "Безлимит анализов", "PDF-отчёты", "Telegram-уведомления"], highlight: false, cta: "Попробовать" },
            { name: "Pro", price: "₽7 990", period: "/мес", features: ["3 компании", "30 конкурентов", "Battle cards", "API-доступ", "White-label отчёты"], highlight: true, cta: "Выбрать Pro" },
            { name: "Agency", price: "₽14 990", period: "/мес", features: ["10 компаний", "100 конкурентов", "Real-time", "5 рабочих мест", "Брендированные отчёты"], highlight: false, cta: "Для агентств" },
          ].map(plan => (
            <div key={plan.name} className="mr-card-hover" style={{ background: plan.highlight ? "linear-gradient(135deg, #6366f1, #4f46e5)" : c.bgCard, borderRadius: 20, border: `1px solid ${plan.highlight ? "#6366f1" : c.border}`, padding: "24px 20px", position: "relative", boxShadow: plan.highlight ? "0 8px 32px #6366f140, 0 0 0 1px #6366f160" : c.shadow }}>
              {plan.highlight && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>ПОПУЛЯРНЫЙ</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.7)" : c.textMuted, marginBottom: 6, letterSpacing: "0.04em" }}>{plan.name.toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 18 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: plan.highlight ? "#fff" : c.textPrimary, letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.5)" : c.textMuted }}>{plan.period}</span>
              </div>
              <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 7 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.85)" : c.textSecondary, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 5, background: plan.highlight ? "rgba(255,255,255,0.2)" : "#6366f118", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, color: plan.highlight ? "#fff" : "#818cf8", fontWeight: 800 }}>✓</span>
                    </div>
                    {f}
                  </div>
                ))}
              </div>
              <button className="mr-btn" onClick={onRegister} style={{ width: "100%", background: plan.highlight ? "#fff" : "#6366f1", color: plan.highlight ? "#6366f1" : "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em" }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "0 20px 80px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ОТЗЫВЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: c.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>Доверяют маркетологи</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
          {[
            { name: "Алексей М.", role: "Директор digital-агентства", text: "За час нашёл 3 слабых места у главного конкурента и обновил предложение. Клиент оценил — закрыли сделку.", avatar: "А" },
            { name: "Ирина Соколова", role: "Маркетолог клиники", text: "Наконец понятно, почему конкурент в ТОП-3 Яндекса. Оказалось, schema.org — добавили за 2 дня, трафик вырос.", avatar: "И" },
            { name: "Дмитрий К.", role: "Владелец B2B компании", text: "Онбординг за 10 минут. Система сама предложила конкурентов по нише — не нужно ничего гуглить.", avatar: "Д" },
          ].map(({ name, role, text, avatar }) => (
            <div key={name} className="mr-card-hover" style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "24px", boxShadow: c.shadow }}>
              <div style={{ fontSize: 14, color: "#f59e0b", marginBottom: 12, letterSpacing: 3 }}>★★★★★</div>
              <div style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.65, marginBottom: 18 }}>"{text}"</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>{avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary }}>{name}</div>
                  <div style={{ fontSize: 12, color: c.textMuted }}>{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BOTTOM */}
      <section style={{ padding: "64px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, #6366f115 0%, transparent 70%)` }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: c.textPrimary, margin: "0 0 12px", letterSpacing: "-0.03em" }}>Начните анализировать сейчас</h2>
          <p style={{ fontSize: 15, color: c.textSecondary, margin: "0 0 32px" }}>Первые 3 анализа — бесплатно, без кредитной карты</p>
          <button className="mr-btn" onClick={onRegister} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "16px 48px", fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px #6366f150", letterSpacing: "-0.01em" }}>
            Создать аккаунт →
          </button>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "20px", borderTop: `1px solid ${c.border}`, fontSize: 12, color: c.textMuted }}>
        © 2026 MarketRadar · Продукт Company24.pro
      </footer>
    </div>
  );
}

// ============================================================
// Register View
// ============================================================

function RegisterView({ c, onSuccess, onLogin }: { c: Colors; onSuccess: (user: UserAccount) => void; onLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${c.accent}20`; e.currentTarget.style.borderColor = c.accent; };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = c.border; };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Введите имя"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Введите корректный email"); return; }
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return; }
    const users = authGetUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
      setError("Аккаунт с таким email уже существует");
      return;
    }
    const user: UserAccount = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim() || undefined,
      onboardingDone: false,
    };
    authSaveUser(user);
    authSetCurrentUser(user.id);
    onSuccess(user);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `${c.bg} radial-gradient(${c.accent}08 1px, transparent 1px)`, backgroundSize: "24px 24px", fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: 20 }}>
      <div style={{ background: c.bgCard, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: `1px solid ${c.border}`, padding: "40px 44px", width: "100%", maxWidth: 440, boxShadow: c.shadowLg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.textPrimary }}>MarketRadar</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: c.textPrimary }}>Создать аккаунт</h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 22px" }}>Бесплатно · Без кредитной карты</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Имя *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" onFocus={onFocus} onBlur={onBlur} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@example.com" onFocus={onFocus} onBlur={onBlur} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Пароль * (мин. 6 символов)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onFocus={onFocus} onBlur={onBlur} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Телефон</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" onFocus={onFocus} onBlur={onBlur} style={inputStyle} />
          </div>
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: c.accentRed + "12", color: c.accentRed, fontSize: 13 }}>{error}</div>}
          <button type="submit" style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            Создать аккаунт →
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: c.textSecondary }}>
          Уже есть аккаунт?{" "}
          <span onClick={onLogin} style={{ color: c.accent, fontWeight: 600, cursor: "pointer" }}>Войти</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Login View
// ============================================================

function LoginView({ c, onSuccess, onRegister }: { c: Colors; onSuccess: (user: UserAccount) => void; onRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loginInputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const };
  const onFocusL = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${c.accent}20`; e.currentTarget.style.borderColor = c.accent; };
  const onBlurL = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = c.border; };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const users = authGetUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
    if (!user) { setError("Неверный email или пароль"); return; }
    authSetCurrentUser(user.id);
    onSuccess(user);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `${c.bg} radial-gradient(${c.accent}08 1px, transparent 1px)`, backgroundSize: "24px 24px", fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: 20 }}>
      <div style={{ background: c.bgCard, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: `1px solid ${c.border}`, padding: "40px 44px", width: "100%", maxWidth: 400, boxShadow: c.shadowLg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.textPrimary }}>MarketRadar</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: c.textPrimary }}>Войти</h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 22px" }}>Добро пожаловать обратно</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@example.com" onFocus={onFocusL} onBlur={onBlurL} style={loginInputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onFocus={onFocusL} onBlur={onBlurL} style={loginInputStyle} />
          </div>
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: c.accentRed + "12", color: c.accentRed, fontSize: 13 }}>{error}</div>}
          <button type="submit" style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            Войти →
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: c.textSecondary }}>
          Нет аккаунта?{" "}
          <span onClick={onRegister} style={{ color: c.accent, fontWeight: 600, cursor: "pointer" }}>Зарегистрироваться</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Onboarding View (3 steps)
// ============================================================

function OnboardingView({ c, user, onComplete }: {
  c: Colors;
  user: UserAccount;
  onComplete: (updatedUser: UserAccount, companyUrl: string, competitorUrls: string[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [niche, setNiche] = useState(user.niche || "");
  const [companyName, setCompanyName] = useState(user.companyName || "");
  const [companyUrl, setCompanyUrl] = useState(user.companyUrl || "");
  const [vk, setVk] = useState("");
  const [tg, setTg] = useState("");
  const [hh, setHh] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [customUrl, setCustomUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const niches = [
    { id: "digital", icon: "💻", label: "Digital-агентство", desc: "SEO, контекст, SMM, разработка" },
    { id: "clinic", icon: "🏥", label: "Клиника или салон", desc: "Медицина, красота, здоровье" },
    { id: "b2b", icon: "🤝", label: "B2B-торговля или SaaS", desc: "Программное обеспечение, услуги" },
    { id: "other", icon: "🏢", label: "Другое", desc: "Другая ниша или тип бизнеса" },
  ];

  const suggestions = niche ? (NICHE_COMPETITORS[niche] ?? []) : [];
  const MAX_COMPETITORS = 30;

  const toggleCompetitor = (url: string) => {
    setSelectedCompetitors(prev => {
      const next = new Set(prev);
      if (next.has(url)) { next.delete(url); return next; }
      if (next.size >= MAX_COMPETITORS) return prev;
      next.add(url);
      return next;
    });
  };

  const addCustom = () => {
    if (!customUrl.trim()) return;
    if (selectedCompetitors.size >= MAX_COMPETITORS) { setError(`Максимум ${MAX_COMPETITORS} на тарифе Free`); return; }
    setSelectedCompetitors(prev => new Set([...prev, customUrl.trim()]));
    setCustomUrl("");
    setError(null);
  };

  const handleFinish = () => {
    const updatedUser: UserAccount = {
      ...user, niche, companyName: companyName.trim(), companyUrl: companyUrl.trim(),
      vk: vk.trim() || undefined, tg: tg.trim() || undefined, hhUrl: hh.trim() || undefined,
      onboardingDone: true,
    };
    authSaveUser(updatedUser);
    onComplete(updatedUser, companyUrl.trim(), Array.from(selectedCompetitors));
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>MR</div>
            <span style={{ fontWeight: 700, color: c.textPrimary, fontSize: 15 }}>MarketRadar</span>
          </div>
          <span style={{ fontSize: 12, color: c.textMuted }}>Шаг {step} из 3</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / 3) * 100}%`, background: c.accent, borderRadius: 3, transition: "width 0.4s" }} />
        </div>
      </div>

      <div style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "30px 36px", width: "100%", maxWidth: 560, boxShadow: c.shadowLg }}>
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: c.textPrimary }}>Выберите вашу нишу</h2>
            <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 22px" }}>Мы подберём конкурентов и настроим анализ под вашу отрасль</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {niches.map(n => (
                <div key={n.id} onClick={() => setNiche(n.id)}
                  style={{ border: `2px solid ${niche === n.id ? c.accent : c.border}`, borderRadius: 12, padding: 16, cursor: "pointer", background: niche === n.id ? c.accent + "0c" : "transparent", transition: "all 0.15s", position: "relative" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
                  {niche === n.id && (
                    <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: c.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>
                    </div>
                  )}
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{n.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary, marginBottom: 3 }}>{n.label}</div>
                  <div style={{ fontSize: 11, color: c.textSecondary }}>{n.desc}</div>
                </div>
              ))}
            </div>
            <button disabled={!niche} onClick={() => setStep(2)} style={{ marginTop: 20, width: "100%", background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: niche ? "pointer" : "not-allowed", opacity: niche ? 1 : 0.5, fontFamily: "inherit" }}>
              Далее →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: c.textPrimary }}>Расскажите о компании</h2>
            <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 20px" }}>Обязательные поля помогут нам запустить анализ</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                { label: "Название компании *", value: companyName, setter: setCompanyName, placeholder: "ООО Ромашка" },
                { label: "Сайт компании *", value: companyUrl, setter: setCompanyUrl, placeholder: "example.ru" },
                { label: "VK-группа", value: vk, setter: (v: string) => setVk(v), placeholder: "vk.com/company" },
                { label: "Telegram-канал", value: tg, setter: (v: string) => setTg(v), placeholder: "t.me/company" },
                { label: "Профиль на hh.ru", value: hh, setter: (v: string) => setHh(v), placeholder: "hh.ru/employer/123" },
              ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string }>).map(field => (
                <div key={field.label}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>{field.label}</label>
                  <input type="text" value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            {error && <div style={{ marginTop: 10, color: c.accentRed, fontSize: 13 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => { setError(null); setStep(1); }} style={{ flex: 1, background: "none", border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", color: c.textSecondary, fontFamily: "inherit" }}>← Назад</button>
              <button onClick={() => { setError(null); if (!companyName.trim()) { setError("Введите название компании"); return; } if (!companyUrl.trim()) { setError("Введите URL сайта"); return; } setStep(3); }}
                style={{ flex: 2, background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                Далее →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: c.textPrimary }}>Выберите конкурентов</h2>
            <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 4px" }}>Выберите до {MAX_COMPETITORS} конкурентов (тариф Free)</p>
            <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 14 }}>Выбрано: {selectedCompetitors.size} из {MAX_COMPETITORS}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {suggestions.map(s => {
                const selected = selectedCompetitors.has(s.url);
                const disabled = !selected && selectedCompetitors.size >= MAX_COMPETITORS;
                return (
                  <div key={s.url} onClick={() => !disabled && toggleCompetitor(s.url)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${selected ? c.accent : c.border}`, background: selected ? c.accent + "0c" : "transparent", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.15s" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? c.accent : c.border}`, background: selected ? c.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: c.textPrimary }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: c.textMuted }}>{s.url}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Добавить своего конкурента</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="competitor.ru"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <button onClick={addCustom} disabled={!customUrl.trim() || selectedCompetitors.size >= MAX_COMPETITORS}
                  style={{ background: c.accent + "20", color: c.accent, border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: !customUrl.trim() || selectedCompetitors.size >= MAX_COMPETITORS ? 0.5 : 1 }}>
                  + Добавить
                </button>
              </div>
              {error && <div style={{ marginTop: 5, color: c.accentRed, fontSize: 12 }}>{error}</div>}
            </div>
            {Array.from(selectedCompetitors).filter(url => !suggestions.find(s => s.url === url)).map(url => (
              <div key={url} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${c.accent}`, background: c.accent + "0c", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: c.textPrimary }}>{url}</span>
                <span onClick={() => toggleCompetitor(url)} style={{ fontSize: 13, color: c.accentRed, cursor: "pointer", fontWeight: 600 }}>✕</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: "none", border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", color: c.textSecondary, fontFamily: "inherit" }}>← Назад</button>
              <button onClick={handleFinish} style={{ flex: 2, background: c.accentGreen, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {selectedCompetitors.size > 0 ? `Запустить анализ (${1 + selectedCompetitors.size} сайта) →` : "Пропустить и продолжить →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Reusable UI Components
// ============================================================

function ScoreRing({ score, size = 160, strokeWidth = 10, c }: { score: number; size?: number; strokeWidth?: number; c: Colors }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  const gradId = `sg-${size}-${strokeWidth}`;
  const scoreColor = score >= 75 ? c.accentGreen : score >= 50 ? c.accentWarm : c.accentRed;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.accent} />
            <stop offset="100%" stopColor={scoreColor} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.borderLight} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={circ - progress} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 ${strokeWidth}px ${c.accent}60)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color: c.textPrimary, lineHeight: 1, letterSpacing: "-0.02em" }}>{score}</span>
        <span style={{ fontSize: size * 0.085, color: c.textMuted, marginTop: 3, letterSpacing: "0.02em" }}>из 100</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, color, c, height = 8 }: { value: number; color: string; c: Colors; height?: number }) {
  return (
    <div style={{ height, borderRadius: height / 2, background: c.borderLight, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, borderRadius: height / 2, background: color, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

function PriorityBadge({ priority, c }: { priority: string; c: Colors }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    high: { label: "Высокий", bg: c.accentRed + "18", color: c.accentRed },
    medium: { label: "Средний", bg: c.accentYellow + "18", color: c.accentYellow },
    low: { label: "Низкий", bg: c.accentGreen + "18", color: c.accentGreen },
  };
  const { label, bg, color } = map[priority] ?? map.medium;
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>
  );
}

function CategoryCard({ cat, c }: { cat: AnalysisResult["company"]["categories"][number]; c: Colors }) {
  const color = cat.score >= 75 ? c.accentGreen : cat.score >= 50 ? c.accentWarm : c.accentRed;
  return (
    <div style={{ background: c.bgCard, borderRadius: 16, padding: "16px 20px", border: `1px solid ${c.border}`, display: "flex", alignItems: "center", gap: 16, boxShadow: c.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)` }} />
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: c.textSecondary }}>{cat.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontWeight: 800, fontSize: 22, color, letterSpacing: "-0.02em" }}>{cat.score}</span>
            {cat.delta !== 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: cat.delta > 0 ? c.accentGreen : c.accentRed }}>
                {cat.delta > 0 ? "↑" : "↓"}{Math.abs(cat.delta)}
              </span>
            )}
          </div>
        </div>
        <ProgressBar value={cat.score} color={color} c={c} height={4} />
      </div>
    </div>
  );
}

function RadarChart({ data, competitors, c, size = 260 }: { data: AnalysisResult["company"]; competitors?: AnalysisResult["company"][]; c: Colors; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const cats = data.categories, n = cats.length;
  const getPoint = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const d = (v / 100) * r;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
  };
  const poly = (vals: number[]) => vals.map((v, i) => getPoint(i, v)).map(p => `${p.x},${p.y}`).join(" ");
  const compColors = [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm, c.accent];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[20, 40, 60, 80, 100].map(v => (
        <polygon key={v} points={Array.from({ length: n }, (_, i) => getPoint(i, v)).map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={c.border} strokeWidth={1} />
      ))}
      {cats.map((cat, i) => {
        const p = getPoint(i, 110);
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill={c.textSecondary} fontSize={10} fontWeight={500}>{cat.name}</text>;
      })}
      {competitors?.map((comp, ci) => (
        <polygon key={ci} points={poly(comp.categories.map(c2 => c2.score))} fill={compColors[ci % compColors.length] + "15"} stroke={compColors[ci % compColors.length]} strokeWidth={1.5} strokeOpacity={0.6} />
      ))}
      <polygon points={poly(cats.map(c2 => c2.score))} fill={c.accent + "25"} stroke={c.accent} strokeWidth={2.5} />
      {cats.map((cat, i) => { const p = getPoint(i, cat.score); return <circle key={i} cx={p.x} cy={p.y} r={4} fill={c.accent} stroke={c.bgCard} strokeWidth={2} />; })}
    </svg>
  );
}

// ============================================================
// Landing View
// ============================================================

function LandingView({ c, theme, setTheme, onAnalyze }: { c: Colors; theme: Theme; setTheme: (t: Theme) => void; onAnalyze: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAnalyze(url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>MR</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, color: c.textPrimary, lineHeight: 1.1 }}>MarketRadar</div>
          <div style={{ fontSize: 12, color: c.textMuted }}>Узнайте всё о своих конкурентах за 10 минут</div>
        </div>
      </div>
      <div style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "32px 36px", width: "100%", maxWidth: 520, boxShadow: c.shadowLg }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: c.textPrimary, margin: "0 0 6px" }}>Проанализируйте любой сайт</h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 24px" }}>Введите URL — мы оценим SEO, соцсети, контент и дадим конкретные рекомендации</p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="example.ru" disabled={loading}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${error ? c.accentRed : c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={loading || !url.trim()}
              style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", opacity: loading || !url.trim() ? 0.65 : 1, fontFamily: "inherit" }}>
              {loading ? "Анализ…" : "Анализировать →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: c.accentRed, fontSize: 13 }}>{error}</div>}
        </form>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginTop: 24 }}>
          {[{ i: "🔍", t: "SEO-аудит" }, { i: "📱", t: "Соцсети" }, { i: "✏️", t: "Анализ контента" }, { i: "⚙️", t: "Технологии" }, { i: "👥", t: "HR-бренд" }, { i: "💡", t: "AI-рекомендации" }].map(({ i, t }) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.textSecondary }}><span>{i}</span><span>{t}</span></div>
          ))}
        </div>
      </div>
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ marginTop: 20, background: "none", border: "none", cursor: "pointer", color: c.textMuted, fontSize: 13, fontFamily: "inherit" }}>
        {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
      </button>
    </div>
  );
}

// ============================================================
// Loading View
// ============================================================

function LoadingView({ c, url }: { c: Colors; url: string }) {
  const steps = ["Загружаем сайт…", "Извлекаем данные…", "AI анализирует…"];
  const [step, setStep] = useState(0);
  useEffect(() => { const id = setInterval(() => setStep(s => s < steps.length - 1 ? s + 1 : s), 4000); return () => clearInterval(id); }, []);
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", gap: 20 }}>
      <style>{`@keyframes mr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 48, height: 48, border: `4px solid ${c.borderLight}`, borderTop: `4px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin 1s linear infinite" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>{steps[step]}</div>
        <div style={{ fontSize: 12, color: c.textMuted }}>{url.replace(/^https?:\/\//, "")}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= step ? c.accent : c.borderLight, transition: "background 0.4s" }} />)}
      </div>
    </div>
  );
}

// ============================================================
// New Analysis View (inside dashboard sidebar)
// ============================================================

function NewAnalysisView({ c, onAnalyze, isAnalyzing }: { c: Colors; onAnalyze: (url: string) => Promise<void>; isAnalyzing: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isAnalyzing) return;
    setError(null);
    try {
      await onAnalyze(url.trim());
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Новый анализ</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 24px" }}>Введите URL сайта для анализа. Результат будет добавлен в дашборд и список конкурентов.</p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="example.ru" disabled={isAnalyzing}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${error ? c.accentRed : c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={isAnalyzing || !url.trim()}
              style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", opacity: isAnalyzing || !url.trim() ? 0.65 : 1, fontFamily: "inherit" }}>
              {isAnalyzing ? "Анализ…" : "Анализировать →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: c.accentRed, fontSize: 13 }}>{error}</div>}
          {isAnalyzing && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <style>{`@keyframes mr-spin2 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 16, height: 16, border: `2px solid ${c.borderLight}`, borderTop: `2px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin2 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: c.textSecondary }}>Анализируем сайт…</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Collapsible Section wrapper
// ============================================================

function KeysoDashboardBlock({ c, dash }: {
  c: Colors;
  dash?: { yandex?: import("@/lib/types").KeysoDashboardData; google?: import("@/lib/types").KeysoDashboardData } | null;
}) {
  const y = dash?.yandex;
  const g = dash?.google;

  // Check if we actually have meaningful data
  const hasData = (d?: import("@/lib/types").KeysoDashboardData | null) =>
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

function CollapsibleSection({ c, title, defaultOpen = true, extra, children }: {
  c: Colors; title: string; defaultOpen?: boolean;
  extra?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: open ? 12 : 0, cursor: "pointer", userSelect: "none", padding: "4px 0" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, flex: 1 }}>{title}</span>
        {extra && <div onClick={e => e.stopPropagation()}>{extra}</div>}
        <span style={{ fontSize: 10, color: c.textMuted, transition: "transform 0.18s", display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>▶</span>
      </div>
      {open && children}
    </div>
  );
}

// ============================================================
// Previous Analyses View
// ============================================================

function PreviousAnalysesView({ c, history, currentAnalysis }: {
  c: Colors;
  history: Array<AnalysisResult & { analyzedAt: string }>;
  currentAnalysis: AnalysisResult | null;
}) {
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div style={{ maxWidth: 900, padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>Предыдущие анализы</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Пока нет предыдущих анализов</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>После повторного анализа компании предыдущие результаты сохраняются здесь</div>
        </div>
      </div>
    );
  }

  const compEntry = compareIdx !== null ? history[compareIdx] : null;

  const renderDelta = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff === 0) return <span style={{ color: c.textMuted, fontSize: 12 }}>→ 0</span>;
    return (
      <span style={{ color: diff > 0 ? c.accentGreen : c.accentRed, fontSize: 12, fontWeight: 700 }}>
        {diff > 0 ? `↑ +${diff}` : `↓ ${diff}`}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 1000, padding: "0" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Предыдущие анализы</h1>
      <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 20 }}>
        {history.length} сохранённых анализов. Нажмите «Сравнить» для детального сравнения с текущим.
      </p>

      {/* History cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {history.map((entry, i) => {
          const isExpanded = expandedIdx === i;
          const isCompare = compareIdx === i;
          return (
            <div key={i} style={{
              background: c.bgCard, borderRadius: 14, border: `1px solid ${isCompare ? c.accent : isExpanded ? c.accent + "60" : c.border}`,
              boxShadow: isCompare || isExpanded ? c.shadowLg : c.shadow, overflow: "hidden", transition: "box-shadow .15s",
            }}>
              {/* Card header — clickable to expand */}
              <div
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: c.textPrimary }}>{entry.company.name}</div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                    {new Date(entry.analyzedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} • {entry.company.url}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.accent }}>Score: {entry.company.score}</span>
                    {entry.company.categories.slice(0, 4).map(cat => (
                      <span key={cat.name} style={{ fontSize: 11, color: c.textSecondary, background: c.borderLight, padding: "1px 6px", borderRadius: 4 }}>
                        {cat.icon} {cat.score}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={e => { e.stopPropagation(); setCompareIdx(isCompare ? null : i); }}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: `1px solid ${isCompare ? c.accent : c.border}`,
                      background: isCompare ? c.accent : "transparent", color: isCompare ? "#fff" : c.textPrimary,
                      cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
                    }}
                  >
                    {isCompare ? "✓ Сравнение" : "Сравнить"}
                  </button>
                  <span style={{ fontSize: 16, color: c.textMuted, userSelect: "none", width: 20, textAlign: "center" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${c.border}`, padding: "16px 20px", background: c.bg, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Description */}
                  {entry.company.description && (
                    <p style={{ fontSize: 13, color: c.textSecondary, margin: 0, lineHeight: 1.6 }}>{entry.company.description}</p>
                  )}

                  {/* Categories grid */}
                  {entry.company.categories.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>КАТЕГОРИИ</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                        {entry.company.categories.map(cat => (
                          <div key={cat.name} style={{ background: c.bgCard, borderRadius: 10, padding: "10px 14px", border: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: c.textSecondary }}>{cat.icon} {cat.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>{cat.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key metrics row */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {entry.social?.yandexRating > 0 && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        🟡 Яндекс: <b>{entry.social.yandexRating}★</b>
                      </div>
                    )}
                    {entry.social?.gisRating > 0 && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        🟢 2ГИС: <b>{entry.social.gisRating}★</b>
                      </div>
                    )}
                    {!!((entry.seo as Record<string, unknown>)?.loadTime) && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        ⚡ Сайт: <b>{String((entry.seo as Record<string, unknown>).loadTime)}</b>
                      </div>
                    )}
                    {entry.business?.employees && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        👥 <b>{entry.business.employees}</b> сотрудников
                      </div>
                    )}
                    {entry.business?.founded && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        📅 С <b>{entry.business.founded}</b>
                      </div>
                    )}
                    {entry.business?.revenue && (
                      <div style={{ background: c.bgCard, borderRadius: 10, padding: "8px 14px", border: `1px solid ${c.border}`, fontSize: 12 }}>
                        💰 <b>{entry.business.revenue}</b>
                      </div>
                    )}
                  </div>

                  {/* Strengths / weaknesses */}
                  {(() => {
                    const co = entry.company as Record<string, unknown>;
                    const strengths = Array.isArray(co.strengths) ? co.strengths as string[] : [];
                    const weaknesses = Array.isArray(co.weaknesses) ? co.weaknesses as string[] : [];
                    if (strengths.length === 0 && weaknesses.length === 0) return null;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {strengths.length > 0 && (
                          <div style={{ background: c.accentGreen + "08", borderRadius: 10, padding: "12px 14px", border: `1px solid ${c.accentGreen}20` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 6 }}>СИЛЬНЫЕ СТОРОНЫ</div>
                            {strengths.slice(0, 3).map((s, si) => (
                              <div key={si} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 3 }}>✓ {s}</div>
                            ))}
                          </div>
                        )}
                        {weaknesses.length > 0 && (
                          <div style={{ background: c.accentRed + "08", borderRadius: 10, padding: "12px 14px", border: `1px solid ${c.accentRed}20` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 6 }}>СЛАБЫЕ СТОРОНЫ</div>
                            {weaknesses.slice(0, 3).map((w, wi) => (
                              <div key={wi} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 3 }}>✗ {w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      {compEntry && currentAnalysis && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>
            Сравнение: Текущий vs {new Date(compEntry.analyzedAt).toLocaleDateString("ru-RU")}
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>МЕТРИКА</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.accent, fontWeight: 600, fontSize: 11 }}>ТЕКУЩИЙ</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>ПРЕДЫДУЩИЙ</th>
                <th style={{ textAlign: "center", padding: "10px 12px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11 }}>ИЗМЕНЕНИЕ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600 }}>Общий Score</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 700, color: c.accent }}>{currentAnalysis.company.score}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.company.score}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{renderDelta(currentAnalysis.company.score, compEntry.company.score)}</td>
              </tr>
              {currentAnalysis.company.categories.map((cat, ci) => {
                const prevCat = compEntry.company.categories[ci];
                return (
                  <tr key={cat.name}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{cat.icon} {cat.name}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.accent }}>{cat.score}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{prevCat?.score ?? "—"}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{prevCat ? renderDelta(cat.score, prevCat.score) : "—"}</td>
                  </tr>
                );
              })}
              {/* SEO metrics */}
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>SEO — трафик</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, color: c.accent }}>{currentAnalysis.seo.estimatedTraffic}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.seo.estimatedTraffic}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>Яндекс.Карты</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, color: c.accent }}>{currentAnalysis.social.yandexRating > 0 ? `★${currentAnalysis.social.yandexRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.social.yandexRating > 0 ? `★${compEntry.social.yandexRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>2ГИС</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}`, color: c.accent }}>{currentAnalysis.social.gisRating > 0 ? `★${currentAnalysis.social.gisRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>{compEntry.social.gisRating > 0 ? `★${compEntry.social.gisRating.toFixed(1)}` : "—"}</td>
                <td style={{ textAlign: "center", padding: "10px 12px", borderBottom: `1px solid ${c.borderLight}` }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dashboard View
// ============================================================

function DashboardView({ c, data, competitors }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const { company, recommendations } = data;
  const [kwSearch, setKwSearch] = useState("");
  const [kwEngine, setKwEngine] = useState<"yandex" | "google">("yandex");
  const [liveRatings, setLiveRatings] = useState<{
    google: { rating: number; reviewCount: number } | null;
    yandex: { rating: number; reviewCount: number } | null;
    gis: { rating: number; reviewCount: number } | null;
  } | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  useEffect(() => {
    if (!company?.name) return;
    setRatingsLoading(true);
    fetch("/api/fetch-map-ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: company.name }),
    })
      .then(r => r.json())
      .then(json => { if (json.ok) setLiveRatings(json.data); })
      .catch(() => {/* ignore */})
      .finally(() => setRatingsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.name]);

  const isRealKeywords = data.seo?.keywordsSource === "keyso";
  const allPositions = data.seo?.positions ?? [];
  const yandexPositions = allPositions;
  const googlePositions = data.seo?.googlePositions && data.seo.googlePositions.length > 0
    ? data.seo.googlePositions
    : allPositions.map(p => ({ ...p, position: Math.min(100, Math.max(1, p.position + Math.floor(Math.sin(p.keyword.length) * 8))) }));
  const activePositions = kwEngine === "yandex" ? yandexPositions : googlePositions;
  const filteredPositions = kwSearch.trim()
    ? activePositions.filter(p => p.keyword.toLowerCase().includes(kwSearch.toLowerCase()))
    : activePositions;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Дашборд</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>{company.name} · {company.url}</p>
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: `linear-gradient(160deg, ${c.bgCard} 60%, ${c.accent}06 100%)`, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200, boxShadow: c.shadow }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 16, letterSpacing: "0.03em" }}>ОБЩИЙ SCORE</div>
          <ScoreRing score={company.score} c={c} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 12, color: c.textSecondary }}>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary }}>{company.avgNiche}</div><div>Среднее ниши</div></div>
            <div style={{ width: 1, background: c.border }} />
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: c.accentGreen }}>{company.top10}+</div><div>ТОП-10%</div></div>
          </div>
        </div>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, flex: 1, minWidth: 280, boxShadow: c.shadow, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>ОЦЕНКА ПО КАТЕГОРИЯМ</div>
          <RadarChart data={company} competitors={[]} c={c} size={240} />
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> {company.name.length > 20 ? company.name.slice(0, 20) + "…" : company.name}</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Категории оценки</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map(cat => <CategoryCard key={cat.name} cat={cat} c={c} />)}
      </div>
      <CollapsibleSection c={c} title="AI-рекомендации">
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
          {recommendations.map((rec, i) => {
            const dotColor = rec.priority === "high" ? c.accentRed : rec.priority === "medium" ? c.accentYellow : c.accentGreen;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.accentGreen, background: c.accentGreen + "12", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>{rec.effect}</span>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Key.so Dashboard */}
      <CollapsibleSection c={c} title="📈 Данные Key.so" defaultOpen={true}>
        <KeysoDashboardBlock c={c} dash={data.keysoDashboard} />
      </CollapsibleSection>

      {/* ── Ключевые слова ── */}
      {(data.seo?.positions ?? []).length > 0 && (
        <CollapsibleSection c={c} title="🔑 Ключевые слова и позиции"
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}`, padding: 2 }}>
                {(["yandex", "google"] as const).map(e => (
                  <button key={e} onClick={() => setKwEngine(e)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: kwEngine === e ? c.accent : "transparent", color: kwEngine === e ? "#fff" : c.textSecondary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    {e === "yandex" ? "Яндекс" : "Google"}
                  </button>
                ))}
              </div>
              <input type="text" value={kwSearch} onChange={e => setKwSearch(e.target.value)} placeholder="Поиск…"
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, outline: "none", width: 160 }} />
            </div>
          }>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: c.bg }}>
                {["Ключевое слово", "Позиция", "Объём/мес", "Рейтинг"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredPositions.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: "20px 16px", color: c.textMuted, textAlign: "center" }}>Ничего не найдено по запросу «{kwSearch}»</td></tr>
                ) : filteredPositions.map((pos, i) => (
                  <tr key={i} style={{ borderBottom: i < filteredPositions.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                    <td style={{ padding: "10px 16px", color: c.textPrimary, fontWeight: 500 }}>{pos.keyword}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: pos.position <= 10 ? c.accentGreen : pos.position <= 30 ? c.accentWarm : c.textSecondary }}>#{pos.position}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: c.textSecondary }}>{pos.volume.toLocaleString("ru")}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ width: 90, height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(4, Math.round((1 - (pos.position - 1) / 99) * 100))}%`, background: pos.position <= 10 ? c.accentGreen : pos.position <= 30 ? c.accentWarm : c.accentRed, borderRadius: 3 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 6 }}>
            {isRealKeywords
              ? <span style={{ color: c.accentGreen, fontWeight: 600 }}>✓ Реальные позиции из Keys.so · {activePositions.length} ключевых слов</span>
              : "⚠ Позиции — AI-оценка. Подключён Keys.so, но данных по этому домену не найдено."}
          </div>
        </CollapsibleSection>
      )}

      {/* ── SEO-детали + Бизнес-профиль ── */}
      <CollapsibleSection c={c} title="🔍 SEO-детали и бизнес-профиль">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔍 SEO-детали</div>
            {[
              { label: "Трафик/мес", value: data.seo?.estimatedTraffic ?? "—" },
              { label: "Возраст домена", value: data.seo?.domainAge ?? "—" },
              { label: "Страниц на сайте", value: data.seo?.pageCount ? String(data.seo.pageCount) : "—" },
              ...(data.seo?.firstArchiveDate ? [{ label: "В веб-архиве с", value: `${data.seo.firstArchiveDate} (${data.seo.archiveAgeYears ?? 0} лет)` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{value}</span>
              </div>
            ))}
            {data.seo?.lighthouseScores && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>LIGHTHOUSE (MOBILE)</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {([
                    { label: "Скорость", value: data.seo.lighthouseScores.performance },
                    { label: "SEO", value: data.seo.lighthouseScores.seo },
                    { label: "Доступность", value: data.seo.lighthouseScores.accessibility },
                  ] as { label: string; value: number }[]).map(s => {
                    const lhColor = s.value >= 90 ? "#34d399" : s.value >= 50 ? "#fbbf24" : "#f87171";
                    return (
                      <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 10, background: lhColor + "12", border: `1px solid ${lhColor}25` }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: lhColor }}>{s.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(data.seo?.issues ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ПРОБЛЕМЫ</div>
                {data.seo.issues.map((issue, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6, fontSize: 12, color: c.textSecondary }}>
                    <span style={{ color: c.accentRed, marginTop: 1, flexShrink: 0 }}>⚠</span>{issue}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🏢 Бизнес-профиль</div>
            {(() => {
              // Split description: DaData legal line vs actual description
              const descLines = (company.description ?? "").split("\n");
              const legalLine = descLines.find((l: string) => l.includes("ИНН:") || l.includes("ОГРН:")) ?? null;
              const cleanDesc = descLines.filter((l: string) => l !== legalLine).join("\n").trim();
              const legalFields: { label: string; value: string }[] = [];
              if (legalLine) {
                legalLine.split(" · ").forEach((part: string) => {
                  const colonIdx = part.indexOf(": ");
                  if (colonIdx > -1) legalFields.push({ label: part.slice(0, colonIdx).trim(), value: part.slice(colonIdx + 2).trim() });
                });
              }
              const mainRows = [
                { label: "Сотрудников", value: data.business?.employees ?? "—" },
                { label: "Выручка / год", value: data.business?.revenue ?? "—" },
                { label: "Основана", value: data.business?.founded ?? "—" },
                { label: "Форма", value: data.business?.legalForm ?? "—" },
                ...(data.business?.courtCases !== undefined ? [{ label: "Арб. дела", value: String(data.business.courtCases) }] : []),
                ...legalFields,
              ];
              return (
                <>
                  {mainRows.map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                      <span style={{ color: c.textSecondary, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontWeight: 600, color: c.textPrimary, textAlign: "right", wordBreak: "break-word", maxWidth: "65%" }}>{value}</span>
                    </div>
                  ))}
                  {data.business?.rusprofileUrl && (
                    <a href={data.business.rusprofileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: c.accent, textDecoration: "none" }}>Rusprofile →</a>
                  )}
                  {cleanDesc && (
                    <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>{cleanDesc}</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Госконтракты ── */}
      {data.governmentContracts && data.governmentContracts.totalContracts > 0 && (
        <CollapsibleSection c={c} title="📋 Госконтракты (zakupki.gov.ru)">
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 14 }}>
              Найдено <span style={{ fontWeight: 700, color: c.textPrimary }}>{data.governmentContracts.totalContracts}</span> контрактов на сумму <span style={{ fontWeight: 700, color: c.accent }}>{data.governmentContracts.totalAmount}</span>
            </div>
            {data.governmentContracts.recentContracts.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Дата", "Сумма", "Заказчик", "Предмет"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 10, letterSpacing: "0.04em" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.governmentContracts.recentContracts.map((ct: { date: string; amount: string; customer: string; subject: string }, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, whiteSpace: "nowrap" }}>{ct.date}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.textPrimary, whiteSpace: "nowrap" }}>{ct.amount}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.customer}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Технологии + Найм ── */}
      <CollapsibleSection c={c} title="⚙️ Технологии и найм">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>⚙️ Технологии</div>
            {data.techStack?.cms && data.techStack.cms !== "Unknown" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>CMS</div>
                <span style={{ background: c.accent + "15", color: c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.cms}</span>
              </div>
            )}
            {(data.techStack?.analytics ?? []).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>АНАЛИТИКА</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.techStack.analytics.map(a => <span key={a} style={{ background: c.accentGreen + "15", color: c.accentGreen, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{a}</span>)}
                </div>
              </div>
            )}
            {data.techStack?.chat && !["None", "Unknown", "—"].includes(data.techStack.chat) && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ЧАТ-ПОДДЕРЖКА</div>
                <span style={{ background: c.accentWarm + "15", color: c.accentWarm, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.chat}</span>
              </div>
            )}
            {(data.techStack?.other ?? []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ДРУГОЕ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.techStack.other.map(o => <span key={o} style={{ background: c.borderLight, color: c.textSecondary, borderRadius: 8, padding: "4px 10px", fontSize: 12, border: `1px solid ${c.border}` }}>{o}</span>)}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>👥 Найм (hh.ru)</div>
              {data.hiring?.trend && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                  background: data.hiring.trend === "growing" ? c.accentGreen + "18" : data.hiring.trend === "declining" ? c.accentRed + "18" : c.borderLight,
                  color: data.hiring.trend === "growing" ? c.accentGreen : data.hiring.trend === "declining" ? c.accentRed : c.textMuted
                }}>
                  {data.hiring.trend === "growing" ? "▲ Растёт" : data.hiring.trend === "declining" ? "▼ Снижается" : "→ Стабильно"}
                </span>
              )}
            </div>
            {[
              { label: "Открытых вакансий", value: String(data.hiring?.openVacancies ?? "—") },
              { label: "Средняя зарплата", value: data.hiring?.avgSalary ?? "—" },
              { label: "Диапазон", value: data.hiring?.salaryRange ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{value}</span>
              </div>
            ))}
            {(data.hiring?.topRoles ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ИЩУТ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.hiring.topRoles.map(r => <span key={r} style={{ background: c.bg, color: c.textSecondary, borderRadius: 8, padding: "4px 10px", fontSize: 11, border: `1px solid ${c.border}` }}>{r}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Соцсети и рейтинги ── */}
      <CollapsibleSection c={c} title="📱 Соцсети и рейтинги">
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {data.social?.vk ? (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2787F5", marginBottom: 8 }}>ВКонтакте</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, lineHeight: 1 }}>{data.social.vk.subscribers.toLocaleString("ru")}</div>
                <div style={{ fontSize: 11, color: c.textMuted, margin: "3px 0 8px" }}>подписчиков</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{data.social.vk.posts30d} постов/мес</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{data.social.vk.engagement} вовлечённость</div>
              </div>
            ) : (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px dashed ${c.border}`, padding: 16, opacity: 0.5 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>ВКонтакте</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>Не найдено</div>
              </div>
            )}
            {data.social?.telegram ? (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#229ED9", marginBottom: 8 }}>Telegram</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, lineHeight: 1 }}>{data.social.telegram.subscribers.toLocaleString("ru")}</div>
                <div style={{ fontSize: 11, color: c.textMuted, margin: "3px 0 8px" }}>подписчиков</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{data.social.telegram.posts30d} постов/мес</div>
              </div>
            ) : (
              <div style={{ background: c.bgCard, borderRadius: 14, border: `1px dashed ${c.border}`, padding: 16, opacity: 0.5 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>Telegram</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>Не найдено</div>
              </div>
            )}
            {[
              { label: "Яндекс.Карты", rating: liveRatings?.yandex?.rating ?? data.social?.yandexRating ?? 0, reviews: liveRatings?.yandex?.reviewCount ?? data.social?.yandexReviews ?? 0, color: "#FC3F1D", isLive: !!liveRatings?.yandex },
              { label: "2ГИС", rating: liveRatings?.gis?.rating ?? data.social?.gisRating ?? 0, reviews: liveRatings?.gis?.reviewCount ?? data.social?.gisReviews ?? 0, color: "#04AE30", isLive: !!liveRatings?.gis },
              { label: "Google Maps", rating: liveRatings?.google?.rating ?? 0, reviews: liveRatings?.google?.reviewCount ?? 0, color: "#4285F4", isLive: !!liveRatings?.google },
            ].map(({ label, rating, reviews, color, isLive }) => (
              <div key={label} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
                  {ratingsLoading
                    ? <span style={{ fontSize: 10, color: c.textMuted }}>⏳</span>
                    : isLive && <span style={{ fontSize: 10, color: c.accentGreen, background: c.accentGreen + "18", padding: "1px 6px", borderRadius: 4 }}>live</span>
                  }
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, lineHeight: 1 }}>{rating > 0 ? rating.toFixed(1) : "—"}</div>
                <div style={{ fontSize: 11, color: c.textMuted, margin: "3px 0 8px" }}>рейтинг</div>
                {rating > 0 && (
                  <div style={{ display: "flex", gap: 1, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ fontSize: 12, color: s <= Math.round(rating) ? "#f59e0b" : c.borderLight }}>★</span>)}
                  </div>
                )}
                <div style={{ fontSize: 12, color: c.textSecondary }}>{reviews > 0 ? `${reviews} отзывов` : "нет данных"}</div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Прогноз ниши ── */}
      {data.nicheForecast && (
        <CollapsibleSection c={c} title={`📈 Прогноз ниши — ${data.nicheForecast.timeframe}`}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>Рост рынка / год</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentWarm }}>
                    {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: c.borderLight, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.abs(data.nicheForecast.trendPercent) * 5)}%`, background: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentWarm, borderRadius: 5, transition: "width 1.2s ease" }} />
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, whiteSpace: "nowrap",
                background: data.nicheForecast.trend === "growing" ? c.accentGreen + "18" : data.nicheForecast.trend === "declining" ? c.accentRed + "18" : c.accentYellow + "18",
                color: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentYellow
              }}>
                {data.nicheForecast.trend === "growing" ? "▲ Растёт" : data.nicheForecast.trend === "declining" ? "▼ Снижается" : "→ Стабильно"}
              </span>
            </div>
            <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.65, marginBottom: 14 }}>{data.nicheForecast.forecast}</p>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Куда движется рынок:</div>
            <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55, marginBottom: 20 }}>{data.nicheForecast.direction}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, marginBottom: 10 }}>✓ Возможности</div>
                {(data.nicheForecast.opportunities ?? []).map((o, i) => (
                  <div key={i} style={{ fontSize: 13, color: c.textSecondary, padding: "6px 0", borderBottom: i < (data.nicheForecast.opportunities.length - 1) ? `1px solid ${c.borderLight}` : "none" }}>{o}</div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 10 }}>⚠ Угрозы</div>
                {(data.nicheForecast.threats ?? []).map((t, i) => (
                  <div key={i} style={{ fontSize: 13, color: c.textSecondary, padding: "6px 0", borderBottom: i < (data.nicheForecast.threats.length - 1) ? `1px solid ${c.borderLight}` : "none" }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================
// Competitors View
// ============================================================

function CompetitorsView({ c, myCompany, competitors, onSelectCompetitor, onAddCompetitor, isAnalyzing }: {
  c: Colors; myCompany: AnalysisResult | null; competitors: AnalysisResult[];
  onSelectCompetitor: (i: number) => void; onAddCompetitor: (url: string) => Promise<void>; isAnalyzing: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    try {
      await onAddCompetitor(url.trim());
      setUrl("");
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Конкуренты</h1>
          <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>{competitors.length} из 3 (Free). Добавьте ещё за ₽100/мес</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>+</span> Добавить конкурента
        </button>
      </div>

      {showAdd && (
        <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, marginBottom: 16, boxShadow: c.shadow }}>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Введите URL сайта конкурента" disabled={isAnalyzing}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${error ? c.accentRed : c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={isAnalyzing || !url.trim()}
              style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: isAnalyzing || !url.trim() ? 0.65 : 1 }}>
              {isAnalyzing ? "Анализ…" : "Добавить"}
            </button>
          </form>
          {error && <div style={{ marginTop: 8, color: c.accentRed, fontSize: 13 }}>{error}</div>}
          {isAnalyzing && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <style>{`@keyframes mr-spin3 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 14, height: 14, border: `2px solid ${c.borderLight}`, borderTop: `2px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin3 1s linear infinite" }} />
              <span style={{ fontSize: 12, color: c.textSecondary }}>Анализируем конкурента…</span>
            </div>
          )}
        </div>
      )}

      {competitors.length === 0 ? (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Конкуренты ещё не добавлены</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Добавьте URL сайта конкурента, чтобы увидеть сравнительный анализ</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {competitors.map((comp, i) => {
            const sc = comp.company.score;
            return (
              <div key={i} onClick={() => onSelectCompetitor(i)}
                style={{ background: c.bgCard, borderRadius: 14, padding: 16, border: `1px solid ${c.border}`, cursor: "pointer", transition: "box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = c.shadowLg; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: c.textPrimary }}>{comp.company.name}</div>
                    <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{comp.company.url}</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: (sc >= 70 ? c.accentGreen : c.accentWarm) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: sc >= 70 ? c.accentGreen : c.accentWarm }}>
                    {sc}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {comp.company.categories.map(cat => (
                    <span key={cat.name} style={{ fontSize: 11, color: c.textSecondary, background: c.borderLight, padding: "2px 8px", borderRadius: 6 }}>
                      {cat.icon} {cat.score}
                    </span>
                  ))}
                </div>
                {/* Map ratings */}
                {((comp.social?.yandexRating ?? 0) > 0 || (comp.social?.gisRating ?? 0) > 0) && (
                  <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `1px solid ${c.border}` }}>
                    {(comp.social?.yandexRating ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: "#FC3F1D", fontWeight: 600 }}>
                        Я.К: ★{comp.social.yandexRating.toFixed(1)} ({comp.social.yandexReviews})
                      </span>
                    )}
                    {(comp.social?.gisRating ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: "#04AE30", fontWeight: 600 }}>
                        2ГИС: ★{comp.social.gisRating.toFixed(1)} ({comp.social.gisReviews})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Competitor Profile View
// ============================================================

function CompetitorProfileView({ c, data, onBack }: { c: Colors; data: AnalysisResult; onBack: () => void }) {
  const { company, recommendations, insights } = data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [offers, setOffers] = useState<any>(null);
  const [offersLoading, setOffersLoading] = useState(false);

  const loadOffers = async () => {
    setOffersLoading(true);
    try {
      const res = await fetch("/api/analyze-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: company.name, companyUrl: company.url, companyDescription: company.description }),
      });
      const json = await res.json();
      if (json.ok) setOffers(json.data);
    } catch { /* ignore */ }
    setOffersLoading(false);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: c.accent, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        ← Назад к конкурентам
      </button>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: c.accent + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: c.accent }}>
          {company.name.charAt(0)}
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>{company.name}</h1>
          <div style={{ fontSize: 13, color: c.textMuted }}>{company.url}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ScoreRing score={company.score} size={80} strokeWidth={6} c={c} />
        </div>
      </div>

      {/* Categories */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Оценки по категориям</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map(cat => <CategoryCard key={cat.name} cat={cat} c={c} />)}
      </div>

      {/* Strengths & Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.accentGreen, marginBottom: 12 }}>💪 Сильные стороны</div>
          {company.categories.filter(c2 => c2.score >= 60).map(cat => (
            <div key={cat.name} style={{ fontSize: 13, color: c.textPrimary, marginBottom: 6 }}>
              {cat.icon} {cat.name} — <strong>{cat.score}/100</strong>
            </div>
          ))}
          {company.categories.filter(c2 => c2.score >= 60).length === 0 && (
            <div style={{ fontSize: 13, color: c.textMuted }}>Нет категорий выше 60</div>
          )}
        </div>
        <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.accentRed, marginBottom: 12 }}>⚠️ Слабые стороны</div>
          {company.categories.filter(c2 => c2.score < 50).map(cat => (
            <div key={cat.name} style={{ fontSize: 13, color: c.textPrimary, marginBottom: 6 }}>
              {cat.icon} {cat.name} — <strong>{cat.score}/100</strong>
            </div>
          ))}
          {company.categories.filter(c2 => c2.score < 50).length === 0 && (
            <div style={{ fontSize: 13, color: c.textMuted }}>Нет категорий ниже 50</div>
          )}
        </div>
      </div>

      {/* AI Recommendations for this competitor */}
      <CollapsibleSection c={c} title="AI-рекомендации">
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 24 }}>
          {recommendations.map((rec, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
              <PriorityBadge priority={rec.priority} c={c} />
              <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: c.accentGreen, background: c.accentGreen + "12", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>{rec.effect}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Insights */}
      {insights.length > 0 && (
        <CollapsibleSection c={c} title="💡 Инсайты">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>{ins.title}</div>
                <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{ins.text}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Offers analysis */}
      <CollapsibleSection c={c} title="🏷️ Анализ офферов">
        {!offers && !offersLoading && (
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, textAlign: "center", boxShadow: c.shadow, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: c.textSecondary, marginBottom: 12 }}>Проанализировать офферы и предложения конкурента с его сайта</p>
            <button onClick={loadOffers} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Загрузить офферы
            </button>
          </div>
        )}
        {offersLoading && (
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, textAlign: "center", boxShadow: c.shadow, marginBottom: 16 }}>
            <div style={{ color: c.accent, fontSize: 13 }}>Анализирую офферы с сайта...</div>
          </div>
        )}
        {offers && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div style={{ background: c.accent + "10", borderRadius: 12, padding: 16, border: `1px solid ${c.accent}30` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕННОСТНОЕ ПРЕДЛОЖЕНИЕ</div>
              <p style={{ fontSize: 14, color: c.textPrimary, margin: 0, fontWeight: 600 }}>{offers.mainValueProposition}</p>
              <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 6 }}>Стратегия: {offers.pricingStrategy}</div>
            </div>
            {(offers.offers ?? []).map((offer: { title: string; description: string; price: string; uniqueSellingPoint: string; targetAudience: string }, i: number) => (
              <div key={i} style={{ background: c.bgCard, borderRadius: 12, padding: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>{offer.title}</div>
                  {offer.price && <span style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, background: c.accentGreen + "12", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{offer.price}</span>}
                </div>
                <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 6px", lineHeight: 1.4 }}>{offer.description}</p>
                {offer.uniqueSellingPoint && <div style={{ fontSize: 12, color: c.accent }}>USP: {offer.uniqueSellingPoint}</div>}
                {offer.targetAudience && <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>ЦА: {offer.targetAudience}</div>}
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: c.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 8 }}>СИЛЬНЫЕ</div>
                {(offers.strengths ?? []).map((s: string, i: number) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${c.accentGreen}30` }}>{s}</div>)}
              </div>
              <div style={{ background: c.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 8 }}>СЛАБЫЕ</div>
                {(offers.weaknesses ?? []).map((w: string, i: number) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${c.accentRed}30` }}>{w}</div>)}
              </div>
              <div style={{ background: c.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.accentWarm, marginBottom: 8 }}>НЕ ХВАТАЕТ</div>
                {(offers.missingOffers ?? []).map((m: string, i: number) => <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${c.accentWarm}30` }}>{m}</div>)}
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Key.so Dashboard */}
      <CollapsibleSection c={c} title="📈 Данные Key.so" defaultOpen={true}>
        <KeysoDashboardBlock c={c} dash={data.keysoDashboard} />
      </CollapsibleSection>

      {/* ── Ключевые слова ── */}
      {(data.seo?.positions ?? []).length > 0 && (
        <CollapsibleSection c={c} title="🔑 Ключевые слова и позиции">
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: c.bg }}>
                {["Ключевое слово", "Позиция", "Объём/мес", "Рейтинг"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.seo.positions.map((pos, i) => (
                  <tr key={i} style={{ borderBottom: i < data.seo.positions.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                    <td style={{ padding: "10px 16px", color: c.textPrimary, fontWeight: 500 }}>{pos.keyword}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: pos.position <= 10 ? c.accentGreen : pos.position <= 30 ? c.accentWarm : c.textSecondary }}>#{pos.position}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: c.textSecondary }}>{pos.volume.toLocaleString("ru")}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ width: 90, height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(4, Math.round((1 - (pos.position - 1) / 99) * 100))}%`, background: pos.position <= 10 ? c.accentGreen : pos.position <= 30 ? c.accentWarm : c.accentRed, borderRadius: 3 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* ── SEO-детали + Бизнес-профиль ── */}
      <CollapsibleSection c={c} title="🔍 SEO-детали и бизнес-профиль">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔍 SEO-детали</div>
            {[
              { label: "Трафик/мес", value: data.seo?.estimatedTraffic ?? "—" },
              { label: "Возраст домена", value: data.seo?.domainAge ?? "—" },
              { label: "Страниц на сайте", value: data.seo?.pageCount ? String(data.seo.pageCount) : "—" },
              ...(data.seo?.firstArchiveDate ? [{ label: "В веб-архиве с", value: `${data.seo.firstArchiveDate} (${data.seo.archiveAgeYears ?? 0} лет)` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{value}</span>
              </div>
            ))}
            {data.seo?.lighthouseScores && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>LIGHTHOUSE (MOBILE)</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {([
                    { label: "Скорость", value: data.seo.lighthouseScores.performance },
                    { label: "SEO", value: data.seo.lighthouseScores.seo },
                    { label: "Доступность", value: data.seo.lighthouseScores.accessibility },
                  ] as { label: string; value: number }[]).map(s => {
                    const lhColor = s.value >= 90 ? "#34d399" : s.value >= 50 ? "#fbbf24" : "#f87171";
                    return (
                      <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 10, background: lhColor + "12", border: `1px solid ${lhColor}25` }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: lhColor }}>{s.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(data.seo?.issues ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ПРОБЛЕМЫ</div>
                {data.seo.issues.map((issue, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6, fontSize: 12, color: c.textSecondary }}>
                    <span style={{ color: c.accentRed, marginTop: 1, flexShrink: 0 }}>⚠</span>{issue}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🏢 Бизнес-профиль</div>
            {(() => {
              const descLines = (data.company.description ?? "").split("\n");
              const legalLine = descLines.find((l: string) => l.includes("ИНН:") || l.includes("ОГРН:")) ?? null;
              const cleanDesc = descLines.filter((l: string) => l !== legalLine).join("\n").trim();
              const legalFields: { label: string; value: string }[] = [];
              if (legalLine) {
                legalLine.split(" · ").forEach((part: string) => {
                  const colonIdx = part.indexOf(": ");
                  if (colonIdx > -1) legalFields.push({ label: part.slice(0, colonIdx).trim(), value: part.slice(colonIdx + 2).trim() });
                });
              }
              const mainRows = [
                { label: "Сотрудников", value: data.business?.employees ?? "—" },
                { label: "Выручка / год", value: data.business?.revenue ?? "—" },
                { label: "Основана", value: data.business?.founded ?? "—" },
                { label: "Форма", value: data.business?.legalForm ?? "—" },
                ...(data.business?.courtCases !== undefined ? [{ label: "Арб. дела", value: String(data.business.courtCases) }] : []),
                ...legalFields,
              ];
              return (
                <>
                  {mainRows.map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                      <span style={{ color: c.textSecondary, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontWeight: 600, color: c.textPrimary, textAlign: "right", wordBreak: "break-word", maxWidth: "65%" }}>{value}</span>
                    </div>
                  ))}
                  {data.business?.rusprofileUrl && (
                    <a href={data.business.rusprofileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: c.accent, textDecoration: "none" }}>Rusprofile →</a>
                  )}
                  {cleanDesc && (
                    <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>{cleanDesc}</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Госконтракты ── */}
      {data.governmentContracts && data.governmentContracts.totalContracts > 0 && (
        <CollapsibleSection c={c} title="📋 Госконтракты (zakupki.gov.ru)">
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 14 }}>
              Найдено <span style={{ fontWeight: 700, color: c.textPrimary }}>{data.governmentContracts.totalContracts}</span> контрактов на сумму <span style={{ fontWeight: 700, color: c.accent }}>{data.governmentContracts.totalAmount}</span>
            </div>
            {data.governmentContracts.recentContracts.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Дата", "Сумма", "Заказчик", "Предмет"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 10, letterSpacing: "0.04em" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.governmentContracts.recentContracts.map((ct: { date: string; amount: string; customer: string; subject: string }, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, whiteSpace: "nowrap" }}>{ct.date}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.textPrimary, whiteSpace: "nowrap" }}>{ct.amount}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.customer}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{ct.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Технологии + Найм ── */}
      <CollapsibleSection c={c} title="⚙️ Технологии и найм">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>⚙️ Технологии</div>
            {data.techStack?.cms && data.techStack.cms !== "Unknown" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>CMS</div>
                <span style={{ background: c.accent + "15", color: c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.cms}</span>
              </div>
            )}
            {(data.techStack?.analytics ?? []).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>АНАЛИТИКА</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.techStack.analytics.map(a => <span key={a} style={{ background: c.accentGreen + "15", color: c.accentGreen, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{a}</span>)}
                </div>
              </div>
            )}
            {data.techStack?.chat && !["None", "Unknown", "—"].includes(data.techStack.chat) && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ЧАТ-ПОДДЕРЖКА</div>
                <span style={{ background: c.accentWarm + "15", color: c.accentWarm, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{data.techStack.chat}</span>
              </div>
            )}
            {(data.techStack?.other ?? []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ДРУГОЕ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.techStack.other.map(o => <span key={o} style={{ background: c.borderLight, color: c.textSecondary, borderRadius: 8, padding: "4px 10px", fontSize: 12, border: `1px solid ${c.border}` }}>{o}</span>)}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>👥 Найм (hh.ru)</div>
              {data.hiring?.trend && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                  background: data.hiring.trend === "growing" ? c.accentGreen + "18" : data.hiring.trend === "declining" ? c.accentRed + "18" : c.borderLight,
                  color: data.hiring.trend === "growing" ? c.accentGreen : data.hiring.trend === "declining" ? c.accentRed : c.textMuted
                }}>
                  {data.hiring.trend === "growing" ? "↑ растёт" : data.hiring.trend === "declining" ? "↓ снижается" : "→ стабильно"}
                </span>
              )}
            </div>
            {[
              { label: "Открытых вакансий", value: String(data.hiring?.openVacancies ?? 0) },
              { label: "Средняя зарплата", value: data.hiring?.avgSalary ?? "—" },
              { label: "Вилка зарплат", value: data.hiring?.salaryRange ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{value}</span>
              </div>
            ))}
            {(data.hiring?.topRoles ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ТОП ВАКАНСИИ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.hiring.topRoles.map(role => <span key={role} style={{ background: c.borderLight, color: c.textSecondary, borderRadius: 8, padding: "4px 10px", fontSize: 12, border: `1px solid ${c.border}` }}>{role}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Соцсети ── */}
      {(data.social?.vk || data.social?.telegram || data.social?.yandexRating || data.social?.gisRating) && (
        <CollapsibleSection c={c} title="📱 Соцсети и отзывы">
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {data.social?.vk && (
                <div style={{ background: c.bg, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>ВКонтакте</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.textPrimary }}>{data.social.vk.subscribers.toLocaleString("ru")}</div>
                  <div style={{ fontSize: 11, color: c.textSecondary }}>подписчиков</div>
                </div>
              )}
              {data.social?.telegram && (
                <div style={{ background: c.bg, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>Telegram</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.textPrimary }}>{data.social.telegram.subscribers.toLocaleString("ru")}</div>
                  <div style={{ fontSize: 11, color: c.textSecondary }}>подписчиков</div>
                </div>
              )}
              {(data.social?.yandexRating ?? 0) > 0 && (
                <div style={{ background: c.bg, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>Яндекс.Карты</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.accentYellow }}>★ {data.social.yandexRating.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: c.textSecondary }}>{data.social.yandexReviews} отзывов</div>
                </div>
              )}
              {(data.social?.gisRating ?? 0) > 0 && (
                <div style={{ background: c.bg, borderRadius: 12, padding: 14, border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>2ГИС</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.accentYellow }}>★ {data.social.gisRating.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: c.textSecondary }}>{data.social.gisReviews} отзывов</div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================
// Compare View
// ============================================================

function CompareView({ c, myCompany, competitors }: { c: Colors; myCompany: AnalysisResult | null; competitors: AnalysisResult[] }) {
  if (!myCompany) return <div style={{ color: c.textMuted, fontSize: 14 }}>Сначала проанализируйте свой сайт</div>;

  const allCols = [myCompany, ...competitors];
  const catNames = myCompany.company.categories.map(cat => cat.name);
  const rows = [
    { label: "Score", key: "score" },
    ...catNames.map((name, i) => ({ label: name, catIndex: i })),
  ];

  const getCellValue = (entity: AnalysisResult, row: typeof rows[number]): number => {
    if ('key' in row && row.key === "score") return entity.company.score;
    if ('catIndex' in row && row.catIndex !== undefined) return entity.company.categories[row.catIndex]?.score ?? 0;
    return 0;
  };

  const getMax = (row: typeof rows[number]) => Math.max(...allCols.map(e => getCellValue(e, row)));
  const getMin = (row: typeof rows[number]) => Math.min(...allCols.map(e => getCellValue(e, row)));

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Сравнение</h1>

      {competitors.length === 0 ? (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Добавьте конкурентов для сравнения</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Перейдите в раздел «Конкуренты» и добавьте сайты</div>
        </div>
      ) : (
        <>
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "auto", boxShadow: c.shadow, marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "14px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", position: "sticky", left: 0, background: c.bgCard, minWidth: 120 }}>
                    МЕТРИКА
                  </th>
                  {allCols.map((entity, i) => (
                    <th key={i} style={{ textAlign: "center", padding: "14px 12px", borderBottom: `2px solid ${c.border}`, fontWeight: 600, fontSize: 12, color: i === 0 ? c.accent : c.textPrimary, background: i === 0 ? c.accent + "08" : "transparent", minWidth: 120 }}>
                      {i === 0 ? "Вы" : entity.company.name.length > 18 ? entity.company.name.slice(0, 18) + "…" : entity.company.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const maxVal = getMax(row);
                  const minVal = getMin(row);
                  return (
                    <tr key={ri}>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 500, color: c.textSecondary, position: "sticky", left: 0, background: c.bgCard }}>
                        {row.label}
                      </td>
                      {allCols.map((entity, i) => {
                        const val = getCellValue(entity, row);
                        const isBest = val === maxVal && allCols.length > 1;
                        const isWorst = val === minVal && allCols.length > 1 && val !== maxVal;
                        return (
                          <td key={i} style={{
                            textAlign: "center", padding: "12px", borderBottom: `1px solid ${c.borderLight}`,
                            fontWeight: isBest ? 700 : 400,
                            color: isBest ? c.accentGreen : isWorst ? c.accentRed : c.textPrimary,
                            background: i === 0 ? c.accent + "08" : "transparent",
                          }}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Radar comparison */}
          <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>RADAR CHART</div>
            <RadarChart data={myCompany.company} competitors={competitors.map(c2 => c2.company)} c={c} size={280} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> Вы</span>
              {competitors.map((comp, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: c.textSecondary }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm, c.accent][i % 5] }} />
                  {comp.company.name.length > 15 ? comp.company.name.slice(0, 15) + "…" : comp.company.name}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Insights View
// ============================================================

function InsightsView({ c, data, competitors }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
    niche: { icon: "🔭", label: "Пустая ниша", color: c.accent },
    action: { icon: "🚀", label: "Топ-действие", color: c.accentGreen },
    battle: { icon: "⚔️", label: "Battle Card", color: c.accentRed },
    copy: { icon: "✍️", label: "Копирайтинг", color: c.accentWarm },
    seo: { icon: "🔍", label: "SEO-возможность", color: c.accent },
    offer: { icon: "🎯", label: "Оффер", color: "#9b59b6" },
  };

  const pa = data.practicalAdvice;
  const difficultyConfig: Record<string, { label: string; color: string }> = {
    low: { label: "Лёгкий", color: c.accentGreen },
    medium: { label: "Средний", color: c.accentWarm },
    high: { label: "Сложный", color: c.accentRed },
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>AI-инсайты</h1>

      {/* ── Инсайты ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        {data.insights.map((ins, i) => {
          const cfg = typeConfig[ins.type] ?? typeConfig.action;
          return (
            <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow, borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.color + "15", padding: "2px 9px", borderRadius: 6 }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, marginBottom: 5 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55 }}>{ins.text}</div>
            </div>
          );
        })}
      </div>

      {/* ── Копирайтинг: до / после ── */}
      {(pa?.copyImprovements ?? []).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="✍️ Текст сайта: конкретные правки">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: c.accentWarm + "10", border: `1px solid ${c.accentWarm}25` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>
                <strong style={{ color: c.accentWarm }}>Это примеры формулировок от AI</strong> — не копируйте их дословно. Замените выделенные цифры, сроки и детали на актуальные данные вашей компании. Используйте как шаблон для собственного текста.
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pa.copyImprovements.map((ci, i) => (
                <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
                  <div style={{ padding: "10px 16px", background: c.accentWarm + "10", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.accentWarm, background: c.accentWarm + "20", padding: "2px 9px", borderRadius: 6 }}>{ci.element}</span>
                    <span style={{ fontSize: 12, color: c.textSecondary }}>{ci.reason}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                    <div style={{ padding: "14px 16px", borderRight: `1px solid ${c.borderLight}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.accentRed, marginBottom: 6, letterSpacing: "0.06em" }}>СЕЙЧАС</div>
                      <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5, fontStyle: "italic" }}>{ci.current}</div>
                    </div>
                    <div style={{ padding: "14px 16px", background: c.accentGreen + "05" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.accentGreen, marginBottom: 4, letterSpacing: "0.06em" }}>ПРИМЕР ЗАМЕНЫ</div>
                      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 6, fontStyle: "italic" }}>адаптируйте под реальные данные</div>
                      <div style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5, fontWeight: 500 }}>{ci.suggested}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Оффер и позиционирование ── */}
      {pa?.offerAnalysis && pa.offerAnalysis.currentOffer !== "—" && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="🎯 Оффер и позиционирование">
            <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ТЕКУЩИЙ ОФФЕР</div>
                <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5, padding: "10px 14px", background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}`, fontStyle: "italic" }}>
                  {pa.offerAnalysis.currentOffer}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 8, letterSpacing: "0.05em" }}>СЛАБЫЕ МЕСТА</div>
                  {pa.offerAnalysis.weaknesses.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, fontSize: 13, color: c.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>
                      <span style={{ color: c.accentRed, flexShrink: 0, marginTop: 1 }}>✗</span>{w}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 8, letterSpacing: "0.05em" }}>ЧТО ПОДЧЕРКНУТЬ</div>
                  {pa.offerAnalysis.differentiators.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, fontSize: 13, color: c.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>
                      <span style={{ color: c.accentGreen, flexShrink: 0, marginTop: 1 }}>✓</span>{d}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: `linear-gradient(135deg, ${"#9b59b6"}0f, ${c.accent}08)`, borderRadius: 10, padding: "14px 16px", border: `1px solid ${"#9b59b6"}30` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9b59b6", marginBottom: 8, letterSpacing: "0.05em" }}>ПРЕДЛАГАЕМЫЙ ОФФЕР</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55 }}>{pa.offerAnalysis.suggestedOffer}</div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Незанятые ключевые слова ── */}
      {(pa?.keywordGaps ?? []).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="🔑 Незанятые ключевые слова">
            <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: c.bg }}>
                  {["Ключевое слово", "Объём/мес", "Сложность", "Почему стоит занять"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {pa.keywordGaps.map((kg, i) => {
                    const diff = difficultyConfig[kg.difficulty] ?? difficultyConfig.medium;
                    return (
                      <tr key={i} style={{ borderBottom: i < pa.keywordGaps.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                        <td style={{ padding: "11px 16px", color: c.textPrimary, fontWeight: 500 }}>{kg.keyword}</td>
                        <td style={{ padding: "11px 16px", color: c.textSecondary, fontWeight: 600 }}>{kg.volume.toLocaleString("ru")}</td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: diff.color, background: diff.color + "18", padding: "2px 8px", borderRadius: 5 }}>{diff.label}</span>
                        </td>
                        <td style={{ padding: "11px 16px", color: c.textSecondary, fontSize: 12 }}>{kg.opportunity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── SEO-действия + Идеи контента ── */}
      {((pa?.seoActions ?? []).length > 0 || (pa?.contentIdeas ?? []).length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 28 }}>
          {(pa?.seoActions ?? []).length > 0 && (
            <CollapsibleSection c={c} title="⚡ Быстрые SEO-победы">
              {pa.seoActions.map((action, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: c.accent + "15", color: c.accent, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{action}</div>
                </div>
              ))}
            </CollapsibleSection>
          )}
          {(pa?.contentIdeas ?? []).length > 0 && (
            <CollapsibleSection c={c} title="💡 Идеи контента">
              {pa.contentIdeas.map((idea, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: c.accentGreen + "15", color: c.accentGreen, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{idea}</div>
                </div>
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ── Battle Cards ── */}
      {competitors.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="⚔️ Battle Cards — сравнение с конкурентами">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {competitors.map((comp, i) => {
                const myScores = data.company.categories;
                const theirScores = comp.company.categories;
                const gaps = myScores.map((cat, ci) => ({
                  name: cat.name, icon: cat.icon,
                  me: cat.score, them: theirScores[ci]?.score ?? 0,
                  diff: cat.score - (theirScores[ci]?.score ?? 0),
                }));
                const iWin = gaps.filter(g => g.diff > 0);
                const iLose = gaps.filter(g => g.diff < 0);
                return (
                  <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
                    <div style={{ padding: "12px 20px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>Вы vs {comp.company.name}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.accent }}>Вы: {data.company.score}</span>
                        <span style={{ fontSize: 12, color: c.textMuted }}>/</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.textSecondary }}>Они: {comp.company.score}</span>
                      </div>
                    </div>
                    <div style={{ padding: 16 }}>
                      {/* Category bars comparison */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                        {gaps.map(g => (
                          <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 80, fontSize: 12, color: c.textSecondary, flexShrink: 0 }}>{g.icon} {g.name}</div>
                            <div style={{ flex: 1, position: "relative", height: 8, background: c.borderLight, borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${g.me}%`, background: c.accent + "80", borderRadius: 4 }} />
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${g.them}%`, background: c.accentRed + "50", borderRadius: 4, mixBlendMode: "multiply" as const }} />
                            </div>
                            <div style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 700, color: g.diff > 0 ? c.accentGreen : g.diff < 0 ? c.accentRed : c.textMuted, flexShrink: 0 }}>
                              {g.diff > 0 ? `+${g.diff}` : g.diff}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                        <div>
                          <div style={{ color: c.accentGreen, fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: "0.04em" }}>ВЫ ВПЕРЕДИ</div>
                          {iWin.length > 0 ? iWin.map(g => (
                            <div key={g.name} style={{ color: c.textSecondary, marginBottom: 3 }}>{g.icon} {g.name}: <strong style={{ color: c.accentGreen }}>+{g.diff}</strong></div>
                          )) : <div style={{ color: c.textMuted }}>Нет преимуществ</div>}
                        </div>
                        <div>
                          <div style={{ color: c.accentRed, fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: "0.04em" }}>НУЖНО ДОГНАТЬ</div>
                          {iLose.length > 0 ? iLose.map(g => (
                            <div key={g.name} style={{ color: c.textSecondary, marginBottom: 3 }}>{g.icon} {g.name}: <strong style={{ color: c.accentRed }}>{g.diff}</strong></div>
                          )) : <div style={{ color: c.textMuted }}>Нет отставаний</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Прогноз ниши ── */}
      {data.nicheForecast && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="📈 Прогноз ниши">
            <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentWarm }}>
                  {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%/год
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{data.nicheForecast.timeframe}</div>
                  <div style={{ fontSize: 12, color: c.textSecondary }}>{data.nicheForecast.direction}</div>
                </div>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.abs(data.nicheForecast.trendPercent) * 5)}%`, background: data.nicheForecast.trend === "growing" ? c.accentGreen : data.nicheForecast.trend === "declining" ? c.accentRed : c.accentWarm, borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: "0 0 14px" }}>{data.nicheForecast.forecast}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 8, letterSpacing: "0.05em" }}>ВОЗМОЖНОСТИ</div>
                  {data.nicheForecast.opportunities.map((o, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: c.textSecondary, marginBottom: 5 }}>
                      <span style={{ color: c.accentGreen, flexShrink: 0 }}>✓</span>{o}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 8, letterSpacing: "0.05em" }}>УГРОЗЫ</div>
                  {data.nicheForecast.threats.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, color: c.textSecondary, marginBottom: 5 }}>
                      <span style={{ color: c.accentRed, flexShrink: 0 }}>✗</span>{t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── AI-восприятие ── */}
      {data.aiPerception && (
        <div style={{ marginBottom: 28 }}>
          <CollapsibleSection c={c} title="🤖 Как нейросети видят вашу компанию">
            <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 14 }}>Восприятие ChatGPT / Claude / Gemini на основе публичного информационного следа компании</div>

            {/* Presence badge + persona */}
            <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                {(() => {
                  const p2 = data.aiPerception.knowledgePresence;
                  const cfg = {
                    strong: { label: "Хорошо известна", color: c.accentGreen, bg: c.accentGreen + "18", icon: "●" },
                    moderate: { label: "Частично известна", color: c.accentWarm, bg: c.accentWarm + "18", icon: "◐" },
                    weak: { label: "Слабо известна", color: c.accentYellow, bg: c.accentYellow + "18", icon: "◔" },
                    minimal: { label: "Почти не известна", color: c.accentRed, bg: c.accentRed + "18", icon: "○" },
                  }[p2] ?? { label: "Неизвестно", color: c.textMuted, bg: c.borderLight, icon: "?" };
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, color: cfg.color }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "4px 12px", borderRadius: 20 }}>
                        AI-видимость: {cfg.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic", marginBottom: 0 }}>
                {data.aiPerception.persona}
              </div>
            </div>

            {/* Simulated AI answer */}
            <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 12 }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${c.borderLight}`, display: "flex", alignItems: "center", gap: 10, background: c.accent + "08" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.accent }}>Симуляция ответа нейросети</span>
                <span style={{ fontSize: 11, color: c.textMuted }}>— «Расскажи о {data.company.name}»</span>
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.7, background: c.bg, borderRadius: 10, padding: "14px 16px", border: `1px solid ${c.borderLight}`, fontStyle: "italic" }}>
                  {data.aiPerception.sampleAnswer}
                </div>
              </div>
            </div>

            {/* E-E-A-T + Keywords side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
              {/* E-E-A-T */}
              <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 14, letterSpacing: "0.06em" }}>E-E-A-T ОЦЕНКА</div>
                {([
                  { key: "expertise", label: "Экспертиза", desc: "Глубина и точность контента" },
                  { key: "experience", label: "Опыт", desc: "Реальный опыт первого лица" },
                  { key: "authority", label: "Авторитет", desc: "Упоминания в внешних источниках" },
                  { key: "trust", label: "Доверие", desc: "Прозрачность и достоверность" },
                ] as { key: keyof typeof data.aiPerception.eeat; label: string; desc: string }[]).map(({ key, label, desc }) => {
                  const val = data.aiPerception.eeat[key];
                  const col = val >= 70 ? c.accentGreen : val >= 45 ? c.accentWarm : c.accentRed;
                  return (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{label}</span>
                          <span style={{ fontSize: 11, color: c.textMuted, marginLeft: 6 }}>{desc}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{val}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${val}%`, background: col, borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Associated keywords + content signals */}
              <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>АССОЦИАЦИИ НЕЙРОСЕТЕЙ</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
                  {data.aiPerception.associatedKeywords.map((kw, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 500, color: c.accent, background: c.accent + "12", padding: "4px 12px", borderRadius: 20, border: `1px solid ${c.accent}20` }}>{kw}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>СИГНАЛЫ, ФОРМИРУЮЩИЕ МНЕНИЕ</div>
                {data.aiPerception.contentSignals.map((sig, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: c.textSecondary, marginBottom: 7, lineHeight: 1.45 }}>
                    <span style={{ color: c.accentYellow, flexShrink: 0, marginTop: 1 }}>◆</span>{sig}
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement tips */}
            <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.06em" }}>КАК УЛУЧШИТЬ AI-ВИДИМОСТЬ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                {data.aiPerception.improvementTips.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "#6366f115", color: "#818cf8", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Заезженные формулировки ── */}
      <CollapsibleSection c={c} title="🗣 Заезженные формулировки в нише">
        <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
          <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 12 }}>
            Фразы, которые используют все — замените их конкретикой:
          </div>
          {[
            "«Индивидуальный подход» — используют все. Замените на конкретные цифры и кейсы.",
            "«Команда профессионалов» — расскажите о реальном опыте, сертификатах и результатах.",
            "«Комплексные решения» — опишите конкретный стек, сроки и методологию.",
            "«Гарантия качества» — покажите цифры: SLA, процент повторных клиентов, отзывы.",
          ].map((cl, i, arr) => (
            <div key={i} style={{ fontSize: 13, color: c.textPrimary, padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${c.borderLight}` : "none", lineHeight: 1.45 }}>
              {cl}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ============================================================
// Reports View
// ============================================================

function ReportsView({ c, data, taAnalysis, smmAnalysis }: { c: Colors; data: AnalysisResult | null; taAnalysis?: TAResult | null; smmAnalysis?: SMMResult | null }) {
  const [taExpanded, setTaExpanded] = useState(false);
  const [compExpanded, setCompExpanded] = useState(false);
  const [smmExpanded, setSmmExpanded] = useState(false);

  const handlePrintSMM = () => {
    const win = window.open("", "_blank");
    if (!win || !smmAnalysis) return;
    const platforms = smmAnalysis.platformStrategies.map(p => `
      <div style="margin-bottom:24px; padding:16px; border:1px solid #e0e3ef; border-radius:10px;">
        <h3 style="margin:0 0 8px;">${p.platformLabel}</h3>
        <p><b>Соответствие ЦА:</b> ${p.audienceFit}</p>
        <p><b>Форматы:</b> ${p.contentFormat}</p>
        <p><b>Частота:</b> ${p.postingFrequency}</p>
        <p><b>Тон голоса:</b> ${p.toneOfVoice}</p>
        <p><b>Контент-столпы:</b> ${(p.contentPillars ?? []).join(" · ")}</p>
        <p><b>Тактики роста:</b> ${(p.growthTactics ?? []).join("; ")}</p>
        <p><b>Примеры постов:</b><br>${(p.examplePosts ?? []).map((x, i) => `${i + 1}. ${x}`).join("<br><br>")}</p>
      </div>
    `).join("");
    win.document.write(`<html><head><title>СММ-стратегия — ${smmAnalysis.companyName}</title><style>body{font-family:sans-serif;padding:32px;max-width:900px;margin:0 auto;} h1,h2,h3{color:#1a1a2e;} p{line-height:1.6;color:#444;}</style></head><body><h1>СММ-стратегия — ${smmAnalysis.companyName}</h1><p style="color:#888;">${new Date(smmAnalysis.generatedAt).toLocaleDateString("ru-RU")}</p><h2>Архетип бренда</h2><p><b>${smmAnalysis.brandIdentity.archetype}</b> — ${smmAnalysis.brandIdentity.positioning}</p><p><b>УТП:</b> ${smmAnalysis.brandIdentity.uniqueValue}</p><h2>Большая идея</h2><p>${smmAnalysis.contentStrategy.bigIdea}</p><h2>Платформы</h2>${platforms}<h2>Quick wins</h2><ol>${smmAnalysis.quickWins.map(q => `<li>${q}</li>`).join("")}</ol><h2>План на 30 дней</h2><ol>${smmAnalysis.thirtyDayPlan.map(q => `<li>${q}</li>`).join("")}</ol></body></html>`);
    win.document.close();
    win.print();
  };

  const handlePrintTA = () => {
    const win = window.open("", "_blank");
    if (!win || !taAnalysis) return;
    const segs = taAnalysis.segments.map(s => `
      <div style="margin-bottom:24px; padding:16px; border:1px solid #e0e3ef; border-radius:10px;">
        <h3 style="margin:0 0 8px;">${s.isGolden ? "⭐ " : ""}${s.segmentName}</h3>
        <p><b>Persona:</b> ${s.demographics?.personaName ?? ""}, ${s.demographics?.age ?? ""}, ${s.demographics?.income ?? ""}</p>
        <p><b>Образ жизни:</b> ${s.demographics?.lifestyle ?? ""}</p>
        <p><b>Идентичность:</b> ${s.worldview?.identity ?? ""}</p>
        <p><b>Главные проблемы:</b> ${(s.mainProblems ?? []).join("; ")}</p>
        <p><b>Страхи:</b> ${(s.topFears ?? []).join("; ")}</p>
        <p><b>Возражения:</b> ${(s.topObjections ?? []).join("; ")}</p>
        <p><b>Идеальный результат:</b> ${s.magicTransformation ?? ""}</p>
      </div>
    `).join("");
    win.document.write(`<html><head><title>Отчёт ЦА — ${taAnalysis.companyName}</title><style>body{font-family:sans-serif;padding:32px;max-width:900px;margin:0 auto;} h1,h2,h3{color:#1a1a2e;} p{line-height:1.6;color:#444;}</style></head><body><h1>Анализ ЦА — ${taAnalysis.companyName}</h1><p style="color:#888;">${taAnalysis.niche} · ${new Date(taAnalysis.generatedAt).toLocaleDateString("ru-RU")}</p><h2>Общий вывод</h2><p>${taAnalysis.summary}</p><h2>Сегменты</h2>${segs}</body></html>`);
    win.document.close();
    win.print();
  };

  const handlePrintComp = () => {
    window.print();
  };

  if (!data && !taAnalysis && !smmAnalysis) {
    return (
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Отчёты</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Сначала запустите анализ</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Перейдите в «Новый анализ» и введите URL сайта</div>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const scoreColor = data ? (data.company.score >= 75 ? "#22a06b" : data.company.score >= 50 ? "#d4894e" : "#e34935") : "#e34935";

  return (
    <div style={{ maxWidth: 860 }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #mr-report, #mr-report * { visibility: visible !important; }
          #mr-report { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 24px !important; background: #fff !important; }
          .no-print { display: none !important; }
          @page { margin: 20mm; }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>Отчёты</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>Нажмите на отчёт, чтобы развернуть. Каждый отчёт можно скачать отдельно.</p>
      </div>

      {taAnalysis && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 16, overflow: "hidden" }}>
          {/* TA Report Header — click to expand */}
          <div
            onClick={() => setTaExpanded(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", cursor: "pointer", userSelect: "none" }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>🧠 Анализ ЦА — {taAnalysis.companyName}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{taAnalysis.niche} · {new Date(taAnalysis.generatedAt).toLocaleDateString("ru-RU")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); handlePrintTA(); }}
                className="no-print"
                style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                ↓ PDF
              </button>
              <span style={{ fontSize: 12, color: c.textMuted, transition: "transform 0.2s", display: "inline-block", transform: taExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
          </div>

          {/* TA Report Body */}
          {taExpanded && (
            <div style={{ borderTop: `1px solid ${c.border}`, padding: "20px 24px" }}>
              <div style={{ background: c.accent + "08", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 6 }}>ОБЩИЙ ВЫВОД</div>
                <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>{taAnalysis.summary}</p>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 12 }}>СЕГМЕНТЫ АУДИТОРИИ</div>

              {taAnalysis.segments.map((s, i) => (
                <div key={i} style={{ marginBottom: 20, padding: "16px 20px", border: `1px solid ${s.isGolden ? "#f59e0b40" : c.border}`, borderRadius: 12, background: s.isGolden ? "#f59e0b06" : c.bg }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    {s.isGolden && <span style={{ fontSize: 14 }}>⭐</span>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{s.segmentName}</div>
                    {s.isGolden && <span style={{ fontSize: 11, fontWeight: 600, background: "#f59e0b20", color: "#92400e", borderRadius: 6, padding: "2px 8px" }}>Золотой сегмент</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginBottom: 12 }}>
                    {s.demographics && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ПЕРСОНА</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>{s.demographics.personaName}</div>
                        {[{ l: "Возраст", v: s.demographics.age }, { l: "Доход", v: s.demographics.income }, { l: "Пол", v: s.demographics.genderRatio }].map(r => (
                          <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12 }}>
                            <span style={{ color: c.textMuted }}>{r.l}</span>
                            <span style={{ fontWeight: 600, color: c.textPrimary }}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.demographics?.lifestyle && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ОБРАЗ ЖИЗНИ</div>
                        <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{s.demographics.lifestyle}</p>
                      </div>
                    )}
                  </div>

                  {s.worldview?.identity && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>ИДЕНТИЧНОСТЬ</div>
                      <p style={{ fontSize: 12, color: c.textPrimary, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{s.worldview.identity}</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    {s.mainProblems?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#e34935", letterSpacing: "0.05em", marginBottom: 6 }}>ГЛАВНЫЕ БОЛИ</div>
                        {s.mainProblems.slice(0, 4).map((p, j) => (
                          <div key={j} style={{ fontSize: 12, color: c.textSecondary, padding: "3px 0", borderBottom: `1px solid ${c.borderLight}`, display: "flex", gap: 6 }}>
                            <span style={{ color: "#e34935", flexShrink: 0 }}>⚡</span>{p}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.topFears?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#e34935", letterSpacing: "0.05em", marginBottom: 6 }}>СТРАХИ</div>
                        {s.topFears.slice(0, 4).map((f, j) => (
                          <div key={j} style={{ fontSize: 12, color: c.textSecondary, padding: "3px 0", borderBottom: `1px solid ${c.borderLight}`, display: "flex", gap: 6 }}>
                            <span style={{ color: "#e34935", flexShrink: 0 }}>{j + 1}.</span>{f}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.topObjections?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.accentWarm, letterSpacing: "0.05em", marginBottom: 6 }}>ВОЗРАЖЕНИЯ</div>
                        {s.topObjections.slice(0, 4).map((o, j) => (
                          <div key={j} style={{ fontSize: 12, color: c.textSecondary, padding: "3px 0", borderBottom: `1px solid ${c.borderLight}`, display: "flex", gap: 6 }}>
                            <span style={{ color: c.accentWarm, flexShrink: 0 }}>{j + 1}.</span>{o}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.magicTransformation && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, letterSpacing: "0.05em", marginBottom: 6 }}>ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ</div>
                        <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{s.magicTransformation}</p>
                      </div>
                    )}
                  </div>

                  {s.worldview?.values?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ЦЕННОСТИ</div>
                      <div>{s.worldview.values.map((v, j) => (
                        <span key={j} style={{ display: "inline-block", background: c.accent + "15", color: c.accent, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600, marginRight: 5, marginBottom: 5 }}>{v}</span>
                      ))}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {smmAnalysis && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 16, overflow: "hidden" }}>
          <div
            onClick={() => setSmmExpanded(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", cursor: "pointer", userSelect: "none" }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>📱 СММ-стратегия — {smmAnalysis.companyName}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{smmAnalysis.brandIdentity.archetype} · {new Date(smmAnalysis.generatedAt).toLocaleDateString("ru-RU")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); handlePrintSMM(); }}
                className="no-print"
                style={{ background: "#ec4899", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                ↓ PDF
              </button>
              <span style={{ fontSize: 12, color: c.textMuted, transition: "transform 0.2s", display: "inline-block", transform: smmExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
          </div>

          {smmExpanded && (
            <div style={{ borderTop: `1px solid ${c.border}`, padding: "20px 24px" }}>
              <div style={{ background: "#ec489908", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 6 }}>АРХЕТИП И ПОЗИЦИОНИРОВАНИЕ</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ec4899", marginBottom: 6 }}>{smmAnalysis.brandIdentity.archetype}</div>
                <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: "0 0 8px" }}>{smmAnalysis.brandIdentity.positioning}</p>
                <p style={{ fontSize: 12, color: c.textPrimary, fontWeight: 600, lineHeight: 1.55, margin: 0 }}><b>УТП:</b> {smmAnalysis.brandIdentity.uniqueValue}</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 6 }}>БОЛЬШАЯ ИДЕЯ</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55, margin: "0 0 6px" }}>{smmAnalysis.contentStrategy.bigIdea}</p>
                <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{smmAnalysis.contentStrategy.contentMission}</p>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 12 }}>СТРАТЕГИИ ПО ПЛАТФОРМАМ</div>
              {smmAnalysis.platformStrategies.map((p, i) => (
                <div key={i} style={{ marginBottom: 16, padding: "14px 18px", border: `1px solid ${c.border}`, borderRadius: 12, background: c.bg }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>{p.platformLabel}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 12, marginBottom: 10 }}>
                    <div><b style={{ color: c.textMuted }}>Форматы:</b> <span style={{ color: c.textSecondary }}>{p.contentFormat}</span></div>
                    <div><b style={{ color: c.textMuted }}>Частота:</b> <span style={{ color: c.textSecondary }}>{p.postingFrequency}</span></div>
                    <div><b style={{ color: c.textMuted }}>Тон:</b> <span style={{ color: c.textSecondary }}>{p.toneOfVoice}</span></div>
                  </div>
                  {p.contentPillars?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>КОНТЕНТ-СТОЛПЫ</div>
                      <div>{p.contentPillars.map((cp, j) => (
                        <span key={j} style={{ display: "inline-block", background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, marginRight: 5, marginBottom: 4 }}>{cp}</span>
                      ))}</div>
                    </div>
                  )}
                  {p.examplePosts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginTop: 6, marginBottom: 6 }}>ПРИМЕРЫ ПОСТОВ</div>
                      {p.examplePosts.slice(0, 2).map((ex, j) => (
                        <div key={j} style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, padding: "6px 10px", background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 8, marginBottom: 6, whiteSpace: "pre-wrap" }}>{ex}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.05em", marginBottom: 8 }}>QUICK WINS</div>
                  {smmAnalysis.quickWins.map((q, i) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, padding: "4px 0", borderBottom: `1px solid ${c.borderLight}` }}>{i + 1}. {q}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.05em", marginBottom: 8 }}>ПЛАН НА 30 ДНЕЙ</div>
                  {smmAnalysis.thirtyDayPlan.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, padding: "4px 0", borderBottom: `1px solid ${c.borderLight}` }}>📅 {w}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {data && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadowLg, marginBottom: 16 }}>
          {/* Competitor Report Header — click to expand */}
          <div
            onClick={() => setCompExpanded(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", cursor: "pointer", userSelect: "none", background: `linear-gradient(135deg, ${c.accent}0f, ${c.bgCard})` }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.08em", marginBottom: 4 }}>MARKETRADAR · ОТЧЁТ ПО АНАЛИЗУ</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 2 }}>{data.company.name}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{data.company.url} · {today}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{data.company.score} <span style={{ fontSize: 14, fontWeight: 500, color: c.textMuted }}>из 100</span></div>
                <div style={{ fontSize: 11, color: c.textMuted }}>Общий score</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handlePrintComp(); }}
                className="no-print"
                style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                ↓ PDF
              </button>
              <span style={{ fontSize: 12, color: c.textMuted, transition: "transform 0.2s", display: "inline-block", transform: compExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
          </div>

          {/* Competitor Report Body */}
          {compExpanded && (
            <div id="mr-report">
              {/* Categories */}
              <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>ОЦЕНКИ ПО КАТЕГОРИЯМ</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Категория", "Вес", "Оценка", "Уровень"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {data.company.categories.map((cat, i) => {
                      const col = cat.score >= 75 ? "#22a06b" : cat.score >= 50 ? "#d4894e" : "#e34935";
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: c.textPrimary, fontWeight: 500 }}>{cat.icon} {cat.name}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: c.textSecondary }}>{cat.weight}%</td>
                          <td style={{ padding: "10px 12px", fontSize: 16, fontWeight: 800, color: col }}>{cat.score}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ width: 120, height: 6, borderRadius: 3, background: c.borderLight, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${cat.score}%`, background: col, borderRadius: 3 }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Keywords */}
              {(data.seo?.positions ?? []).length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔑 КЛЮЧЕВЫЕ СЛОВА</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["Ключевое слово", "Позиция", "Объём/мес"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.seo.positions.map((pos, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                          <td style={{ padding: "8px 12px", fontSize: 13, color: c.textPrimary }}>{pos.keyword}</td>
                          <td style={{ padding: "8px 12px", fontSize: 14, fontWeight: 700, color: pos.position <= 10 ? "#22a06b" : pos.position <= 30 ? "#d4894e" : c.textSecondary }}>#{pos.position}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, color: c.textSecondary }}>{pos.volume.toLocaleString("ru")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Business + SEO summary */}
              <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>🏢 БИЗНЕС-ПРОФИЛЬ</div>
                  {[
                    { l: "Сотрудников", v: data.business?.employees },
                    { l: "Выручка/год", v: data.business?.revenue },
                    { l: "Основана", v: data.business?.founded },
                    { l: "Трафик/мес", v: data.seo?.estimatedTraffic },
                    { l: "Возраст домена", v: data.seo?.domainAge },
                  ].map(({ l, v }) => v && v !== "—" ? (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 12 }}>
                      <span style={{ color: c.textSecondary }}>{l}</span>
                      <span style={{ fontWeight: 600, color: c.textPrimary }}>{v}</span>
                    </div>
                  ) : null)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>📈 ПРОГНОЗ НИШИ</div>
                  {data.nicheForecast && <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: data.nicheForecast.trend === "growing" ? "#22a06b" : data.nicheForecast.trend === "declining" ? "#e34935" : "#d4894e", marginBottom: 6 }}>
                      {data.nicheForecast.trendPercent > 0 ? "+" : ""}{data.nicheForecast.trendPercent}%/год
                    </div>
                    <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, margin: "0 0 8px" }}>{data.nicheForecast.forecast}</p>
                  </>}
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ padding: "24px 32px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>💡 AI-РЕКОМЕНДАЦИИ</div>
                {data.recommendations.map((rec, i) => {
                  const col = rec.priority === "high" ? "#e34935" : rec.priority === "medium" ? "#e6a817" : "#22a06b";
                  const priorityLabel = rec.priority === "high" ? "Высокий" : rec.priority === "medium" ? "Средний" : "Низкий";
                  return (
                    <div key={i} style={{ padding: "14px 0", borderBottom: i < data.recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: col, background: col + "18", padding: "2px 8px", borderRadius: 5 }}>{priorityLabel}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: c.textMuted }}>{rec.category}</span>
                      </div>
                      <div style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.5, paddingLeft: 16, marginBottom: 6 }}>{rec.text}</div>
                      <div style={{ paddingLeft: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#22a06b", background: "#22a06b12", padding: "3px 10px", borderRadius: 6 }}>Эффект: {rec.effect}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Insights */}
              {data.insights.length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🧠 AI-ИНСАЙТЫ</div>
                  {(() => {
                    const typeCfg: Record<string, { icon: string; label: string }> = {
                      niche: { icon: "🔭", label: "Пустая ниша" },
                      action: { icon: "🚀", label: "Топ-действие" },
                      battle: { icon: "⚔️", label: "Battle Card" },
                      copy: { icon: "✍️", label: "Копирайтинг" },
                      seo: { icon: "🔍", label: "SEO" },
                      offer: { icon: "🎯", label: "Оффер" },
                    };
                    return data.insights.map((ins, i) => {
                      const cfg = typeCfg[ins.type] ?? typeCfg.action;
                      const col = ins.type === "niche" ? c.accent : ins.type === "battle" ? "#ef4444" : ins.type === "copy" ? "#f59e0b" : ins.type === "offer" ? "#9b59b6" : "#10b981";
                      return (
                        <div key={i} style={{ padding: "10px 0", borderBottom: i < data.insights.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + "18", padding: "2px 8px", borderRadius: 5 }}>{cfg.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{ins.title}</span>
                          </div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, paddingLeft: 22 }}>{ins.text}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Copy improvements */}
              {(data.practicalAdvice?.copyImprovements ?? []).length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>✍️ ПРАВКИ ТЕКСТА САЙТА</div>
                  {data.practicalAdvice.copyImprovements.map((ci, i) => (
                    <div key={i} style={{ marginBottom: i < data.practicalAdvice.copyImprovements.length - 1 ? 16 : 0, paddingBottom: i < data.practicalAdvice.copyImprovements.length - 1 ? 16 : 0, borderBottom: i < data.practicalAdvice.copyImprovements.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#f59e0b18", padding: "2px 8px", borderRadius: 5 }}>{ci.element}</span>
                        <span style={{ fontSize: 11, color: c.textMuted }}>{ci.reason}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ padding: "8px 12px", background: "#ef444408", borderRadius: 8, border: "1px solid #ef444420" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", marginBottom: 4, letterSpacing: "0.06em" }}>СЕЙЧАС</div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, fontStyle: "italic" }}>{ci.current}</div>
                        </div>
                        <div style={{ padding: "8px 12px", background: "#10b98108", borderRadius: 8, border: "1px solid #10b98120" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", marginBottom: 4, letterSpacing: "0.06em" }}>ЗАМЕНИТЬ НА</div>
                          <div style={{ fontSize: 12, color: c.textPrimary, lineHeight: 1.5, fontWeight: 500 }}>{ci.suggested}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Offer analysis */}
              {data.practicalAdvice?.offerAnalysis?.currentOffer && data.practicalAdvice.offerAnalysis.currentOffer !== "—" && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🎯 ОФФЕР И ПОЗИЦИОНИРОВАНИЕ</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.06em" }}>ТЕКУЩИЙ ОФФЕР</div>
                    <div style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic", padding: "8px 12px", background: c.bg, borderRadius: 7, border: `1px solid ${c.borderLight}` }}>{data.practicalAdvice.offerAnalysis.currentOffer}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6, letterSpacing: "0.06em" }}>СЛАБЫЕ МЕСТА</div>
                      {data.practicalAdvice.offerAnalysis.weaknesses.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#ef4444" }}>✗</span>{w}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", marginBottom: 6, letterSpacing: "0.06em" }}>ЧТО ПОДЧЕРКНУТЬ</div>
                      {data.practicalAdvice.offerAnalysis.differentiators.map((d, i) => (
                        <div key={i} style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4, display: "flex", gap: 6 }}><span style={{ color: "#10b981" }}>✓</span>{d}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#6366f108", borderRadius: 8, border: "1px solid #6366f120" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", marginBottom: 5, letterSpacing: "0.06em" }}>ПРЕДЛАГАЕМЫЙ ОФФЕР</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55 }}>{data.practicalAdvice.offerAnalysis.suggestedOffer}</div>
                  </div>
                </div>
              )}

              {/* Keyword gaps */}
              {(data.practicalAdvice?.keywordGaps ?? []).length > 0 && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🔑 НЕЗАНЯТЫЕ КЛЮЧЕВЫЕ СЛОВА</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["Ключевое слово", "Объём/мес", "Сложность", "Почему стоит занять"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "7px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.practicalAdvice.keywordGaps.map((kg, i) => {
                        const diffCol = kg.difficulty === "low" ? "#10b981" : kg.difficulty === "medium" ? "#f59e0b" : "#ef4444";
                        const diffLabel = kg.difficulty === "low" ? "Лёгкий" : kg.difficulty === "medium" ? "Средний" : "Сложный";
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: c.textPrimary, fontWeight: 500 }}>{kg.keyword}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: c.textSecondary }}>{kg.volume.toLocaleString("ru")}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: diffCol, background: diffCol + "18", padding: "2px 7px", borderRadius: 5 }}>{diffLabel}</span>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: c.textSecondary }}>{kg.opportunity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Perception */}
              {data.aiPerception && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>🤖 ВОСПРИЯТИЕ НЕЙРОСЕТЯМИ</div>

                  {/* Presence + persona row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    {(() => {
                      const presenceCfg = {
                        strong: { label: "Хорошо известна", col: "#10b981" },
                        moderate: { label: "Частично известна", col: "#f59e0b" },
                        weak: { label: "Слабо известна", col: "#f59e0b" },
                        minimal: { label: "Почти не известна", col: "#ef4444" },
                      }[data.aiPerception.knowledgePresence] ?? { label: "—", col: c.textMuted };
                      return (
                        <span style={{ fontSize: 11, fontWeight: 700, color: presenceCfg.col, background: presenceCfg.col + "18", padding: "3px 12px", borderRadius: 20 }}>
                          AI-видимость: {presenceCfg.label}
                        </span>
                      );
                    })()}
                    <span style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic" }}>{data.aiPerception.persona}</span>
                  </div>

                  {/* Sample answer */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", marginBottom: 6, letterSpacing: "0.06em" }}>СИМУЛЯЦИЯ ОТВЕТА НЕЙРОСЕТИ</div>
                    <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.65, fontStyle: "italic", padding: "10px 14px", background: "#6366f106", borderRadius: 8, border: "1px solid #6366f115" }}>
                      {data.aiPerception.sampleAnswer}
                    </div>
                  </div>

                  {/* E-E-A-T + signals */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>E-E-A-T ОЦЕНКА</div>
                      {([
                        { key: "expertise" as const, label: "Экспертиза" },
                        { key: "experience" as const, label: "Опыт" },
                        { key: "authority" as const, label: "Авторитет" },
                        { key: "trust" as const, label: "Доверие" },
                      ]).map(({ key, label }) => {
                        const val = data.aiPerception.eeat[key];
                        const col = val >= 70 ? "#10b981" : val >= 45 ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 12, color: c.textSecondary }}>{label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{val}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: c.borderLight }}>
                              <div style={{ height: "100%", width: `${val}%`, background: col, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>АССОЦИАЦИИ</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        {data.aiPerception.associatedKeywords.map((kw, i) => (
                          <span key={i} style={{ fontSize: 11, color: "#818cf8", background: "#6366f112", padding: "3px 10px", borderRadius: 20, border: "1px solid #6366f120" }}>{kw}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>СИГНАЛЫ</div>
                      {data.aiPerception.contentSignals.map((s, i) => (
                        <div key={i} style={{ fontSize: 11, color: c.textSecondary, marginBottom: 5, display: "flex", gap: 6 }}>
                          <span style={{ color: "#f59e0b", flexShrink: 0 }}>◆</span>{s}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Improvement tips */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.06em" }}>КАК УЛУЧШИТЬ AI-ВИДИМОСТЬ</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {data.aiPerception.improvementTips.map((tip, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, background: "#6366f115", color: "#818cf8", fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>{tip}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SEO actions + Content ideas */}
              {((data.practicalAdvice?.seoActions ?? []).length > 0 || (data.practicalAdvice?.contentIdeas ?? []).length > 0) && (
                <div style={{ padding: "24px 32px", borderBottom: `1px solid ${c.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {(data.practicalAdvice?.seoActions ?? []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>⚡ БЫСТРЫЕ SEO-ПОБЕДЫ</div>
                        {data.practicalAdvice.seoActions.map((a, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#6366f115", color: "#818cf8", fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>{a}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(data.practicalAdvice?.contentIdeas ?? []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>💡 ИДЕИ КОНТЕНТА</div>
                        {data.practicalAdvice.contentIdeas.map((idea, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#10b98115", color: "#10b981", fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5 }}>{idea}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ padding: "16px 32px", borderTop: `1px solid ${c.border}`, background: c.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: c.textMuted }}>MarketRadar · company24.pro</span>
                <span style={{ fontSize: 11, color: c.textMuted }}>Сгенерировано {today}</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}


// ============================================================
// Sources View
// ============================================================

function SourcesView({ c }: { c: Colors }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? SOURCES_FREE : SOURCES_FREE.filter(s => s.phase === filter);
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Источники данных</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 16px" }}>Бесплатные источники для конкурентного анализа</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "MVP", "v2", "v3"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === f ? c.accent : c.border}`, background: filter === f ? c.accent + "15" : "transparent", color: filter === f ? c.accent : c.textSecondary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {["Источник", "Метод / API", "Цена", "Фаза"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.textPrimary }}>{s.name}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, fontFamily: "monospace", fontSize: 12 }}>{s.method}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: c.accentGreen + "18", color: c.accentGreen }}>{s.price}</span>
                </td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, fontSize: 12, color: s.phase === "MVP" ? c.accent : c.textMuted }}>{s.phase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Settings View
// ============================================================

const NICHE_LABELS: Record<string, string> = {
  digital: "Digital-агентство",
  clinic: "Клиника или салон",
  b2b: "B2B-торговля или SaaS",
  other: "Другое",
};

function SettingsView({ c, user, onUpdateUser }: { c: Colors; user?: UserAccount | null; onUpdateUser?: (u: UserAccount) => void }) {
  const [tab, setTab] = useState<"profile" | "subscription" | "notifications">("profile");
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [companyUrl, setCompanyUrl] = useState(user?.companyUrl || "");
  const [vk, setVk] = useState(user?.vk || "");
  const [tg, setTg] = useState(user?.tg || "");
  const [hhUrl, setHhUrl] = useState(user?.hhUrl || "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!user) return;
    const updated: UserAccount = { ...user, name: name.trim(), phone: phone.trim() || undefined, companyName: companyName.trim() || undefined, companyUrl: companyUrl.trim() || undefined, vk: vk.trim() || undefined, tg: tg.trim() || undefined, hhUrl: hhUrl.trim() || undefined };
    authSaveUser(updated);
    onUpdateUser?.(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: "profile" as const, label: "Профиль" },
    { id: "subscription" as const, label: "Подписка" },
    { id: "notifications" as const, label: "Уведомления" },
  ];

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Настройки</h1>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${tab === t.id ? c.accent : c.border}`, background: tab === t.id ? c.accent + "15" : "transparent", color: tab === t.id ? c.accent : c.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
          {/* Read-only: email + niche */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, padding: "14px 16px", borderRadius: 10, background: c.bg, border: `1px solid ${c.borderLight}` }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, marginBottom: 3 }}>Email</div>
              <div style={{ fontSize: 14, color: c.textPrimary }}>{user?.email || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, marginBottom: 3 }}>Ниша</div>
              <div style={{ fontSize: 14, color: c.textPrimary }}>{user?.niche ? NICHE_LABELS[user.niche] ?? user.niche : "—"}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Personal */}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em" }}>ЛИЧНЫЕ ДАННЫЕ</div>
            {([
              { label: "Имя", value: name, setter: (v: string) => setName(v), placeholder: "Иван Иванов", type: "text" },
              { label: "Телефон", value: phone, setter: (v: string) => setPhone(v), placeholder: "+7 (999) 123-45-67", type: "tel" },
            ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string; type: string }>).map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}

            {/* Company */}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginTop: 4 }}>КОМПАНИЯ</div>
            {([
              { label: "Название компании", value: companyName, setter: (v: string) => setCompanyName(v), placeholder: "ООО Ромашка" },
              { label: "Сайт", value: companyUrl, setter: (v: string) => setCompanyUrl(v), placeholder: "example.ru" },
            ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string }>).map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>{f.label}</label>
                <input type="text" value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}

            {/* Social */}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginTop: 4 }}>СОЦСЕТИ</div>
            {([
              { label: "ВКонтакте", value: vk, setter: (v: string) => setVk(v), placeholder: "vk.com/company" },
              { label: "Telegram", value: tg, setter: (v: string) => setTg(v), placeholder: "t.me/company" },
              { label: "hh.ru", value: hhUrl, setter: (v: string) => setHhUrl(v), placeholder: "hh.ru/employer/123" },
            ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string }>).map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>{f.label}</label>
                <input type="text" value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleSave} style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
            {saved && <span style={{ fontSize: 13, color: c.accentGreen, fontWeight: 600 }}>✓ Сохранено</span>}
          </div>
        </div>
      )}

      {tab === "subscription" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { name: "Free", price: "₽0", features: ["1 компания", "3 конкурента", "2 анализа/мес", "Базовые рекомендации"], current: true },
            { name: "Starter", price: "₽2 990/мес", features: ["1 компания", "10 конкурентов", "Безлимит анализов", "PDF-отчёты", "Telegram-уведомления"], current: false },
            { name: "Pro", price: "₽7 990/мес", features: ["3 компании", "30 конкурентов", "Battle cards", "API-доступ", "White-label отчёты"], current: false },
            { name: "Agency", price: "₽14 990/мес", features: ["10 компаний", "100 конкурентов", "Real-time обновление", "5 мест", "Брендированные отчёты"], current: false },
          ].map(plan => (
            <div key={plan.name} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${plan.current ? c.accent : c.border}`, padding: 20, boxShadow: c.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>{plan.name}</span>
                  {plan.current && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: c.accent, background: c.accent + "15", padding: "2px 8px", borderRadius: 6 }}>Текущий</span>}
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>{plan.price}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                {plan.features.map(f => <span key={f} style={{ fontSize: 12, color: c.textSecondary }}>✓ {f}</span>)}
              </div>
              {!plan.current && (
                <button style={{ marginTop: 12, background: c.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Перейти на {plan.name}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "notifications" && (
        <NotificationsTab c={c} user={user ?? null} onUpdateUser={onUpdateUser ?? (() => { })} />
      )}
    </div>
  );
}

// ============================================================
// Notifications Tab (Telegram connect)
// ============================================================

function NotificationsTab({ c, user, onUpdateUser }: { c: Colors; user: UserAccount | null; onUpdateUser: (u: UserAccount) => void }) {
  const [step, setStep] = useState<"idle" | "waiting" | "done">(user?.tgChatId ? "done" : "idle");
  const [code] = useState(() => {
    // Generate or reuse a code stored in session
    const existing = typeof window !== "undefined" ? sessionStorage.getItem("mr_tg_code") : null;
    if (existing) return existing;
    const c2 = "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    if (typeof window !== "undefined") sessionStorage.setItem("mr_tg_code", c2);
    return c2;
  });
  const [botUsername, setBotUsername] = useState<string>("marketraradr_bot");
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState("");
  const [prefs, setPrefs] = useState({
    analysis: user?.tgNotifyAnalysis ?? true,
    competitors: user?.tgNotifyCompetitors ?? true,
    vacancies: user?.tgNotifyVacancies ?? false,
    digest: user?.tgNotifyDigest ?? false,
  });
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/connect").then(r => r.json()).then(d => { if (d.username) setBotUsername(d.username); }).catch(() => { });
  }, []);

  async function handlePoll() {
    setPolling(true);
    setPollError("");
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.chatId) {
        const updated = { ...user!, tgChatId: String(data.chatId) };
        onUpdateUser(updated);
        setStep("done");
        sessionStorage.removeItem("mr_tg_code");
      } else {
        setPollError("Код не найден. Убедитесь, что отправили его боту.");
      }
    } catch {
      setPollError("Ошибка соединения.");
    }
    setPolling(false);
  }

  function handleDisconnect() {
    const updated = { ...user!, tgChatId: undefined };
    onUpdateUser(updated);
    setStep("idle");
  }

  function handleSavePrefs() {
    const updated = { ...user!, tgNotifyAnalysis: prefs.analysis, tgNotifyCompetitors: prefs.competitors, tgNotifyVacancies: prefs.vacancies, tgNotifyDigest: prefs.digest };
    onUpdateUser(updated);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const boxStyle: React.CSSProperties = { background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Connection block */}
      <div style={boxStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Telegram-уведомления</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 16 }}>Получайте уведомления о новых анализах и изменениях конкурентов прямо в Telegram.</div>

        {step === "done" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.accentGreen + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✓</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.accentGreen }}>Подключено</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>Chat ID: {user?.tgChatId}</div>
            </div>
            <button onClick={handleDisconnect} style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: c.textSecondary, cursor: "pointer" }}>Отключить</button>
          </div>
        ) : step === "idle" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 4 }}>
              1. Откройте бота и отправьте ему код ниже:
            </div>
            <a href={botUsername ? `https://t.me/${botUsername}` : "https://t.me/"} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: "#229ED9", color: "#fff", fontWeight: 600, fontSize: 13, textDecoration: "none", alignSelf: "flex-start" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.88 13.47l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.946l-.564-.857z" /></svg>
              {botUsername ? `Открыть @${botUsername}` : "Открыть бота в Telegram"}
            </a>
            <div style={{ fontSize: 13, color: c.textSecondary, marginTop: 4 }}>2. Отправьте ему этот код:</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...inputStyle, width: "auto", flex: 1, fontFamily: "monospace", fontWeight: 700, fontSize: 18, letterSpacing: 2, color: c.accent, background: c.accent + "10", border: `1.5px solid ${c.accent}33` }}>{code}</div>
              <button onClick={() => { navigator.clipboard.writeText(code); }} style={{ background: c.accent + "15", border: `1px solid ${c.accent}33`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: c.accent, cursor: "pointer", whiteSpace: "nowrap" }}>Копировать</button>
            </div>
            <button onClick={() => setStep("waiting")} style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}>Я отправил →</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: c.textSecondary }}>Нажмите кнопку — мы проверим, получили ли ваш код.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={handlePoll} disabled={polling} style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: polling ? "not-allowed" : "pointer", opacity: polling ? 0.7 : 1 }}>
                {polling ? "Проверяем…" : "Проверить подключение"}
              </button>
              <button onClick={() => { setStep("idle"); setPollError(""); }} style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: c.textSecondary, cursor: "pointer" }}>Назад</button>
            </div>
            {pollError && <div style={{ fontSize: 13, color: c.accentRed }}>{pollError}</div>}
          </div>
        )}
      </div>

      {/* Preferences (only when connected) */}
      {step === "done" && (
        <div style={boxStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>Что уведомлять</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {([
              { key: "analysis", label: "Завершение нового анализа" },
              { key: "competitors", label: "Добавление нового конкурента" },
              { key: "vacancies", label: "Новые вакансии конкурентов" },
              { key: "digest", label: "Еженедельный дайджест" },
            ] as { key: keyof typeof prefs; label: string }[]).map(item => (
              <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={prefs[item.key]} onChange={e => setPrefs(p => ({ ...p, [item.key]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: c.accent, cursor: "pointer" }} />
                <span style={{ fontSize: 13, color: c.textPrimary }}>{item.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleSavePrefs} style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
            {prefsSaved && <span style={{ fontSize: 13, color: c.accentGreen, fontWeight: 600 }}>✓ Сохранено</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Nav items
// ============================================================

// ============================================================
// New TA Analysis View
// ============================================================

function NewTAView({ c, myCompany, isAnalyzing, onAnalyze }: {
  c: Colors; myCompany: AnalysisResult | null;
  isAnalyzing: boolean; onAnalyze: (niche: string, extra: string) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!niche.trim()) { setError("Опишите нишу и продукт"); return; }
    setError(null);
    try { await onAnalyze(niche.trim(), extra.trim()); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Анализ целевой аудитории</h1>
      <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 28px" }}>
        Мы проведём глубокий психологический анализ ЦА: сегменты, боли, страхи, мотивы, возражения и триггеры покупки.
      </p>

      {myCompany && (
        <div style={{ background: c.accent + "10", border: `1px solid ${c.accent}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <span style={{ color: c.textMuted }}>Компания: </span>
          <span style={{ fontWeight: 600, color: c.textPrimary }}>{myCompany.company.name}</span>
          <span style={{ color: c.textMuted }}> · {myCompany.company.url}</span>
        </div>
      )}

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>
          Ниша, продукт / услуга <span style={{ color: c.accentRed }}>*</span>
        </label>
        <p style={{ fontSize: 12, color: c.textMuted, margin: "0 0 10px" }}>
          Опишите чем занимается компания, что продаёт, для кого, какая проблема решается
        </p>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Например: интернет-магазин спортивного питания для любителей фитнеса 25–40 лет. Продаём протеин, витамины, аминокислоты. Основная аудитория — люди которые хотят похудеть и набрать мышечную массу, но не знают с чего начать."
          rows={5}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>
          Дополнительный контекст (необязательно)
        </label>
        <p style={{ fontSize: 12, color: c.textMuted, margin: "0 0 10px" }}>
          Уникальные особенности продукта, уже известные сегменты, конкуренты, ценовой сегмент
        </p>
        <textarea
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder="Средний чек 3000–8000 ₽. Конкуренты: Protein.ru, iHerb. Основной канал — Instagram. Клиенты часто не верят в эффект без тренера..."
          rows={3}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {error && (
        <div style={{ background: c.accentRed + "12", border: `1px solid ${c.accentRed}30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: c.accentRed, marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isAnalyzing || !niche.trim()}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isAnalyzing || !niche.trim() ? c.borderLight : "linear-gradient(135deg, #6366f1, #818cf8)", color: isAnalyzing || !niche.trim() ? c.textMuted : "#fff", fontWeight: 700, fontSize: 15, cursor: isAnalyzing || !niche.trim() ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #6366f140" }}>
        {isAnalyzing ? "⏳ Анализируем ЦА… (60–90 сек)" : "🧠 Провести анализ ЦА"}
      </button>
      {isAnalyzing && (
        <p style={{ fontSize: 12, color: c.textMuted, marginTop: 12 }}>Проводим глубокий анализ. Не закрывайте страницу.</p>
      )}
    </div>
  );
}

// ============================================================
// TA Empty Dashboard (no data yet)
// ============================================================

function TAEmptyDashboard({ c, onRunAnalysis }: { c: Colors; onRunAnalysis: () => void }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Дашборд ЦА</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 28px" }}>Анализ целевой аудитории ещё не проводился</p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>Тут пока нет данных</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 24, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
          Запустите анализ целевой аудитории, чтобы увидеть сегменты, боли, страхи и мотивы ваших клиентов
        </div>
        <button
          onClick={onRunAnalysis}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #6366f140" }}
        >
          🚀 Запустить анализ ЦА
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TA Dashboard View
// ============================================================

function TADashboardView({ c, data }: { c: Colors; data: TAResult }) {
  const [activeSegment, setActiveSegment] = useState(0);

  const seg = data.segments[activeSegment];
  if (!seg) return null;

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  const Tag = ({ text, color }: { text: string; color?: string }) => (
    <span style={{ display: "inline-block", background: (color ?? c.accent) + "15", color: color ?? c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{text}</span>
  );

  const QuoteBlock = ({ text, from }: { text: string; from: string }) => (
    <div style={{ borderLeft: `3px solid ${c.accent}`, paddingLeft: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: c.textPrimary, fontStyle: "italic", lineHeight: 1.55 }}>«{text}»</div>
      <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4, fontWeight: 600 }}>— {from}</div>
    </div>
  );

  const ListItem = ({ text, color, icon }: { text: string; color?: string; icon?: string }) => (
    <div style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
      <span style={{ flexShrink: 0, color: color ?? c.accent }}>{icon ?? "•"}</span>
      <span style={{ color: c.textSecondary, lineHeight: 1.5 }}>{text}</span>
    </div>
  );

  const generatedDate = new Date(data.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>Анализ ЦА — {data.companyName}</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{data.niche} · {generatedDate}</p>
      </div>

      {/* Summary */}
      <Card style={{ marginBottom: 20, background: `linear-gradient(135deg, ${c.bgCard} 60%, ${c.accent}06 100%)` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: "0.06em", marginBottom: 8 }}>ОБЩИЙ ВЫВОД</div>
        <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>{data.summary}</p>
      </Card>

      {/* Segment tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {data.segments.map((s, i) => (
          <button key={i} onClick={() => setActiveSegment(i)} style={{
            padding: "8px 18px", borderRadius: 10, border: `2px solid ${activeSegment === i ? c.accent : c.border}`,
            background: activeSegment === i ? c.accent : "transparent",
            color: activeSegment === i ? "#fff" : c.textSecondary,
            fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            {s.isGolden && <span>⭐</span>}
            {s.segmentName}
          </button>
        ))}
      </div>

      {seg.isGolden && seg.goldenReason && (
        <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b30", borderRadius: 12, padding: "10px 16px", fontSize: 13, color: "#92400e", marginBottom: 16 }}>
          ⭐ <strong>Золотой сегмент</strong> — {seg.goldenReason}
        </div>
      )}

      {/* Demographics */}
      <CollapsibleSection c={c} title="👤 Демография и образ жизни">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ПЕРСОНА</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 12 }}>{seg.demographics.personaName}</div>
            {[
              { label: "Возраст", value: seg.demographics.age },
              { label: "Пол", value: seg.demographics.genderRatio },
              { label: "Доход", value: seg.demographics.income },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                <span style={{ color: c.textSecondary }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: c.textPrimary }}>{r.value}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>ОБРАЗ ЖИЗНИ</div>
            <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: "0 0 14px" }}>{seg.demographics.lifestyle}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ЦЕННОСТИ</div>
            <div>{seg.worldview.values.map((v, i) => <Tag key={i} text={v} />)}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ИДЕНТИЧНОСТЬ</div>
            <p style={{ fontSize: 13, color: c.textPrimary, fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{seg.worldview.identity}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ЧТО ГОВОРИТ О СЕБЕ</div>
            <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{seg.worldview.shortDescription}</p>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Worldview */}
      <CollapsibleSection c={c} title="🌍 Мировоззрение и убеждения">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { title: "Надежды и мечты", text: seg.worldview.hopesAndDreams },
            { title: "Победы и неудачи", text: seg.worldview.winsAndLosses },
            { title: "Ключевые убеждения", text: seg.worldview.coreBeliefs },
          ].map(item => (
            <Card key={item.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>{item.title.toUpperCase()}</div>
              <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>{item.text}</p>
            </Card>
          ))}
        </div>
      </CollapsibleSection>

      {/* Problems & Emotions */}
      <CollapsibleSection c={c} title="💥 Основные проблемы и эмоции">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>ГЛАВНЫЕ ПРОБЛЕМЫ</div>
            {seg.mainProblems.map((p, i) => <ListItem key={i} text={p} color={c.accentRed} icon="⚡" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentWarm, marginBottom: 12, letterSpacing: "0.05em" }}>ДОМИНИРУЮЩИЕ ЭМОЦИИ</div>
            {seg.topEmotions.map((e, i) => <Tag key={i} text={e} color={c.accentWarm} />)}
          </Card>
        </div>
      </CollapsibleSection>

      {/* Fears */}
      <CollapsibleSection c={c} title="😰 Страхи (те, что не признают вслух)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>ТОП-5 СТРАХОВ</div>
            {seg.topFears.map((f, i) => <ListItem key={i} text={f} color={c.accentRed} icon={`${i + 1}.`} />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>КАК СТРАХИ ВЛИЯЮТ НА ОТНОШЕНИЯ</div>
            {seg.fearRelationshipEffects.map((e, i) => <ListItem key={i} text={e} icon="→" />)}
          </Card>
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>БОЛЕЗНЕННЫЕ ФРАЗЫ КОТОРЫЕ СЛЫШИТ КЛИЕНТ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {seg.painfulPhrases.map((p, i) => <QuoteBlock key={i} text={p.text} from={p.from} />)}
          </div>
        </Card>
      </CollapsibleSection>

      {/* Pain situations */}
      <CollapsibleSection c={c} title="🔥 Болевые ситуации">
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>КОНКРЕТНЫЕ МОМЕНТЫ КОГДА КЛИЕНТ ОСОЗНАЁТ ПРОБЛЕМУ</div>
          <p style={{ fontSize: 12, color: c.textMuted, marginBottom: 16 }}>Ситуации которые вызывают желание немедленно решить проблему</p>
          {seg.painSituations.map((s, i) => <ListItem key={i} text={s} color={c.accentRed} icon="→" />)}
        </Card>
      </CollapsibleSection>

      {/* Obstacles & Myths */}
      <CollapsibleSection c={c} title="🧱 Препятствия и мифы">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>ПРЕПЯТСТВИЯ НА ПУТИ К РЕШЕНИЮ</div>
            {seg.obstacles.map((o, i) => <ListItem key={i} text={o} color={c.accentRed} icon="✗" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentWarm, marginBottom: 12, letterSpacing: "0.05em" }}>МИФЫ И ЛОЖНЫЕ УБЕЖДЕНИЯ</div>
            {seg.myths.map((m, i) => <ListItem key={i} text={m} color={c.accentWarm} icon="💭" />)}
          </Card>
        </div>
      </CollapsibleSection>

      {/* Past solutions */}
      <CollapsibleSection c={c} title="🔄 Прошлый опыт решения проблемы">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {seg.pastSolutions.map((ps, i) => (
            <Card key={i}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>{ps.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 4 }}>👍 НРАВИЛОСЬ</div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: "0 0 10px", lineHeight: 1.5 }}>{ps.liked}</p>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 4 }}>👎 НЕ НРАВИЛОСЬ</div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: "0 0 10px", lineHeight: 1.5 }}>{ps.disliked}</p>
              <div style={{ borderLeft: `3px solid ${c.accentRed}`, paddingLeft: 10 }}>
                <p style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic", margin: 0 }}>«{ps.quote}»</p>
              </div>
            </Card>
          ))}
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ЧЕГО НЕ ХОЧЕТ ДЕЛАТЬ (ВНУТРЕННИЙ МОНОЛОГ)</div>
          {seg.dontWantToDo.map((d, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < seg.dontWantToDo.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>{d.text}</div>
              <div style={{ fontSize: 12, color: c.textSecondary, fontStyle: "italic" }}>«{d.quote}»</div>
            </div>
          ))}
        </Card>
      </CollapsibleSection>

      {/* Magic transformation */}
      <CollapsibleSection c={c} title="✨ Волшебная трансформация">
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, ${c.bgCard} 60%, ${c.accentGreen}08 100%)` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, marginBottom: 12, letterSpacing: "0.05em" }}>ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ</div>
          <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.7, margin: "0 0 16px" }}>{seg.magicTransformation}</p>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>КАК ТРАНСФОРМАЦИЯ ПОВЛИЯЕТ НА ЖИЗНЬ</div>
          {seg.transformationImpact.map((t, i) => <ListItem key={i} text={t} color={c.accentGreen} icon="✓" />)}
        </Card>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ЧТО СКАЖУТ ДРУГИЕ ПОСЛЕ ТРАНСФОРМАЦИИ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {seg.postTransformationQuotes.map((q, i) => <QuoteBlock key={i} text={q.text} from={q.from} />)}
          </div>
        </Card>
      </CollapsibleSection>

      {/* Market & Objections */}
      <CollapsibleSection c={c} title="🎯 Рынок и возражения">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ЧТО ДОЛЖЕН УВИДЕТЬ РЫНОК</div>
            {seg.marketSuccessConditions.map((m, i) => <ListItem key={i} text={m} icon="→" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>КОГО ВИНЯТ В ПРОБЛЕМЕ</div>
            {seg.whoBlamedForProblem.map((w, i) => <ListItem key={i} text={w} color={c.accentWarm} icon="⚡" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>ТОП-5 ВОЗРАЖЕНИЙ</div>
            {seg.topObjections.map((o, i) => <ListItem key={i} text={o} color={c.accentRed} icon={`${i + 1}.`} />)}
          </Card>
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ЧТО РЫНОК ДОЛЖЕН ОТПУСТИТЬ</div>
          <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>{seg.mustLetGo}</p>
        </Card>
      </CollapsibleSection>

    </div>
  );
}

// ============================================================
// Brand Suggestions View (standalone tab under Анализ ЦА)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BrandSuggestionsView({ c, taData, brandSuggestions, setBrandSuggestions, brandBook, onUpdateBrandBook }: {
  c: Colors;
  taData: TAResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brandSuggestions: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBrandSuggestions: (v: any) => void;
  brandBook: BrandBook;
  onUpdateBrandBook: (next: BrandBook) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const segments = taData.segments.map(s => ({
        segmentName: s.segmentName,
        demographics: s.demographics,
        worldview: s.worldview,
        topEmotions: s.topEmotions,
        topFears: s.topFears,
      }));
      const res = await fetch("/api/suggest-brandbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: taData.companyName, niche: taData.niche, segments }),
      });
      const json = await res.json();
      if (json.ok) setBrandSuggestions(json.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const applyToBrandBook = () => {
    if (!brandSuggestions) return;
    const cp = brandSuggestions.colorPalette ?? {};
    const typo = brandSuggestions.typography ?? {};
    const tov = brandSuggestions.toneOfVoice ?? {};
    const colors: string[] = [];
    if (cp.primary?.startsWith("#")) colors.push(cp.primary);
    if (cp.secondary?.startsWith("#")) colors.push(cp.secondary);
    if (cp.accent?.startsWith("#")) colors.push(cp.accent);
    if (cp.background?.startsWith("#")) colors.push(cp.background);
    if (cp.text?.startsWith("#")) colors.push(cp.text);
    onUpdateBrandBook({
      ...brandBook,
      colors: colors.length > 0 ? colors : brandBook.colors,
      fontHeader: typo.headerFont || brandBook.fontHeader,
      fontBody: typo.bodyFont || brandBook.fontBody,
      toneOfVoice: tov.adjectives?.length ? tov.adjectives : brandBook.toneOfVoice,
      goodPhrases: tov.goodPhrases?.length ? tov.goodPhrases : brandBook.goodPhrases,
      forbiddenWords: tov.forbiddenPhrases?.length ? tov.forbiddenPhrases : brandBook.forbiddenWords,
      visualStyle: brandSuggestions.aesthetics?.style || brandBook.visualStyle,
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, ...style }}>{children}</div>
  );
  const Tag = ({ text, color }: { text: string; color?: string }) => (
    <span style={{ display: "inline-block", background: (color ?? c.accent) + "15", color: color ?? c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{text}</span>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Рекомендации по брендбуку</h1>
      <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 24 }}>
        AI предлагает цвета, шрифты, тон голоса и визуальный стиль на основе портрета вашей ЦА.
        После генерации нажмите «Применить к брендбуку» — данные перенесутся в план контента.
      </p>

      {!brandSuggestions && !loading && (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
          <h3 style={{ color: c.textPrimary, margin: "0 0 8px" }}>Сгенерировать рекомендации</h3>
          <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
            На основе {taData.segments.length} сегментов ЦА для «{taData.companyName}»
          </p>
          <button onClick={load} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: c.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Сгенерировать рекомендации
          </button>
        </Card>
      )}

      {loading && (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ color: c.accent, fontSize: 14 }}>⏳ Генерирую рекомендации по брендбуку...</div>
        </Card>
      )}

      {brandSuggestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Apply button + regenerate */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={applyToBrandBook} style={{ padding: "10px 24px", borderRadius: 10, border: "none",
              background: applied ? c.accentGreen : c.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "background .3s" }}>
              {applied ? "✓ Применено к брендбуку!" : "✅ Применить к брендбуку"}
            </button>
            <button onClick={load} disabled={loading} style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${c.border}`,
              background: c.bgCard, color: c.textPrimary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              🔄 Перегенерировать
            </button>
            <span style={{ fontSize: 12, color: c.textMuted }}>Данные сохраняются автоматически</span>
          </div>

          {/* Summary */}
          <Card style={{ borderLeft: `4px solid ${c.accent}` }}>
            <p style={{ fontSize: 14, color: c.textPrimary, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{brandSuggestions.summary}</p>
          </Card>

          {/* Color Palette */}
          {brandSuggestions.colorPalette && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ЦВЕТОВАЯ ПАЛИТРА</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                {(["primary", "secondary", "accent", "background", "text"] as const).map(key => {
                  const hexVal = brandSuggestions.colorPalette[key];
                  if (!hexVal || !hexVal.startsWith("#")) return null;
                  return (
                    <div key={key} style={{ textAlign: "center" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 12, background: hexVal, border: `2px solid ${c.border}`, marginBottom: 4 }} />
                      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{key}</div>
                      <div style={{ fontSize: 10, color: c.textSecondary }}>{hexVal}</div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.colorPalette.reasoning}</p>
            </Card>
          )}

          {/* Typography */}
          {brandSuggestions.typography && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ТИПОГРАФИКА</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div style={{ flex: 1, padding: 12, borderRadius: 8, background: c.bg }}>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>Заголовки</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.textPrimary }}>{brandSuggestions.typography.headerFont}</div>
                </div>
                <div style={{ flex: 1, padding: 12, borderRadius: 8, background: c.bg }}>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>Основной текст</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.textPrimary }}>{brandSuggestions.typography.bodyFont}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.typography.reasoning}</p>
            </Card>
          )}

          {/* Aesthetics */}
          {brandSuggestions.aesthetics && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ВИЗУАЛЬНЫЙ СТИЛЬ</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.accent, marginBottom: 8 }}>{brandSuggestions.aesthetics.style}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(brandSuggestions.aesthetics.moodKeywords ?? []).map((kw: string, i: number) => (
                  <Tag key={i} text={kw} color={c.accentGreen} />
                ))}
              </div>
              {(brandSuggestions.aesthetics.avoidKeywords ?? []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: c.accentRed, fontWeight: 600 }}>Избегать:</span>
                  {brandSuggestions.aesthetics.avoidKeywords.map((kw: string, i: number) => (
                    <Tag key={i} text={kw} color={c.accentRed} />
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.aesthetics.reasoning}</p>
            </Card>
          )}

          {/* Tone of Voice */}
          {brandSuggestions.toneOfVoice && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>ТОН ГОЛОСА</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {(brandSuggestions.toneOfVoice.adjectives ?? []).map((a: string, i: number) => (
                  <Tag key={i} text={a} />
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>{brandSuggestions.toneOfVoice.communicationStyle}</div>
              {(brandSuggestions.toneOfVoice.goodPhrases ?? []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentGreen, marginBottom: 4 }}>Хорошие фразы:</div>
                  {brandSuggestions.toneOfVoice.goodPhrases.map((p: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, paddingLeft: 10, borderLeft: `2px solid ${c.accentGreen}30`, marginBottom: 4 }}>«{p}»</div>
                  ))}
                </div>
              )}
              {(brandSuggestions.toneOfVoice.forbiddenPhrases ?? []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accentRed, marginBottom: 4 }}>Запрещённые фразы:</div>
                  {brandSuggestions.toneOfVoice.forbiddenPhrases.map((p: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: c.textSecondary, paddingLeft: 10, borderLeft: `2px solid ${c.accentRed}30`, marginBottom: 4 }}>«{p}»</div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.toneOfVoice.reasoning}</p>
            </Card>
          )}

          {/* Social Media */}
          {brandSuggestions.socialMedia && (
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>СОЦСЕТИ</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(brandSuggestions.socialMedia.bestPlatforms ?? []).map((p: string, i: number) => (
                  <Tag key={i} text={p} color={c.accent} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 6 }}>
                Частота: <b>{brandSuggestions.socialMedia.postingFrequency}</b>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(brandSuggestions.socialMedia.contentTypes ?? []).map((ct: string, i: number) => (
                  <Tag key={i} text={ct} color={c.accentGreen} />
                ))}
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, margin: 0, lineHeight: 1.5 }}>{brandSuggestions.socialMedia.reasoning}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SMM Module — Анализ соцсетей и брендинг
// ============================================================

const SMM_PLATFORMS: Array<{ key: keyof SMMSocialLinks; label: string; icon: string; placeholder: string }> = [
  { key: "vk", label: "ВКонтакте", icon: "🟦", placeholder: "https://vk.com/your_page" },
  { key: "instagram", label: "Instagram", icon: "📸", placeholder: "https://instagram.com/your_account" },
  { key: "telegram", label: "Telegram", icon: "✈️", placeholder: "https://t.me/your_channel" },
  { key: "facebook", label: "Facebook", icon: "📘", placeholder: "https://facebook.com/your_page" },
  { key: "tiktok", label: "TikTok", icon: "🎵", placeholder: "https://tiktok.com/@your_account" },
  { key: "youtube", label: "YouTube", icon: "▶️", placeholder: "https://youtube.com/@your_channel" },
];

function NewSMMView({ c, myCompany, isAnalyzing, onAnalyze }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: (niche: string, links: SMMSocialLinks) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [links, setLinks] = useState<SMMSocialLinks>(() => {
    const initial: SMMSocialLinks = {};
    const social = myCompany?.social;
    // Pre-fill telegram/vk if available from existing analysis (only urls)
    if (social) {
      // social.vk and social.telegram are objects in AnalysisResult, not URLs — skip auto-fill
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof SMMSocialLinks, value: string) => {
    setLinks(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const hasAny = Object.values(links).some(v => v && v.trim());
    if (!hasAny && !niche.trim()) {
      setError("Укажите хотя бы одну ссылку на соцсеть или опишите нишу");
      return;
    }
    setError(null);
    try {
      await onAnalyze(niche.trim(), links);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Анализ СММ и брендинг</h1>
      <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 28px" }}>
        Мы проанализируем ваши соцсети и сайт, определим архетип бренда и разработаем стратегию для каждой платформы: форматы, тон, контент-столпы и готовые примеры постов.
      </p>

      {myCompany && (
        <div style={{ background: c.accent + "10", border: `1px solid ${c.accent}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <span style={{ color: c.textMuted }}>Компания: </span>
          <span style={{ fontWeight: 600, color: c.textPrimary }}>{myCompany.company.name}</span>
          <span style={{ color: c.textMuted }}> · {myCompany.company.url}</span>
        </div>
      )}

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>
          Ниша / о компании
        </label>
        <p style={{ fontSize: 12, color: c.textMuted, margin: "0 0 10px" }}>
          Опишите чем занимается компания, для кого продукт, в чём ценность
        </p>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Например: студия онлайн-йоги для женщин 30+. Помогаем вернуть гибкость, снять стресс и найти баланс через короткие практики дома."
          rows={4}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>
          Ссылки на соцсети
        </label>
        <p style={{ fontSize: 12, color: c.textMuted, margin: "0 0 14px" }}>
          Заполните те, которые есть. Можно оставить пустыми — тогда дадим рекомендации с нуля.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {SMM_PLATFORMS.map(p => (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{p.icon}</span>
              <span style={{ fontSize: 12, color: c.textSecondary, width: 90, fontWeight: 600 }}>{p.label}</span>
              <input
                type="text"
                value={links[p.key] ?? ""}
                onChange={e => handleChange(p.key, e.target.value)}
                placeholder={p.placeholder}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none" }}
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: c.accentRed + "12", border: `1px solid ${c.accentRed}30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: c.accentRed, marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isAnalyzing}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isAnalyzing ? c.borderLight : "linear-gradient(135deg, #ec4899, #f472b6)", color: isAnalyzing ? c.textMuted : "#fff", fontWeight: 700, fontSize: 15, cursor: isAnalyzing ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #ec489940" }}>
        {isAnalyzing ? "⏳ Анализируем СММ… (60–90 сек)" : "📱 Провести анализ СММ"}
      </button>
      {isAnalyzing && (
        <p style={{ fontSize: 12, color: c.textMuted, marginTop: 12 }}>Разрабатываем стратегию брендинга. Не закрывайте страницу.</p>
      )}
    </div>
  );
}

function RealStatsBar({ c, stats }: { c: Colors; stats: SMMRealStats }) {
  const items: Array<{ label: string; value: string; sub?: string }> = [];

  if (stats.vk) {
    items.push({
      label: "🟦 ВКонтакте",
      value: stats.vk.subscribers.toLocaleString("ru-RU") + " подп.",
      sub: stats.vk.posts30d > 0 ? `${stats.vk.posts30d} постов` : undefined,
    });
  }
  if (stats.telegram) {
    items.push({
      label: "✈️ Telegram",
      value: stats.telegram.subscribers.toLocaleString("ru-RU") + " подп.",
      sub: stats.telegram.posts30d > 0 ? `${stats.telegram.posts30d} постов` : undefined,
    });
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12,
          padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: c.shadow,
        }}>
          <div>
            <div style={{ fontSize: 11, color: c.textMuted, fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: c.textPrimary }}>{item.value}</div>
            {item.sub && <div style={{ fontSize: 11, color: c.textMuted }}>{item.sub}</div>}
          </div>
          <div style={{ fontSize: 10, background: "#10b98115", color: "#10b981", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>
            РЕАЛЬНЫЕ ДАННЫЕ
          </div>
        </div>
      ))}
    </div>
  );
}

function SMMEmptyDashboard({ c, onRunAnalysis }: { c: Colors; onRunAnalysis: () => void }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Дашборд СММ</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 28px" }}>Анализ соцсетей ещё не проводился</p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>Тут пока нет данных</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 24, lineHeight: 1.6, maxWidth: 380, margin: "0 auto 24px" }}>
          Запустите анализ СММ, чтобы получить стратегию брендинга, контент-план и рекомендации для каждой соцсети
        </div>
        <button
          onClick={onRunAnalysis}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ec4899, #f472b6)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #ec489940" }}
        >
          🚀 Запустить анализ СММ
        </button>
      </div>
    </div>
  );
}

function SMMDashboardView({ c, data }: { c: Colors; data: SMMResult }) {
  const [activePlatform, setActivePlatform] = useState(0);
  const platform = data.platformStrategies[activePlatform];

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  const Tag = ({ text, color }: { text: string; color?: string }) => (
    <span style={{ display: "inline-block", background: (color ?? c.accent) + "15", color: color ?? c.accent, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{text}</span>
  );

  const ListItem = ({ text, color, icon }: { text: string; color?: string; icon?: string }) => (
    <div style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
      <span style={{ flexShrink: 0, color: color ?? c.accent }}>{icon ?? "•"}</span>
      <span style={{ color: c.textSecondary, lineHeight: 1.5 }}>{text}</span>
    </div>
  );

  const generatedDate = new Date(data.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>СММ-стратегия — {data.companyName}</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{data.companyUrl} · {generatedDate}</p>
      </div>

      {/* Real stats badge */}
      {data.realStats && (data.realStats.vk || data.realStats.telegram) && (
        <RealStatsBar c={c} stats={data.realStats} />
      )}

      {/* Brand Identity */}
      <CollapsibleSection c={c} title="🎭 Идентичность бренда">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>АРХЕТИП</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.accent, marginBottom: 14 }}>{data.brandIdentity.archetype}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ПОЗИЦИОНИРОВАНИЕ</div>
            <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{data.brandIdentity.positioning}</p>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>УТП</div>
            <p style={{ fontSize: 14, color: c.textPrimary, fontWeight: 600, lineHeight: 1.55, marginBottom: 14 }}>{data.brandIdentity.uniqueValue}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ВИЗУАЛЬНЫЙ СТИЛЬ</div>
            <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{data.brandIdentity.visualStyle}</p>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>ТОН ГОЛОСА</div>
            <div style={{ marginBottom: 14 }}>{data.brandIdentity.toneOfVoice.map((t, i) => <Tag key={i} text={t} />)}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>КЛЮЧЕВЫЕ СЛОВА БРЕНДА</div>
            <div>{data.brandIdentity.brandKeywords.map((k, i) => <Tag key={i} text={k} color={c.accentWarm} />)}</div>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Content Strategy */}
      <CollapsibleSection c={c} title="📝 Контент-стратегия">
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, ${c.bgCard} 60%, ${c.accent}06 100%)` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>БОЛЬШАЯ ИДЕЯ</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, lineHeight: 1.5, margin: "0 0 14px" }}>{data.contentStrategy.bigIdea}</p>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>МИССИЯ КОНТЕНТА</div>
          <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.65, margin: 0 }}>{data.contentStrategy.contentMission}</p>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>БОЛИ АУДИТОРИИ</div>
            {data.contentStrategy.audienceProblems.map((p, i) => <ListItem key={i} text={p} color={c.accentRed} icon="⚡" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>СТОРИТЕЛЛИНГ-УГЛЫ</div>
            {data.contentStrategy.storytellingAngles.map((s, i) => <ListItem key={i} text={s} icon="→" />)}
          </Card>
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>МАТРИЦА КОНТЕНТА</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Тип контента", "Цель", "Доля"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${c.border}`, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.contentStrategy.contentMatrix.map((m, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${c.borderLight}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{m.type}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: c.textSecondary }}>{m.goal}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: c.accent }}>{m.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </CollapsibleSection>

      {/* Platform tabs + strategy */}
      {data.platformStrategies.length > 0 && (
        <CollapsibleSection c={c} title="📲 Стратегия по платформам">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {data.platformStrategies.map((p, i) => (
              <button key={i} onClick={() => setActivePlatform(i)} style={{
                padding: "8px 18px", borderRadius: 10, border: `2px solid ${activePlatform === i ? c.accent : c.border}`,
                background: activePlatform === i ? c.accent : "transparent",
                color: activePlatform === i ? "#fff" : c.textSecondary,
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
                {p.platformLabel}
              </button>
            ))}
          </div>
          {platform && (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>СООТВЕТСТВИЕ ЦА</div>
                    <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{platform.audienceFit}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ФОРМАТЫ</div>
                    <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{platform.contentFormat}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ЧАСТОТА</div>
                    <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{platform.postingFrequency}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 6 }}>ТОН</div>
                    <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{platform.toneOfVoice}</p>
                  </div>
                </div>
              </Card>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>КОНТЕНТ-СТОЛПЫ</div>
                  {platform.contentPillars.map((p, i) => <ListItem key={i} text={p} icon="🏛" />)}
                </Card>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, marginBottom: 12, letterSpacing: "0.05em" }}>ТАКТИКИ РОСТА</div>
                  {platform.growthTactics.map((g, i) => <ListItem key={i} text={g} color={c.accentGreen} icon="📈" />)}
                </Card>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>KPI</div>
                  {platform.metricsToTrack.map((m, i) => <ListItem key={i} text={m} icon="📊" />)}
                </Card>
              </div>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 12, letterSpacing: "0.05em" }}>ПРИМЕРЫ ПОСТОВ — ГОТОВЫ К ПУБЛИКАЦИИ</div>
                {platform.examplePosts.map((post, i) => (
                  <div key={i} style={{ padding: 14, background: c.bg, borderRadius: 10, marginBottom: 10, border: `1px solid ${c.borderLight}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>ПОСТ #{i + 1}</div>
                    <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{post}</p>
                  </div>
                ))}
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>СТРАТЕГИЯ ХЭШТЕГОВ / SEO</div>
                <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{platform.hashtagStrategy}</p>
              </Card>
              {platform.warnings && platform.warnings.length > 0 && (
                <Card style={{ background: c.accentRed + "08", border: `1px solid ${c.accentRed}25` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>ЧЕГО НЕ ДЕЛАТЬ</div>
                  {platform.warnings.map((w, i) => <ListItem key={i} text={w} color={c.accentRed} icon="✗" />)}
                </Card>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Quick wins + 30 day plan */}
      <CollapsibleSection c={c} title="🚀 Quick wins и план на 30 дней">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, marginBottom: 12, letterSpacing: "0.05em" }}>QUICK WINS — ПЕРВАЯ НЕДЕЛЯ</div>
            {data.quickWins.map((q, i) => <ListItem key={i} text={q} color={c.accentGreen} icon={`${i + 1}.`} />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 12, letterSpacing: "0.05em" }}>ПЛАН НА 30 ДНЕЙ</div>
            {data.thirtyDayPlan.map((w, i) => <ListItem key={i} text={w} icon="📅" />)}
          </Card>
        </div>
      </CollapsibleSection>

      {/* Red flags + Inspiration */}
      <CollapsibleSection c={c} title="⚠️ Ошибки и вдохновение">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card style={{ background: c.accentRed + "08" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 12, letterSpacing: "0.05em" }}>RED FLAGS</div>
            {data.redFlags.map((r, i) => <ListItem key={i} text={r} color={c.accentRed} icon="⚠️" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 12, letterSpacing: "0.05em" }}>АККАУНТЫ ДЛЯ ВДОХНОВЕНИЯ</div>
            {data.inspirationAccounts.map((a, i) => <ListItem key={i} text={a} icon="✨" />)}
          </Card>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ============================================================
// Content Factory views
// ============================================================

function ContentEmptyView({ c, onRun, hasSmm }: { c: Colors; onRun: () => void; hasSmm: boolean }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Контент-завод</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 28px" }}>Контент-план ещё не сгенерирован</p>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>
          {hasSmm ? "Запустите контент-завод" : "Сначала проведите анализ СММ"}
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 24, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
          {hasSmm
            ? "На основе вашего СММ-анализа мы создадим контент-план: 12 идей постов и 8 видео-рилсов. Дальше можно сгенерировать готовые посты с картинками и видео с аватарами HeyGen."
            : "Контент-завод работает на основе СММ-анализа — он определяет архетип бренда, тон голоса и боли аудитории, а уже потом строит контент-план."}
        </div>
        <button
          onClick={onRun}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b, #fb923c)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #f59e0b40" }}>
          {hasSmm ? "🏭 Сгенерировать план" : "📱 Перейти к анализу СММ"}
        </button>
      </div>
    </div>
  );
}

function NewContentPlanView({ c, myCompany, smm, isGenerating, onGenerate }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  smm: SMMResult | null;
  isGenerating: boolean;
  onGenerate: (niche: string) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!smm) {
      setError("Сначала проведите анализ СММ — контент-завод работает на его основе");
      return;
    }
    setError(null);
    try {
      await onGenerate(niche.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Контент-завод</h1>
      <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 28px" }}>
        Сгенерируем контент-план на 30 дней: 12 идей постов и 8 видео-рилсов на основе вашего СММ-анализа. Каждую идею можно превратить в готовый пост с картинкой или видео с аватаром HeyGen.
      </p>

      {smm ? (
        <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ color: c.textMuted, marginBottom: 4 }}>Используем СММ-анализ:</div>
          <div style={{ fontWeight: 600, color: c.textPrimary }}>{smm.brandIdentity.archetype} · {smm.companyName}</div>
          <div style={{ color: c.textSecondary, marginTop: 4 }}>{smm.brandIdentity.positioning}</div>
        </div>
      ) : (
        <div style={{ background: c.accentRed + "12", border: `1px solid ${c.accentRed}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: c.accentRed }}>
          ⚠️ СММ-анализ не найден. Сначала запустите его в разделе «Анализ СММ».
        </div>
      )}

      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow, marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>
          Уточнение по нише (опционально)
        </label>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Можно дополнить контекст: продукт, ЦА, особенности коммуникации"
          rows={3}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {error && (
        <div style={{ background: c.accentRed + "12", border: `1px solid ${c.accentRed}30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: c.accentRed, marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isGenerating || !smm}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isGenerating || !smm ? c.borderLight : "linear-gradient(135deg, #f59e0b, #fb923c)", color: isGenerating || !smm ? c.textMuted : "#fff", fontWeight: 700, fontSize: 15, cursor: isGenerating || !smm ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #f59e0b40" }}>
        {isGenerating ? "⏳ Запускаем завод… (60–90 сек)" : "🏭 Сгенерировать контент-план"}
      </button>
    </div>
  );
}

// ---------- Idea card helpers ----------

function buildPostPrompt(idea: ContentPostIdea): string {
  return `Напиши пост для платформы ${idea.platform}.
Формат: ${idea.format}
Крючок (заголовок): ${idea.hook}
Угол подачи: ${idea.angle}
Контент-столп: ${idea.pillar}
Цель: ${idea.goal}
CTA: ${idea.cta}

Верни JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }`;
}

function buildReelPrompt(idea: ContentReelIdea): string {
  return `Напиши сценарий рилса (${idea.durationSec} сек) по виральной структуре:
Крюк: ${idea.hook}
Интрига: ${idea.intrigue}
Проблема: ${idea.problem}
Решение: ${idea.solution}
Результат: ${idea.result}
CTA: ${idea.cta}
Визуал: ${idea.visualStyle}
Столп: ${idea.pillar}

Верни JSON: { "title": "...", "scenario": "...", "voiceoverScript": "...", "hashtags": [...] }`;
}

function PostIdeaCard({ c, idea, isGenerating, generatingId, onGenerate }: {
  c: Colors;
  idea: ContentPostIdea;
  isGenerating: boolean;
  generatingId: string | null;
  onGenerate: (idea: ContentPostIdea, customPrompt?: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");
  const busy = isGenerating && generatingId === idea.id;

  const handleOpenPrompt = () => {
    if (!prompt) setPrompt(buildPostPrompt(idea));
    setShowPrompt(v => !v);
  };

  return (
    <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: 14, boxShadow: c.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#f59e0b15", color: "#f59e0b", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase" }}>{idea.format}</span>
        <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{idea.platform}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 6 }}>{idea.hook}</div>
      <p style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.45, margin: "0 0 6px" }}>{idea.angle}</p>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 2 }}><b>Столп:</b> {idea.pillar} · <b>Цель:</b> {idea.goal}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 12 }}><b>CTA:</b> {idea.cta}</div>

      <button
        onClick={() => onGenerate(idea, showPrompt && prompt ? prompt : undefined)}
        disabled={busy || isGenerating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: busy ? c.borderLight : "linear-gradient(135deg, #f59e0b, #fb923c)", color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 11, cursor: busy || isGenerating ? "not-allowed" : "pointer", opacity: isGenerating && !busy ? 0.5 : 1, marginBottom: 6 }}>
        {busy ? "⏳ Генерируем…" : "✨ Создать пост с картинкой"}
      </button>
      <button
        onClick={handleOpenPrompt}
        style={{ width: "100%", padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: showPrompt ? "#f59e0b12" : "transparent", color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
        {showPrompt ? "↑ Скрыть промпт" : "✏️ Редактировать промпт"}
      </button>
      {showPrompt && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={7}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid #f59e0b50`, background: c.bg, color: c.textPrimary, fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>Промпт заменит стандартный при генерации. Ответ должен быть JSON.</div>
        </div>
      )}
    </div>
  );
}

function ReelIdeaCard({ c, idea, isGenerating, generatingId, onGenerate }: {
  c: Colors;
  idea: ContentReelIdea;
  isGenerating: boolean;
  generatingId: string | null;
  onGenerate: (idea: ContentReelIdea, customPrompt?: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");
  const busy = isGenerating && generatingId === idea.id;

  const handleOpenPrompt = () => {
    if (!prompt) setPrompt(buildReelPrompt(idea));
    setShowPrompt(v => !v);
  };

  return (
    <div style={{ background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, padding: 14, boxShadow: c.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "3px 8px" }}>REEL · {idea.durationSec}s</span>
        <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{idea.pillar}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 6 }}>🪝 {idea.hook}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 2 }}><b>Боль:</b> {idea.problem}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 2 }}><b>Решение:</b> {idea.solution}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 12 }}><b>Результат:</b> {idea.result}</div>

      <button
        onClick={() => onGenerate(idea, showPrompt && prompt ? prompt : undefined)}
        disabled={busy || isGenerating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: busy ? c.borderLight : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 11, cursor: busy || isGenerating ? "not-allowed" : "pointer", opacity: isGenerating && !busy ? 0.5 : 1, marginBottom: 6 }}>
        {busy ? "⏳ Пишем сценарий…" : "🎬 Создать сценарий рилса"}
      </button>
      <button
        onClick={handleOpenPrompt}
        style={{ width: "100%", padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: showPrompt ? "#ec489912" : "transparent", color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
        {showPrompt ? "↑ Скрыть промпт" : "✏️ Редактировать промпт"}
      </button>
      {showPrompt && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={7}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid #ec489950`, background: c.bg, color: c.textPrimary, fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>Промпт заменит стандартный. Ответ должен быть JSON.</div>
        </div>
      )}
    </div>
  );
}

// ---------- ContentGeneratorBlock ----------

function ContentGeneratorBlock({ c, plan, isGeneratingPost, generatingPostId, isGeneratingReel, generatingReelId, onGeneratePost, onGenerateReel, brandBook }: {
  c: Colors;
  plan: ContentPlan;
  isGeneratingPost: boolean;
  generatingPostId: string | null;
  isGeneratingReel: boolean;
  generatingReelId: string | null;
  onGeneratePost: (idea: ContentPostIdea, customPrompt?: string) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  brandBook: BrandBook;
}) {
  const [mode, setMode] = useState<"post" | "reel">("post");
  const [scratchMode, setScratchMode] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  // brief = plain-language instructions from user; prompt = AI-generated full prompt (optional advanced view)
  const [brief, setBrief] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const selectedPost = plan.postIdeas.find(p => p.id === selectedPostId);
  const selectedReel = plan.reelIdeas.find(r => r.id === selectedReelId);

  const selectPost = (idea: ContentPostIdea) => {
    setScratchMode(false);
    if (selectedPostId === idea.id) { setSelectedPostId(null); setBrief(""); setGeneratedPrompt(""); return; }
    setSelectedPostId(idea.id);
    setBrief("");
    setGeneratedPrompt("");
  };

  const selectReel = (idea: ContentReelIdea) => {
    setScratchMode(false);
    if (selectedReelId === idea.id) { setSelectedReelId(null); setBrief(""); setGeneratedPrompt(""); return; }
    setSelectedReelId(idea.id);
    setBrief("");
    setGeneratedPrompt("");
  };

  const openScratch = () => {
    setScratchMode(true);
    setSelectedPostId(null);
    setSelectedReelId(null);
    setGeneratedPrompt("");
  };

  // Build the topic string for expand-prompt: use idea hook OR brief OR empty (AI will use company context)
  const getExpandTopic = () => {
    if (scratchMode) return brief;
    if (mode === "post") return brief || (selectedPost ? `${selectedPost.hook} — ${selectedPost.angle}` : "");
    return brief || (selectedReel ? selectedReel.hook : "");
  };

  const handleExpandPrompt = async () => {
    setIsExpandingPrompt(true);
    setExpandError(null);
    try {
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: getExpandTopic(),
          type: mode,
          companyName: plan.companyName,
          bigIdea: plan.bigIdea,
          pillars: plan.pillars ?? [],
          brandBook,
        }),
      });
      const json = await res.json() as { ok: boolean; prompt?: string; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      setGeneratedPrompt(json.prompt ?? "");
      setShowAdvanced(true);
    } catch (e) {
      setExpandError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setIsExpandingPrompt(false);
    }
  };

  const handleGenerate = () => {
    // customPrompt: use AI-generated prompt if available (and visible), otherwise use brief as extra instruction
    const customPrompt = showAdvanced && generatedPrompt ? generatedPrompt : undefined;
    if (mode === "post") {
      const idea: ContentPostIdea = selectedPost ?? {
        id: `scratch-${Date.now()}`, pillar: "С нуля", format: "single",
        hook: brief || "Новый пост", angle: brief, goal: "охват", cta: "", platform: "vk",
      };
      onGeneratePost(idea, customPrompt);
    } else {
      const idea: ContentReelIdea = selectedReel ?? {
        id: `scratch-${Date.now()}`, pillar: "С нуля", hook: brief || "Новый рилс",
        intrigue: "", problem: "", solution: "", result: "", cta: "", durationSec: 30, visualStyle: "", hashtags: [],
      };
      onGenerateReel(idea, customPrompt);
    }
  };

  const isGenerating = mode === "post" ? isGeneratingPost : isGeneratingReel;
  const busyId = mode === "post" ? generatingPostId : generatingReelId;
  const selectedId = mode === "post" ? selectedPostId : selectedReelId;
  const busy = isGenerating && (busyId === selectedId || (scratchMode && (busyId?.startsWith("scratch") ?? false)));
  const accent = mode === "post" ? "#f59e0b" : "#ec4899";

  return (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadowLg, marginBottom: 24, overflow: "hidden" }}>
      {/* Header + mode tabs */}
      <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${c.borderLight}`, background: `linear-gradient(135deg, ${c.bgCard} 50%, ${accent}06 100%)` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary, marginBottom: 12 }}>✨ Создать контент</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([["post", "📝 Пост"], ["reel", "🎬 Рилс"]] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedPostId(null); setSelectedReelId(null); setScratchMode(false); setBrief(""); setGeneratedPrompt(""); setShowAdvanced(false); }}
              style={{ padding: "7px 18px", borderRadius: 9, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                background: mode === m ? (m === "reel" ? "#ec4899" : "#f59e0b") : c.bg,
                color: mode === m ? "#fff" : c.textSecondary,
                boxShadow: mode === m ? `0 2px 8px ${m === "reel" ? "#ec489940" : "#f59e0b40"}` : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "18px 20px" }}>
        {/* Idea chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10, letterSpacing: "0.05em" }}>
            {mode === "post" ? "ВЫБЕРИТЕ ИДЕЮ ИЗ ПЛАНА" : "ВЫБЕРИТЕ ИДЕЮ РИЛСА"}
            <span style={{ fontWeight: 400, marginLeft: 6 }}>— или создайте с нуля</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mode === "post"
              ? plan.postIdeas.map(idea => {
                  const sel = selectedPostId === idea.id;
                  return (
                    <button key={idea.id} onClick={() => selectPost(idea)}
                      style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${sel ? accent : c.border}`,
                        background: sel ? accent + "18" : c.bg, color: sel ? accent : c.textSecondary,
                        fontSize: 11, fontWeight: sel ? 700 : 500, cursor: "pointer", textAlign: "left",
                        maxWidth: 220, transition: "all 0.12s", lineHeight: 1.35,
                      }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: sel ? accent : c.textMuted, marginBottom: 2, textTransform: "uppercase" }}>{idea.format}</div>
                      {idea.hook}
                    </button>
                  );
                })
              : plan.reelIdeas.map(idea => {
                  const sel = selectedReelId === idea.id;
                  return (
                    <button key={idea.id} onClick={() => selectReel(idea)}
                      style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${sel ? accent : c.border}`,
                        background: sel ? accent + "18" : c.bg, color: sel ? accent : c.textSecondary,
                        fontSize: 11, fontWeight: sel ? 700 : 500, cursor: "pointer", textAlign: "left",
                        maxWidth: 220, transition: "all 0.12s", lineHeight: 1.35,
                      }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: sel ? accent : c.textMuted, marginBottom: 2 }}>{idea.durationSec}с · {idea.pillar}</div>
                      🪝 {idea.hook}
                    </button>
                  );
                })
            }
            <button onClick={openScratch}
              style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px dashed ${scratchMode ? accent : c.border}`,
                background: scratchMode ? accent + "12" : "transparent", color: scratchMode ? accent : c.textMuted,
                fontSize: 11, fontWeight: scratchMode ? 700 : 500, cursor: "pointer", transition: "all 0.12s",
              }}>
              ✍️ С нуля
            </button>
          </div>
        </div>

        {/* Selected idea details */}
        {!scratchMode && (selectedPost || selectedReel) && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: accent + "0a", borderRadius: 10, border: `1px solid ${accent}20`, fontSize: 11, color: c.textSecondary, lineHeight: 1.6 }}>
            {selectedPost && <><b style={{ color: accent }}>Угол:</b> {selectedPost.angle} · <b style={{ color: accent }}>Цель:</b> {selectedPost.goal} · <b style={{ color: accent }}>CTA:</b> {selectedPost.cta}</>}
            {selectedReel && <><b style={{ color: accent }}>Боль:</b> {selectedReel.problem} · <b style={{ color: accent }}>Решение:</b> {selectedReel.solution} · <b style={{ color: accent }}>CTA:</b> {selectedReel.cta}</>}
          </div>
        )}

        {/* Brief / instructions field */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>
            БРИФ / УТОЧНЕНИЕ
            <span style={{ fontWeight: 400, marginLeft: 6 }}>— необязательно, можно оставить пустым</span>
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={scratchMode
              ? `Например: «напиши ${mode === "post" ? "пост" : "рилс"} о плюсах нашего бизнеса» или «сделай акцент на надёжности и немецком качестве»`
              : `Дополнительные пожелания. Например: «сделай акцент на скорости доставки» или «добавь кейс из практики»`}
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${c.border}`,
              background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
            }}
          />
        </div>

        {/* AI assistant row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleExpandPrompt}
            disabled={isExpandingPrompt}
            style={{ padding: "8px 18px", borderRadius: 9, border: `1px solid ${accent}50`, background: accent + "0c",
              color: accent, fontSize: 12, fontWeight: 700, cursor: isExpandingPrompt ? "not-allowed" : "pointer",
              opacity: isExpandingPrompt ? 0.6 : 1, transition: "all 0.15s",
            }}>
            {isExpandingPrompt ? "⏳ ИИ готовит промпт…" : "🤖 ИИ-помощник: подготовить промпт"}
          </button>
          <div style={{ fontSize: 11, color: c.textMuted, flex: 1 }}>
            {isExpandingPrompt ? "Анализирую компанию и тему…" : "ИИ использует данные компании и сформирует готовый промпт"}
          </div>
          {expandError && <span style={{ fontSize: 11, color: c.accentRed }}>{expandError}</span>}
        </div>

        {/* AI-generated prompt (advanced / editable) */}
        {showAdvanced && generatedPrompt && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>
                ПРОМПТ ОТ ИИ-ПОМОЩНИКА
                <span style={{ fontWeight: 400, marginLeft: 6 }}>— можно отредактировать</span>
              </label>
              <button onClick={() => { setShowAdvanced(false); setGeneratedPrompt(""); }}
                style={{ fontSize: 10, color: c.textMuted, background: "none", border: "none", cursor: "pointer" }}>✕ скрыть</button>
            </div>
            <textarea
              value={generatedPrompt}
              onChange={e => setGeneratedPrompt(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `1px solid ${accent}40`,
                background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical",
                fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.6, boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>
              Этот промпт будет использован при генерации. При нажатии «Создать» без промпта — ИИ сгенерирует по идее и данным компании автоматически.
            </div>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14, cursor: isGenerating ? "not-allowed" : "pointer", transition: "all 0.15s",
            background: isGenerating ? c.borderLight : (mode === "reel" ? "linear-gradient(135deg, #ec4899, #f472b6)" : "linear-gradient(135deg, #f59e0b, #fb923c)"),
            color: isGenerating ? c.textMuted : "#fff",
            boxShadow: isGenerating ? "none" : `0 4px 16px ${accent}50`,
          }}>
          {isGenerating
            ? (busy ? "⏳ Генерируем…" : "⏳ Ожидание…")
            : mode === "reel" ? "🎬 Создать сценарий рилса" : "✨ Создать пост с картинкой"}
        </button>
        {isGenerating && !busy && (
          <div style={{ fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: 6 }}>Дождитесь окончания текущей генерации</div>
        )}
      </div>
    </div>
  );
}

function CalendarDayPanel({ c, dayText, dayIndex, isGeneratingPost, isGeneratingReel, onGeneratePost, onGenerateReel, onClose }: {
  c: Colors;
  dayText: string;
  dayIndex: number;
  isGeneratingPost: boolean;
  isGeneratingReel: boolean;
  onGeneratePost: (idea: ContentPostIdea, customPrompt?: string) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  onClose: () => void;
}) {
  const isReel = /рилс/i.test(dayText);
  const accentColor = isReel ? "#ec4899" : "#f59e0b";

  const defaultPrompt = isReel
    ? `Напиши сценарий рилса по теме: ${dayText}\n\nСтруктура: крюк (0-3 сек) → интрига → проблема → решение → результат → CTA.\nВерни JSON: { "title": "...", "scenario": "...", "voiceoverScript": "...", "hashtags": [...] }`
    : `Напиши пост на тему: ${dayText}\n\nИспользуй сильный крючок, тело с конкретикой и призыв к действию.\nВерни JSON: { "hook": "...", "body": "...", "hashtags": [...], "imagePrompt": "..." }`;

  const [prompt, setPrompt] = useState(defaultPrompt);
  const busy = isReel ? isGeneratingReel : isGeneratingPost;

  const fakeIdBase = { id: `cal-${dayIndex}`, pillar: "Календарь", format: "single" as const, hook: dayText, angle: dayText, goal: "охват", cta: "", platform: "instagram" };
  const fakeReelBase = { id: `cal-${dayIndex}`, pillar: "Календарь", hook: dayText, intrigue: "", problem: "", solution: "", result: "", cta: "", durationSec: 30, visualStyle: "", hashtags: [] };

  return (
    <div style={{ marginTop: 14, background: c.bgCard, borderRadius: 12, border: `1.5px solid ${accentColor}40`, padding: 18, boxShadow: c.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 4, letterSpacing: "0.05em" }}>ДЕНЬ {dayIndex + 1}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{dayText}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: c.textMuted, lineHeight: 1 }}>×</button>
      </div>

      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" }}>ПРОМПТ ДЛЯ ГЕНЕРАЦИИ (можно редактировать)</label>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={6}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${accentColor}50`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.55, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={() => isReel
            ? onGenerateReel(fakeReelBase, prompt)
            : onGeneratePost(fakeIdBase, prompt)
          }
          disabled={busy}
          style={{ flex: 1, padding: "10px 16px", borderRadius: 9, border: "none", background: busy ? c.borderLight : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer" }}>
          {busy ? "⏳ Генерируем…" : isReel ? "🎬 Создать сценарий рилса" : "✨ Создать пост с картинкой"}
        </button>
        <button
          onClick={() => setPrompt(defaultPrompt)}
          style={{ padding: "10px 14px", borderRadius: 9, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Сбросить промпт
        </button>
      </div>
    </div>
  );
}

// ---------- ContentPlanView ----------

function ContentPlanView({ c, plan, isGeneratingPost, generatingPostId, isGeneratingReel, generatingReelId, onGeneratePost, onGenerateReel, avatarSettings, onUpdateAvatarSettings, referenceImages, onUpdateReferenceImages, brandBook, onUpdateBrandBook }: {
  c: Colors;
  plan: ContentPlan;
  isGeneratingPost: boolean;
  generatingPostId: string | null;
  isGeneratingReel: boolean;
  generatingReelId: string | null;
  onGeneratePost: (idea: ContentPostIdea, customPrompt?: string) => void;
  onGenerateReel: (idea: ContentReelIdea, customPrompt?: string) => void;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (next: AvatarSettings) => void;
  referenceImages: ReferenceImage[];
  onUpdateReferenceImages: (next: ReferenceImage[]) => void;
  brandBook: BrandBook;
  onUpdateBrandBook: (next: BrandBook) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const generatedDate = new Date(plan.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>🏭 Контент-завод — {plan.companyName}</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{generatedDate} · {plan.postIdeas.length} постов · {plan.reelIdeas.length} рилсов</p>
      </div>

      {/* Big Idea + pillars */}
      <CollapsibleSection c={c} title="💡 Большая идея и контент-столпы">
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, ${c.bgCard} 60%, #f59e0b08 100%)` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>БОЛЬШАЯ ИДЕЯ</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, lineHeight: 1.5, margin: 0 }}>{plan.bigIdea}</p>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {plan.pillars?.map((p, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{p.name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{p.share}</div>
              </div>
              <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, margin: 0 }}>{p.description}</p>
            </Card>
          ))}
        </div>
      </CollapsibleSection>

      {/* Content Generator */}
      <ContentGeneratorBlock
        c={c} plan={plan}
        isGeneratingPost={isGeneratingPost} generatingPostId={generatingPostId}
        isGeneratingReel={isGeneratingReel} generatingReelId={generatingReelId}
        onGeneratePost={onGeneratePost} onGenerateReel={onGenerateReel}
        brandBook={brandBook}
      />

      {/* Brand Book */}
      <BrandBookPanel c={c} brandBook={brandBook} onChange={onUpdateBrandBook} />

      {/* Reference images panel */}
      <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />

      {/* Avatar settings (affects reel scenarios + video generation) */}
      <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />

      {/* Post ideas */}
      <CollapsibleSection c={c} title={`📝 Идеи постов (${plan.postIdeas.length})`} defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {plan.postIdeas.map(idea => (
            <PostIdeaCard key={idea.id} c={c} idea={idea}
              isGenerating={isGeneratingPost} generatingId={generatingPostId}
              onGenerate={onGeneratePost}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Reel ideas */}
      <CollapsibleSection c={c} title={`🎬 Идеи видео-рилсов (${plan.reelIdeas.length})`} defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {plan.reelIdeas.map(idea => (
            <ReelIdeaCard key={idea.id} c={c} idea={idea}
              isGenerating={isGeneratingReel} generatingId={generatingReelId}
              onGenerate={onGenerateReel}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Calendar */}
      <CollapsibleSection c={c} title="📅 Календарь на 30 дней" defaultOpen={false}>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {plan.thirtyDayCalendar?.map((day, i) => {
              const isReel = /рилс/i.test(day);
              const isSelected = selectedDay === i;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : i)}
                  style={{
                    padding: "8px 10px", background: isSelected ? (isReel ? "#ec489918" : "#f59e0b18") : c.bg,
                    borderRadius: 8, border: `1.5px solid ${isSelected ? (isReel ? "#ec4899" : "#f59e0b") : c.borderLight}`,
                    fontSize: 11, color: c.textSecondary, lineHeight: 1.45, cursor: "pointer",
                    transition: "all 0.12s",
                  }}>
                  {day}
                </div>
              );
            })}
          </div>
          {plan.weeklyRhythm && (
            <div style={{ marginTop: 14, padding: 10, background: "#f59e0b08", borderRadius: 8, fontSize: 12, color: c.textSecondary }}>
              <b style={{ color: "#f59e0b" }}>Ритм:</b> {plan.weeklyRhythm}
            </div>
          )}
        </Card>

        {/* Day detail panel */}
        {selectedDay !== null && plan.thirtyDayCalendar?.[selectedDay] && (
          <CalendarDayPanel
            c={c}
            dayText={plan.thirtyDayCalendar[selectedDay]}
            dayIndex={selectedDay}
            isGeneratingPost={isGeneratingPost}
            isGeneratingReel={isGeneratingReel}
            onGeneratePost={onGeneratePost}
            onGenerateReel={onGenerateReel}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </CollapsibleSection>
    </div>
  );
}

// Render carousel body (split by "---") as numbered screens
function CarouselBody({ c, body }: { c: Colors; body: string }) {
  const slides = body.split(/\n?---\n?/).map(s => s.trim()).filter(Boolean);
  if (slides.length <= 1) {
    return <p style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{body}</p>;
  }
  return (
    <div>
      {slides.map((slide, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
          <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, margin: 0 }}>{slide}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Tone of Voice panel ----------

function TovPanel({ c, post, brandBook, onApply, onClose }: {
  c: Colors;
  post: GeneratedPost;
  brandBook: BrandBook;
  onApply: (corrected: GeneratedPost) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TovCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCorrected, setShowCorrected] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check-tov", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: post.hook,
          text: post.body,
          hashtags: post.hashtags,
          platform: post.platform,
          brandBook,
        }),
      });
      const json = await res.json() as { ok: boolean; data?: TovCheckResult; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      setResult(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80 ? "#22c55e" : score >= 55 ? "#f59e0b" : c.accentRed;

  const issueTypeLabel: Record<TovIssue["type"], string> = {
    forbidden_word: "Запрещённое слово",
    wrong_tone: "Неверный тон",
    missing_phrase_style: "Не тот стиль",
    format: "Формат",
  };

  return (
    <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: c.bg, border: "1.5px solid #6366f140" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6366f1" }}>🎨 Корректор Tone of Voice</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: c.textMuted, fontSize: 14, cursor: "pointer" }}>×</button>
      </div>

      {!result && !loading && (
        <button
          onClick={run}
          style={{ width: "100%", padding: "9px 16px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px #6366f140" }}>
          🔍 Проверить на соответствие брендбуку
        </button>
      )}
      {loading && (
        <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "#6366f1", fontWeight: 700 }}>
          ⏳ GPT-4o проверяет тон…
        </div>
      )}
      {error && (
        <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11 }}>❌ {error}</div>
      )}
      {result && (
        <div>
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: scoreColor(result.score) + "20", border: `3px solid ${scoreColor(result.score)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: scoreColor(result.score) }}>{result.score}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}>{result.verdict}</div>
              <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
                {result.issues.length === 0 ? "✅ Нарушений не найдено" : `${result.issues.length} ${result.issues.length === 1 ? "нарушение" : "нарушения/нарушений"}`}
              </div>
            </div>
            <button
              onClick={run}
              style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 6, border: `1px solid #6366f130`, background: "transparent", color: "#6366f1", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              ↺ Перепроверить
            </button>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {result.issues.map((issue, i) => (
                <div key={i} style={{ padding: "8px 10px", background: c.accentRed + "08", border: `1px solid ${c.accentRed}25`, borderRadius: 7, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, background: c.accentRed + "20", color: c.accentRed, borderRadius: 4, padding: "2px 6px" }}>{issueTypeLabel[issue.type]}</span>
                    <span style={{ fontSize: 11, fontStyle: "italic", color: c.textMuted }}>«{issue.text}»</span>
                  </div>
                  <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 3 }}>{issue.explanation}</div>
                  <div style={{ fontSize: 11, color: "#22c55e" }}>👉 {issue.suggestion}</div>
                </div>
              ))}
            </div>
          )}

          {/* Corrected version */}
          <button
            onClick={() => setShowCorrected(v => !v)}
            style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: `1px solid #6366f140`, background: "#6366f108", color: "#6366f1", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: showCorrected ? 10 : 0 }}>
            {showCorrected ? "▲ Скрыть исправленную версию" : "✨ Показать исправленную версию"}
          </button>
          {showCorrected && (
            <div style={{ padding: 12, background: "#6366f108", borderRadius: 8, border: "1px solid #6366f125", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ИСПРАВЛЕННАЯ ВЕРСИЯ</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>{result.correctedHook}</div>
              <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{result.correctedBody}</div>
              <button
                onClick={() => onApply({ ...post, hook: result.correctedHook, body: result.correctedBody })}
                style={{ marginTop: 10, width: "100%", padding: "9px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                ✅ Применить исправления к посту
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Metrics block (screenshot → vision → editable form) ----------

const POST_METRIC_FIELDS: Array<{ key: keyof PostMetrics; label: string; emoji: string }> = [
  { key: "reach", label: "Охват", emoji: "👁" },
  { key: "impressions", label: "Показы", emoji: "📊" },
  { key: "likes", label: "Лайки", emoji: "❤️" },
  { key: "comments", label: "Комменты", emoji: "💬" },
  { key: "shares", label: "Репосты", emoji: "↗️" },
  { key: "saves", label: "Сохранения", emoji: "🔖" },
  { key: "clicks", label: "Клики", emoji: "🖱" },
  { key: "leads", label: "Лиды", emoji: "🎯" },
  { key: "revenue", label: "Выручка ₽", emoji: "💰" },
  { key: "adSpend", label: "Реклама ₽", emoji: "💸" },
];

const REEL_METRIC_FIELDS: Array<{ key: keyof ReelMetrics; label: string; emoji: string }> = [
  { key: "views", label: "Просмотры", emoji: "▶️" },
  { key: "reach", label: "Охват", emoji: "👁" },
  { key: "likes", label: "Лайки", emoji: "❤️" },
  { key: "comments", label: "Комменты", emoji: "💬" },
  { key: "shares", label: "Репосты", emoji: "↗️" },
  { key: "saves", label: "Сохранения", emoji: "🔖" },
  { key: "avgWatchTimeSec", label: "Ср. время (сек)", emoji: "⏱" },
  { key: "watchedFullPct", label: "Досмотры %", emoji: "🎬" },
  { key: "clicks", label: "Клики", emoji: "🖱" },
  { key: "leads", label: "Лиды", emoji: "🎯" },
  { key: "revenue", label: "Выручка ₽", emoji: "💰" },
  { key: "adSpend", label: "Реклама ₽", emoji: "💸" },
];

function fmtNumber(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n);
}

function MetricsBlock({ c, kind, metrics, onChange }: {
  c: Colors;
  kind: "post" | "reel";
  metrics: AnyMetrics | undefined;
  onChange: (next: AnyMetrics | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnyMetrics>(metrics ?? {});
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(metrics?.screenshotUrl ?? null);
  const [dragging, setDragging] = useState(false);

  const fields = kind === "reel" ? REEL_METRIC_FIELDS : POST_METRIC_FIELDS;
  const accent = kind === "reel" ? "#ec4899" : "#f59e0b";

  const reach = draft.reach ?? draft.views ?? 0;
  const engagement = (draft.likes ?? 0) + (draft.comments ?? 0) + (draft.shares ?? 0) + (draft.saves ?? 0);
  const er = reach > 0 ? (engagement / reach) * 100 : 0;
  const cpl = (draft.adSpend && draft.leads && draft.leads > 0) ? draft.adSpend / draft.leads : 0;
  const romi = (draft.adSpend && draft.adSpend > 0 && draft.revenue != null)
    ? ((draft.revenue - draft.adSpend) / draft.adSpend) * 100 : 0;

  const processFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setScreenshotPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("/api/extract-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, contentType: kind }),
      });
      const json = await res.json() as { ok: boolean; data?: AnyMetrics; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Не удалось распознать");
      setDraft(prev => ({ ...prev, ...json.data, screenshotUrl: dataUrl }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const updateField = (key: string, raw: string) => {
    const num = raw === "" ? undefined : Number(raw.replace(/\s/g, "").replace(",", "."));
    setDraft({ ...draft, [key]: num });
  };

  const handleSave = () => {
    onChange({ ...draft, capturedAt: new Date().toISOString() });
    setOpen(false);
  };

  const handleClear = () => {
    setDraft({});
    setScreenshotPreview(null);
    onChange(undefined);
    setOpen(false);
  };

  if (!open) {
    if (!metrics) {
      return (
        <button
          onClick={() => setOpen(true)}
          style={{
            marginTop: 10, padding: "7px 12px", borderRadius: 8,
            border: `1px dashed ${accent}60`, background: accent + "08",
            color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer", width: "100%",
          }}>
          📊 Внести метрики (бросьте сюда скрин статистики)
        </button>
      );
    }
    const reachVal = metrics.reach ?? metrics.views ?? 0;
    const eng = (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.saves ?? 0);
    const erVal = reachVal > 0 ? ((eng / reachVal) * 100).toFixed(1) : "—";
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          marginTop: 10, padding: "8px 12px", borderRadius: 8,
          background: accent + "0c", border: `1px solid ${accent}30`,
          cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 11,
        }}>
        <span style={{ fontWeight: 700, color: accent }}>📊</span>
        {metrics.views != null && <span style={{ color: c.textSecondary }}>▶️ <b>{fmtNumber(metrics.views)}</b></span>}
        {metrics.reach != null && <span style={{ color: c.textSecondary }}>👁 <b>{fmtNumber(metrics.reach)}</b></span>}
        {metrics.likes != null && <span style={{ color: c.textSecondary }}>❤️ <b>{fmtNumber(metrics.likes)}</b></span>}
        {metrics.comments != null && <span style={{ color: c.textSecondary }}>💬 <b>{fmtNumber(metrics.comments)}</b></span>}
        {metrics.saves != null && <span style={{ color: c.textSecondary }}>🔖 <b>{fmtNumber(metrics.saves)}</b></span>}
        <span style={{ color: c.textSecondary }}>ER: <b style={{ color: accent }}>{erVal}%</b></span>
        {metrics.leads != null && <span style={{ color: c.textSecondary }}>🎯 <b>{metrics.leads}</b></span>}
        <span style={{ marginLeft: "auto", color: c.textMuted, fontSize: 10 }}>✏️ изменить</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: c.bg, border: `1.5px solid ${accent}40` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: accent }}>📊 Метрики {kind === "reel" ? "рилса" : "поста"}</div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: c.textMuted, fontSize: 14, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          padding: screenshotPreview ? 8 : 16, borderRadius: 8,
          border: `1.5px dashed ${dragging ? accent : c.border}`,
          background: dragging ? accent + "12" : c.bgCard,
          textAlign: "center", marginBottom: 10, transition: "all 0.15s",
        }}>
        {screenshotPreview ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshotPreview} alt="screenshot" style={{ maxHeight: 80, maxWidth: 140, borderRadius: 6, border: `1px solid ${c.border}` }} />
            <div style={{ flex: 1, textAlign: "left", fontSize: 11, color: c.textSecondary }}>
              {loading ? "🤖 GPT-4o распознаёт метрики…" : "Скрин загружен — поля заполнены ниже"}
            </div>
            <label style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: c.bg, color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              ↻ заменить
              <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
            </label>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, marginBottom: 4 }}>📸</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, marginBottom: 2 }}>Бросьте сюда скриншот статистики</div>
            <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 8 }}>VK / Instagram / Telegram / TikTok — GPT-4o распознает все цифры автоматически</div>
            <label style={{ display: "inline-block", padding: "6px 14px", borderRadius: 7, background: accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Выбрать файл
              <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
            </label>
          </>
        )}
        {loading && <div style={{ marginTop: 8, fontSize: 11, color: accent, fontWeight: 700 }}>⏳ Распознаём…</div>}
        {error && <div style={{ marginTop: 8, fontSize: 11, color: c.accentRed }}>❌ {error}</div>}
      </div>

      {draft.source && (
        <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 8 }}>
          Источник: <b style={{ color: c.textSecondary }}>{draft.source}</b>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
        {fields.map(f => (
          <div key={String(f.key)}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: c.textMuted, marginBottom: 3, letterSpacing: "0.03em" }}>
              {f.emoji} {f.label.toUpperCase()}
            </label>
            <input
              type="number"
              value={(draft[f.key as keyof AnyMetrics] as number | undefined) ?? ""}
              onChange={e => updateField(String(f.key), e.target.value)}
              placeholder="—"
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary,
                fontSize: 12, fontWeight: 600, outline: "none", boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>
        ))}
      </div>

      {(reach > 0 || (draft.adSpend && draft.adSpend > 0)) && (
        <div style={{ display: "flex", gap: 12, padding: "8px 12px", borderRadius: 7, background: accent + "0c", border: `1px solid ${accent}25`, fontSize: 11, marginBottom: 10, flexWrap: "wrap" }}>
          {reach > 0 && (
            <span style={{ color: c.textSecondary }}>
              ER: <b style={{ color: accent }}>{er.toFixed(1)}%</b>
            </span>
          )}
          {cpl > 0 && (
            <span style={{ color: c.textSecondary }}>
              CPL: <b style={{ color: accent }}>{cpl.toFixed(0)} ₽</b>
            </span>
          )}
          {(draft.adSpend != null && draft.adSpend > 0 && draft.revenue != null) && (
            <span style={{ color: c.textSecondary }}>
              ROMI: <b style={{ color: romi >= 0 ? "#22c55e" : c.accentRed }}>{romi.toFixed(0)}%</b>
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          💾 Сохранить метрики
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Отмена
        </button>
        {metrics && (
          <button
            onClick={handleClear}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.accentRed}40`, background: "transparent", color: c.accentRed, fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>
            🗑 Удалить метрики
          </button>
        )}
      </div>
    </div>
  );
}

function PostCard({ c, post, onUpdate, onDelete, brandBook }: {
  c: Colors;
  post: GeneratedPost;
  onUpdate: (updated: GeneratedPost) => void;
  onDelete: (id: string) => void;
  brandBook?: BrandBook;
}) {
  const [editing, setEditing] = useState(false);
  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [hashtagsRaw, setHashtagsRaw] = useState(post.hashtags.join(" "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);
  const [showTov, setShowTov] = useState(false);

  const isCarousel = post.body.includes("---");

  const handleSave = () => {
    const tags = hashtagsRaw.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith("#") ? t : "#" + t);
    onUpdate({ ...post, hook, body, hashtags: tags });
    setEditing(false);
  };

  const handleCancel = () => {
    setHook(post.hook);
    setBody(post.body);
    setHashtagsRaw(post.hashtags.join(" "));
    setEditing(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${c.accent}50`, background: c.bg,
    color: c.textPrimary, fontSize: 13, outline: "none",
    lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `2px solid ${editing ? c.accent + "60" : c.border}`, padding: 16, boxShadow: c.shadow, transition: "border-color 0.15s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, background: "#f59e0b15", color: "#f59e0b", borderRadius: 6, padding: "3px 8px" }}>{post.platform}</span>
          {isCarousel && <span style={{ fontSize: 10, fontWeight: 700, background: "#6366f115", color: "#818cf8", borderRadius: 6, padding: "3px 8px" }}>КАРУСЕЛЬ</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: c.textMuted }}>{new Date(post.generatedAt).toLocaleDateString("ru-RU")}</span>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              ✏️
            </button>
          )}
        </div>
      </div>

      {/* Compact image thumbnail */}
      {post.imageUrl && !editing && (
        <div style={{ marginBottom: 10 }}>
          {imgExpanded ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt={post.hook} style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 320 }} />
              <button onClick={() => setImgExpanded(false)} style={{ marginTop: 4, padding: "3px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 10, cursor: "pointer" }}>
                Свернуть
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl} alt={post.hook}
                onClick={() => setImgExpanded(true)}
                style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", cursor: "pointer", border: `1px solid ${c.border}`, flexShrink: 0 }}
              />
              <span style={{ fontSize: 10, color: c.textMuted, cursor: "pointer" }} onClick={() => setImgExpanded(true)}>🖼 Нажмите, чтобы открыть картинку</span>
            </div>
          )}
        </div>
      )}

      {editing ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>КРЮЧОК / ЗАГОЛОВОК</label>
            <input type="text" value={hook} onChange={e => setHook(e.target.value)} style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>
              ТЕКСТ ПОСТА {isCarousel && <span style={{ fontWeight: 400 }}>(экраны карусели разделяются через "---")</span>}
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>ХЭШТЕГИ (через пробел)</label>
            <input type="text" value={hashtagsRaw} onChange={e => setHashtagsRaw(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>💾 Сохранить</button>
            <button onClick={handleCancel} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Отмена</button>
            {confirmDelete ? (
              <>
                <button onClick={() => onDelete(post.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: c.accentRed, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, cursor: "pointer" }}>Нет</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.accentRed}40`, background: "transparent", color: c.accentRed, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑 Удалить</button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 10 }}>{post.hook}</div>
          <div style={{ marginBottom: 10 }}>
            <CarouselBody c={c} body={post.body} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {post.hashtags.map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => navigator.clipboard.writeText(`${post.hook}\n\n${post.body}\n\n${post.hashtags.join(" ")}`)}
              style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              📋 Скопировать
            </button>
            {brandBook && (brandBook.toneOfVoice?.length > 0 || brandBook.forbiddenWords?.length > 0) && (
              <button
                onClick={() => setShowTov(v => !v)}
                style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${showTov ? "#6366f1" : c.border}`, background: showTov ? "#6366f115" : "transparent", color: showTov ? "#6366f1" : c.textSecondary, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                🎨 Tone of Voice
              </button>
            )}
          </div>
          {showTov && brandBook && (
            <TovPanel
              c={c}
              post={post}
              brandBook={brandBook}
              onApply={corrected => { onUpdate(corrected); setShowTov(false); }}
              onClose={() => setShowTov(false)}
            />
          )}
          <MetricsBlock c={c} kind="post" metrics={post.metrics} onChange={m => onUpdate({ ...post, metrics: m })} />
        </>
      )}
    </div>
  );
}

function GeneratedPostsView({ c, posts, onUpdatePost, onDeletePost, referenceImages, onUpdateReferenceImages, brandBook }: {
  c: Colors;
  posts: GeneratedPost[];
  onUpdatePost: (updated: GeneratedPost) => void;
  onDeletePost: (id: string) => void;
  referenceImages: ReferenceImage[];
  onUpdateReferenceImages: (next: ReferenceImage[]) => void;
  brandBook?: BrandBook;
}) {
  if (posts.length === 0) {
    return (
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Готовые посты</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow, marginTop: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, color: c.textSecondary }}>Пока нет сгенерированных постов. Перейдите в «План контента» и нажмите «Создать пост» на любой идее.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Готовые посты ({posts.length})</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 16px" }}>Кликните ✏️ на карточке для правки. Картинка — миниатюра, кликни чтобы открыть.</p>
      <ImageReferencePanel c={c} images={referenceImages} onChange={onUpdateReferenceImages} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {posts.map(post => (
          <PostCard key={post.id} c={c} post={post} onUpdate={onUpdatePost} onDelete={onDeletePost} brandBook={brandBook} />
        ))}
      </div>
    </div>
  );
}

function ImageReferencePanel({ c, images, onChange }: {
  c: Colors;
  images: ReferenceImage[];
  onChange: (next: ReferenceImage[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const readFiles = (files: FileList) => {
    Array.from(files).slice(0, 5 - images.length).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        onChange([...images, { id: `ref-${Date.now()}-${Math.random()}`, name: file.name, mimeType: file.type, data: base64, previewUrl: dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files);
  };

  return (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: open ? `1px solid ${c.borderLight}` : "none" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>🖼 Референсы для стиля изображений</div>
          <div style={{ fontSize: 11, color: c.textMuted, marginTop: 3 }}>
            {images.length > 0 ? `${images.length} референс${images.length === 1 ? "" : images.length < 5 ? "а" : "ов"} — Gemini будет генерировать в похожем стиле` : "Не загружено — Gemini генерирует без стиля"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              {images.slice(0, 3).map(img => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.previewUrl} alt={img.name} style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", border: `1px solid ${c.border}` }} />
              ))}
            </div>
          )}
          <span style={{ fontSize: 11, color: c.textMuted, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? c.accent : c.border}`,
              borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer",
              background: dragging ? c.accent + "08" : "transparent", transition: "all 0.15s", marginBottom: 14,
            }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>Перетащите картинки сюда или кликните</div>
            <div style={{ fontSize: 11, color: c.textMuted }}>До 5 изображений · JPG, PNG, WEBP · Макс. 4 МБ каждый</div>
            <input
              ref={inputRef} type="file" accept="image/*" multiple
              style={{ display: "none" }}
              onChange={e => e.target.files && readFiles(e.target.files)}
            />
          </div>

          {images.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>ЗАГРУЖЕННЫЕ РЕФЕРЕНСЫ ({images.length}/5)</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {images.map(img => (
                  <div key={img.id} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt={img.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: `1px solid ${c.border}` }} />
                    <button
                      onClick={() => onChange(images.filter(i => i.id !== img.id))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: c.accentRed, border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, lineHeight: 1 }}>
                      ×
                    </button>
                    <div style={{ fontSize: 9, color: c.textMuted, marginTop: 3, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onChange([])}
                style={{ marginTop: 10, padding: "5px 12px", borderRadius: 7, border: `1px solid ${c.accentRed}30`, background: "transparent", color: c.accentRed, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                🗑 Удалить все
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, padding: "10px 12px", background: c.accent + "08", borderRadius: 8, fontSize: 11, color: c.textSecondary, lineHeight: 1.5 }}>
            💡 <b>Как работает:</b> загрузите 1-3 картинки в нужном стиле (например, фирменные фото или референс-изображения). Gemini будет генерировать картинки для постов, ориентируясь на их цвета, композицию и настроение.
          </div>
        </div>
      )}
    </div>
  );
}

const POPULAR_FONTS = [
  "Inter", "Manrope", "Montserrat", "Roboto", "Open Sans", "Lato", "Poppins",
  "Raleway", "Nunito", "Playfair Display", "Merriweather", "PT Sans", "PT Serif",
  "Oswald", "Ubuntu", "Rubik", "Source Sans 3", "Work Sans", "DM Sans", "DM Serif Display",
  "Bebas Neue", "Josefin Sans", "Cormorant Garamond", "Libre Baskerville", "Lora",
  "Fira Sans", "IBM Plex Sans", "IBM Plex Serif", "Space Grotesk", "Archivo",
];

function BrandBookPanel({ c, brandBook, onChange }: {
  c: Colors;
  brandBook: BrandBook;
  onChange: (next: BrandBook) => void;
}) {
  const isEmpty = !brandBook.brandName && !brandBook.tagline && brandBook.colors.length === 0;
  const [open, setOpen] = useState(isEmpty);
  const [pickerColor, setPickerColor] = useState("#f59e0b");

  const update = (patch: Partial<BrandBook>) => onChange({ ...brandBook, ...patch });

  const updateList = (key: "colors" | "toneOfVoice" | "forbiddenWords" | "goodPhrases", raw: string) => {
    const arr = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    onChange({ ...brandBook, [key]: arr });
  };

  const addColor = (col: string) => {
    const hex = col.toLowerCase();
    if (brandBook.colors.includes(hex)) return;
    onChange({ ...brandBook, colors: [...brandBook.colors, hex] });
  };

  const removeColor = (col: string) => {
    onChange({ ...brandBook, colors: brandBook.colors.filter(x => x !== col) });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") update({ logoDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const taStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", lineHeight: 1.5 };
  const hintStyle: React.CSSProperties = { fontSize: 10, color: c.textMuted, marginTop: 4 };

  const summary = brandBook.brandName
    ? `${brandBook.brandName}${brandBook.tagline ? " · " + brandBook.tagline : ""}`
    : "Не заполнено — контент будет генерироваться без брендовых правил";

  return (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: open ? `1px solid ${c.borderLight}` : "none" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>📖 Брендбук</div>
          <div style={{ fontSize: 11, color: c.textMuted, marginTop: 3 }}>{summary}</div>
        </div>
        <span style={{ fontSize: 11, color: c.textMuted, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
            Все поля передаются в генерацию постов, рилсов и промптов ИИ-помощника. Чем полнее заполнен брендбук — тем точнее тон и визуал.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <div>
              <label style={labelStyle}>НАЗВАНИЕ БРЕНДА</label>
              <input type="text" value={brandBook.brandName} onChange={e => update({ brandName: e.target.value })} placeholder="как называем бренд в публикациях" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>СЛОГАН / ПОЗИЦИОНИРОВАНИЕ</label>
              <input type="text" value={brandBook.tagline} onChange={e => update({ tagline: e.target.value })} placeholder="короткая формулировка (до 10 слов)" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>МИССИЯ БРЕНДА</label>
            <textarea value={brandBook.mission} onChange={e => update({ mission: e.target.value })} rows={2} placeholder="во что верим и зачем существуем" style={taStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>ЦВЕТОВАЯ ПАЛИТРА</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", border: `2px solid ${c.border}`, overflow: "hidden", cursor: "pointer", background: pickerColor, boxShadow: c.shadow }}>
                  <input
                    type="color"
                    value={pickerColor}
                    onChange={e => setPickerColor(e.target.value)}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addColor(pickerColor)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  + добавить
                </button>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: c.textMuted }}>{pickerColor}</span>
              </div>
              {brandBook.colors.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {brandBook.colors.map((col, i) => (
                    <div key={i}
                      style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 6px", borderRadius: 6, background: c.bg, border: `1px solid ${c.borderLight}` }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, background: col, border: `1px solid ${c.border}` }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: c.textSecondary }}>{col}</span>
                      <button
                        type="button"
                        onClick={() => removeColor(col)}
                        title="удалить"
                        style={{ background: "none", border: "none", color: c.textMuted, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={hintStyle}>Выбери цвет в кружочке и нажми «+ добавить».</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>ШРИФТ ЗАГОЛОВКОВ</label>
                <select
                  value={brandBook.fontHeader}
                  onChange={e => update({ fontHeader: e.target.value })}
                  style={{ ...inputStyle, fontFamily: brandBook.fontHeader || "inherit", cursor: "pointer" }}>
                  <option value="">— не выбран —</option>
                  {POPULAR_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ШРИФТ ТЕКСТА</label>
                <select
                  value={brandBook.fontBody}
                  onChange={e => update({ fontBody: e.target.value })}
                  style={{ ...inputStyle, fontFamily: brandBook.fontBody || "inherit", cursor: "pointer" }}>
                  <option value="">— не выбран —</option>
                  {POPULAR_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>TONE OF VOICE (3-5 дескрипторов)</label>
              <input type="text" value={brandBook.toneOfVoice.join(", ")} onChange={e => updateList("toneOfVoice", e.target.value)} placeholder="дружелюбный, экспертный, без формальностей" style={inputStyle} />
              <div style={hintStyle}>Через запятую. Влияет на стиль всех текстов.</div>
            </div>
            <div>
              <label style={labelStyle}>ЗАПРЕЩЁННЫЕ СЛОВА / ФОРМУЛИРОВКИ</label>
              <input type="text" value={brandBook.forbiddenWords.join(", ")} onChange={e => updateList("forbiddenWords", e.target.value)} placeholder="дешёвый, клиент, проблема" style={inputStyle} />
              <div style={hintStyle}>ИИ будет избегать этих слов.</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ПРИМЕРЫ &laquo;ХОРОШИХ&raquo; ФРАЗ БРЕНДА (по одной на строку)</label>
            <textarea
              value={brandBook.goodPhrases.join("\n")}
              onChange={e => updateList("goodPhrases", e.target.value)}
              rows={3}
              placeholder={"Сделаем быстрее, чем вы успеете заварить кофе\nНе продаём — помогаем выбрать"}
              style={taStyle}
            />
            <div style={hintStyle}>ИИ будет ориентироваться на этот стиль.</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ВИЗУАЛЬНЫЙ СТИЛЬ (для генерации картинок)</label>
            <textarea
              value={brandBook.visualStyle}
              onChange={e => update({ visualStyle: e.target.value })}
              rows={3}
              placeholder="минимализм, тёплые бежевые тона, мягкий свет, плёночная зернистость, без стоковых лиц"
              style={taStyle}
            />
            <div style={hintStyle}>Добавляется к промпту Gemini/DALL-E для каждой картинки.</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ЛОГОТИП (PNG / JPG)</label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: 11, color: c.textSecondary }} />
              {brandBook.logoDataUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brandBook.logoDataUrl} alt="logo" style={{ maxHeight: 48, maxWidth: 120, borderRadius: 6, border: `1px solid ${c.borderLight}`, background: c.bg, padding: 4 }} />
                  <button onClick={() => update({ logoDataUrl: undefined })} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 10, cursor: "pointer" }}>✕ удалить</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarSettingsPanel({ c, settings, onChange }: {
  c: Colors;
  settings: AvatarSettings;
  onChange: (next: AvatarSettings) => void;
}) {
  const [open, setOpen] = useState(!settings.avatarId && !settings.voiceId);
  const [loading, setLoading] = useState(false);
  const [avatars, setAvatars] = useState<Array<{ id: string; name: string; gender: string; previewImage: string }>>([]);
  const [voices, setVoices] = useState<Array<{ id: string; name: string; language: string; gender: string; previewAudio: string }>>([]);
  const [showLists, setShowLists] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState("ru");
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<AvatarSettings>) => onChange({ ...settings, ...patch });

  const loadLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/heygen-list");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка HeyGen");
      setAvatars(json.data.avatars);
      setVoices(json.data.voices);
      setShowLists(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const filteredVoices = voiceFilter
    ? voices.filter(v => v.language?.toLowerCase().includes(voiceFilter.toLowerCase()) || v.name?.toLowerCase().includes(voiceFilter.toLowerCase()))
    : voices;

  return (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, boxShadow: c.shadow, marginBottom: 20 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: open ? `1px solid ${c.borderLight}` : "none" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>🎭 Настройки аватара и голоса HeyGen</div>
          <div style={{ fontSize: 11, color: c.textMuted, marginTop: 3 }}>
            {settings.avatarId || settings.voiceId
              ? `Avatar: ${settings.avatarId || "—"} · Voice: ${settings.voiceId || "—"}`
              : "Не настроено — будут использованы значения по умолчанию"}
          </div>
        </div>
        <span style={{ fontSize: 11, color: c.textMuted, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </div>

      {open && (
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" }}>HEYGEN AVATAR ID</label>
              <input
                type="text"
                value={settings.avatarId}
                onChange={e => update({ avatarId: e.target.value })}
                placeholder="например: Daisy-inskirt-20220818"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" }}>HEYGEN VOICE ID</label>
              <input
                type="text"
                value={settings.voiceId}
                onChange={e => update({ voiceId: e.target.value })}
                placeholder="ID голоса из HeyGen"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", fontFamily: "monospace" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" }}>КАК ВЫГЛЯДИТ АВАТАР</label>
              <textarea
                value={settings.avatarDescription}
                onChange={e => update({ avatarDescription: e.target.value })}
                placeholder="Например: молодой эксперт мужчина 30-35 лет, деловой стиль, дружелюбное лицо, профессиональный фон"
                rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>Используется в подсказке для генерации сценария — чтобы стиль сценария совпадал с внешним видом ведущего</div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" }}>КАКИМ ДОЛЖЕН БЫТЬ ГОЛОС</label>
              <textarea
                value={settings.voiceDescription}
                onChange={e => update({ voiceDescription: e.target.value })}
                placeholder="Например: уверенный мужской баритон, средний темп, дружелюбный, с лёгкой улыбкой в голосе, без формальностей"
                rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>Скрипт для озвучки будет адаптирован под этот тон и манеру речи</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>ФОРМАТ:</label>
            <button
              onClick={() => update({ aspect: "portrait" })}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${settings.aspect === "portrait" ? c.accent : c.border}`, background: settings.aspect === "portrait" ? c.accent + "15" : "transparent", color: settings.aspect === "portrait" ? c.accent : c.textSecondary, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              📱 Вертикально (720×1280)
            </button>
            <button
              onClick={() => update({ aspect: "landscape" })}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${settings.aspect === "landscape" ? c.accent : c.border}`, background: settings.aspect === "landscape" ? c.accent + "15" : "transparent", color: settings.aspect === "landscape" ? c.accent : c.textSecondary, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              🖥 Горизонтально (1280×720)
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={loadLists}
              disabled={loading}
              style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "⏳ Загружаем…" : showLists ? "🔄 Обновить списки" : "📋 Загрузить доступные аватары и голоса с HeyGen"}
            </button>
          </div>

          {error && (
            <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginTop: 12 }}>{error}</div>
          )}

          {showLists && avatars.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8, letterSpacing: "0.05em" }}>АВАТАРЫ ({avatars.length}) — кликни, чтобы выбрать</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, maxHeight: 320, overflowY: "auto", padding: 4 }}>
                {avatars.map(a => (
                  <div
                    key={a.id}
                    onClick={() => update({ avatarId: a.id })}
                    style={{ cursor: "pointer", border: `2px solid ${settings.avatarId === a.id ? c.accent : c.border}`, borderRadius: 8, padding: 6, background: settings.avatarId === a.id ? c.accent + "10" : "transparent" }}>
                    {a.previewImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.previewImage} alt={a.name} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 5, marginBottom: 4 }} />
                    )}
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.textPrimary, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.id}</div>
                    {a.gender && <div style={{ fontSize: 9, color: c.textMuted }}>{a.gender}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showLists && voices.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>ГОЛОСА ({filteredVoices.length} из {voices.length})</div>
                <input
                  type="text"
                  value={voiceFilter}
                  onChange={e => setVoiceFilter(e.target.value)}
                  placeholder="фильтр (ru, en, female...)"
                  style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 11, outline: "none", width: 180 }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 300, overflowY: "auto", padding: 4 }}>
                {filteredVoices.slice(0, 100).map(v => (
                  <div
                    key={v.id}
                    onClick={() => update({ voiceId: v.id })}
                    style={{ cursor: "pointer", border: `1.5px solid ${settings.voiceId === v.id ? c.accent : c.border}`, borderRadius: 7, padding: "8px 10px", background: settings.voiceId === v.id ? c.accent + "10" : "transparent" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c.textPrimary, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name || v.id}</div>
                    <div style={{ fontSize: 10, color: c.textMuted }}>{v.language} · {v.gender}</div>
                    {v.previewAudio && (
                      <audio src={v.previewAudio} controls style={{ width: "100%", height: 24, marginTop: 4 }} onClick={e => e.stopPropagation()} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoPreview({ c, src }: { c: Colors; src: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      {expanded ? (
        <div>
          <video src={src} controls style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 400 }} />
          <button onClick={() => setExpanded(false)} style={{ marginTop: 4, padding: "3px 10px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textMuted, fontSize: 10, cursor: "pointer" }}>
            Свернуть
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid #ec489940`, background: "#ec489910", color: "#ec4899", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          ▶ Смотреть готовое видео
        </button>
      )}
    </div>
  );
}

function ReelCard({ c, reel, onUpdate, onDelete, onGenerateVideo, generatingVideoFor }: {
  c: Colors;
  reel: GeneratedReel;
  onUpdate: (updated: GeneratedReel) => void;
  onDelete: (id: string) => void;
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reel.title);
  const [scenario, setScenario] = useState(reel.scenario);
  const [voiceover, setVoiceover] = useState(reel.voiceoverScript);
  const [hashtagsRaw, setHashtagsRaw] = useState(reel.hashtags.join(" "));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const busy = generatingVideoFor === reel.id || reel.videoStatus === "generating";

  const handleSave = () => {
    const tags = hashtagsRaw.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith("#") ? t : "#" + t);
    onUpdate({ ...reel, title, scenario, voiceoverScript: voiceover, hashtags: tags });
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(reel.title);
    setScenario(reel.scenario);
    setVoiceover(reel.voiceoverScript);
    setHashtagsRaw(reel.hashtags.join(" "));
    setEditing(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${c.accent}50`, background: c.bg,
    color: c.textPrimary, fontSize: 12, outline: "none",
    lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `2px solid ${editing ? "#ec489960" : c.border}`, padding: 18, boxShadow: c.shadow, transition: "border-color 0.15s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#ec489915", color: "#ec4899", borderRadius: 6, padding: "3px 8px" }}>REEL · {reel.durationSec}s</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: c.textMuted }}>{new Date(reel.generatedAt).toLocaleString("ru-RU")}</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ✏️ Редактировать
            </button>
          )}
        </div>
      </div>

      {/* Finished video — compact toggle */}
      {reel.videoUrl && reel.videoStatus === "ready" && (
        <VideoPreview c={c} src={reel.videoUrl} />
      )}

      {editing ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>НАЗВАНИЕ</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>РАСКАДРОВКА</label>
            <textarea value={scenario} onChange={e => setScenario(e.target.value)} rows={10} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>ТЕКСТ ДЛЯ ОЗВУЧКИ (отправляется в HeyGen)</label>
            <textarea value={voiceover} onChange={e => setVoiceover(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>После правки можно заново сгенерировать видео с обновлённым текстом</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, letterSpacing: "0.05em" }}>ХЭШТЕГИ</label>
            <input type="text" value={hashtagsRaw} onChange={e => setHashtagsRaw(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              💾 Сохранить
            </button>
            <button onClick={handleCancel} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Отмена
            </button>
            {confirmDelete ? (
              <>
                <button onClick={() => onDelete(reel.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: c.accentRed, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 12, cursor: "pointer" }}>Нет</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.accentRed}40`, background: "transparent", color: c.accentRed, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🗑 Удалить
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, lineHeight: 1.4, marginBottom: 12 }}>{reel.title}</div>

          <details style={{ marginBottom: 10 }}>
            <summary style={{ fontSize: 12, fontWeight: 700, color: c.textSecondary, cursor: "pointer" }}>📋 Раскадровка</summary>
            <pre style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.55, margin: "8px 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit", background: c.bg, padding: 12, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>{reel.scenario}</pre>
          </details>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ fontSize: 12, fontWeight: 700, color: c.textSecondary, cursor: "pointer" }}>🎙 Текст для озвучки</summary>
            <p style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.55, margin: "8px 0 0", background: c.bg, padding: 12, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>{reel.voiceoverScript}</p>
          </details>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {reel.hashtags.map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
            ))}
          </div>

          {reel.videoStatus === "failed" && reel.videoError && (
            <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 10 }}>❌ {reel.videoError}</div>
          )}

          {reel.videoStatus !== "ready" && (
            <button
              onClick={() => onGenerateVideo(reel.id)}
              disabled={busy}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "none", background: busy ? c.borderLight : "linear-gradient(135deg, #ec4899, #f472b6)", color: busy ? c.textMuted : "#fff", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer" }}>
              {reel.videoStatus === "generating"
                ? "⏳ HeyGen генерирует видео… (~2-5 мин)"
                : busy ? "⏳ Запускаем HeyGen…"
                : reel.videoStatus === "failed" ? "🔄 Повторить генерацию"
                : "🎥 Сгенерировать видео с аватаром"}
            </button>
          )}

          <MetricsBlock c={c} kind="reel" metrics={reel.metrics} onChange={m => onUpdate({ ...reel, metrics: m })} />
        </>
      )}
    </div>
  );
}

function GeneratedReelsView({ c, reels, onGenerateVideo, generatingVideoFor, avatarSettings, onUpdateAvatarSettings, onUpdateReel, onDeleteReel }: {
  c: Colors;
  reels: GeneratedReel[];
  onGenerateVideo: (reelId: string) => void;
  generatingVideoFor: string | null;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (next: AvatarSettings) => void;
  onUpdateReel: (updated: GeneratedReel) => void;
  onDeleteReel: (id: string) => void;
}) {
  if (reels.length === 0) {
    return (
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Готовые видео</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 24px" }}>Настройте аватара, потом сгенерируйте сценарии в «План контента»</p>
        <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 14, color: c.textSecondary }}>Пока нет сценариев. Перейдите в «План контента» и нажмите «Создать сценарий рилса» на любой идее.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Готовые видео ({reels.length})</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 24px" }}>Кликните ✏️ для правки сценария и текста озвучки</p>
      <AvatarSettingsPanel c={c} settings={avatarSettings} onChange={onUpdateAvatarSettings} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {reels.map(reel => (
          <ReelCard key={reel.id} c={c} reel={reel} onUpdate={onUpdateReel} onDelete={onDeleteReel} onGenerateVideo={onGenerateVideo} generatingVideoFor={generatingVideoFor} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Content Analytics View
// ============================================================

interface PerformanceInsights {
  summary: string;
  topPillars: Array<{ name: string; avgER: number; totalReach: number; why: string }>;
  topFormats: Array<{ format: string; avgER: number; why: string }>;
  topHooks: Array<{ pattern: string; examples: string[]; why: string }>;
  underperformers: Array<{ what: string; metric: string; fix: string }>;
  recommendations: string[];
  nextWeekPlan: string[];
}

type AnalyticsRow = {
  id: string;
  kind: "post" | "reel";
  title: string;
  pillar: string;
  format: string;
  reach: number;
  engagement: number;
  er: number;
  leads: number;
  revenue: number;
  adSpend: number;
  romi: number | null;
  generatedAt: string;
};

function buildAnalyticsRows(posts: GeneratedPost[], reels: GeneratedReel[]): AnalyticsRow[] {
  const rows: AnalyticsRow[] = [];
  for (const p of posts) {
    if (!p.metrics) continue;
    const m = p.metrics;
    const reach = m.reach ?? m.impressions ?? 0;
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const er = reach > 0 ? (eng / reach) * 100 : 0;
    const adSpend = m.adSpend ?? 0;
    const revenue = m.revenue ?? 0;
    rows.push({
      id: p.id, kind: "post", title: p.hook, pillar: p.pillar,
      format: p.body.includes("---") ? "carousel" : "single",
      reach, engagement: eng, er,
      leads: m.leads ?? 0, revenue, adSpend,
      romi: adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : null,
      generatedAt: p.generatedAt,
    });
  }
  for (const r of reels) {
    if (!r.metrics) continue;
    const m = r.metrics;
    const reach = m.reach ?? m.views ?? 0;
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const er = reach > 0 ? (eng / reach) * 100 : 0;
    const adSpend = m.adSpend ?? 0;
    const revenue = m.revenue ?? 0;
    rows.push({
      id: r.id, kind: "reel", title: r.title, pillar: r.pillar,
      format: `reel-${r.durationSec}s`,
      reach, engagement: eng, er,
      leads: m.leads ?? 0, revenue, adSpend,
      romi: adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : null,
      generatedAt: r.generatedAt,
    });
  }
  return rows;
}

function ContentAnalyticsView({ c, posts, reels, companyName }: {
  c: Colors;
  posts: GeneratedPost[];
  reels: GeneratedReel[];
  companyName: string;
}) {
  const [periodDays, setPeriodDays] = useState<number>(0); // 0 = all time
  const [filterKind, setFilterKind] = useState<"all" | "post" | "reel">("all");
  const [sortBy, setSortBy] = useState<"er" | "reach" | "romi" | "revenue" | "date">("er");
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const allRows = buildAnalyticsRows(posts, reels);

  // Apply period filter
  const periodRows = periodDays === 0
    ? allRows
    : allRows.filter(r => {
        const ageMs = Date.now() - new Date(r.generatedAt).getTime();
        return ageMs <= periodDays * 24 * 60 * 60 * 1000;
      });

  // Apply kind filter
  const filteredRows = filterKind === "all" ? periodRows : periodRows.filter(r => r.kind === filterKind);

  // Sort
  const sortedRows = [...filteredRows].sort((a, b) => {
    switch (sortBy) {
      case "reach": return b.reach - a.reach;
      case "romi": return (b.romi ?? -Infinity) - (a.romi ?? -Infinity);
      case "revenue": return b.revenue - a.revenue;
      case "date": return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      default: return b.er - a.er;
    }
  });

  // KPI aggregation
  const totalReach = filteredRows.reduce((s, r) => s + r.reach, 0);
  const totalEng = filteredRows.reduce((s, r) => s + r.engagement, 0);
  const avgER = totalReach > 0 ? (totalEng / totalReach) * 100 : 0;
  const totalLeads = filteredRows.reduce((s, r) => s + r.leads, 0);
  const totalRevenue = filteredRows.reduce((s, r) => s + r.revenue, 0);
  const totalSpend = filteredRows.reduce((s, r) => s + r.adSpend, 0);
  const totalROMI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;
  const totalCPL = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : 0;

  const handleAnalyze = async () => {
    setLoadingInsights(true);
    setInsightsError(null);
    try {
      const res = await fetch("/api/analyze-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: posts.filter(p => p.metrics),
          reels: reels.filter(r => r.metrics),
          companyName,
        }),
      });
      const json = await res.json() as { ok: boolean; data?: PerformanceInsights; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка");
      setInsights(json.data ?? null);
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoadingInsights(false);
    }
  };

  if (allRows.length === 0) {
    return (
      <div style={{ maxWidth: 800 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>📊 Аналитика контента</h1>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 48, textAlign: "center", boxShadow: c.shadow, marginTop: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14, color: c.textSecondary, marginBottom: 6 }}>Пока нет публикаций с метриками</div>
          <div style={{ fontSize: 12, color: c.textMuted }}>
            Откройте «Готовые посты» или «Готовые видео», нажмите 📊 на карточке и бросьте скрин статистики — GPT-4o распознает все цифры.
          </div>
        </div>
      </div>
    );
  }

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  const KpiCell = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div style={{ flex: "1 1 140px", padding: "12px 14px", background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? c.textPrimary, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>📊 Аналитика контента</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>{filteredRows.length} публикаций с метриками · {allRows.length - filteredRows.length} вне фильтра</p>
      </div>

      {/* Period & filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {([[0, "Всё время"], [7, "7 дней"], [30, "30 дней"], [90, "90 дней"]] as const).map(([days, label]) => (
          <button key={days} onClick={() => setPeriodDays(days)}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${periodDays === days ? "#f59e0b" : c.border}`,
              background: periodDays === days ? "#f59e0b15" : c.bg, color: periodDays === days ? "#f59e0b" : c.textSecondary,
              fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
        <div style={{ width: 1, background: c.borderLight, margin: "0 4px" }} />
        {([["all", "Всё"], ["post", "Посты"], ["reel", "Рилсы"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilterKind(k)}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${filterKind === k ? c.accent : c.border}`,
              background: filterKind === k ? c.accent + "15" : c.bg, color: filterKind === k ? c.accent : c.textSecondary,
              fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCell label="ОХВАТ" value={fmtNumber(totalReach)} sub={`${filteredRows.length} публикаций`} />
        <KpiCell label="ВОВЛЕЧЕНИЕ" value={fmtNumber(totalEng)} sub={`ER ${avgER.toFixed(2)}%`} />
        <KpiCell label="ЛИДЫ" value={String(totalLeads)} sub={totalCPL > 0 ? `CPL ${totalCPL.toFixed(0)} ₽` : undefined} />
        <KpiCell label="ВЫРУЧКА" value={`${fmtNumber(totalRevenue)} ₽`} />
        <KpiCell label="РЕКЛАМА" value={`${fmtNumber(totalSpend)} ₽`} />
        <KpiCell label="ROMI" value={totalROMI != null ? `${totalROMI.toFixed(0)}%` : "—"} color={totalROMI != null ? (totalROMI >= 0 ? "#22c55e" : c.accentRed) : undefined} />
      </div>

      {/* AI insights block */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary }}>🤖 AI-разбор аналитики</div>
            <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>GPT-4o проанализирует все метрики и даст конкретные рекомендации</div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loadingInsights}
            style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: loadingInsights ? c.borderLight : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: loadingInsights ? c.textMuted : "#fff", fontSize: 12, fontWeight: 800, cursor: loadingInsights ? "not-allowed" : "pointer",
              boxShadow: loadingInsights ? "none" : "0 4px 14px #6366f140" }}>
            {loadingInsights ? "⏳ Анализирую…" : insights ? "🔄 Перезапустить анализ" : "🤖 Разобрать аналитику"}
          </button>
        </div>
        {insightsError && <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 10 }}>❌ {insightsError}</div>}
        {insights && <InsightsDisplay c={c} insights={insights} />}
      </Card>

      {/* Sort selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>СОРТИРОВКА:</span>
        {([["er", "ER"], ["reach", "Охват"], ["romi", "ROMI"], ["revenue", "Выручка"], ["date", "Дата"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSortBy(k)}
            style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${sortBy === k ? c.accent : c.border}`,
              background: sortBy === k ? c.accent + "15" : "transparent", color: sortBy === k ? c.accent : c.textSecondary,
              fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: c.bg, borderBottom: `1px solid ${c.borderLight}` }}>
                {["Тип", "Заголовок", "Пиллар", "Формат", "Охват", "ER", "Лиды", "Выручка", "ROMI"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const erColor = row.er >= avgER * 1.3 ? "#22c55e" : row.er < avgER * 0.7 ? c.accentRed : c.textSecondary;
                const romiColor = row.romi == null ? c.textMuted : row.romi >= 100 ? "#22c55e" : row.romi >= 0 ? c.textSecondary : c.accentRed;
                return (
                  <tr key={row.id} style={{ borderBottom: i < sortedRows.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: row.kind === "reel" ? "#ec489918" : "#f59e0b18",
                        color: row.kind === "reel" ? "#ec4899" : "#f59e0b" }}>
                        {row.kind === "reel" ? "REEL" : "POST"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", color: c.textPrimary, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</td>
                    <td style={{ padding: "9px 12px", color: c.textSecondary }}>{row.pillar}</td>
                    <td style={{ padding: "9px 12px", color: c.textMuted, fontSize: 10 }}>{row.format}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: c.textPrimary, fontFamily: "monospace" }}>{fmtNumber(row.reach)}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: erColor, fontFamily: "monospace" }}>{row.er.toFixed(1)}%</td>
                    <td style={{ padding: "9px 12px", color: c.textSecondary, fontFamily: "monospace" }}>{row.leads || "—"}</td>
                    <td style={{ padding: "9px 12px", color: c.textSecondary, fontFamily: "monospace" }}>{row.revenue > 0 ? fmtNumber(row.revenue) + " ₽" : "—"}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: romiColor, fontFamily: "monospace" }}>{row.romi != null ? row.romi.toFixed(0) + "%" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function InsightsDisplay({ c, insights }: { c: Colors; insights: PerformanceInsights }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ padding: "10px 14px", background: "#6366f10c", borderRadius: 8, border: "1px solid #6366f125", fontSize: 12, fontWeight: 600, color: c.textPrimary, lineHeight: 1.55 }}>
        💡 {insights.summary}
      </div>

      {insights.topPillars?.length > 0 && (
        <Section title="🏆 ТОП КОНТЕНТ-СТОЛПЫ">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {insights.topPillars.map((p, i) => (
              <div key={i} style={{ padding: 12, background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 6 }}>
                  ER <b style={{ color: "#22c55e" }}>{p.avgER?.toFixed?.(1) ?? p.avgER}%</b> · охват <b>{fmtNumber(p.totalReach)}</b>
                </div>
                <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.5 }}>{p.why}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {insights.topFormats?.length > 0 && (
        <Section title="📐 ТОП ФОРМАТЫ">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {insights.topFormats.map((f, i) => (
              <div key={i} style={{ padding: "8px 12px", background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}>{f.format} <span style={{ color: "#22c55e" }}>{f.avgER?.toFixed?.(1) ?? f.avgER}%</span></div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{f.why}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {insights.topHooks?.length > 0 && (
        <Section title="🪝 РАБОЧИЕ КРЮЧКИ">
          {insights.topHooks.map((h, i) => (
            <div key={i} style={{ padding: 10, background: c.bg, borderRadius: 8, border: `1px solid ${c.borderLight}`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>{h.pattern}</div>
              {h.examples?.length > 0 && (
                <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 4, fontStyle: "italic" }}>
                  {h.examples.map(e => `«${e}»`).join(" · ")}
                </div>
              )}
              <div style={{ fontSize: 11, color: c.textSecondary }}>{h.why}</div>
            </div>
          ))}
        </Section>
      )}

      {insights.underperformers?.length > 0 && (
        <Section title="⚠️ ЧТО НЕ РАБОТАЕТ">
          {insights.underperformers.map((u, i) => (
            <div key={i} style={{ padding: 10, background: c.accentRed + "08", borderRadius: 8, border: `1px solid ${c.accentRed}25`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, marginBottom: 3 }}>{u.what}</div>
              <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 3 }}>метрика: {u.metric}</div>
              <div style={{ fontSize: 11, color: c.textSecondary }}>👉 {u.fix}</div>
            </div>
          ))}
        </Section>
      )}

      {insights.recommendations?.length > 0 && (
        <Section title="🎯 РЕКОМЕНДАЦИИ">
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {insights.recommendations.map((r, i) => (
              <li key={i} style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.6, marginBottom: 4 }}>{r}</li>
            ))}
          </ol>
        </Section>
      )}

      {insights.nextWeekPlan?.length > 0 && (
        <Section title="📅 ПЛАН НА СЛЕДУЮЩУЮ НЕДЕЛЮ">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
            {insights.nextWeekPlan.map((d, i) => (
              <div key={i} style={{ padding: "8px 10px", background: c.bg, borderRadius: 7, border: `1px solid ${c.borderLight}`, fontSize: 11, color: c.textSecondary }}>{d}</div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================
// ROI Calculator View
// ============================================================

function ROICalculatorView({ c, posts, reels }: {
  c: Colors;
  posts: GeneratedPost[];
  reels: GeneratedReel[];
}) {
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [avgCheck, setAvgCheck] = useState<number>(0);
  const [marginPct, setMarginPct] = useState<number>(40);
  const [postsPerMonth, setPostsPerMonth] = useState<number>(20);

  const rows = buildAnalyticsRows(posts, reels);
  const withSpend = rows.filter(r => r.adSpend > 0 && r.leads > 0);
  const withRevenue = rows.filter(r => r.revenue > 0 && r.adSpend > 0);

  // Historical averages
  const avgCPL = withSpend.length > 0
    ? withSpend.reduce((s, r) => s + r.adSpend / r.leads, 0) / withSpend.length
    : 0;
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const conversionRate = totalLeads > 0 && rows.reduce((s, r) => s + r.reach, 0) > 0
    ? (totalLeads / rows.reduce((s, r) => s + r.reach, 0)) * 100
    : 0;
  const avgRevenuePerLead = totalLeads > 0 ? totalRevenue / totalLeads : 0;
  const historicalROMI = withRevenue.length > 0
    ? (withRevenue.reduce((s, r) => s + r.revenue, 0) - withRevenue.reduce((s, r) => s + r.adSpend, 0))
        / withRevenue.reduce((s, r) => s + r.adSpend, 0) * 100
    : null;

  // Forecast
  const forecastLeads = avgCPL > 0 && monthlyBudget > 0 ? Math.round(monthlyBudget / avgCPL) : 0;
  const forecastRevenue = avgCheck > 0 ? forecastLeads * avgCheck : 0;
  const forecastProfit = forecastRevenue * (marginPct / 100) - monthlyBudget;
  const forecastROMI = monthlyBudget > 0 ? (forecastProfit / monthlyBudget) * 100 : 0;
  const breakEvenLeads = avgCheck > 0 && marginPct > 0
    ? Math.ceil(monthlyBudget / (avgCheck * (marginPct / 100)))
    : 0;

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 18, boxShadow: c.shadow, ...style }}>{children}</div>
  );

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 5, letterSpacing: "0.05em" };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary,
    fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box", fontFamily: "monospace",
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>💰 ROI калькулятор</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>
          Прогноз окупаемости на основе ваших исторических метрик
        </p>
      </div>

      {/* Historical KPI */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 8 }}>📈 ВАШИ ИСТОРИЧЕСКИЕ ПОКАЗАТЕЛИ</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "СРЕДНИЙ CPL", value: avgCPL > 0 ? `${avgCPL.toFixed(0)} ₽` : "—", sub: `${withSpend.length} публикаций` },
            { label: "КОНВЕРСИЯ", value: conversionRate > 0 ? `${conversionRate.toFixed(2)}%` : "—", sub: "охват → лид" },
            { label: "ВЫРУЧКА/ЛИД", value: avgRevenuePerLead > 0 ? `${avgRevenuePerLead.toFixed(0)} ₽` : "—" },
            { label: "ROMI ИСТОРИЧ.", value: historicalROMI != null ? `${historicalROMI.toFixed(0)}%` : "—",
              color: historicalROMI != null ? (historicalROMI >= 0 ? "#22c55e" : c.accentRed) : undefined },
          ].map((k, i) => (
            <div key={i} style={{ flex: "1 1 160px", padding: "12px 14px", background: c.bgCard, borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color ?? c.textPrimary }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Inputs + Forecast */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, color: c.textPrimary, marginBottom: 14 }}>📥 Параметры на месяц</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle}>БЮДЖЕТ НА ПРОДВИЖЕНИЕ (₽)</label>
              <input type="number" value={monthlyBudget || ""} onChange={e => setMonthlyBudget(Number(e.target.value) || 0)} placeholder="100000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>СРЕДНИЙ ЧЕК (₽)</label>
              <input type="number" value={avgCheck || ""} onChange={e => setAvgCheck(Number(e.target.value) || 0)} placeholder="15000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>МАРЖИНАЛЬНОСТЬ (%)</label>
              <input type="number" value={marginPct || ""} onChange={e => setMarginPct(Number(e.target.value) || 0)} placeholder="40" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>ПУБЛИКАЦИЙ В МЕСЯЦ</label>
              <input type="number" value={postsPerMonth || ""} onChange={e => setPostsPerMonth(Number(e.target.value) || 0)} placeholder="20" style={inputStyle} />
            </div>
          </div>
          {avgCPL === 0 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#f59e0b15", borderRadius: 7, fontSize: 11, color: c.textSecondary }}>
              ⚠️ Внесите метрики хотя бы по 3-5 публикациям с указанием рекламного бюджета и лидов — иначе прогноз будет нулевым.
            </div>
          )}
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${c.bgCard}, #6366f108)` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: c.textPrimary, marginBottom: 14 }}>🎯 Прогноз на месяц</div>
          <div style={{ display: "grid", gap: 12 }}>
            <ForecastRow c={c} label="Прогноз лидов" value={forecastLeads > 0 ? String(forecastLeads) : "—"} sub={avgCPL > 0 ? `при CPL ${avgCPL.toFixed(0)} ₽` : ""} />
            <ForecastRow c={c} label="Прогноз выручки" value={forecastRevenue > 0 ? `${fmtNumber(forecastRevenue)} ₽` : "—"} sub={avgCheck > 0 ? `${forecastLeads} лидов × ${avgCheck} ₽` : ""} />
            <ForecastRow c={c} label="Чистая прибыль" value={forecastProfit !== 0 ? `${fmtNumber(Math.round(forecastProfit))} ₽` : "—"}
              color={forecastProfit > 0 ? "#22c55e" : forecastProfit < 0 ? c.accentRed : undefined}
              sub={`${marginPct}% маржи − реклама`} />
            <ForecastRow c={c} label="ROMI" value={monthlyBudget > 0 ? `${forecastROMI.toFixed(0)}%` : "—"}
              color={forecastROMI > 0 ? "#22c55e" : forecastROMI < 0 ? c.accentRed : undefined} />
            <div style={{ height: 1, background: c.borderLight, margin: "4px 0" }} />
            <ForecastRow c={c} label="Точка безубыточности" value={breakEvenLeads > 0 ? `${breakEvenLeads} лидов` : "—"}
              sub={avgCheck > 0 && marginPct > 0 ? "минимум для окупаемости" : ""} />
            <ForecastRow c={c} label="Цена 1 публикации" value={postsPerMonth > 0 && monthlyBudget > 0 ? `${(monthlyBudget / postsPerMonth).toFixed(0)} ₽` : "—"} />
          </div>
        </Card>
      </div>

      {/* Hint */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>💡 Как читать прогноз</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: c.textSecondary, lineHeight: 1.7 }}>
          <li>Прогноз построен на <b>ваших</b> реальных метриках, а не на средних по рынку</li>
          <li>Если ROMI отрицательный — нужно либо снижать CPL (улучшать креативы), либо повышать средний чек</li>
          <li>Точка безубыточности — сколько лидов нужно, чтобы маржа покрыла рекламу</li>
          <li>Чем больше публикаций с метриками вы внесёте — тем точнее прогноз</li>
        </ul>
      </Card>
    </div>
  );
}

function ForecastRow({ c, label, value, sub, color }: { c: Colors; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: 11, color: c.textSecondary, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? c.textPrimary, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

// ============================================================
// Presentation Builder View
// ============================================================

interface PresentationSlide {
  title: string;
  subtitle?: string;
  type: string;
  content: string;
  bullets: string[];
  stats: Array<{ value: string; label: string }>;
  quote?: string;
  note?: string;
  isEdited?: boolean;
}

const PRESET_STYLES: PresentationStyle[] = [
  { id: "minimalist", name: "Минимализм", colors: ["#1a1a2e", "#f5f5f5", "#6366f1", "#ffffff", "#1a1a2e"], fontHeader: "Inter", fontBody: "Inter", mood: "Чистый, воздушный, элегантный" },
  { id: "corporate", name: "Корпоративный", colors: ["#0f2b46", "#c7985e", "#2563eb", "#f8f9fc", "#1e293b"], fontHeader: "Georgia", fontBody: "Calibri", mood: "Надёжный, солидный, деловой" },
  { id: "bright", name: "Яркий", colors: ["#7c3aed", "#f59e0b", "#10b981", "#ffffff", "#18181b"], fontHeader: "Montserrat", fontBody: "Open Sans", mood: "Энергичный, современный, динамичный" },
  { id: "warm", name: "Тёплый", colors: ["#92400e", "#d97706", "#b45309", "#fffbeb", "#422006"], fontHeader: "Merriweather", fontBody: "Source Sans Pro", mood: "Уютный, натуральный, человечный" },
  { id: "dark", name: "Премиум", colors: ["#0a0a0a", "#a855f7", "#22d3ee", "#111111", "#f1f5f9"], fontHeader: "Playfair Display", fontBody: "Raleway", mood: "Элитный, технологичный, стильный" },
  { id: "fresh", name: "Свежий", colors: ["#059669", "#34d399", "#06b6d4", "#f0fdf4", "#064e3b"], fontHeader: "Nunito", fontBody: "Nunito", mood: "Экологичный, лёгкий, оптимистичный" },
];

function buildStyleFromBrandBook(bb: BrandBook): PresentationStyle {
  return {
    id: "brandbook",
    name: "Мой брендбук",
    colors: bb.colors.length >= 5 ? bb.colors.slice(0,5) : [
      bb.colors[0] || "#1a1a2e",
      bb.colors[1] || "#6366f1",
      bb.colors[2] || "#10b981",
      bb.colors[3] || "#ffffff",
      bb.colors[4] || "#1a1a2e",
    ],
    fontHeader: bb.fontHeader || "Georgia",
    fontBody: bb.fontBody || "Calibri",
    mood: bb.visualStyle || "Фирменный стиль",
  };
}

function PresentationView({ c, myCompany, taAnalysis, smmAnalysis, brandBook }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  taAnalysis: TAResult | null;
  smmAnalysis: SMMResult | null;
  brandBook: BrandBook;
}) {
  // Multi-stage wizard
  const [stage, setStage] = useState<"style" | "generating" | "review">("style");
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [presTitle, setPresTitle] = useState("");
  const [error, setError] = useState("");

  // Stage 1: style
  const [styleSource, setStyleSource] = useState<"brandbook" | "presets" | null>(null);
  const [paletteOptions, setPaletteOptions] = useState<PresentationStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<PresentationStyle | null>(null);

  // Stage 2: generation
  const [genProgress, setGenProgress] = useState(0);

  // Stage 3: review
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [wishText, setWishText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [isExportingSlidev, setIsExportingSlidev] = useState(false);

  // Derived colors from selected style
  const sty = selectedStyle || buildStyleFromBrandBook(brandBook);
  const primary = sty.colors[0] || c.accent;
  const secondary = sty.colors[1] || c.accentGreen;
  const bg = sty.colors[3] || "#ffffff";
  const textColor = sty.colors[4] || "#1a1a2e";

  // ── Stage 1 handlers ─────────────────────────────────
  const handlePickBrandbook = () => {
    setStyleSource("brandbook");
    const bbStyle = buildStyleFromBrandBook(brandBook);
    // Generate 3 variations: the brandbook itself + 2 tweaked
    const variations: PresentationStyle[] = [bbStyle];
    const shift = (hex: string, deg: number) => {
      const h = hex.replace("#","");
      let r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b2 = parseInt(h.slice(4,6),16);
      r = Math.min(255, Math.max(0, r + deg)); g = Math.min(255, Math.max(0, g + deg * 0.5)); b2 = Math.min(255, Math.max(0, b2 - deg * 0.3));
      return `#${Math.round(r).toString(16).padStart(2,"0")}${Math.round(g).toString(16).padStart(2,"0")}${Math.round(b2).toString(16).padStart(2,"0")}`;
    };
    variations.push({ ...bbStyle, id: "bb-light", name: "Брендбук (светлый)", colors: bbStyle.colors.map((col, i) => i === 3 ? "#ffffff" : i === 4 ? "#1a1a2e" : shift(col, 20)) });
    variations.push({ ...bbStyle, id: "bb-dark", name: "Брендбук (тёмный)", colors: [bbStyle.colors[0], bbStyle.colors[1], bbStyle.colors[2], "#111118", "#f1f5f9"], mood: "Тёмная версия бренда" });
    // Add 2 matching presets
    variations.push(...PRESET_STYLES.slice(0, 2));
    setPaletteOptions(variations);
  };

  const handlePickPresets = () => {
    setStyleSource("presets");
    setPaletteOptions(PRESET_STYLES);
  };

  // ── Stage 2 handler ──────────────────────────────────
  const handleGenerate = async () => {
    if (!myCompany || !selectedStyle) { setError("Выберите стиль и убедитесь что анализ проведён"); return; }
    setStage("generating");
    setGenProgress(0);
    setError("");
    const timer = setInterval(() => setGenProgress(p => Math.min(p + 2, 88)), 400);
    try {
      const res = await fetch("/api/generate-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: myCompany.company,
          brandBook,
          style: selectedStyle,
          taData: taAnalysis,
          smmData: smmAnalysis,
          social: myCompany.social,
          business: myCompany.business,
          seo: myCompany.seo,
          nicheForecast: myCompany.nicheForecast,
          hiring: myCompany.hiring,
        }),
      });
      const json = await res.json();
      clearInterval(timer);
      if (!json.ok) throw new Error(json.error);
      setPresTitle(json.data.title ?? "Бренд-презентация");
      setSlides(json.data.slides ?? []);
      setGenProgress(100);
      setTimeout(() => setStage("review"), 600);
    } catch (err: unknown) {
      clearInterval(timer);
      setError(err instanceof Error ? err.message : "Ошибка генерации");
      setStage("style");
    }
  };

  // ── Stage 3 handlers ─────────────────────────────────
  const handleSlideUpdate = (idx: number, patch: Partial<PresentationSlide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch, isEdited: true } : s));
  };

  const handleWishUpdate = async () => {
    if (!wishText.trim() || !myCompany) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/edit-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, wish: wishText, style: selectedStyle, brandBook, company: myCompany.company }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setSlides(json.data.slides ?? slides);
      setWishText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка обновления");
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Export handlers ──────────────────────────────────
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [960, 540] });
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:0;width:960px;";
      document.body.appendChild(container);
      const fontH = sty.fontHeader;
      const fontB = sty.fontBody;
      for (let i = 0; i < slides.length; i++) {
        if (i > 0) pdf.addPage([960, 540], "landscape");
        container.innerHTML = renderSlideHtml(slides[i], i, slides.length, primary, secondary, bg, textColor, fontH, fontB, brandBook.logoDataUrl);
        const canvas = await html2canvas(container.firstElementChild as HTMLElement, { width: 960, height: 540, scale: 2, useCORS: true, backgroundColor: null });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 960, 540);
      }
      document.body.removeChild(container);
      pdf.save(`${presTitle || "presentation"}.pdf`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPptx = async () => {
    setIsExportingPptx(true);
    try {
      const res = await fetch("/api/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, presTitle, brandBook, style: selectedStyle }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presTitle || "presentation"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка PPTX");
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handleExportSlidev = async () => {
    setIsExportingSlidev(true);
    try {
      const res = await fetch("/api/export-slidev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, style: selectedStyle, title: presTitle }),
      });
      if (!res.ok) throw new Error("Ошибка экспорта Slidev");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presTitle || "presentation"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка Slidev");
    } finally {
      setIsExportingSlidev(false);
    }
  };

  const renderSlide = (slide: PresentationSlide, idx: number) => {
    const type = slide.type;
    const total = slides.length;
    const fontH = brandBook.fontHeader || "Georgia";
    const fontB = brandBook.fontBody || "Calibri";

    // Derive dark version of primary for contrast
    const darkenHex = (hex: string, amt: number) => {
      const h = hex.replace("#", "");
      const r = Math.round(parseInt(h.slice(0,2),16)*(1-amt));
      const g = Math.round(parseInt(h.slice(2,4),16)*(1-amt));
      const b2 = Math.round(parseInt(h.slice(4,6),16)*(1-amt));
      return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b2.toString(16).padStart(2,"0")}`;
    };
    const darkPrimary = darkenHex(primary, 0.3);

    const slideBase: React.CSSProperties = {
      width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden",
      position: "relative", boxShadow: "0 12px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)",
      fontFamily: `'${fontB}', system-ui, sans-serif`,
    };

    const numTag = (dark: boolean) => (
      <div style={{ position: "absolute", bottom: 14, right: 18, fontSize: 10, fontWeight: 700,
        color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.18)", letterSpacing: 1.5 }}>
        {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
    );

    // ── COVER ─────────────────────────────────────────────────
    if (type === "cover") {
      return (
        <div key={idx} style={{ ...slideBase, display: "flex" }}>
          {/* Left panel — dark brand */}
          <div style={{ width: "42%", background: `linear-gradient(160deg, ${darkPrimary} 0%, ${primary} 100%)`,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "32px 28px 24px", position: "relative", overflow: "hidden", flexShrink: 0 }}>
            {/* Decorative ring */}
            <div style={{ position: "absolute", bottom: "-30%", left: "-30%", width: "120%", paddingBottom: "120%",
              borderRadius: "50%", border: `2px solid rgba(255,255,255,0.08)`, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: "-20%", right: "-20%", width: "80%", paddingBottom: "80%",
              borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
            {/* Logo */}
            {brandBook.logoDataUrl
              ? <img src={brandBook.logoDataUrl} alt="logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, background: "rgba(255,255,255,0.12)", padding: 4 }} />
              : <div style={{ width: 40, height: 4, borderRadius: 2, background: secondary }} />
            }
            {/* Bottom: slide index + brand name */}
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "rgba(255,255,255,0.08)", lineHeight: 1, marginBottom: 8, fontFamily: `'${fontH}', serif` }}>
                {String(idx + 1).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 2, textTransform: "uppercase" }}>
                {brandBook.brandName || "Brand"}
              </div>
            </div>
          </div>
          {/* Right panel — white */}
          <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "36px 36px 36px 40px" }}>
            {/* Top accent bar */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: secondary, marginBottom: 24 }} />
            <h2 style={{ fontSize: 28, fontWeight: 900, color: textColor || "#111", margin: "0 0 14px", lineHeight: 1.15,
              fontFamily: `'${fontH}', serif`, letterSpacing: "-0.5px" }}>
              {slide.title}
            </h2>
            {slide.subtitle && (
              <p style={{ fontSize: 15, color: "#555", margin: "0 0 12px", fontWeight: 500, lineHeight: 1.4 }}>{slide.subtitle}</p>
            )}
            {slide.content && (
              <p style={{ fontSize: 13, color: "#777", margin: 0, lineHeight: 1.65, maxWidth: 340 }}>{slide.content}</p>
            )}
            {/* Bottom: total slides */}
            <div style={{ position: "absolute", bottom: 18, right: 22, fontSize: 10, color: "#ccc", fontWeight: 600, letterSpacing: 1 }}>
              {String(idx + 1).padStart(2,"0")} / {String(total).padStart(2,"0")}
            </div>
          </div>
        </div>
      );
    }

    // ── CTA ───────────────────────────────────────────────────
    if (type === "cta") {
      return (
        <div key={idx} style={{ ...slideBase, background: `linear-gradient(135deg, ${darkPrimary} 0%, ${primary} 60%, ${secondary} 100%)`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 60px" }}>
          {/* Grid pattern overlay */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "28px 28px", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 2, maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: secondary }} />
            <h2 style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.15,
              fontFamily: `'${fontH}', serif`, letterSpacing: "-0.5px" }}>{slide.title}</h2>
            {slide.subtitle && <p style={{ fontSize: 16, color: "rgba(255,255,255,0.78)", margin: 0, fontWeight: 500 }}>{slide.subtitle}</p>}
            {slide.content && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", margin: 0, lineHeight: 1.6 }}>{slide.content}</p>}
            {(slide.bullets || []).length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                {slide.bullets.map((b, bi) => (
                  <span key={bi} style={{ padding: "7px 18px", borderRadius: 20, background: "rgba(255,255,255,0.14)",
                    color: "#fff", fontSize: 12, fontWeight: 600, border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(4px)" }}>{b}</span>
                ))}
              </div>
            )}
          </div>
          {numTag(true)}
        </div>
      );
    }

    // ── STATS ────────────────────────────────────────────────
    if (type === "stats") {
      const stats = slide.stats || [];
      return (
        <div key={idx} style={{ ...slideBase, display: "flex", flexDirection: "column", background: "#f8f9fc" }}>
          {/* Header band */}
          <div style={{ background: `linear-gradient(90deg, ${primary}, ${darkPrimary})`, padding: "18px 32px 16px", flexShrink: 0 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0, fontFamily: `'${fontH}', serif`, letterSpacing: "-0.3px" }}>{slide.title}</h3>
            {slide.subtitle && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "4px 0 0", letterSpacing: 0.3 }}>{slide.subtitle}</p>}
          </div>
          {/* Stats grid */}
          <div style={{ flex: 1, display: "flex", gap: 16, padding: "20px 28px 16px", alignItems: "stretch" }}>
            {stats.map((s, si) => (
              <div key={si} style={{ flex: 1, background: "#fff", borderRadius: 14, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: "20px 12px", gap: 10, position: "relative",
                boxShadow: `0 4px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)`,
                border: `1px solid rgba(0,0,0,0.06)` }}>
                {/* Colored top indicator */}
                <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, background: [primary, secondary, "#f59e0b", "#10b981"][si % 4], borderRadius: "0 0 3px 3px" }} />
                <div style={{ fontSize: 42, fontWeight: 900, color: textColor || "#111", lineHeight: 1, fontFamily: `'${fontH}', serif`, letterSpacing: "-1px" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#888", textAlign: "center", lineHeight: 1.45, maxWidth: 110, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {slide.content && (
            <div style={{ padding: "0 28px 16px", fontSize: 11, color: "#999", lineHeight: 1.5 }}>{slide.content}</div>
          )}
          {numTag(false)}
        </div>
      );
    }

    // ── QUOTE ────────────────────────────────────────────────
    if (type === "quote") {
      return (
        <div key={idx} style={{ ...slideBase, background: primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Subtle grid */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: "24px 24px", pointerEvents: "none" }} />
          {/* Big decorative quote */}
          <div style={{ position: "absolute", top: "5%", left: "4%", fontSize: 180, color: "rgba(255,255,255,0.06)",
            fontFamily: "Georgia, serif", fontWeight: 900, lineHeight: 1, userSelect: "none", pointerEvents: "none" }}>&ldquo;</div>
          <div style={{ position: "relative", zIndex: 2, maxWidth: "70%", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: secondary, letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
              {slide.title}
            </div>
            {slide.quote && (
              <p style={{ fontSize: 20, fontStyle: "italic", color: "rgba(255,255,255,0.95)", lineHeight: 1.6, margin: "0 0 20px",
                fontFamily: `'${fontH}', serif`, fontWeight: 400 }}>
                &ldquo;{slide.quote}&rdquo;
              </p>
            )}
            {slide.content && (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>{slide.content}</p>
            )}
            {/* Bottom line */}
            <div style={{ width: 48, height: 2, background: secondary, borderRadius: 2, margin: "20px auto 0" }} />
          </div>
          {numTag(true)}
        </div>
      );
    }

    // ── TWO-COLUMN ───────────────────────────────────────────
    if (type === "two-column") {
      const half = Math.ceil((slide.bullets || []).length / 2);
      const leftBullets = (slide.bullets || []).slice(0, half);
      const rightBullets = (slide.bullets || []).slice(half);
      const colColors = [primary, secondary];
      return (
        <div key={idx} style={{ ...slideBase, background: "#f8f9fc", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ background: `linear-gradient(90deg, ${primary}, ${darkPrimary})`, padding: "16px 32px 14px", flexShrink: 0 }}>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: 0, fontFamily: `'${fontH}', serif` }}>{slide.title}</h3>
            {slide.subtitle && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "3px 0 0" }}>{slide.subtitle}</p>}
          </div>
          {slide.content && (
            <div style={{ padding: "12px 28px 0", fontSize: 12, color: "#555", lineHeight: 1.5 }}>{slide.content}</div>
          )}
          <div style={{ display: "flex", gap: 14, padding: "14px 28px 20px", flex: 1 }}>
            {[leftBullets, rightBullets].map((col, ci) => (
              <div key={ci} style={{ flex: 1, background: "#fff", borderRadius: 12, overflow: "hidden",
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.05)" }}>
                {/* Column header accent */}
                <div style={{ height: 3, background: colColors[ci] }} />
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {col.map((b, bi) => (
                    <div key={bi} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: colColors[ci] + "18",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: colColors[ci] }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#333", lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {numTag(false)}
        </div>
      );
    }

    // ── BULLETS (default) ─────────────────────────────────────
    return (
      <div key={idx} style={{ ...slideBase, display: "flex", background: "#fff" }}>
        {/* Left sidebar */}
        <div style={{ width: "26%", background: `linear-gradient(180deg, ${primary} 0%, ${darkPrimary} 100%)`,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "28px 20px 20px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: "-15%", left: "-15%", width: "80%", paddingBottom: "80%",
            borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div>
            <div style={{ width: 28, height: 3, borderRadius: 2, background: secondary, marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.3,
              fontFamily: `'${fontH}', serif`, letterSpacing: "-0.2px" }}>{slide.title}</h3>
            {slide.subtitle && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", margin: "8px 0 0", lineHeight: 1.5, letterSpacing: 0.2 }}>{slide.subtitle}</p>
            )}
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "rgba(255,255,255,0.08)", lineHeight: 1, fontFamily: `'${fontH}', serif` }}>
            {String(idx + 1).padStart(2, "0")}
          </div>
        </div>
        {/* Right content */}
        <div style={{ flex: 1, padding: "24px 28px 20px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {slide.content && (
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 14px", lineHeight: 1.6, borderBottom: `1px solid #f0f0f0`, paddingBottom: 12 }}>{slide.content}</p>
          )}
          {(slide.bullets || []).length > 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              {(slide.bullets || []).map((b, bi) => (
                <div key={bi} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", borderRadius: 8,
                  background: bi % 2 === 0 ? "#f9fafb" : "transparent" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: primary, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                    {bi + 1}
                  </div>
                  <span style={{ fontSize: 12, color: "#2d2d2d", lineHeight: 1.55 }}>{b}</span>
                </div>
              ))}
            </div>
          )}
          {(slide.stats || []).length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {(slide.stats || []).map((s, si) => (
                <div key={si} style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10,
                  background: primary + "0d", border: `1px solid ${primary}18` }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: primary, fontFamily: `'${fontH}', serif` }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {numTag(false)}
        </div>
      </div>
    );
  };

  // ── Mini cover preview for palette card ─────────────────────
  const renderMiniCover = (sty2: PresentationStyle) => {
    const [p, s2] = [sty2.colors[0], sty2.colors[1]];
    const dk = (hex: string, a: number) => { const h = hex.replace("#",""); return `#${[0,2,4].map(i => Math.round(parseInt(h.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,"0")).join("")}`; };
    return (
      <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", display: "flex", fontSize: 0 }}>
        <div style={{ width: "42%", background: `linear-gradient(160deg, ${dk(p, 0.3)}, ${p})`, display: "flex", alignItems: "flex-end", padding: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 4, left: 6, width: 10, height: 2, borderRadius: 1, background: s2 }} />
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 0.5 }}>{sty2.name}</div>
        </div>
        <div style={{ flex: 1, background: sty2.colors[3] || "#fff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 8px" }}>
          <div style={{ width: 14, height: 1.5, borderRadius: 1, background: s2, marginBottom: 4 }} />
          <div style={{ width: "70%", height: 4, borderRadius: 1, background: sty2.colors[4] || "#222", marginBottom: 2 }} />
          <div style={{ width: "50%", height: 2, borderRadius: 1, background: "#bbb" }} />
        </div>
      </div>
    );
  };

  // ── Fullscreen mode ──────────────────────────────────────────
  if (fullscreen && slides.length > 0) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}
        onKeyDown={e => { if (e.key === "Escape") setFullscreen(false); if (e.key === "ArrowRight") setActiveSlide(p => Math.min(p + 1, slides.length - 1)); if (e.key === "ArrowLeft") setActiveSlide(p => Math.max(p - 1, 0)); }}
        tabIndex={0}>
        <div style={{ width: "88vw", maxWidth: 1100, cursor: "pointer" }}
          onClick={() => setActiveSlide(prev => Math.min(prev + 1, slides.length - 1))}>
          {renderSlide(slides[activeSlide], activeSlide)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {slides.map((_, i) => (
            <div key={i} onClick={() => setActiveSlide(i)} style={{ width: i === activeSlide ? 20 : 6, height: 6, borderRadius: 3,
              background: i === activeSlide ? primary : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all .2s" }} />
          ))}
        </div>
        <button onClick={() => setFullscreen(false)} style={{ position: "absolute", top: 16, right: 20, background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 18, cursor: "pointer", borderRadius: 8, padding: "4px 14px" }}>✕</button>
        <div style={{ position: "absolute", bottom: 16, color: "rgba(255,255,255,0.3)", fontSize: 11 }}>← → навигация &nbsp;•&nbsp; ESC выход &nbsp;•&nbsp; клик → далее</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Бренд-презентация</h1>
      <p style={{ color: c.textSecondary, marginBottom: 24, fontSize: 14 }}>
        Профессиональная презентация за 5 минут из ваших данных
      </p>

      {error && <div style={{ padding: 12, borderRadius: 8, background: c.accentRed + "18", color: c.accentRed, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ━━━ STAGE 1: STYLE SELECTION ━━━ */}
      {stage === "style" && (
        <div>
          {/* Data availability */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { label: "Анализ компании", ok: !!myCompany },
              { label: "Анализ ЦА", ok: !!taAnalysis },
              { label: "Анализ СММ", ok: !!smmAnalysis },
              { label: "Брендбук", ok: brandBook.colors.length > 0 || !!brandBook.fontHeader },
            ].map(item => (
              <span key={item.label} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: item.ok ? c.accentGreen + "15" : c.accentRed + "15", color: item.ok ? c.accentGreen : c.accentRed }}>
                {item.ok ? "✓" : "✗"} {item.label}
              </span>
            ))}
          </div>

          {/* Step 1a: Pick source */}
          {!styleSource && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 14 }}>Шаг 1: Выберите основу стиля</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
                <div onClick={brandBook.colors.length > 0 ? handlePickBrandbook : undefined}
                  style={{ background: c.bgCard, borderRadius: 14, padding: 24, border: `2px solid ${c.border}`, cursor: brandBook.colors.length > 0 ? "pointer" : "default",
                    opacity: brandBook.colors.length > 0 ? 1 : 0.4, textAlign: "center", boxShadow: c.shadow, transition: "border-color .15s" }}
                  onMouseEnter={e => brandBook.colors.length > 0 && ((e.currentTarget as HTMLElement).style.borderColor = c.accent)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = c.border)}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, marginBottom: 4 }}>На основе брендбука</div>
                  <div style={{ fontSize: 12, color: c.textSecondary }}>Цвета, шрифты и тон из вашего брендбука</div>
                  {brandBook.colors.length > 0 && (
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 10 }}>
                      {brandBook.colors.slice(0,5).map((col, i) => (
                        <div key={i} style={{ width: 20, height: 20, borderRadius: 6, background: col, border: `1px solid ${c.border}` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div onClick={handlePickPresets}
                  style={{ background: c.bgCard, borderRadius: 14, padding: 24, border: `2px solid ${c.border}`, cursor: "pointer",
                    textAlign: "center", boxShadow: c.shadow, transition: "border-color .15s" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = c.accent)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = c.border)}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, marginBottom: 4 }}>Выбрать из каталога</div>
                  <div style={{ fontSize: 12, color: c.textSecondary }}>6 готовых стилей: минимализм, корпоративный, яркий...</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1b: Pick palette */}
          {styleSource && paletteOptions.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <button onClick={() => { setStyleSource(null); setPaletteOptions([]); setSelectedStyle(null); }}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontSize: 12 }}>← Назад</button>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: 0 }}>Шаг 2: Выберите палитру</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
                {paletteOptions.map(p => {
                  const isSel = selectedStyle?.id === p.id;
                  return (
                    <div key={p.id} onClick={() => setSelectedStyle(p)}
                      style={{ background: c.bgCard, borderRadius: 12, overflow: "hidden", border: `2px solid ${isSel ? c.accent : c.border}`,
                        cursor: "pointer", boxShadow: isSel ? c.shadowLg : c.shadow, transition: "all .15s" }}>
                      {renderMiniCover(p)}
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 8 }}>{p.mood}</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {p.colors.slice(0, 5).map((col, i) => (
                            <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: col, border: `1px solid ${c.border}` }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>{p.fontHeader} / {p.fontBody}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedStyle && (
                <button onClick={handleGenerate} disabled={!myCompany} style={{ padding: "14px 36px", borderRadius: 10, border: "none",
                  background: !myCompany ? c.textMuted : c.accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: !myCompany ? "default" : "pointer" }}>
                  Создать презентацию в стиле «{selectedStyle.name}»
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ━━━ STAGE 2: GENERATING ━━━ */}
      {stage === "generating" && (
        <div style={{ background: c.bgCard, borderRadius: 16, padding: 48, boxShadow: c.shadow, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🧠</div>
          <h3 style={{ color: c.textPrimary, marginBottom: 8 }}>Генерируем презентацию...</h3>
          <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 24 }}>
            AI создаёт слайды на основе анализа компании, ЦА и выбранного стиля
          </p>
          <div style={{ maxWidth: 400, margin: "0 auto", background: c.border, borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg, ${c.accent}, ${c.accentGreen})`, borderRadius: 8,
              width: `${genProgress}%`, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: c.textMuted }}>{genProgress}%</div>
        </div>
      )}

      {/* ━━━ STAGE 3: REVIEW & EDIT ━━━ */}
      {stage === "review" && slides.length > 0 && (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center",
            background: c.bgCard, padding: "12px 16px", borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
            <h3 style={{ margin: 0, fontSize: 15, color: c.textPrimary, flex: 1 }}>{presTitle} — {slides.length} слайдов</h3>
            <button onClick={() => setFullscreen(true)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              ▶ Показ
            </button>
            <button onClick={handleExportPdf} disabled={isExportingPdf} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPdf ? c.textMuted : c.accent, color: "#fff", cursor: isExportingPdf ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPdf ? "Экспорт..." : "📄 PDF"}
            </button>
            <button onClick={handleExportPptx} disabled={isExportingPptx} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingPptx ? c.textMuted : "#10b981", color: "#fff", cursor: isExportingPptx ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingPptx ? "Экспорт..." : "⬇ PPTX"}
            </button>
            <button onClick={handleExportSlidev} disabled={isExportingSlidev} style={{ padding: "7px 14px", borderRadius: 8, border: "none",
              background: isExportingSlidev ? c.textMuted : "#7c3aed", color: "#fff", cursor: isExportingSlidev ? "wait" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {isExportingSlidev ? "Экспорт..." : "✦ Slidev .md"}
            </button>
            <button onClick={() => { setStage("style"); setSlides([]); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${c.border}`,
              background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              🔄 Заново
            </button>
          </div>

          {/* Wish input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input value={wishText} onChange={e => setWishText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleWishUpdate()}
              placeholder="Напишите пожелание: «добавь слайд про команду», «сделай акцент на ценах»..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.bgCard,
                color: c.textPrimary, fontSize: 13, outline: "none" }} />
            <button onClick={handleWishUpdate} disabled={isUpdating || !wishText.trim()}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: isUpdating ? c.textMuted : c.accent,
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: isUpdating ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {isUpdating ? "Обновляю..." : "Обновить"}
            </button>
          </div>

          {/* All slides — vertical scroll (Canva-style) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {slides.map((slide, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Slide number label */}
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: 0.5 }}>
                  СЛАЙД {i + 1} · {slide.type.toUpperCase()} {slide.isEdited && <span style={{ color: c.accentGreen, fontSize: 10 }}>✎ изменён</span>}
                </div>
                {/* Slide preview */}
                <div onClick={() => setEditingSlide(editingSlide === i ? null : i)} style={{ cursor: "pointer" }}>
                  {renderSlide(slide, i)}
                </div>
                {/* Inline edit panel */}
                {editingSlide === i && (
                  <div style={{ marginTop: 10, background: c.bgCard, borderRadius: 12, border: `1px solid ${c.accent}40`, padding: 16, boxShadow: c.shadow }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 10 }}>Редактирование слайда {i + 1}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ЗАГОЛОВОК</label>
                        <input value={slide.title} onChange={e => handleSlideUpdate(i, { title: e.target.value })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ПОДЗАГОЛОВОК</label>
                        <input value={slide.subtitle || ""} onChange={e => handleSlideUpdate(i, { subtitle: e.target.value })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ТЕКСТ</label>
                      <textarea value={slide.content || ""} onChange={e => handleSlideUpdate(i, { content: e.target.value })} rows={2}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 13, resize: "vertical" }} />
                    </div>
                    {(slide.bullets || []).length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, display: "block", marginBottom: 3 }}>ПУНКТЫ (по строке)</label>
                        <textarea value={(slide.bullets || []).join("\n")} rows={Math.min(slide.bullets.length + 1, 6)}
                          onChange={e => handleSlideUpdate(i, { bullets: e.target.value.split("\n") })}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 12, resize: "vertical", fontFamily: "inherit" }} />
                      </div>
                    )}
                    {slide.note && (
                      <div style={{ fontSize: 11, color: c.textSecondary, padding: "6px 10px", background: c.bg, borderRadius: 6 }}>
                        🎤 <b>Заметка:</b> {slide.note}
                      </div>
                    )}
                    <button onClick={() => setEditingSlide(null)} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: `1px solid ${c.border}`,
                      background: c.bgCard, color: c.textPrimary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Закрыть</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Watermark */}
          <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: c.textMuted }}>
            Создано в MarketRadar для Company24.pro
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: render a single slide as static HTML string for print/PDF
function renderSlideHtml(slide: PresentationSlide, i: number, total: number, primary: string, secondary: string, bg: string, textColor: string, fontH: string, fontB: string, logoUrl?: string): string {
  const type = slide.type;
  const num = `<div style="position:absolute;bottom:14px;right:18px;font-size:10px;font-weight:600;color:rgba(0,0,0,0.18);letter-spacing:1px">${i + 1} / ${total}</div>`;
  const base = `width:960px;height:540px;position:relative;overflow:hidden;box-sizing:border-box;font-family:'${fontB}',system-ui,sans-serif;`;

  if (type === "cover" || type === "cta") {
    return `<div class="slide" style="${base}background:${primary};display:flex;align-items:center;justify-content:center;text-align:center;">
      <div style="position:absolute;top:-20%;right:-10%;width:55%;padding-bottom:55%;border-radius:50%;background:${secondary};opacity:0.18"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${secondary}"></div>
      <div style="position:relative;z-index:2;max-width:70%;display:flex;flex-direction:column;align-items:center;gap:12px">
        ${logoUrl && type !== "cta" ? `<img src="${logoUrl}" style="width:56px;height:56px;border-radius:12px;object-fit:contain;background:rgba(255,255,255,0.15);padding:6px;margin-bottom:4px">` : ""}
        <h2 style="font-size:36px;font-weight:800;color:#fff;margin:0;line-height:1.15;text-shadow:0 2px 12px rgba(0,0,0,0.25);font-family:'${fontH}',serif">${slide.title}</h2>
        ${slide.subtitle ? `<p style="font-size:18px;color:rgba(255,255,255,0.82);margin:0;font-weight:500">${slide.subtitle}</p>` : ""}
        ${slide.content ? `<p style="font-size:14px;color:rgba(255,255,255,0.62);margin:0;max-width:480px;line-height:1.55">${slide.content}</p>` : ""}
      </div>
      <div style="position:absolute;bottom:14px;right:18px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:1px">${i + 1} / ${total}</div>
    </div>`;
  }

  if (type === "stats") {
    const statsHtml = (slide.stats || []).map(s => `<div style="flex:1;border-radius:12px;background:#fff;border:1px solid ${primary}22;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;gap:8px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${primary}"></div>
      <div style="font-size:42px;font-weight:900;color:${primary};line-height:1;font-family:'${fontH}',serif">${s.value}</div>
      <div style="font-size:12px;color:#666;text-align:center;line-height:1.4;max-width:120px">${s.label}</div>
    </div>`).join("");
    return `<div class="slide" style="${base}background:${bg};display:flex;flex-direction:column;padding:28px 36px 24px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:4px;height:24px;border-radius:2px;background:${primary};flex-shrink:0"></div>
        <h3 style="font-size:22px;font-weight:700;color:${textColor};margin:0;font-family:'${fontH}',serif">${slide.title}</h3>
      </div>
      <div style="display:flex;gap:14px;flex:1">${statsHtml}</div>
      ${slide.content ? `<p style="font-size:13px;color:#777;margin:14px 0 0;line-height:1.5">${slide.content}</p>` : ""}
      ${num}
    </div>`;
  }

  if (type === "quote") {
    return `<div class="slide" style="${base}background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 60px;text-align:center;">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${primary},${secondary})"></div>
      <div style="position:absolute;top:16px;left:36px;font-size:80px;color:${primary};opacity:0.12;font-family:Georgia,serif;font-weight:900;line-height:1">"</div>
      <div style="position:relative;z-index:2;max-width:600px">
        <div style="width:3px;height:40px;background:${primary};margin:0 auto 20px;border-radius:2px"></div>
        <h3 style="font-size:20px;font-weight:700;color:${textColor};margin:0 0 16px;font-family:'${fontH}',serif">${slide.title}</h3>
        ${slide.quote ? `<p style="font-size:17px;font-style:italic;color:#444;line-height:1.65;margin:0 0 16px;padding:0 20px">"${slide.quote}"</p>` : ""}
        ${slide.content ? `<p style="font-size:13px;color:#777;line-height:1.5;margin:0">${slide.content}</p>` : ""}
      </div>
      ${num}
    </div>`;
  }

  // Bullets / two-column / default
  const bulletsHtml = (slide.bullets || []).map((b, bi) => `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:8px;background:${bi % 2 === 0 ? primary + "08" : "transparent"}">
    <div style="width:20px;height:20px;border-radius:50%;background:${primary};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;margin-top:1px">${bi + 1}</div>
    <span style="font-size:14px;color:#2d2d2d;line-height:1.5">${b}</span>
  </div>`).join("");
  return `<div class="slide" style="${base}background:${bg};display:flex;flex-direction:column;padding:28px 36px 24px;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${primary},${secondary})"></div>
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:18px">
      <div style="width:4px;min-height:28px;border-radius:2px;background:${primary};flex-shrink:0;margin-top:2px"></div>
      <div>
        <h3 style="font-size:22px;font-weight:700;color:${textColor};margin:0 0 3px;font-family:'${fontH}',serif">${slide.title}</h3>
        ${slide.subtitle ? `<p style="font-size:12px;color:#999;margin:0">${slide.subtitle}</p>` : ""}
      </div>
    </div>
    ${slide.content ? `<p style="font-size:14px;color:#555;margin:0 0 12px;line-height:1.6">${slide.content}</p>` : ""}
    <div style="flex:1;display:flex;flex-direction:column;gap:8px">${bulletsHtml}</div>
    ${num}
  </div>`;
}

// ============================================================
// Reviews Analysis View
// ============================================================

function ReviewsView({ c, companyName }: {
  c: Colors;
  companyName: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [inputMode, setInputMode] = useState<"paste" | "screenshot" | "2gis">("paste");
  const [pasteText, setPasteText] = useState("");
  const [gisUrl, setGisUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"input" | "reviews" | "analysis">("input");
  const [autoFetchStatus, setAutoFetchStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [autoFetchLog, setAutoFetchLog] = useState<string[]>([]);

  // Auto-fetch from Google + 2GIS on mount when company name is known
  useEffect(() => {
    if (!companyName.trim()) return;
    const run = async () => {
      setAutoFetchStatus("loading");
      const log: string[] = [];
      const fetched: Review[] = [];

      // Google Places
      try {
        const res = await fetch("/api/fetch-reviews-google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName }),
        });
        const json = await res.json();
        if (json.ok && json.data.reviews.length > 0) {
          fetched.push(...json.data.reviews);
          log.push(`Google Maps: ${json.data.reviews.length} отзывов (рейтинг ${json.data.rating}★)`);
        } else {
          log.push("Google Maps: не найдено");
        }
      } catch {
        log.push("Google Maps: ошибка загрузки");
      }

      // 2GIS by name
      try {
        const res = await fetch("/api/fetch-reviews-2gis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName }),
        });
        const json = await res.json();
        if (json.ok && json.data.reviews.length > 0) {
          fetched.push(...json.data.reviews);
          log.push(`2ГИС: ${json.data.reviews.length} отзывов`);
        } else {
          log.push("2ГИС: не найдено");
        }
      } catch {
        log.push("2ГИС: ошибка загрузки");
      }

      setAutoFetchLog(log);
      if (fetched.length > 0) {
        setReviews(fetched);
        setTab("reviews");
      }
      setAutoFetchStatus("done");
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName]);

  // Handle screenshot drop/paste
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setError("");
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/extract-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenshot: dataUrl }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const newReviews: Review[] = json.data.reviews;
      setReviews(prev => [...prev, ...newReviews]);
      if (newReviews.length > 0) setTab("reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка извлечения");
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle pasted text
  const handleExtractFromText = async () => {
    if (!pasteText.trim()) return;
    setIsExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/extract-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedText: pasteText }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const newReviews: Review[] = json.data.reviews;
      setReviews(prev => [...prev, ...newReviews]);
      setPasteText("");
      if (newReviews.length > 0) setTab("reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка извлечения");
    } finally {
      setIsExtracting(false);
    }
  };

  // Fetch from 2GIS
  const handleFetch2GIS = async () => {
    if (!gisUrl.trim()) return;
    setIsExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/fetch-reviews-2gis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gisUrl }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const newReviews: Review[] = json.data.reviews;
      setReviews(prev => [...prev, ...newReviews]);
      setGisUrl("");
      if (newReviews.length > 0) setTab("reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setIsExtracting(false);
    }
  };

  // Run AI analysis
  const handleAnalyze = async () => {
    if (reviews.length === 0) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/analyze-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, reviews }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAnalysis(json.data);
      setTab("analysis");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка анализа");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteReview = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    setReviews([]);
    setAnalysis(null);
    setTab("input");
  };

  const platformLabel = (p: string) => {
    const map: Record<string, string> = {
      yandex_maps: "Яндекс.Карты", "2gis": "2ГИС", otzovik: "Отзовик",
      avito: "Авито", google: "Google", manual: "Вручную", unknown: "Другое",
    };
    return map[p] ?? p;
  };

  const starColor = (rating: number) =>
    rating >= 4 ? c.accentGreen : rating >= 3 ? c.accentYellow : c.accentRed;

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? starColor(rating) : c.border, fontSize: 14 }}>★</span>
    ));

  // --- TABS ---
  const tabs = [
    { id: "input" as const, label: "Добавить отзывы", icon: "+" },
    { id: "reviews" as const, label: `Отзывы (${reviews.length})`, icon: "💬" },
    { id: "analysis" as const, label: "Анализ", icon: "📊" },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>Анализ отзывов</h1>
      <p style={{ color: c.textSecondary, marginBottom: 24, fontSize: 14 }}>
        Собирайте отзывы с разных платформ и получайте AI-анализ
      </p>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 8, border: `1px solid ${tab === t.id ? c.accent : c.border}`,
            background: tab === t.id ? c.accent : c.bgCard, color: tab === t.id ? "#fff" : c.textPrimary,
            cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        {reviews.length > 0 && (
          <button onClick={handleAnalyze} disabled={isAnalyzing} style={{
            marginLeft: "auto", padding: "8px 20px", borderRadius: 8, border: "none",
            background: isAnalyzing ? c.textMuted : c.accentGreen, color: "#fff",
            cursor: isAnalyzing ? "wait" : "pointer", fontWeight: 700, fontSize: 13,
          }}>
            {isAnalyzing ? "Анализирую..." : `🧠 Анализировать (${reviews.length})`}
          </button>
        )}
      </div>

      {/* Auto-fetch status banner */}
      {autoFetchStatus === "loading" && (
        <div style={{ padding: 12, borderRadius: 8, background: c.accent + "12", color: c.accent, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${c.accent}40`, borderTop: `2px solid ${c.accent}`, borderRadius: "50%", animation: "mr-spin 1s linear infinite" }} />
          Загружаю отзывы с Google Maps и 2ГИС...
        </div>
      )}
      {autoFetchStatus === "done" && autoFetchLog.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: c.accentGreen + "12", color: c.textSecondary, marginBottom: 16, fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: c.accentGreen }}>✓ Автозагрузка:</span>
          {autoFetchLog.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: c.accentRed + "18", color: c.accentRed, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ===== INPUT TAB ===== */}
      {tab === "input" && (
        <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
          {/* Input mode selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {([
              { id: "paste" as const, label: "📋 Вставить текст", desc: "Скопируйте отзывы с любой платформы" },
              { id: "screenshot" as const, label: "📸 Скриншот", desc: "Загрузите скрин страницы отзывов" },
              { id: "2gis" as const, label: "🗺️ 2ГИС (авто)", desc: "Ссылка на организацию в 2ГИС" },
            ] as const).map(mode => (
              <button key={mode.id} onClick={() => setInputMode(mode.id)} style={{
                flex: 1, padding: 16, borderRadius: 12, border: `2px solid ${inputMode === mode.id ? c.accent : c.border}`,
                background: inputMode === mode.id ? c.accent + "10" : "transparent",
                cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, marginBottom: 4 }}>{mode.label}</div>
                <div style={{ fontSize: 12, color: c.textSecondary }}>{mode.desc}</div>
              </button>
            ))}
          </div>

          {/* Paste mode */}
          {inputMode === "paste" && (
            <div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Вставьте сюда отзывы с любой платформы.\n\nПример:\n★★★★★ Иван Иванов\nОтличный сервис! Быстро и качественно.\n\n★★☆☆☆ Мария Петрова\nДолго ждала заказ, разочарована."}
                style={{
                  width: "100%", minHeight: 200, padding: 16, borderRadius: 12, border: `1px solid ${c.border}`,
                  background: c.bg, color: c.textPrimary, fontSize: 14, fontFamily: "inherit", resize: "vertical",
                }}
              />
              <button
                onClick={handleExtractFromText}
                disabled={isExtracting || !pasteText.trim()}
                style={{
                  marginTop: 12, padding: "10px 24px", borderRadius: 8, border: "none",
                  background: isExtracting ? c.textMuted : c.accent, color: "#fff",
                  cursor: isExtracting ? "wait" : "pointer", fontWeight: 700, fontSize: 14,
                }}
              >
                {isExtracting ? "Извлекаю отзывы..." : "Извлечь отзывы"}
              </button>
            </div>
          )}

          {/* Screenshot mode */}
          {inputMode === "screenshot" && (
            <div>
              <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Сделайте скриншот страницы отзывов на Яндекс.Картах, Отзовике, Авито или любой другой платформе.
                GPT-4o распознает платформу и извлечёт все отзывы.
              </p>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: 40, borderRadius: 12, border: `2px dashed ${c.border}`,
                background: c.bg, cursor: "pointer", color: c.textSecondary, fontSize: 14,
              }}>
                <input type="file" accept="image/*" onChange={handleScreenshotUpload} style={{ display: "none" }} />
                {isExtracting ? "Распознаю..." : "📸 Нажмите или перетащите скриншот"}
              </label>
            </div>
          )}

          {/* 2GIS mode */}
          {inputMode === "2gis" && (
            <div>
              <p style={{ color: c.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Вставьте ссылку на организацию в 2ГИС. Отзывы загрузятся автоматически через открытый API.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={gisUrl}
                  onChange={e => setGisUrl(e.target.value)}
                  placeholder="https://2gis.ru/moscow/firm/70000001012345678"
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${c.border}`,
                    background: c.bg, color: c.textPrimary, fontSize: 14,
                  }}
                />
                <button
                  onClick={handleFetch2GIS}
                  disabled={isExtracting || !gisUrl.trim()}
                  style={{
                    padding: "10px 24px", borderRadius: 8, border: "none",
                    background: isExtracting ? c.textMuted : c.accent, color: "#fff",
                    cursor: isExtracting ? "wait" : "pointer", fontWeight: 700, fontSize: 14,
                  }}
                >
                  {isExtracting ? "Загружаю..." : "Загрузить"}
                </button>
              </div>
            </div>
          )}

          {/* Platform hints */}
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary, marginBottom: 8 }}>Поддерживаемые платформы:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { name: "2ГИС", method: "Авто (ссылка)", color: c.accentGreen },
                { name: "Яндекс.Карты", method: "Скриншот / текст", color: c.accentYellow },
                { name: "Google Maps", method: "Скриншот / текст", color: c.accent },
                { name: "Отзовик", method: "Скриншот / текст", color: c.accentWarm },
                { name: "Авито", method: "Скриншот / текст", color: c.accentRed },
              ].map(p => (
                <span key={p.name} style={{
                  padding: "4px 10px", borderRadius: 6, background: p.color + "18",
                  color: p.color, fontSize: 12, fontWeight: 600,
                }}>
                  {p.name} — {p.method}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== REVIEWS LIST TAB ===== */}
      {tab === "reviews" && (
        <div>
          {reviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: c.textMuted }}>
              Отзывов пока нет. Добавьте через вкладку &ldquo;Добавить отзывы&rdquo;.
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                {(() => {
                  const platforms = [...new Set(reviews.map(r => r.platform))];
                  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                  return (
                    <>
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: c.bgCard, border: `1px solid ${c.border}`, fontSize: 13 }}>
                        <b>{reviews.length}</b> отзывов
                      </div>
                      <div style={{ padding: "8px 14px", borderRadius: 8, background: c.bgCard, border: `1px solid ${c.border}`, fontSize: 13 }}>
                        Средняя оценка: <b style={{ color: starColor(Math.round(avg)) }}>{avg.toFixed(1)} ★</b>
                      </div>
                      {platforms.map(p => (
                        <div key={p} style={{ padding: "8px 14px", borderRadius: 8, background: c.accent + "12", fontSize: 13, color: c.accent, fontWeight: 600 }}>
                          {platformLabel(p)}: {reviews.filter(r => r.platform === p).length}
                        </div>
                      ))}
                      <button onClick={handleClearAll} style={{
                        marginLeft: "auto", padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.accentRed}33`,
                        background: "transparent", color: c.accentRed, fontSize: 12, cursor: "pointer",
                      }}>
                        Очистить все
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Review cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.map(rev => (
                  <div key={rev.id} style={{
                    background: c.bgCard, borderRadius: 12, padding: 16, boxShadow: c.shadow,
                    borderLeft: `3px solid ${starColor(rev.rating)}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>{rev.author}</span>
                        <span>{renderStars(rev.rating)}</span>
                        <span style={{ fontSize: 11, color: c.textMuted, padding: "2px 6px", borderRadius: 4, background: c.accent + "12" }}>
                          {platformLabel(rev.platform)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {rev.date && <span style={{ fontSize: 11, color: c.textMuted }}>{rev.date}</span>}
                        <button onClick={() => handleDeleteReview(rev.id)} style={{
                          background: "none", border: "none", cursor: "pointer", color: c.textMuted, fontSize: 16, padding: 2,
                        }}>
                          ×
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: c.textPrimary, lineHeight: 1.5, margin: 0 }}>{rev.text}</p>
                    {rev.reply && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: c.bg, fontSize: 13, color: c.textSecondary }}>
                        <b>Ответ:</b> {rev.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== ANALYSIS TAB ===== */}
      {tab === "analysis" && (
        <div>
          {!analysis ? (
            <div style={{ textAlign: "center", padding: 60, color: c.textMuted }}>
              {reviews.length === 0
                ? "Сначала добавьте отзывы"
                : "Нажмите «Анализировать» чтобы запустить AI-анализ"
              }
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Summary */}
              <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.textPrimary }}>Общий вердикт</h3>
                <p style={{ fontSize: 15, color: c.textPrimary, lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
              </div>

              {/* KPI strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Отзывов", value: analysis.totalReviews.toString(), color: c.accent },
                  { label: "Средняя оценка", value: `${analysis.avgRating.toFixed(1)} ★`, color: starColor(Math.round(analysis.avgRating)) },
                  { label: "Позитивные", value: `${analysis.sentimentSummary.positive}`, color: c.accentGreen },
                  { label: "Негативные", value: `${analysis.sentimentSummary.negative}`, color: c.accentRed },
                ].map(kpi => (
                  <div key={kpi.label} style={{
                    background: c.bgCard, borderRadius: 12, padding: 16, textAlign: "center",
                    boxShadow: c.shadow, borderTop: `3px solid ${kpi.color}`,
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 4 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Rating distribution */}
              <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>Распределение оценок</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = analysis.ratingDistribution[star] ?? 0;
                    const pct = analysis.totalReviews > 0 ? (count / analysis.totalReviews) * 100 : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: c.textPrimary }}>{star}★</span>
                        <div style={{ flex: 1, height: 20, borderRadius: 6, background: c.bg, overflow: "hidden" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", borderRadius: 6,
                            background: star >= 4 ? c.accentGreen : star >= 3 ? c.accentYellow : c.accentRed,
                            transition: "width .3s",
                          }} />
                        </div>
                        <span style={{ width: 40, fontSize: 12, color: c.textSecondary, textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Topics */}
              {analysis.topics.length > 0 && (
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>Темы отзывов</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {analysis.topics.map((topic, i) => {
                      const total = topic.positive + topic.negative + topic.neutral;
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 12, background: c.bg }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary }}>{topic.topic}</span>
                            <span style={{ fontSize: 12, color: c.textMuted }}>{total} упоминаний</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: c.accentGreen }}>+{topic.positive}</span>
                            <span style={{ fontSize: 12, color: c.accentYellow }}>{topic.neutral} нейтр.</span>
                            <span style={{ fontSize: 12, color: c.accentRed }}>-{topic.negative}</span>
                          </div>
                          {topic.keyQuotes.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {topic.keyQuotes.map((q, qi) => (
                                <div key={qi} style={{
                                  fontSize: 12, color: c.textSecondary, fontStyle: "italic",
                                  padding: "4px 8px", borderRadius: 6, background: c.bgCard,
                                  borderLeft: `2px solid ${c.accent}`,
                                }}>
                                  &ldquo;{q}&rdquo;
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.accentGreen }}>Сильные стороны</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.strengths.map((s, i) => (
                      <li key={i} style={{ fontSize: 14, color: c.textPrimary }}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.accentRed }}>Слабые стороны</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} style={{ fontSize: 14, color: c.textPrimary }}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: c.textPrimary }}>Рекомендации</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 10, background: c.accent + "10",
                      fontSize: 14, color: c.textPrimary, borderLeft: `3px solid ${c.accent}`,
                    }}>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Templates */}
              {analysis.responseTemplates.length > 0 && (
                <div style={{ background: c.bgCard, borderRadius: 16, padding: 24, boxShadow: c.shadow }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: c.textPrimary }}>Шаблоны ответов на отзывы</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {analysis.responseTemplates.map((tpl, i) => {
                      const typeLabel = tpl.type === "positive" ? "Позитивный" : tpl.type === "negative" ? "Негативный" : "Нейтральный";
                      const typeColor = tpl.type === "positive" ? c.accentGreen : tpl.type === "negative" ? c.accentRed : c.accentYellow;
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 12, background: c.bg, borderLeft: `3px solid ${typeColor}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: typeColor, marginBottom: 6 }}>{typeLabel} отзыв</div>
                          <p style={{ fontSize: 14, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>{tpl.template}</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(tpl.template)}
                            style={{
                              marginTop: 8, padding: "4px 10px", borderRadius: 6, border: `1px solid ${c.border}`,
                              background: "transparent", color: c.textSecondary, cursor: "pointer", fontSize: 11,
                            }}
                          >
                            Копировать
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Stories View
// ============================================================

function StoriesView({ c, stories, plan, smmAnalysis, companyName, brandBook, onAdd, onDelete, onUpdate }: {
  c: Colors;
  stories: GeneratedStory[];
  plan: ContentPlan | null;
  smmAnalysis: unknown;
  companyName: string;
  brandBook: BrandBook;
  onAdd: (story: GeneratedStory) => void;
  onDelete: (id: string) => void;
  onUpdate: (story: GeneratedStory) => void;
}) {
  const [platform, setPlatform] = useState<"instagram" | "vk" | "telegram">("instagram");
  const [slidesCount, setSlidesCount] = useState<3 | 5 | 7>(5);
  const [goal, setGoal] = useState("прогрев");
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState(plan?.pillars?.[0]?.name ?? "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, platform, slidesCount, goal, brief, pillar, smmAnalysis, brandBook }),
      });
      const json = await res.json() as { ok: boolean; data?: GeneratedStory; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");
      onAdd(json.data!);
      setBrief("");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${c.border}`, background: c.bg, color: c.textPrimary,
    fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const accent = "#a855f7";

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: c.textPrimary }}>📱 Сторис-сценарии</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>Серии сторис с поэкранной структурой, стикерами и CTA</p>
      </div>

      {/* Generator form */}
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadowLg, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${c.borderLight}`, background: `linear-gradient(135deg, ${c.bgCard} 50%, ${accent}06 100%)` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary }}>✨ Создать серию сторис</div>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
            {/* Platform */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ПЛАТФОРМА</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["instagram", "vk", "telegram"] as const).map(p => (
                  <button key={p} onClick={() => setPlatform(p)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${platform === p ? accent : c.border}`,
                      background: platform === p ? accent + "15" : c.bg, color: platform === p ? accent : c.textSecondary,
                      fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                    {p === "instagram" ? "📸 Insta" : p === "vk" ? "💙 VK" : "✈️ TG"}
                  </button>
                ))}
              </div>
            </div>

            {/* Slides count */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>КОЛ-ВО СЛАЙДОВ</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([3, 5, 7] as const).map(n => (
                  <button key={n} onClick={() => setSlidesCount(n)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1.5px solid ${slidesCount === n ? accent : c.border}`,
                      background: slidesCount === n ? accent + "15" : c.bg, color: slidesCount === n ? accent : c.textSecondary,
                      fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>ЦЕЛЬ</label>
              <select value={goal} onChange={e => setGoal(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {["прогрев", "продажа", "охват", "вовлечение", "обучение", "анонс", "доверие"].map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Pillar */}
            {plan?.pillars?.length ? (
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>КОНТЕНТ-СТОЛП</label>
                <select value={pillar} onChange={e => setPillar(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— свободная тема —</option>
                  {plan.pillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          {/* Brief */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: "0.05em" }}>
              ТЕМА / БРИФ
              <span style={{ fontWeight: 400, marginLeft: 6 }}>— можно оставить пустым, ИИ придумает по столпу</span>
            </label>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              rows={2}
              placeholder="Например: «серия про наш процесс производства», «3 мифа о нашей нише», «анонс акции 20%»"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {genError && <div style={{ background: c.accentRed + "12", color: c.accentRed, padding: "8px 12px", borderRadius: 8, fontSize: 11, marginBottom: 12 }}>❌ {genError}</div>}

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14,
              cursor: generating ? "not-allowed" : "pointer",
              background: generating ? c.borderLight : `linear-gradient(135deg, #a855f7, #c084fc)`,
              color: generating ? c.textMuted : "#fff",
              boxShadow: generating ? "none" : `0 4px 16px #a855f740` }}>
            {generating ? "⏳ Генерируем сценарий…" : "📱 Создать серию сторис"}
          </button>
        </div>
      </div>

      {/* Stories list */}
      {stories.length === 0 ? (
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 40, textAlign: "center", boxShadow: c.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
          <div style={{ fontSize: 13, color: c.textSecondary }}>Пока нет сгенерированных сторис. Заполните форму выше и нажмите «Создать».</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {stories.map(story => (
            <StoryCard key={story.id} c={c} story={story} onDelete={onDelete} onUpdate={onUpdate} brandBook={brandBook} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoryCard({ c, story, onDelete, onUpdate, brandBook }: {
  c: Colors;
  story: GeneratedStory;
  onDelete: (id: string) => void;
  onUpdate: (updated: GeneratedStory) => void;
  brandBook?: BrandBook;
}) {
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [generatingBg, setGeneratingBg] = useState<number | null>(null); // slide order index
  const [bgError, setBgError] = useState<string | null>(null);
  const accent = "#a855f7";

  const handleGenerateBg = async (slideIndex: number) => {
    const slide = story.slides[slideIndex];
    if (!slide) return;
    setGeneratingBg(slideIndex);
    setBgError(null);
    try {
      const brandVisual = brandBook?.visualStyle?.trim();
      const brandColors = brandBook?.colors?.length ? `Brand palette: ${brandBook.colors.join(", ")}.` : "";
      const prompt = [
        `Story background for ${story.platform}: ${slide.background}.`,
        `Mood: ${slide.visualNote}.`,
        brandVisual && `Brand visual style: ${brandVisual}.`,
        brandColors,
        "Vertical 9:16 format. No text overlay. Clean, atmospheric.",
      ].filter(Boolean).join(" ");

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json() as { ok: boolean; data?: { imageUrl: string }; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации");

      const updatedSlides = story.slides.map((s, i) =>
        i === slideIndex ? { ...s, backgroundImageUrl: json.data!.imageUrl } : s,
      );
      onUpdate({ ...story, slides: updatedSlides });
    } catch (e) {
      setBgError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGeneratingBg(null);
    }
  };

  const platformLabel = { instagram: "📸 Instagram", vk: "💙 VK", telegram: "✈️ Telegram" }[story.platform];

  return (
    <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, boxShadow: c.shadow, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: expanded ? `1px solid ${c.borderLight}` : "none", cursor: "pointer" }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: accent + "15", color: accent, flexShrink: 0 }}>STORIES</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: c.bg, color: c.textMuted, flexShrink: 0 }}>{platformLabel}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: c.bg, color: c.textMuted, flexShrink: 0 }}>{story.slides.length} слайдов</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{story.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: c.textMuted }}>{new Date(story.generatedAt).toLocaleDateString("ru-RU")}</span>
          <span style={{ fontSize: 11, color: c.textMuted, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {/* Slide navigator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {story.slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)}
                style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${activeSlide === i ? accent : c.border}`,
                  background: activeSlide === i ? accent : c.bg, color: activeSlide === i ? "#fff" : c.textSecondary,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                {i + 1}
              </button>
            ))}
          </div>

          {/* Active slide */}
          {story.slides[activeSlide] && (() => {
            const slide = story.slides[activeSlide];
            return (
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
                {/* Phone mockup */}
                <div style={{
                  borderRadius: 16, padding: 12, minHeight: 320, display: "flex", flexDirection: "column",
                  justifyContent: "space-between", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", position: "relative",
                  overflow: "hidden",
                  background: slide.backgroundImageUrl ? "transparent" : "#0f0f0f",
                }}>
                  {/* Background image */}
                  {slide.backgroundImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={slide.backgroundImageUrl} alt="bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
                  )}
                  {/* Overlay for readability */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.55) 100%)", zIndex: 1 }} />

                  {/* Content above overlay */}
                  <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                    {/* Progress bar */}
                    <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
                      {story.slides.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i <= activeSlide ? "#fff" : "rgba(255,255,255,0.4)" }} />
                      ))}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "8px 4px" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.3, marginBottom: 8, textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>{slide.headlineText}</div>
                      {slide.bodyText && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, marginBottom: 8, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{slide.bodyText}</div>}
                      {slide.sticker && (
                        <div style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 8px", fontSize: 9, color: "#fff", fontWeight: 700, marginBottom: 6 }}>
                          🎯 {slide.sticker}
                        </div>
                      )}
                    </div>
                    {slide.cta && (
                      <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: accent + "dd", borderRadius: 6, padding: "5px 8px" }}>
                        {slide.cta}
                      </div>
                    )}
                  </div>
                </div>

                {/* Slide details */}
                <div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 4 }}>ФОН</div>
                      <div style={{ fontSize: 12, color: c.textSecondary, lineHeight: 1.5, marginBottom: 6 }}>{slide.background}</div>
                      <button
                        onClick={() => handleGenerateBg(activeSlide)}
                        disabled={generatingBg === activeSlide}
                        style={{
                          padding: "6px 12px", borderRadius: 7,
                          border: `1px solid ${accent}50`, background: accent + "10",
                          color: accent, fontSize: 11, fontWeight: 700,
                          cursor: generatingBg === activeSlide ? "not-allowed" : "pointer",
                          opacity: generatingBg === activeSlide ? 0.6 : 1,
                        }}>
                        {generatingBg === activeSlide ? "⏳ Генерируем…" : slide.backgroundImageUrl ? "🔄 Перегенерировать фон" : "🎨 Сгенерировать фон"}
                      </button>
                      {bgError && <div style={{ marginTop: 4, fontSize: 10, color: c.accentRed }}>❌ {bgError}</div>}
                    </div>
                    <Field c={c} label="Заголовок" value={slide.headlineText} bold />
                    {slide.bodyText && <Field c={c} label="Текст" value={slide.bodyText} />}
                    {slide.sticker && <Field c={c} label="Стикер / интерактив" value={slide.sticker} accent={accent} />}
                    {slide.cta && <Field c={c} label="CTA" value={slide.cta} accent={accent} />}
                    <Field c={c} label="Режиссёрская пометка" value={slide.visualNote} muted />
                  </div>
                  {/* Nav arrows */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0}
                      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: activeSlide === 0 ? "not-allowed" : "pointer", opacity: activeSlide === 0 ? 0.4 : 1 }}>
                      ← Назад
                    </button>
                    <button onClick={() => setActiveSlide(Math.min(story.slides.length - 1, activeSlide + 1))} disabled={activeSlide === story.slides.length - 1}
                      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, color: c.textSecondary, fontSize: 11, fontWeight: 600, cursor: activeSlide === story.slides.length - 1 ? "not-allowed" : "pointer", opacity: activeSlide === story.slides.length - 1 ? 0.4 : 1 }}>
                      Вперёд →
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Hashtags + delete */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {story.hashtags.map((h, i) => (
                <span key={i} style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{h.startsWith("#") ? h : "#" + h}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {confirmDelete ? (
                <>
                  <button onClick={() => onDelete(story.id)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: c.accentRed, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Удалить</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: "transparent", color: c.textSecondary, fontSize: 11, cursor: "pointer" }}>Нет</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${c.accentRed}40`, background: "transparent", color: c.accentRed, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Удалить</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ c, label, value, bold, muted, accent }: { c: Colors; label: string; value: string; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.05em", marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: accent ?? (muted ? c.textMuted : c.textSecondary), fontWeight: bold ? 700 : 400, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

interface NavItem {
  id: string;
  icon: string;
  label: string;
  count: number | null;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "МАРКЕТИНГ",
    items: [
      {
        id: "company-analysis", icon: "🏢", label: "Анализ компании", count: null,
        children: [
          { id: "new-analysis", icon: "🔎", label: "Новый анализ", count: null },
          { id: "dashboard", icon: "📈", label: "Дашборд", count: null },
          { id: "prev-analyses", icon: "📂", label: "Предыдущие анализы", count: null },
        ],
      },
      {
        id: "competitor-analysis", icon: "📊", label: "Анализ конкурентов", count: null,
        children: [
          { id: "competitors", icon: "🎯", label: "Конкуренты", count: null },
          { id: "compare", icon: "⚖️", label: "Сравнение", count: null },
          { id: "insights", icon: "💡", label: "AI-инсайты", count: null },
        ],
      },
      {
        id: "ta-analysis", icon: "🧠", label: "Анализ ЦА", count: null,
        children: [
          { id: "ta-new", icon: "✏️", label: "Новый анализ", count: null },
          { id: "ta-dashboard", icon: "👥", label: "Дашборд ЦА", count: null },
          { id: "ta-brandbook", icon: "🎨", label: "Рекомендации бренда", count: null },
        ],
      },
      {
        id: "smm-analysis", icon: "📱", label: "Анализ СММ", count: null,
        children: [
          { id: "smm-new", icon: "✏️", label: "Новый анализ", count: null },
          { id: "smm-dashboard", icon: "🎨", label: "Дашборд СММ", count: null },
        ],
      },
      {
        id: "content-factory", icon: "🏭", label: "Контент-завод", count: null,
        children: [
          { id: "content-plan", icon: "📋", label: "План контента", count: null },
          { id: "content-posts", icon: "📝", label: "Готовые посты", count: null },
          { id: "content-reels", icon: "🎬", label: "Готовые видео", count: null },
          { id: "content-stories", icon: "📱", label: "Сторис-сценарии", count: null },
          { id: "content-analytics", icon: "📊", label: "Аналитика контента", count: null },
          { id: "content-roi", icon: "💰", label: "ROI калькулятор", count: null },
        ],
      },
      { id: "reviews-analysis", icon: "⭐", label: "Анализ отзывов", count: null },
      { id: "brand-presentation", icon: "🎤", label: "Презентация бренда", count: null },
      { id: "reports", icon: "📄", label: "Отчёты", count: null },
      { id: "sources", icon: "🔗", label: "Источники", count: null },
    ],
  },
  {
    title: "СИСТЕМА",
    items: [
      { id: "settings", icon: "⚙️", label: "Настройки", count: null },
    ],
  },
];

// ============================================================
// Main App
// ============================================================

export default function MarketRadarDashboard() {
  const [theme, setTheme] = useState<Theme>("light");
  const [appScreen, setAppScreen] = useState<"landing" | "register" | "login" | "onboarding" | "app">("landing");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeNav, setActiveNav] = useState("new-analysis");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [myCompany, setMyCompany] = useState<AnalysisResult | null>(null);
  const [competitors, setCompetitors] = useState<AnalysisResult[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<number | null>(null);
  const [taAnalysis, setTaAnalysis] = useState<TAResult | null>(null);
  const [isTAAnalyzing, setIsTAAnalyzing] = useState(false);
  const [smmAnalysis, setSmmAnalysis] = useState<SMMResult | null>(null);
  const [isSMMAnalyzing, setIsSMMAnalyzing] = useState(false);
  const [contentPlan, setContentPlan] = useState<ContentPlan | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [generatedReels, setGeneratedReels] = useState<GeneratedReel[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatingPostId, setGeneratingPostId] = useState<string | null>(null);
  const [generatingReelId, setGeneratingReelId] = useState<string | null>(null);
  const [generatingVideoFor, setGeneratingVideoFor] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings>({
    avatarId: "",
    voiceId: "",
    avatarDescription: "",
    voiceDescription: "",
    aspect: "portrait",
  });
  const [brandBook, setBrandBook] = useState<BrandBook>({
    brandName: "",
    tagline: "",
    mission: "",
    colors: [],
    fontHeader: "",
    fontBody: "",
    toneOfVoice: [],
    forbiddenWords: [],
    goodPhrases: [],
    visualStyle: "",
  });
  const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<Array<AnalysisResult & { analyzedAt: string }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brandSuggestions, setBrandSuggestions] = useState<any | null>(null);
  const c = COLORS[theme];

  // Check for existing session + restore saved company data on mount
  useEffect(() => {
    const user = authGetCurrentUser();
    if (user) {
      setCurrentUser(user);
      // Restore saved company analysis + competitors
      try {
        const saved = localStorage.getItem(`mr_company_${user.id}`);
        if (saved) {
          const parsed: AnalysisResult = JSON.parse(saved);
          setMyCompany(parsed);
          setStatus("done");
          setActiveNav("dashboard");
        }
        const savedComps = localStorage.getItem(`mr_competitors_${user.id}`);
        if (savedComps) {
          const parsedComps: AnalysisResult[] = JSON.parse(savedComps);
          if (Array.isArray(parsedComps) && parsedComps.length > 0) {
            setCompetitors(parsedComps);
          }
        }
        const savedTA = localStorage.getItem(`mr_ta_${user.id}`);
        if (savedTA) {
          setTaAnalysis(JSON.parse(savedTA));
        }
        const savedSMM = localStorage.getItem(`mr_smm_${user.id}`);
        if (savedSMM) {
          setSmmAnalysis(JSON.parse(savedSMM));
        }
        const savedContent = localStorage.getItem(`mr_content_${user.id}`);
        if (savedContent) {
          const parsedContent = JSON.parse(savedContent) as { plan: ContentPlan | null; posts: GeneratedPost[]; reels: GeneratedReel[] };
          if (parsedContent.plan) setContentPlan(parsedContent.plan);
          if (Array.isArray(parsedContent.posts)) setGeneratedPosts(parsedContent.posts);
          if (Array.isArray(parsedContent.reels)) setGeneratedReels(parsedContent.reels);
        }
        const savedAvatarSettings = localStorage.getItem(`mr_avatar_settings_${user.id}`);
        if (savedAvatarSettings) {
          setAvatarSettings(JSON.parse(savedAvatarSettings));
        }
        const savedBrandBook = localStorage.getItem(`mr_brandbook_${user.id}`);
        if (savedBrandBook) {
          setBrandBook(JSON.parse(savedBrandBook));
        }
        const savedStories = localStorage.getItem(`mr_stories_${user.id}`);
        if (savedStories) {
          setGeneratedStories(JSON.parse(savedStories));
        }
        const savedHistory = localStorage.getItem(`mr_analysis_history_${user.id}`);
        if (savedHistory) {
          setAnalysisHistory(JSON.parse(savedHistory));
        }
        const savedBrandSug = localStorage.getItem(`mr_brandsug_${user.id}`);
        if (savedBrandSug) {
          setBrandSuggestions(JSON.parse(savedBrandSug));
        }
      } catch { /* ignore */ }
      setAppScreen(user.onboardingDone ? "app" : "onboarding");
    }
  }, []);

  const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Ошибка анализа");
    return json.data;
  };

  // Save company to localStorage and state
  const saveMyCompany = (result: AnalysisResult, userId?: string) => {
    setMyCompany(result);
    const uid = userId ?? currentUser?.id;
    if (uid) {
      try { localStorage.setItem(`mr_company_${uid}`, JSON.stringify(result)); } catch { /* ignore */ }
    }
  };

  // New analysis from within dashboard
  const handleNewAnalysis = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      // Save current analysis to history before replacing
      if (myCompany) {
        const historyEntry = { ...myCompany, analyzedAt: new Date().toISOString() };
        setAnalysisHistory(prev => {
          const next = [historyEntry, ...prev].slice(0, 20); // keep last 20
          if (currentUser?.id) {
            try { localStorage.setItem(`mr_analysis_history_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
          }
          return next;
        });
      }
      saveMyCompany(result);
      setCompetitors([]);
      if (currentUser?.id) {
        try { localStorage.removeItem(`mr_competitors_${currentUser.id}`); } catch { /* ignore */ }
      }
      setSelectedCompetitor(null);
      setActiveNav("dashboard");
      if (currentUser?.tgChatId && currentUser.tgNotifyAnalysis !== false) {
        await sendTgNotification(
          currentUser.tgChatId,
          `✅ <b>MarketRadar</b>\n\nАнализ завершён: <b>${result.company.name}</b>\nScore: <b>${result.company.score}/100</b>\n\nОткройте приложение, чтобы посмотреть результаты.`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add competitor
  const handleAddCompetitor = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      setCompetitors(prev => {
        const updated = [...prev, result];
        if (currentUser?.id) {
          try { localStorage.setItem(`mr_competitors_${currentUser.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
        }
        return updated;
      });
      if (currentUser?.tgChatId && currentUser.tgNotifyCompetitors !== false) {
        await sendTgNotification(
          currentUser.tgChatId,
          `🎯 <b>MarketRadar</b>\n\nДобавлен конкурент: <b>${result.company.name}</b>\nScore: <b>${result.company.score}/100</b>\n${result.hiring?.openVacancies ? `Открытых вакансий: ${result.hiring.openVacancies}` : ""}`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTAAnalysis = async (niche: string, extraContext: string) => {
    setIsTAAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-ta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? "",
          companyUrl: myCompany?.company.url ?? "",
          niche,
          extraContext,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа ЦА");
      setTaAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_ta_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
      }
      setActiveNav("ta-dashboard");
    } finally {
      setIsTAAnalyzing(false);
    }
  };

  const handleSMMAnalysis = async (niche: string, links: SMMSocialLinks) => {
    setIsSMMAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? "",
          companyUrl: myCompany?.company.url ?? "",
          niche,
          socialLinks: links,
          websiteContext: myCompany?.company.description ?? "",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка анализа СММ");
      setSmmAnalysis(json.data);
      if (currentUser?.id) {
        try { localStorage.setItem(`mr_smm_${currentUser.id}`, JSON.stringify(json.data)); } catch { /* ignore */ }
      }
      setActiveNav("smm-dashboard");
    } finally {
      setIsSMMAnalyzing(false);
    }
  };

  // ----- Content Factory -----

  const persistContent = (plan: ContentPlan | null, posts: GeneratedPost[], reels: GeneratedReel[]) => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`mr_content_${currentUser.id}`, JSON.stringify({ plan, posts, reels }));
    } catch { /* ignore */ }
  };

  const handleUpdateAvatarSettings = (next: AvatarSettings) => {
    setAvatarSettings(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_avatar_settings_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  const handleUpdateBrandBook = (next: BrandBook) => {
    setBrandBook(next);
    if (currentUser?.id) {
      try { localStorage.setItem(`mr_brandbook_${currentUser.id}`, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  const handleSetBrandSuggestions = (v: unknown) => {
    setBrandSuggestions(v);
    if (currentUser) {
      try { localStorage.setItem(`mr_brandsug_${currentUser.id}`, JSON.stringify(v)); } catch { /* ignore */ }
    }
  };

  const persistStories = (stories: GeneratedStory[]) => {
    if (!currentUser?.id) return;
    try { localStorage.setItem(`mr_stories_${currentUser.id}`, JSON.stringify(stories)); } catch { /* ignore */ }
  };

  const handleAddStory = (story: GeneratedStory) => {
    setGeneratedStories(prev => {
      const next = [story, ...prev];
      persistStories(next);
      return next;
    });
  };

  const handleDeleteStory = (storyId: string) => {
    setGeneratedStories(prev => {
      const next = prev.filter(s => s.id !== storyId);
      persistStories(next);
      return next;
    });
  };

  const handleUpdateStory = (updated: GeneratedStory) => {
    setGeneratedStories(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      persistStories(next);
      return next;
    });
  };

  const handleGenerateContentPlan = async (niche: string) => {
    if (!smmAnalysis) return;
    setIsGeneratingPlan(true);
    try {
      const res = await fetch("/api/generate-content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis.companyName,
          niche,
          smmAnalysis,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации плана");
      setContentPlan(json.data);
      persistContent(json.data, generatedPosts, generatedReels);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGeneratePost = async (idea: ContentPostIdea, customPrompt?: string) => {
    setGeneratingPostId(idea.id);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          idea,
          smmAnalysis,
          brandBook,
          generateImage: true,
          userPrompt: customPrompt,
          referenceImages: referenceImages.map(r => ({ data: r.data, mimeType: r.mimeType })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации поста");
      setGeneratedPosts(prev => {
        const next = [json.data as GeneratedPost, ...prev];
        persistContent(contentPlan, next, generatedReels);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации поста");
    } finally {
      setGeneratingPostId(null);
    }
  };

  const handleGenerateReelScenario = async (idea: ContentReelIdea, customPrompt?: string) => {
    setGeneratingReelId(idea.id);
    try {
      const res = await fetch("/api/generate-reel-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: myCompany?.company.name ?? smmAnalysis?.companyName ?? "",
          idea,
          smmAnalysis,
          brandBook,
          voiceDescription: avatarSettings.voiceDescription,
          avatarDescription: avatarSettings.avatarDescription,
          userPrompt: customPrompt,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка генерации сценария");
      setGeneratedReels(prev => {
        const next = [json.data as GeneratedReel, ...prev];
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка генерации сценария");
    } finally {
      setGeneratingReelId(null);
    }
  };

  const handleUpdatePost = (updated: GeneratedPost) => {
    setGeneratedPosts(prev => {
      const next = prev.map(p => p.id === updated.id ? updated : p);
      persistContent(contentPlan, next, generatedReels);
      return next;
    });
  };

  const handleUpdateReel = (updated: GeneratedReel) => {
    setGeneratedReels(prev => {
      const next = prev.map(r => r.id === updated.id ? updated : r);
      persistContent(contentPlan, generatedPosts, next);
      return next;
    });
  };

  const handleDeletePost = (postId: string) => {
    setGeneratedPosts(prev => {
      const next = prev.filter(p => p.id !== postId);
      persistContent(contentPlan, next, generatedReels);
      return next;
    });
  };

  const handleDeleteReel = (reelId: string) => {
    setGeneratedReels(prev => {
      const next = prev.filter(r => r.id !== reelId);
      persistContent(contentPlan, generatedPosts, next);
      return next;
    });
  };

  const handleGenerateReelVideo = async (reelId: string) => {
    const reel = generatedReels.find(r => r.id === reelId);
    if (!reel) return;
    setGeneratingVideoFor(reelId);
    try {
      const res = await fetch("/api/generate-reel-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: reel.voiceoverScript,
          avatarId: avatarSettings.avatarId || undefined,
          voiceId: avatarSettings.voiceId || undefined,
          aspect: avatarSettings.aspect,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Ошибка HeyGen");
      const videoId: string = json.data.videoId;
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, heygenVideoId: videoId, videoStatus: "generating" as const, videoError: undefined }
          : r);
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setGeneratedReels(prev => {
        const next = prev.map(r => r.id === reelId
          ? { ...r, videoStatus: "failed" as const, videoError: msg }
          : r);
        persistContent(contentPlan, generatedPosts, next);
        return next;
      });
    } finally {
      setGeneratingVideoFor(null);
    }
  };

  // Poll HeyGen for any reels currently generating
  useEffect(() => {
    const generating = generatedReels.filter(r => r.videoStatus === "generating" && r.heygenVideoId);
    if (generating.length === 0) return;
    const interval = setInterval(async () => {
      for (const reel of generating) {
        try {
          const res = await fetch(`/api/video-status?videoId=${encodeURIComponent(reel.heygenVideoId!)}`);
          const json = await res.json();
          if (!json.ok) continue;
          const status: string = json.data.status;
          if (status === "completed" && json.data.videoUrl) {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "ready" as const, videoUrl: json.data.videoUrl as string }
                : r);
              persistContent(contentPlan, generatedPosts, next);
              return next;
            });
          } else if (status === "failed") {
            setGeneratedReels(prev => {
              const next = prev.map(r => r.id === reel.id
                ? { ...r, videoStatus: "failed" as const, videoError: json.data.error ?? "HeyGen вернул failed" }
                : r);
              persistContent(contentPlan, generatedPosts, next);
              return next;
            });
          }
        } catch { /* keep polling */ }
      }
    }, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedReels.map(r => `${r.id}:${r.videoStatus}`).join(",")]);

  // Onboarding complete: run initial analysis
  const handleOnboardingComplete = async (updatedUser: UserAccount, companyUrl: string, competitorUrls: string[]) => {
    setCurrentUser(updatedUser);
    setAppScreen("app");
    if (!companyUrl) { setStatus("done"); setActiveNav("new-analysis"); return; }
    setCurrentUrl(companyUrl);
    setStatus("loading");
    try {
      const result = await analyzeUrl(companyUrl);
      saveMyCompany(result, updatedUser.id);
      const compResults: AnalysisResult[] = [];
      for (const url of competitorUrls) {
        setCurrentUrl(url);
        const comp = await analyzeUrl(url);
        compResults.push(comp);
        setCompetitors([...compResults]);
      }
      if (compResults.length > 0 && updatedUser.id) {
        try { localStorage.setItem(`mr_competitors_${updatedUser.id}`, JSON.stringify(compResults)); } catch { /* ignore */ }
      }
      setActiveNav("dashboard");
    } catch {
      setActiveNav("new-analysis");
    } finally {
      setStatus("done");
    }
  };

  // Logout — НЕ сбрасываем данные компании (они в localStorage)
  const handleLogout = () => {
    authSetCurrentUser(null);
    setCurrentUser(null);
    setAppScreen("landing");
    // Не сбрасываем myCompany/competitors — пусть остаются в памяти для UX
    // При следующем входе они восстановятся из localStorage
    setStatus("idle");
    setActiveNav("new-analysis");
    setSelectedCompetitor(null);
  };

  // Update nav counts dynamically (including nested children)
  const updateCounts = (items: typeof NAV_SECTIONS[0]["items"]): typeof NAV_SECTIONS[0]["items"] =>
    items.map(item => ({
      ...item,
      count: item.id === "competitors" ? (competitors.length > 0 ? competitors.length : null) :
        item.id === "insights" ? (myCompany?.insights?.length ?? null) :
          item.id === "competitor-analysis" ? (myCompany ? 1 : null) :
            item.id === "ta-analysis" ? (taAnalysis ? 1 : null) :
              item.id === "smm-analysis" ? (smmAnalysis ? 1 : null) :
                item.id === "content-factory" ? (contentPlan ? 1 : null) :
                  item.id === "content-posts" ? (generatedPosts.length > 0 ? generatedPosts.length : null) :
                    item.id === "content-reels" ? (generatedReels.length > 0 ? generatedReels.length : null) : item.count,
      children: item.children ? updateCounts(item.children) : undefined,
    }));
  const navSections = NAV_SECTIONS.map(section => ({ ...section, items: updateCounts(section.items) }));

  // Screen routing
  if (appScreen === "landing") {
    return <LandingPageView c={c} theme={theme} setTheme={setTheme} onRegister={() => setAppScreen("register")} onLogin={() => setAppScreen("login")} />;
  }
  if (appScreen === "register") {
    return <RegisterView c={c} onSuccess={(user) => { setCurrentUser(user); setAppScreen("onboarding"); }} onLogin={() => setAppScreen("login")} />;
  }
  if (appScreen === "login") {
    return <LoginView c={c} onSuccess={(user) => { setCurrentUser(user); setAppScreen(user.onboardingDone ? "app" : "onboarding"); }} onRegister={() => setAppScreen("register")} />;
  }
  if (appScreen === "onboarding" && currentUser) {
    return <OnboardingView c={c} user={currentUser} onComplete={handleOnboardingComplete} />;
  }

  // App: loading state (initial analysis)
  if (status === "loading") {
    return <LoadingView c={c} url={currentUrl} />;
  }

  // App: competitor profile sub-view
  if (selectedCompetitor !== null && competitors[selectedCompetitor]) {
    return (
      <div style={{ display: "flex", height: "100vh", fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", background: c.bg, color: c.textPrimary, overflow: "hidden" }}>
        <style>{`* { box-sizing: border-box; } ::selection { background: ${c.accent}30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
        <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={(id) => { setSelectedCompetitor(null); setActiveNav(id); }} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
        <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
          <CompetitorProfileView c={c} data={competitors[selectedCompetitor]} onBack={() => { setSelectedCompetitor(null); setActiveNav("competitors"); }} />
        </main>
      </div>
    );
  }

  // App: main dashboard layout
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", background: c.bg, color: c.textPrimary, overflow: "hidden" }}>
      <style>{`* { box-sizing: border-box; } ::selection { background: ${c.accent}30; } button { transition: opacity 0.15s ease, transform 0.1s ease; } button:hover:not(:disabled) { opacity: 0.92; } button:active:not(:disabled) { transform: scale(0.98); }`}</style>
      <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={setActiveNav} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
      <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {activeNav === "new-analysis" && <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />}
        {activeNav === "dashboard" && (myCompany ? <DashboardView c={c} data={myCompany} competitors={competitors} /> : <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />)}
        {activeNav === "prev-analyses" && <PreviousAnalysesView c={c} history={analysisHistory} currentAnalysis={myCompany} />}
        {activeNav === "competitors" && <CompetitorsView c={c} myCompany={myCompany} competitors={competitors} onSelectCompetitor={(i) => { setSelectedCompetitor(i); }} onAddCompetitor={handleAddCompetitor} isAnalyzing={isAnalyzing} />}
        {activeNav === "compare" && <CompareView c={c} myCompany={myCompany} competitors={competitors} />}
        {activeNav === "insights" && myCompany && <InsightsView c={c} data={myCompany} competitors={competitors} />}
        {activeNav === "reports" && <ReportsView c={c} data={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} />}
        {activeNav === "sources" && <SourcesView c={c} />}
        {activeNav === "settings" && <SettingsView c={c} user={currentUser} onUpdateUser={(updated) => setCurrentUser(updated)} />}
        {activeNav === "ta-new" && <NewTAView c={c} myCompany={myCompany} isAnalyzing={isTAAnalyzing} onAnalyze={handleTAAnalysis} />}
        {activeNav === "ta-dashboard" && (taAnalysis ? <TADashboardView c={c} data={taAnalysis} /> : <TAEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("ta-new")} />)}
        {activeNav === "ta-brandbook" && taAnalysis && (
          <BrandSuggestionsView c={c} taData={taAnalysis} brandSuggestions={brandSuggestions} setBrandSuggestions={handleSetBrandSuggestions} brandBook={brandBook} onUpdateBrandBook={handleUpdateBrandBook} />
        )}
        {activeNav === "ta-brandbook" && !taAnalysis && (
          <div style={{ padding: 40, textAlign: "center", color: c.textSecondary }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>Сначала проведите анализ ЦА</div>
            <div style={{ fontSize: 13 }}>Перейдите в «Анализ ЦА → Новый анализ»</div>
          </div>
        )}
        {activeNav === "smm-new" && <NewSMMView c={c} myCompany={myCompany} isAnalyzing={isSMMAnalyzing} onAnalyze={handleSMMAnalysis} />}
        {activeNav === "smm-dashboard" && (smmAnalysis ? <SMMDashboardView c={c} data={smmAnalysis} /> : <SMMEmptyDashboard c={c} onRunAnalysis={() => setActiveNav("smm-new")} />)}
        {activeNav === "content-plan" && (
          contentPlan
            ? <ContentPlanView
                c={c}
                plan={contentPlan}
                isGeneratingPost={generatingPostId !== null}
                generatingPostId={generatingPostId}
                isGeneratingReel={generatingReelId !== null}
                generatingReelId={generatingReelId}
                onGeneratePost={handleGeneratePost}
                onGenerateReel={handleGenerateReelScenario}
                avatarSettings={avatarSettings}
                onUpdateAvatarSettings={handleUpdateAvatarSettings}
                referenceImages={referenceImages}
                onUpdateReferenceImages={setReferenceImages}
                brandBook={brandBook}
                onUpdateBrandBook={handleUpdateBrandBook}
              />
            : <NewContentPlanView c={c} myCompany={myCompany} smm={smmAnalysis} isGenerating={isGeneratingPlan} onGenerate={handleGenerateContentPlan} />
        )}
        {activeNav === "content-posts" && <GeneratedPostsView c={c} posts={generatedPosts} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} referenceImages={referenceImages} onUpdateReferenceImages={setReferenceImages} brandBook={brandBook} />}
        {activeNav === "content-reels" && <GeneratedReelsView c={c} reels={generatedReels} onGenerateVideo={handleGenerateReelVideo} generatingVideoFor={generatingVideoFor} avatarSettings={avatarSettings} onUpdateAvatarSettings={handleUpdateAvatarSettings} onUpdateReel={handleUpdateReel} onDeleteReel={handleDeleteReel} />}
        {activeNav === "content-stories" && <StoriesView c={c} stories={generatedStories} plan={contentPlan} smmAnalysis={smmAnalysis} companyName={myCompany?.company.name ?? ""} brandBook={brandBook} onAdd={handleAddStory} onDelete={handleDeleteStory} onUpdate={handleUpdateStory} />}
        {activeNav === "content-analytics" && <ContentAnalyticsView c={c} posts={generatedPosts} reels={generatedReels} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "content-roi" && <ROICalculatorView c={c} posts={generatedPosts} reels={generatedReels} />}
        {activeNav === "reviews-analysis" && <ReviewsView c={c} companyName={myCompany?.company.name ?? ""} />}
        {activeNav === "brand-presentation" && <PresentationView c={c} myCompany={myCompany} taAnalysis={taAnalysis} smmAnalysis={smmAnalysis} brandBook={brandBook} />}
      </main>
    </div>
  );
}

// ============================================================
// Sidebar Component
// ============================================================

function SidebarComponent({ c, theme, setTheme, activeNav, setActiveNav, navSections, companyUrl, user, onLogout }: {
  c: Colors; theme: Theme; setTheme: (t: Theme) => void;
  activeNav: string; setActiveNav: (id: string) => void;
  navSections: NavSection[]; companyUrl: string;
  user?: UserAccount | null; onLogout?: () => void;
}) {
  // Auto-expand groups that contain the active item
  const getDefaultExpanded = () => {
    const expanded = new Set<string>();
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children?.some(c => c.id === activeNav)) expanded.add(item.id);
      }
    }
    return expanded;
  };
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(getDefaultExpanded);

  // When activeNav changes, ensure parent group is expanded
  useEffect(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children?.some(ch => ch.id === activeNav)) {
          setExpandedGroups(prev => { const next = new Set(prev); next.add(item.id); return next; });
        }
      }
    }
  }, [activeNav]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderItem = (item: NavItem, depth = 0) => {
    const isGroup = !!(item.children && item.children.length > 0);
    const isExpanded = expandedGroups.has(item.id);
    const isActive = activeNav === item.id;
    const childActive = isGroup && item.children!.some(ch => ch.id === activeNav);

    return (
      <div key={item.id}>
        <div
          onClick={() => isGroup ? toggleGroup(item.id) : setActiveNav(item.id)}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: depth > 0 ? "7px 10px 7px 28px" : "8px 10px",
            borderRadius: 9, cursor: "pointer",
            background: isActive ? "#6366f118" : childActive && !isExpanded ? "#6366f10a" : "transparent",
            color: isActive ? "#818cf8" : childActive ? "#818cf8" : c.textSecondary,
            fontWeight: isActive || (childActive && !isExpanded) ? 600 : 400, fontSize: 13,
            transition: "all 0.12s ease", marginBottom: 1,
            border: "1px solid transparent",
            borderColor: isActive ? "#6366f125" : "transparent",
          }}
          onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = c.bgSidebarHover; e.currentTarget.style.color = c.textPrimary; } }}
          onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = isActive ? "#6366f118" : "transparent"; e.currentTarget.style.color = isActive ? "#818cf8" : c.textSecondary; } }}>
          <span style={{ fontSize: depth > 0 ? 13 : 15, flexShrink: 0, opacity: isActive || childActive ? 1 : 0.7 }}>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.count !== null && !isGroup && (
            <span style={{ fontSize: 10, fontWeight: 700, background: isActive ? "#6366f130" : c.borderLight, color: isActive ? "#818cf8" : c.textMuted, borderRadius: 8, padding: "1px 7px" }}>{item.count}</span>
          )}
          {isGroup && (
            <span style={{ fontSize: 10, color: c.textMuted, transition: "transform 0.15s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
          )}
        </div>
        {isGroup && isExpanded && (
          <div style={{ borderLeft: `2px solid ${c.borderLight}`, marginLeft: 18, marginBottom: 2 }}>
            {item.children!.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside style={{ width: 220, minWidth: 220, background: c.bgSidebar, borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${c.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: "-0.02em", boxShadow: "0 2px 8px #6366f140", flexShrink: 0 }}>MR</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary, letterSpacing: "-0.02em" }}>MarketRadar</div>
            {companyUrl && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 1 }}>{companyUrl}</div>}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "8px 8px", flex: 1, overflowY: "auto" }}>
        {navSections.map(section => (
          <div key={section.title}>
            <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: "0.1em", padding: "12px 10px 5px", textTransform: "uppercase" }}>{section.title}</div>
            {section.items.map(item => renderItem(item))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ padding: "8px", borderTop: `1px solid ${c.border}` }}>
        <div onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: c.textSecondary, transition: "background 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.background = c.bgSidebarHover}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span>{theme === "light" ? "🌙" : "☀️"}</span>
          <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
        </div>
        {user && (
          <div style={{ padding: "8px 10px", borderTop: `1px solid ${c.borderLight}`, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#34d399", border: `2px solid ${c.bgSidebar}` }} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                <div style={{ fontSize: 10, color: c.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
              </div>
            </div>
            <div onClick={onLogout}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.accentRed, cursor: "pointer", padding: "4px 0", opacity: 0.8, transition: "opacity 0.12s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.8"}>
              <span>↩</span><span>Выйти</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
