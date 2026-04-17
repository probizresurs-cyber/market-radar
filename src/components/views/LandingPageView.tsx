"use client";

import { useState } from "react";
import type { Colors, Theme } from "@/lib/colors";

export function LandingPageView({ c, theme, setTheme, onRegister, onLogin }: {
  c: Colors;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onRegister: () => void;
  onLogin: () => void;
}) {
  void c;
  const [url, setUrl] = useState("");
  const TG_BOT = "https://t.me/Company24Bot?start=lending";
  const TG_CHANNEL = "https://t.me/company24pro";
  const TG_PARTNER_BOT = "https://t.me/Company24PartnerBot";

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

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: fg, minHeight: "100vh", overflowX: "hidden" }}>
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
        @media (max-width: 640px) {
          .lp-hero-btns { flex-direction: column !important; }
          .lp-plans { grid-template-columns: 1fr !important; }
          .lp-services { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .lp-url-row { flex-direction: column !important; }
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
          <a href="#how" style={{ color: muted, textDecoration: "none" }}>Как работает</a>
          <a href="#pricing" style={{ color: muted, textDecoration: "none" }}>Тарифы</a>
          <a href="#partner" style={{ color: muted, textDecoration: "none" }}>Партнёрам</a>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="lp-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ background: "none", border: `1px solid ${border}`, borderRadius: 7, padding: "5px 9px", color: muted, fontSize: 14, fontFamily: "inherit" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button className="lp-btn" onClick={onLogin} style={{ background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: fg, fontFamily: "inherit" }}>
            Войти
          </button>
          <button className="lp-btn" onClick={onRegister} style={{ background: accent, border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "inherit", boxShadow: `0 2px 12px ${accent}50` }}>
            Начать бесплатно
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "88px 20px 72px", position: "relative", overflow: "hidden" }}>
        {/* grid bg */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${border} 1px,transparent 1px),linear-gradient(90deg,${border} 1px,transparent 1px)`, backgroundSize: "48px 48px", opacity: 0.5 }} />
        <div style={{ position: "absolute", top: "15%", left: "20%", width: 560, height: 560, borderRadius: "50%", background: `${accent}12`, filter: "blur(120px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "5%", right: "15%", width: 300, height: 300, borderRadius: "50%", background: "#818cf80d", filter: "blur(80px)", pointerEvents: "none" }} />

        <div className="lp-fade" style={{ position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${accent}15`, color: "#818cf8", borderRadius: 24, padding: "5px 16px 5px 8px", fontSize: 12, fontWeight: 600, marginBottom: 28, border: `1px solid ${accent}25` }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800 }}>AI</div>
            Powered by Claude AI · Company24.pro
          </div>

          {/* H1 */}
          <h1 style={{ fontSize: "clamp(34px,5.5vw,66px)", fontWeight: 900, lineHeight: 1.05, margin: "0 auto 20px", maxWidth: 780, letterSpacing: "-0.03em" }}>
            AI‑анализ бизнеса
            <br />
            <span style={{ background: `linear-gradient(135deg,${accent},#818cf8,#a5b4fc)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              за 3 минуты
            </span>
          </h1>

          <p style={{ fontSize: 18, color: muted, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.65 }}>
            Узнайте, как ваш бизнес выглядит для клиентов.<br />
            Получите 10+ рекомендаций по росту.
          </p>

          {/* Primary CTA — Telegram */}
          <div style={{ marginBottom: 16 }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#2AABEE", color: "#fff", borderRadius: 14, padding: "15px 36px", fontWeight: 700, fontSize: 16, textDecoration: "none", boxShadow: "0 4px 24px #2AABEE50", fontFamily: "inherit" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" fill="white"/></svg>
              Получить бесплатный анализ в Telegram
            </a>
          </div>

          {/* Alt CTA — URL input */}
          <div style={{ maxWidth: 520, margin: "0 auto 12px" }}>
            <div className="lp-url-row" style={{ display: "flex", gap: 8, background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "6px 6px 6px 16px", boxShadow: `0 2px 16px ${accent}10` }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUrlAnalyze()}
                placeholder="Введите URL вашего сайта..."
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: fg, outline: "none", fontFamily: "inherit", minWidth: 0 }}
              />
              <button className="lp-btn" onClick={handleUrlAnalyze} style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 14, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Получить анализ →
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: muted }}>Бесплатно · Без карты · 7 дней trial</div>

          {/* Stats */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 56, flexWrap: "wrap", borderTop: `1px solid ${border}`, paddingTop: 40 }}>
            {[
              { num: "3 мин", label: "время первого анализа" },
              { num: "40+", label: "источников данных" },
              { num: "10+", label: "AI-рекомендаций" },
              { num: "99%", label: "аптайм" },
            ].map(({ num, label }, i) => (
              <div key={label} style={{ textAlign: "center", padding: "12px 36px", borderLeft: i > 0 ? `1px solid ${border}` : "none" }}>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: fg }}>{num}</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ЧТО ПОЛУЧИТЕ ────────────────────────────────────── */}
      <section id="features" style={{ padding: "72px 20px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ЧТО ПОЛУЧИТЕ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Три инструмента роста</h2>
          <p style={{ fontSize: 15, color: muted, margin: 0 }}>Всё в одном — без лишних сервисов</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 20 }}>
          {[
            {
              icon: "📊",
              emoji_bg: "#6366f1",
              title: "Score компании",
              desc: "Интегральная оценка вашего бизнеса по SEO, соцсетям, контенту, HR-бренду и репутации. Сравнение со средним по нише и ТОП-10%.",
              tag: "Аудит · Оценка",
              accent: "#6366f1",
            },
            {
              icon: "🎯",
              emoji_bg: "#10b981",
              title: "Анализ конкурентов",
              desc: "Добавьте до 30 конкурентов — получите сравнительный дашборд: сильные и слабые стороны, офферы, SEO-позиции, рейтинги на картах.",
              tag: "До 30 конкурентов",
              accent: "#10b981",
            },
            {
              icon: "🤖",
              emoji_bg: "#f59e0b",
              title: "AI-рекомендации",
              desc: "Claude AI формирует 10+ конкретных действий: переформулировки заголовков, новые ключевые слова, правки оффера и контент-идеи.",
              tag: "Claude AI",
              accent: "#f59e0b",
            },
          ].map(({ icon, title, desc, tag, accent: ac }) => (
            <div key={title} className="lp-card" style={{ background: card, borderRadius: 20, border: `1px solid ${border}`, padding: "28px 24px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${ac}80,transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: `${ac}18`, border: `1px solid ${ac}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: ac, background: `${ac}15`, padding: "4px 10px", borderRadius: 20 }}>{tag}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 14, color: muted, lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── КАК ЭТО РАБОТАЕТ ────────────────────────────────── */}
      <section id="how" style={{ padding: "0 20px 72px", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>КАК ЭТО РАБОТАЕТ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Три шага до инсайтов</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { n: "01", icon: "🌐", title: "Введите URL", desc: "Вставьте адрес своего сайта — мы соберём все публичные данные автоматически через 40+ источников." },
            { n: "02", icon: "⚡", title: "AI анализирует", desc: "Claude AI обрабатывает SEO, тексты, соцсети, вакансии, отзывы на картах и юридические данные. Занимает ~3 минуты." },
            { n: "03", icon: "📋", title: "Получите отчёт", desc: "Готовые рекомендации, Score по 10 параметрам, сравнение с конкурентами и конкретные правки для роста." },
          ].map(({ n, icon, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: 20, alignItems: "flex-start", background: card, borderRadius: 16, border: `1px solid ${border}`, padding: "22px 24px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: accentLight, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.05em" }}>{n}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</span>
                </div>
                <div style={{ fontSize: 14, color: muted, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── СКРИНШОТЫ ────────────────────────────────────────── */}
      <section style={{ padding: "0 20px 72px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ПРОДУКТ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Как выглядит изнутри</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {[
            { label: "Дашборд компании", icon: "📊", desc: "Score, SEO-метрики, соцсети, рейтинги на картах" },
            { label: "AI-рекомендации", icon: "🤖", desc: "Конкретные действия с приоритетами и примерами" },
          ].map(({ label, icon, desc }) => (
            <div key={label} style={{ background: card, borderRadius: 20, border: `2px dashed ${border}`, minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: muted, padding: 32 }}>
              <div style={{ fontSize: 48 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: fg }}>{label}</div>
              <div style={{ fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>{desc}</div>
              <div style={{ fontSize: 11, background: `${accent}15`, color: accent, padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>Скриншот появится скоро</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ТАРИФЫ ───────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "0 20px 72px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ТАРИФЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Начните бесплатно</h2>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Масштабируйтесь по мере роста без рисков</p>
        </div>
        <div className="lp-plans" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            { name: "Trial", price: "Бесплатно", period: "7 дней", features: ["Анализ компании", "3 конкурента", "AI-рекомендации", "Score компании"], highlight: false, cta: "Начать бесплатно", tag: "" },
            { name: "Старт", price: "9 900 ₽", period: "/мес", features: ["Безлимит анализов", "10 конкурентов", "Контент-план", "Telegram-уведомления"], highlight: false, cta: "Начать", tag: "" },
            { name: "Бизнес", price: "24 900 ₽", period: "/мес", features: ["30 конкурентов", "Анализ отзывов", "Контент-завод", "Брендбук + SMM"], highlight: true, cta: "Начать", tag: "Популярный" },
            { name: "Про", price: "39 900 ₽", period: "/мес", features: ["Мониторинг 24/7", "50 конкурентов", "AI-видео аватар", "Презентации + лендинги"], highlight: false, cta: "Начать", tag: "" },
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
                <span style={{ fontSize: plan.price === "Бесплатно" ? 22 : 24, fontWeight: 900, color: plan.highlight ? "#fff" : fg, letterSpacing: "-0.03em" }}>{plan.price}</span>
              </div>
              <div style={{ fontSize: 12, color: plan.highlight ? "rgba(255,255,255,0.5)" : muted, marginBottom: 20 }}>{plan.period}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.85)" : muted }}>
                    <span style={{ color: plan.highlight ? "#a5b4fc" : accent, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
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
      </section>

      {/* ── РАЗОВЫЕ УСЛУГИ ───────────────────────────────────── */}
      <section style={{ padding: "0 20px 72px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>РАЗОВЫЕ УСЛУГИ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Платите только за нужное</h2>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Без подписки, без обязательств</p>
        </div>
        <div className="lp-services" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { icon: "🔬", title: "Анализ конкурентов", price: "от 9 900 ₽", desc: "Глубокий разбор до 50 конкурентов: офферы, SEO, отзывы, соцсети", accent: "#6366f1" },
            { icon: "✍️", title: "Контент-завод", price: "от 4 900 ₽", desc: "Статьи, посты, рилсы, сторис — пакетами от 5 до 100 единиц", accent: "#10b981" },
            { icon: "🎨", title: "Презентации и лендинги", price: "от 4 900 ₽", desc: "Брендовые презентации и одностраничные лендинги под вашу нишу", accent: "#f59e0b" },
          ].map(({ icon, title, price, desc, accent: ac }) => (
            <div key={title} className="lp-card" style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, padding: "24px 20px" }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: `${ac}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 14, color: muted, lineHeight: 1.55, marginBottom: 14 }}>{desc}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: ac }}>{price}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <a href="/pricing" className="lp-btn" style={{ display: "inline-block", background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 600, color: fg, textDecoration: "none" }}>
            Посмотреть все услуги →
          </a>
        </div>
      </section>

      {/* ── ПАРТНЁРСКАЯ ПРОГРАММА ────────────────────────────── */}
      <section id="partner" style={{ padding: "0 20px 72px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: `linear-gradient(135deg,${accent}18,#818cf810)`, borderRadius: 24, border: `1px solid ${accent}25`, padding: "48px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-40%", right: "-10%", width: 320, height: 320, borderRadius: "50%", background: `${accent}12`, filter: "blur(80px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 14 }}>ПАРТНЁРСКАЯ ПРОГРАММА</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              До <span style={{ color: accent }}>20%</span> с каждого клиента
            </h2>
            <p style={{ fontSize: 15, color: muted, maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.65 }}>
              Приводите клиентов и зарабатывайте комиссию с каждой их оплаты.
              Ставка растёт по мере увеличения базы клиентов — до 20% для рефералов, до 50% для интеграторов.
            </p>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
              {[
                { label: "Реферал", rates: "10% → 20%", desc: "По числу клиентов" },
                { label: "Интегратор", rates: "25% → 50%", desc: "Агентства и партнёры" },
                { label: "Выплата от", rates: "3 000 ₽", desc: "Ежемесячно" },
              ].map(({ label, rates, desc }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em" }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: fg, letterSpacing: "-0.02em" }}>{rates}</div>
                  <div style={{ fontSize: 12, color: muted }}>{desc}</div>
                </div>
              ))}
            </div>
            <a href={TG_PARTNER_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: accent, color: "#fff", borderRadius: 12, padding: "13px 32px", fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: `0 4px 20px ${accent}50`, fontFamily: "inherit" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" fill="white"/></svg>
              Стать партнёром → @Company24PartnerBot
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ───────────────────────────────────────── */}
      <section style={{ padding: "64px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center,${accent}12 0%,transparent 70%)` }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, margin: "0 0 12px", letterSpacing: "-0.03em" }}>Начните анализировать сейчас</h2>
          <p style={{ fontSize: 15, color: muted, margin: "0 0 32px" }}>7 дней бесплатно · Без кредитной карты · Отмена в любой момент</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#2AABEE", color: "#fff", borderRadius: 12, padding: "14px 30px", fontWeight: 700, fontSize: 15, textDecoration: "none", fontFamily: "inherit" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" fill="white"/></svg>
              В Telegram
            </a>
            <button className="lp-btn" onClick={onRegister} style={{ background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 30px", fontWeight: 700, fontSize: 15, fontFamily: "inherit", boxShadow: `0 4px 24px ${accent}50` }}>
              Войти в платформу →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${border}`, padding: "40px 32px 28px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 32, marginBottom: 32 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${accent},#818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 10 }}>MR</div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>MarketRadar</span>
            </div>
            <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>AI-аналитика для бизнеса в России. Продукт Company24.pro</div>
          </div>

          {/* Продукт */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>ПРОДУКТ</div>
            {[
              { label: "Тарифы", href: "/pricing" },
              { label: "Партнёрская программа", href: "/partner" },
              { label: "Все услуги", href: "/pricing" },
            ].map(({ label, href }) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <a href={href} style={{ fontSize: 13, color: muted, textDecoration: "none" }}>{label}</a>
              </div>
            ))}
          </div>

          {/* Контакты */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>КОНТАКТЫ</div>
            <div style={{ marginBottom: 8 }}>
              <a href={TG_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <span>✈</span> Telegram-канал @company24pro
              </a>
            </div>
            <div style={{ marginBottom: 8 }}>
              <a href={TG_PARTNER_BOT} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🤝</span> Партнёрам @Company24PartnerBot
              </a>
            </div>
            <div>
              <a href={TG_BOT} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <span>💬</span> Поддержка в боте
              </a>
            </div>
          </div>

          {/* Документы */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fg, marginBottom: 14, letterSpacing: "0.05em" }}>ДОКУМЕНТЫ</div>
            <div style={{ marginBottom: 8 }}>
              <a href="/oferta" style={{ fontSize: 13, color: muted, textDecoration: "none" }}>Публичная оферта</a>
            </div>
            <div style={{ marginBottom: 8 }}>
              <a href="/privacy" style={{ fontSize: 13, color: muted, textDecoration: "none" }}>Политика конфиденциальности</a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 12, color: muted }}>
          <div>© 2026 MarketRadar · Company24.pro · Все права защищены</div>
          <div style={{ display: "flex", gap: 16 }}>
            <a href={TG_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ color: muted, textDecoration: "none" }}>Telegram</a>
            <a href="/pricing" style={{ color: muted, textDecoration: "none" }}>Тарифы</a>
            <a href="/partner" style={{ color: muted, textDecoration: "none" }}>Партнёрам</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
