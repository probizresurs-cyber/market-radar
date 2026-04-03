"use client";

import { useState, useEffect } from "react";
import type { AnalysisResult } from "@/lib/types";

// ============================================================
// MarketRadar — Конкурентный анализ для Company24.pro
// ============================================================

const COLORS = {
  light: {
    bg: "#faf8f5", bgCard: "#ffffff", bgSidebar: "#fdf6ee",
    bgSidebarHover: "#f5ebe0", bgSidebarActive: "#ede2d4",
    accent: "#3b82f6", accentWarm: "#d4894e", accentGreen: "#22a06b",
    accentRed: "#e34935", accentYellow: "#e6a817",
    textPrimary: "#1e293b", textSecondary: "#64748b", textMuted: "#94a3b8",
    border: "#e8dfd5", borderLight: "#f0ebe4",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    shadowLg: "0 4px 12px rgba(0,0,0,0.08)",
  },
  dark: {
    bg: "#1a1a1f", bgCard: "#24242b", bgSidebar: "#1e1e24",
    bgSidebarHover: "#2a2a32", bgSidebarActive: "#32323c",
    accent: "#5b9cf6", accentWarm: "#e0a06a", accentGreen: "#36b37e",
    accentRed: "#f06555", accentYellow: "#f0b830",
    textPrimary: "#e8e4df", textSecondary: "#9e9a94", textMuted: "#6b6860",
    border: "#35353d", borderLight: "#2c2c34",
    shadow: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
    shadowLg: "0 4px 12px rgba(0,0,0,0.4)",
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
  { name: "MegaIndex", method: "megaindex.ru API", price: "Бесплатно (базовый)", phase: "v2" },
  { name: "Яндекс.Wordstat", method: "wordstat.yandex.ru парсинг", price: "Бесплатно", phase: "v2" },
  { name: "Яндекс.Карты", method: "Playwright парсинг", price: "Бесплатно", phase: "v2" },
  { name: "2ГИС", method: "Playwright парсинг", price: "Бесплатно", phase: "v2" },
  { name: "YouTube / Social Blade", method: "YouTube Data API", price: "Бесплатно", phase: "v2" },
  { name: "zakupki.gov.ru", method: "Парсинг / API", price: "Бесплатно", phase: "v2" },
  { name: "Rusprofile.ru", method: "Парсинг", price: "Бесплатно (базовый)", phase: "v2" },
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
  onboardingDone: boolean;
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
  return (
    <div style={{ fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", background: c.bg, color: c.textPrimary, minHeight: "100vh" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", borderBottom: `1px solid ${c.border}`, background: c.bgCard, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.textPrimary }}>MarketRadar</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ background: "none", border: "none", cursor: "pointer", color: c.textMuted, fontSize: 18, fontFamily: "inherit" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button onClick={onLogin} style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: c.textSecondary, fontFamily: "inherit" }}>
            Войти
          </button>
          <button onClick={onRegister} style={{ background: c.accent, border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff", fontFamily: "inherit" }}>
            Попробовать бесплатно
          </button>
        </div>
      </nav>

      <section style={{ textAlign: "center", padding: "72px 20px 56px", background: `linear-gradient(180deg, ${c.accent}0a 0%, ${c.bg} 100%)` }}>
        <div style={{ display: "inline-block", background: c.accentWarm + "20", color: c.accentWarm, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
          ИИ-анализ конкурентов для малого бизнеса
        </div>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 50px)", fontWeight: 900, lineHeight: 1.15, margin: "0 auto 20px", maxWidth: 700, color: c.textPrimary }}>
          Узнайте всё о конкурентах<br />
          <span style={{ color: c.accent }}>за 10 минут</span>
        </h1>
        <p style={{ fontSize: 16, color: c.textSecondary, maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.65 }}>
          MarketRadar анализирует сайты конкурентов с помощью Claude AI — SEO, соцсети, контент, HR-бренд — и даёт конкретные рекомендации
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onRegister} style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 14px ${c.accent}40` }}>
            Начать бесплатно →
          </button>
          <button onClick={onLogin} style={{ background: c.bgCard, color: c.textPrimary, border: `1px solid ${c.border}`, borderRadius: 12, padding: "14px 28px", fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            Уже есть аккаунт
          </button>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: c.textMuted }}>Бесплатно · Без кредитной карты · 3 анализа в месяц</div>
      </section>

      <section style={{ padding: "0 20px 60px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: c.textPrimary, textAlign: "center", marginBottom: 32 }}>Три инструмента в одном</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 18 }}>
          {[
            { icon: "🔍", title: "Самоанализ", desc: "Введите свой сайт — получите полный аудит: SEO, соцсети, контент, HR-бренд и стек технологий. Сравнение со средним по нише." },
            { icon: "🎯", title: "Мониторинг конкурентов", desc: "Добавьте до 10 конкурентов и видите их сильные и слабые стороны. Battle Cards помогут подготовиться к встрече с клиентом." },
            { icon: "💡", title: "AI-рекомендации", desc: "Claude AI анализирует данные и даёт конкретные советы: что добавить на сайт, какие слова написать, какие каналы развить." },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: "26px 22px", boxShadow: c.shadow }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "0 20px 60px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: c.textPrimary, margin: "0 0 8px" }}>Тарифы</h2>
          <p style={{ fontSize: 14, color: c.textSecondary, margin: 0 }}>Начните бесплатно, масштабируйтесь по мере роста</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          {[
            { name: "Free", price: "₽0", period: "", features: ["1 компания", "3 конкурента", "2 анализа/мес", "Базовые рекомендации"], highlight: false, cta: "Начать бесплатно" },
            { name: "Starter", price: "₽2 990", period: "/мес", features: ["1 компания", "10 конкурентов", "Безлимит анализов", "PDF-отчёты", "Telegram-уведомления"], highlight: false, cta: "Попробовать" },
            { name: "Pro", price: "₽7 990", period: "/мес", features: ["3 компании", "30 конкурентов", "Battle cards", "API-доступ", "White-label отчёты"], highlight: true, cta: "Выбрать Pro" },
            { name: "Agency", price: "₽14 990", period: "/мес", features: ["10 компаний", "100 конкурентов", "Real-time обновление", "5 мест", "Брендированные отчёты"], highlight: false, cta: "Для агентств" },
          ].map(plan => (
            <div key={plan.name} style={{ background: plan.highlight ? c.accent : c.bgCard, borderRadius: 16, border: `2px solid ${plan.highlight ? c.accent : c.border}`, padding: "22px 18px", position: "relative", boxShadow: plan.highlight ? `0 8px 20px ${c.accent}30` : c.shadow }}>
              {plan.highlight && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: c.accentWarm, color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Популярный</div>}
              <div style={{ fontSize: 14, fontWeight: 700, color: plan.highlight ? "#fff" : c.textPrimary, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 14 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: plan.highlight ? "#fff" : c.textPrimary }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: plan.highlight ? "rgba(255,255,255,0.7)" : c.textMuted }}>{plan.period}</span>
              </div>
              <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ fontSize: 12, color: plan.highlight ? "rgba(255,255,255,0.9)" : c.textSecondary, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: plan.highlight ? "#fff" : c.accentGreen, fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button onClick={onRegister} style={{ width: "100%", background: plan.highlight ? "#fff" : c.accent, color: plan.highlight ? c.accent : "#fff", border: "none", borderRadius: 10, padding: "10px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "0 20px 60px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: c.textPrimary, textAlign: "center", marginBottom: 28 }}>Отзывы</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
          {[
            { name: "Алексей М.", role: "Директор digital-агентства", text: "За час нашёл 3 слабых места у главного конкурента и обновил предложение. Клиент оценил — закрыли сделку." },
            { name: "Ирина Соколова", role: "Маркетолог клиники", text: "Наконец понятно, почему конкурент в ТОП-3 Яндекса. Оказалось, schema.org — добавили за 2 дня, трафик вырос." },
            { name: "Дмитрий К.", role: "Владелец B2B компании", text: "Онбординг за 10 минут. Система сама предложила конкурентов по нише — не нужно ничего гуглить." },
          ].map(({ name, role, text }) => (
            <div key={name} style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 22, boxShadow: c.shadow }}>
              <div style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>"{text}"</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: c.textPrimary }}>{name}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{role}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ textAlign: "center", padding: "56px 20px", background: `linear-gradient(135deg, ${c.accent}12, ${c.accentWarm}12)` }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: c.textPrimary, margin: "0 0 10px" }}>Начните анализировать сейчас</h2>
        <p style={{ fontSize: 14, color: c.textSecondary, margin: "0 0 24px" }}>Первые 3 анализа — бесплатно, без кредитной карты</p>
        <button onClick={onRegister} style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
          Создать аккаунт →
        </button>
      </section>

      <footer style={{ textAlign: "center", padding: "20px", borderTop: `1px solid ${c.border}`, fontSize: 12, color: c.textMuted }}>
        © 2025 MarketRadar · Продукт Company24.pro
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: 20 }}>
      <div style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "36px 40px", width: "100%", maxWidth: 440, boxShadow: c.shadowLg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.textPrimary }}>MarketRadar</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: c.textPrimary }}>Создать аккаунт</h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 22px" }}>Бесплатно · Без кредитной карты</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Имя *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@example.com"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Пароль * (мин. 6 символов)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Телефон</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, fontFamily: "'PT Sans', 'Segoe UI', system-ui, sans-serif", padding: 20 }}>
      <div style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "36px 40px", width: "100%", maxWidth: 400, boxShadow: c.shadowLg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: c.textPrimary }}>MarketRadar</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: c.textPrimary }}>Войти</h1>
        <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 22px" }}>Добро пожаловать обратно</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@example.com"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5 }}>Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
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
  const MAX_COMPETITORS = 3;

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
    const updatedUser: UserAccount = { ...user, niche, companyName: companyName.trim(), companyUrl: companyUrl.trim(), onboardingDone: true };
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
        <div style={{ height: 4, borderRadius: 2, background: c.borderLight, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / 3) * 100}%`, background: c.accent, borderRadius: 2, transition: "width 0.4s" }} />
        </div>
      </div>

      <div style={{ background: c.bgCard, borderRadius: 20, border: `1px solid ${c.border}`, padding: "30px 36px", width: "100%", maxWidth: 560, boxShadow: c.shadowLg }}>
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: c.textPrimary }}>Выберите вашу нишу</h2>
            <p style={{ fontSize: 13, color: c.textSecondary, margin: "0 0 22px" }}>Мы подберём конкурентов и настроим анализ под вашу отрасль</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {niches.map(n => (
                <div key={n.id} onClick={() => setNiche(n.id)} style={{ border: `2px solid ${niche === n.id ? c.accent : c.border}`, borderRadius: 12, padding: 16, cursor: "pointer", background: niche === n.id ? c.accent + "0c" : "transparent", transition: "all 0.15s" }}>
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
  const color = score >= 75 ? c.accentGreen : score >= 50 ? c.accentWarm : c.accentRed;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.borderLight} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={circ - progress} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.25, fontWeight: 700, color: c.textPrimary, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.08, color: c.textMuted, marginTop: 2 }}>из 100</span>
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
    <div style={{ background: c.bgCard, borderRadius: 12, padding: "16px 20px", border: `1px solid ${c.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cat.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: c.textPrimary }}>{cat.name}</span>
          <span style={{ fontSize: 11, color: c.textMuted }}>{cat.weight}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 20, color }}>{cat.score}</span>
          {cat.delta !== 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: cat.delta > 0 ? c.accentGreen : c.accentRed, background: (cat.delta > 0 ? c.accentGreen : c.accentRed) + "18", padding: "2px 6px", borderRadius: 6 }}>
              {cat.delta > 0 ? "+" : ""}{cat.delta}
            </span>
          )}
        </div>
      </div>
      <ProgressBar value={cat.score} color={color} c={c} />
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
// Dashboard View
// ============================================================

function DashboardView({ c, data, competitors }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const { company, recommendations } = data;
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c.textPrimary }}>Дашборд</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>{company.name} · {company.url}</p>
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200, boxShadow: c.shadow }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 16, letterSpacing: "0.03em" }}>ОБЩИЙ SCORE</div>
          <ScoreRing score={company.score} c={c} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 12, color: c.textSecondary }}>
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary }}>{company.avgNiche}</div><div>Среднее ниши</div></div>
            <div style={{ width: 1, background: c.border }} />
            <div style={{ textAlign: "center" }}><div style={{ fontWeight: 700, fontSize: 16, color: c.accentGreen }}>{company.top10}+</div><div>ТОП-10%</div></div>
          </div>
        </div>
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, flex: 1, minWidth: 280, boxShadow: c.shadow, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 8, letterSpacing: "0.03em" }}>СРАВНЕНИЕ ПО КАТЕГОРИЯМ</div>
          <RadarChart data={company} competitors={competitors.map(c2 => c2.company)} c={c} size={240} />
          {competitors.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.accent }} /> Вы</span>
              {competitors.map((comp, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: c.textSecondary }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: [c.accentRed, c.accentYellow, c.accentGreen, c.accentWarm, c.accent][i % 5] }} />
                  {comp.company.name.length > 15 ? comp.company.name.slice(0, 15) + "…" : comp.company.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Категории оценки</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        {company.categories.map(cat => <CategoryCard key={cat.name} cat={cat} c={c} />)}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>AI-рекомендации</div>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
        {recommendations.map((rec, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
            <PriorityBadge priority={rec.priority} c={c} />
            <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.accentGreen, background: c.accentGreen + "12", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>{rec.effect}</span>
          </div>
        ))}
      </div>
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
                style={{ background: c.bgCard, borderRadius: 12, padding: 16, border: `1px solid ${c.border}`, cursor: "pointer", transition: "box-shadow 0.2s, transform 0.2s" }}
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {comp.company.categories.map(cat => (
                    <span key={cat.name} style={{ fontSize: 11, color: c.textSecondary, background: c.borderLight, padding: "2px 8px", borderRadius: 6 }}>
                      {cat.icon} {cat.score}
                    </span>
                  ))}
                </div>
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
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>AI-рекомендации</div>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow, marginBottom: 24 }}>
        {recommendations.map((rec, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
            <PriorityBadge priority={rec.priority} c={c} />
            <span style={{ flex: 1, fontSize: 13, color: c.textPrimary }}>{rec.text}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.accentGreen, background: c.accentGreen + "12", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>{rec.effect}</span>
          </div>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>Инсайты</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, boxShadow: c.shadow }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, marginBottom: 4 }}>{ins.title}</div>
                <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{ins.text}</div>
              </div>
            ))}
          </div>
        </>
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
// Insights View — 4 blocks per document
// ============================================================

function InsightsView({ c, data, competitors }: { c: Colors; data: AnalysisResult; competitors: AnalysisResult[] }) {
  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
    niche: { icon: "🔭", label: "Пустая ниша", color: c.accent },
    action: { icon: "🚀", label: "Топ-действие", color: c.accentGreen },
    battle: { icon: "⚔️", label: "Battle Card", color: c.accentRed },
  };

  // Clichés block: detect common phrases across competitors
  const cliches = [
    "«Индивидуальный подход» — используют все. Замените на конкретные цифры и кейсы.",
    "«Команда профессионалов» — расскажите о реальном опыте и результатах.",
    "«Комплексные решения» — опишите конкретный стек и методологию.",
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>AI-инсайты</h1>

      {/* Main insights from analysis */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        {data.insights.map((ins, i) => {
          const cfg = typeConfig[ins.type] ?? typeConfig.action;
          return (
            <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow, borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.color + "15", padding: "3px 10px", borderRadius: 6 }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{ins.text}</div>
            </div>
          );
        })}
      </div>

      {/* Battle Cards for each competitor */}
      {competitors.length > 0 && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>⚔️ Battle Cards</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {competitors.map((comp, i) => {
              const strengths = comp.company.categories.filter(c2 => c2.score >= 60);
              const weaknesses = comp.company.categories.filter(c2 => c2.score < 40);
              return (
                <div key={i} style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>
                    Вы vs {comp.company.name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                    <div>
                      <div style={{ color: c.accentGreen, fontWeight: 600, marginBottom: 4 }}>Их сильные стороны</div>
                      {strengths.length > 0 ? strengths.map(s => <div key={s.name} style={{ color: c.textSecondary }}>{s.icon} {s.name}: {s.score}</div>) :
                        <div style={{ color: c.textMuted }}>Нет явных сильных сторон</div>}
                    </div>
                    <div>
                      <div style={{ color: c.accentRed, fontWeight: 600, marginBottom: 4 }}>Их слабости</div>
                      {weaknesses.length > 0 ? weaknesses.map(w => <div key={w.name} style={{ color: c.textSecondary }}>{w.icon} {w.name}: {w.score}</div>) :
                        <div style={{ color: c.textMuted }}>Нет явных слабостей</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Clichés */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>🗣 Заезженные формулировки</div>
      <div style={{ background: c.bgCard, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: c.shadow }}>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 12 }}>
          Фразы, которые используют все — замените их, чтобы выделиться:
        </div>
        {cliches.map((cl, i) => (
          <div key={i} style={{ fontSize: 13, color: c.textPrimary, padding: "8px 0", borderBottom: i < cliches.length - 1 ? `1px solid ${c.borderLight}` : "none" }}>
            {cl}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Reports View
// ============================================================

function ReportsView({ c }: { c: Colors }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: c.textPrimary }}>Отчёты</h1>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 32, textAlign: "center", boxShadow: c.shadow }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, marginBottom: 6 }}>PDF-отчёты доступны на тарифе Starter</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 16 }}>Получите полный PDF с аудитом, сравнением конкурентов и AI-рекомендациями</div>
        <button style={{ background: c.accentWarm, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Перейти на Starter — ₽2 990/мес
        </button>
      </div>
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

function SettingsView({ c }: { c: Colors }) {
  const [tab, setTab] = useState<"profile" | "subscription" | "notifications">("profile");

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
          {[{ label: "Имя", placeholder: "Ваше имя" }, { label: "Email", placeholder: "email@example.com" }, { label: "Телефон", placeholder: "+7 (999) 123-45-67" }].map(field => (
            <div key={field.label} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>{field.label}</label>
              <input type="text" placeholder={field.placeholder}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, color: c.textPrimary, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          ))}
          <button style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
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
        <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, padding: 24, boxShadow: c.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, marginBottom: 16 }}>Telegram-уведомления</div>
          <div style={{ background: c.bg, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 8 }}>Подключите Telegram-бот для получения уведомлений:</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="@username" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textPrimary, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <button style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Подключить</button>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, marginBottom: 10 }}>Что присылать:</div>
          {["Анализ завершён", "Изменения у конкурентов", "Новые вакансии у конкурентов", "Еженедельный дайджест"].map(item => (
            <label key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 13, color: c.textPrimary, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked style={{ accentColor: c.accent }} /> {item}
            </label>
          ))}
          <button style={{ marginTop: 16, background: c.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Nav items
// ============================================================

const NAV_SECTIONS = [
  {
    title: "МАРКЕТИНГ",
    items: [
      { id: "new-analysis", icon: "🔎", label: "Новый анализ", count: null as number | null },
      { id: "dashboard", icon: "📊", label: "Дашборд", count: null as number | null },
      { id: "competitors", icon: "🎯", label: "Конкуренты", count: null as number | null },
      { id: "compare", icon: "⚖️", label: "Сравнение", count: null as number | null },
      { id: "insights", icon: "💡", label: "AI-инсайты", count: null as number | null },
      { id: "reports", icon: "📄", label: "Отчёты", count: null as number | null },
      { id: "sources", icon: "🔗", label: "Источники", count: null as number | null },
    ],
  },
  {
    title: "СИСТЕМА",
    items: [
      { id: "settings", icon: "⚙️", label: "Настройки", count: null as number | null },
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
  const c = COLORS[theme];

  // Check for existing session on mount
  useEffect(() => {
    const user = authGetCurrentUser();
    if (user) {
      setCurrentUser(user);
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

  // New analysis from within dashboard
  const handleNewAnalysis = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      setMyCompany(result);
      setCompetitors([]);
      setSelectedCompetitor(null);
      setActiveNav("dashboard");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add competitor
  const handleAddCompetitor = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeUrl(url);
      setCompetitors(prev => [...prev, result]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Onboarding complete: run initial analysis
  const handleOnboardingComplete = async (updatedUser: UserAccount, companyUrl: string, competitorUrls: string[]) => {
    setCurrentUser(updatedUser);
    setAppScreen("app");
    if (!companyUrl) { setStatus("done"); setActiveNav("new-analysis"); return; }
    setCurrentUrl(companyUrl);
    setStatus("loading");
    try {
      const result = await analyzeUrl(companyUrl);
      setMyCompany(result);
      for (const url of competitorUrls) {
        setCurrentUrl(url);
        const comp = await analyzeUrl(url);
        setCompetitors(prev => [...prev, comp]);
      }
      setActiveNav("dashboard");
    } catch {
      // If analysis fails, go to new-analysis so user can try again
      setActiveNav("new-analysis");
    } finally {
      setStatus("done");
    }
  };

  // Logout
  const handleLogout = () => {
    authSetCurrentUser(null);
    setCurrentUser(null);
    setAppScreen("landing");
    setMyCompany(null);
    setCompetitors([]);
    setStatus("idle");
    setActiveNav("new-analysis");
    setSelectedCompetitor(null);
  };

  // Update nav counts dynamically
  const navSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      count: item.id === "competitors" ? (competitors.length > 0 ? competitors.length : null) :
             item.id === "insights" ? (myCompany?.insights.length ?? null) : item.count,
    })),
  }));

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
      <SidebarComponent c={c} theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={setActiveNav} navSections={navSections} companyUrl={myCompany?.company.url ?? ""} user={currentUser} onLogout={handleLogout} />
      <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {activeNav === "new-analysis" && <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />}
        {activeNav === "dashboard" && (myCompany ? <DashboardView c={c} data={myCompany} competitors={competitors} /> : <NewAnalysisView c={c} onAnalyze={handleNewAnalysis} isAnalyzing={isAnalyzing} />)}
        {activeNav === "competitors" && <CompetitorsView c={c} myCompany={myCompany} competitors={competitors} onSelectCompetitor={(i) => { setSelectedCompetitor(i); }} onAddCompetitor={handleAddCompetitor} isAnalyzing={isAnalyzing} />}
        {activeNav === "compare" && <CompareView c={c} myCompany={myCompany} competitors={competitors} />}
        {activeNav === "insights" && myCompany && <InsightsView c={c} data={myCompany} competitors={competitors} />}
        {activeNav === "reports" && <ReportsView c={c} />}
        {activeNav === "sources" && <SourcesView c={c} />}
        {activeNav === "settings" && <SettingsView c={c} />}
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
  navSections: typeof NAV_SECTIONS; companyUrl: string;
  user?: UserAccount | null; onLogout?: () => void;
}) {
  return (
    <aside style={{ width: 220, minWidth: 220, background: c.bgSidebar, borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>MR</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, lineHeight: 1.2 }}>MarketRadar</div>
          <div style={{ fontSize: 10, color: c.textMuted }}>{companyUrl || "company24.pro"}</div>
        </div>
      </div>

      <div style={{ padding: "4px 8px", flex: 1 }}>
        {navSections.map(section => (
          <div key={section.title}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: "0.08em", padding: "12px 8px 6px" }}>{section.title}</div>
            {section.items.map(item => {
              const isActive = activeNav === item.id;
              return (
                <div key={item.id} onClick={() => setActiveNav(item.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: isActive ? c.bgSidebarActive : "transparent", fontWeight: isActive ? 600 : 400, fontSize: 13, color: isActive ? c.textPrimary : c.textSecondary, transition: "background 0.15s", marginBottom: 2 }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = c.bgSidebarHover; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.count !== null && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: c.accentWarm + "25", color: c.accentWarm, borderRadius: 10, padding: "1px 7px" }}>{item.count}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 8px 12px", borderTop: `1px solid ${c.border}` }}>
        <div onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: c.textSecondary, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = c.bgSidebarHover}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span style={{ fontSize: 15 }}>{theme === "light" ? "🌙" : "☀️"}</span>
          <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
        </div>
        {user && (
          <div style={{ padding: "8px 10px", borderTop: `1px solid ${c.borderLight}`, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, marginBottom: 1 }}>{user.name}</div>
            <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 8 }}>{user.email}</div>
            <div onClick={onLogout}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.accentRed, cursor: "pointer", padding: "4px 0" }}>
              <span>↩</span><span>Выйти</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
