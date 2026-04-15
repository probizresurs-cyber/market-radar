"use client";

import type { Colors, Theme } from "@/lib/colors";

export function LandingPageView({ c, theme, setTheme, onRegister, onLogin }: {
  c: Colors;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onRegister: () => void;
  onLogin: () => void;
}) {
  const isDark = theme === "dark";
  void isDark;
  return (
    <div style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", background: "var(--background)", color: "var(--foreground)", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: "var(--primary)"40; }
        .mr-btn { transition: all 0.15s ease; }
        .mr-btn:hover { transform: translateY(-1px); opacity: 0.92; }
        .mr-btn:active { transform: translateY(0); }
        .mr-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .mr-card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 32px var(--primary)20 !important; }
        @keyframes mr-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes mr-pulse-ring { 0%{transform:scale(0.95);opacity:0.7} 100%{transform:scale(1.2);opacity:0} }
        @keyframes mr-gradient { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", borderBottom: "1px solid var(--border)", background: "var(--background)" + "e0", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, #6366f1, #818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em", boxShadow: "0 2px 12px #6366f140" }}>MR</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--foreground)", letterSpacing: "-0.02em" }}>MarketRadar</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="mr-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--muted-foreground)", fontFamily: "inherit", fontSize: 14 }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button className="mr-btn" onClick={onLogin} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--muted-foreground)", fontFamily: "inherit" }}>
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
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`, backgroundSize: "48px 48px", opacity: 0.4 }} />
        {/* glow blobs */}
        <div style={{ position: "absolute", top: "20%", left: "25%", width: 500, height: 500, borderRadius: "50%", background: "#6366f118", filter: "blur(100px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "10%", right: "20%", width: 300, height: 300, borderRadius: "50%", background: "#818cf810", filter: "blur(80px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#6366f115", color: "#818cf8", borderRadius: 20, padding: "5px 16px 5px 8px", fontSize: 12, fontWeight: 600, marginBottom: 28, border: "1px solid #6366f125", backdropFilter: "blur(8px)" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800 }}>✦</div>
            ИИ-анализ конкурентов для бизнеса в России
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.05, margin: "0 auto 24px", maxWidth: 820, letterSpacing: "-0.03em", color: "var(--foreground)" }}>
            Узнайте всё о конкурентах
            <br />
            <span style={{ background: "linear-gradient(135deg, #6366f1, #818cf8, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              за 10 минут
            </span>
          </h1>

          <p style={{ fontSize: 17, color: "var(--muted-foreground)", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7, fontWeight: 400 }}>
            MarketRadar анализирует сайты конкурентов с помощью Claude AI —<br />SEO, соцсети, контент, HR-бренд — и даёт конкретные рекомендации
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <button className="mr-btn" onClick={onRegister} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px #6366f150, 0 0 0 1px #6366f1" }}>
              Начать бесплатно →
            </button>
            <button className="mr-btn" onClick={onLogin} style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 28px", fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(8px)" }}>
              Уже есть аккаунт
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", letterSpacing: "0.02em" }}>Бесплатно · Без кредитной карты · 3 анализа в месяц</div>

          {/* stats row */}
          <div style={{ display: "flex", gap: 0, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
            {[
              { num: "10 000+", label: "анализов выполнено" },
              { num: "40+", label: "источников данных" },
              { num: "< 60 сек", label: "время анализа" },
              { num: "99%", label: "аптайм API" },
            ].map(({ num, label }, i) => (
              <div key={label} style={{ textAlign: "center", padding: "16px 36px", borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.03em" }}>{num}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "0 20px 80px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ВОЗМОЖНОСТИ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: "var(--foreground)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Три инструмента в одном</h2>
          <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: 0 }}>Всё что нужно для конкурентного анализа без лишних инструментов</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {[
            { icon: "🔍", title: "Глубокий самоанализ", desc: "Введите свой сайт — получите полный аудит: SEO, соцсети, контент, HR-бренд и стек. Сравнение со средним по нише и ТОП-10%.", accent: "#6366f1", tag: "SEO + Контент" },
            { icon: "🎯", title: "Мониторинг конкурентов", desc: "Добавьте до 30 конкурентов и видите их сильные и слабые стороны. Battle Cards помогут подготовиться к встрече с клиентом.", accent: "#10b981", tag: "До 30 конкурентов" },
            { icon: "✍️", title: "AI-правки текста", desc: "Claude AI анализирует оффер, заголовки и мета-теги — и даёт готовые переформулировки, новые ключевые слова и идеи контента.", accent: "#f59e0b", tag: "Готовые тексты" },
          ].map(({ icon, title, desc, accent, tag }) => (
            <div key={title} className="mr-card-hover" style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "28px 26px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: accent + "18", border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{icon}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: accent + "15", padding: "4px 10px", borderRadius: 20, border: `1px solid ${accent}25` }}>{tag}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)", marginBottom: 10, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "0 20px 80px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>КАК ЭТО РАБОТАЕТ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: "var(--foreground)", margin: 0, letterSpacing: "-0.02em" }}>Три шага до инсайтов</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { n: "01", title: "Введите URL сайта", desc: "Вставьте адрес своего сайта или конкурента — мы соберём все публичные данные автоматически." },
            { n: "02", title: "AI-анализ за 30–60 секунд", desc: "Claude AI обрабатывает SEO, тексты, соцсети, вакансии и юридические данные через 8+ открытых API." },
            { n: "03", title: "Получите готовые действия", desc: "Конкретные правки заголовков, список ключевых слов, оффер-редизайн и сравнение с конкурентами." },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: 20, alignItems: "flex-start", background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: "22px 24px", boxShadow: "var(--shadow)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#6366f115", border: "1px solid #6366f125", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#818cf8", flexShrink: 0, letterSpacing: "-0.02em" }}>{n}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 4, letterSpacing: "-0.01em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: "0 20px 80px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 12 }}>ТАРИФЫ</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: "var(--foreground)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>Начните бесплатно</h2>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>Масштабируйтесь по мере роста без рисков</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {[
            { name: "Free", price: "₽0", period: "", features: ["1 компания", "3 конкурента", "3 анализа/мес", "Базовые рекомендации"], highlight: false, cta: "Начать бесплатно" },
            { name: "Starter", price: "₽2 990", period: "/мес", features: ["1 компания", "10 конкурентов", "Безлимит анализов", "PDF-отчёты", "Telegram-уведомления"], highlight: false, cta: "Попробовать" },
            { name: "Pro", price: "₽7 990", period: "/мес", features: ["3 компании", "30 конкурентов", "Battle cards", "API-доступ", "White-label отчёты"], highlight: true, cta: "Выбрать Pro" },
            { name: "Agency", price: "₽14 990", period: "/мес", features: ["10 компаний", "100 конкурентов", "Real-time", "5 рабочих мест", "Брендированные отчёты"], highlight: false, cta: "Для агентств" },
          ].map(plan => (
            <div key={plan.name} className="mr-card-hover" style={{ background: plan.highlight ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--card)", borderRadius: 20, border: `1px solid ${plan.highlight ? "#6366f1" : "var(--border)"}`, padding: "24px 20px", position: "relative", boxShadow: plan.highlight ? "0 8px 32px #6366f140, 0 0 0 1px #6366f160" : "var(--shadow)" }}>
              {plan.highlight && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>ПОПУЛЯРНЫЙ</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.7)" : "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.04em" }}>{plan.name.toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 18 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: plan.highlight ? "#fff" : "var(--foreground)", letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.5)" : "var(--muted-foreground)" }}>{plan.period}</span>
              </div>
              <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 7 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 8 }}>
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
          <h2 style={{ fontSize: 34, fontWeight: 800, color: "var(--foreground)", margin: 0, letterSpacing: "-0.02em" }}>Доверяют маркетологи</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
          {[
            { name: "Алексей М.", role: "Директор digital-агентства", text: "За час нашёл 3 слабых места у главного конкурента и обновил предложение. Клиент оценил — закрыли сделку.", avatar: "А" },
            { name: "Ирина Соколова", role: "Маркетолог клиники", text: "Наконец понятно, почему конкурент в ТОП-3 Яндекса. Оказалось, schema.org — добавили за 2 дня, трафик вырос.", avatar: "И" },
            { name: "Дмитрий К.", role: "Владелец B2B компании", text: "Онбординг за 10 минут. Система сама предложила конкурентов по нише — не нужно ничего гуглить.", avatar: "Д" },
          ].map(({ name, role, text, avatar }) => (
            <div key={name} className="mr-card-hover" style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px", boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: 14, color: "#f59e0b", marginBottom: 12, letterSpacing: 3 }}>★★★★★</div>
              <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.65, marginBottom: 18 }}>"{text}"</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>{avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{role}</div>
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
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "var(--foreground)", margin: "0 0 12px", letterSpacing: "-0.03em" }}>Начните анализировать сейчас</h2>
          <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 32px" }}>Первые 3 анализа — бесплатно, без кредитной карты</p>
          <button className="mr-btn" onClick={onRegister} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "16px 48px", fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px #6366f150", letterSpacing: "-0.01em" }}>
            Создать аккаунт →
          </button>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "20px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
        © 2026 MarketRadar · Продукт Company24.pro
      </footer>
    </div>
  );
}
