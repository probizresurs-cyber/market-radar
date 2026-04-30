"use client";

/**
 * Public /partners marketing page (T-29).
 *
 * The existing `/partner` route is the authenticated partner dashboard
 * (registration + balance). This page is the public sales pitch that the
 * landing's footer + mini-banner link to. Matches the dark landing aesthetic:
 * inline styles, CSS variables, no emoji — all glyphs are lucide icons.
 *
 * Block order:
 *  1. HERO           — "Партнёрская программа MarketRadar"
 *  2. MISSION        — «Чтобы ваши клиенты процветали»
 *  3. REFERRAL       — 20% flat + how it works
 *  4. INTEGRATOR     — 25% → 50% scale + responsibilities
 *  5. COMPARISON     — referral vs integrator table
 *  6. FAQ            — 6 partner-specific questions + JSON-LD
 *  7. CTA + FOOTER
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronDown, Check, Users, Handshake, Target, Wallet,
  TrendingUp, ShieldCheck, Sparkles, Briefcase, Send, Building2,
} from "lucide-react";
import { REFERRAL_SCALES, INTEGRATOR_SCALES } from "@/lib/partner-types";

export default function PartnersPage() {
  // Dark by default — matches landing; respect saved user preference.
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("mr_theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* ignore */ }
  }, []);

  const isDark = theme === "dark";
  const bg = isDark ? "#0a0b0f" : "#ffffff";
  const fg = isDark ? "#f1f5f9" : "#0f172a";
  const muted = "#64748b";
  const card = isDark ? "#111318" : "#f8fafc";
  const border = isDark ? "#1e2433" : "#e2e8f0";
  const accent = "#6366f1";
  const neonCyan = "#4FC3F7";
  const neonMagenta = "#D500F9";
  const neonGreen = "#69FF47";

  // FAQ entries — also serialized to JSON-LD for AI-search discoverability
  const faq: Array<{ q: string; a: string }> = [
    {
      q: "Чем отличается реферальная программа от интеграторской?",
      a: "Реферальный партнёр просто приводит клиента по ссылке и получает 20% с каждого платежа — без обязательств. Интегратор глубоко работает с клиентом (внедрение рекомендаций, обучение, сопровождение) и получает прогрессивную комиссию от 25% до 50% в зависимости от количества активных клиентов.",
    },
    {
      q: "Как отслеживаются мои клиенты?",
      a: "Каждый партнёр получает уникальный реферальный код и персональную ссылку вида marketradar24.ru/?rf=XXXX. Клиент, перешедший по ссылке, закрепляется за партнёром навсегда — комиссия начисляется со всех его платежей, в том числе повторных подписок.",
    },
    {
      q: "Когда и как выплачиваются комиссии?",
      a: "Выплаты производятся ежемесячно по запросу из кабинета партнёра при балансе от 3 000 ₽. Есть 60-дневный резерв на случай возвратов — комиссия перемещается из резерва в доступный баланс через 60 дней после платежа клиента.",
    },
    {
      q: "Нужен ли ИП или ООО для получения выплат?",
      a: "Для физлиц возможны выплаты как самозанятому (НПД) или по договору ГПХ с удержанием НДФЛ. Для ИП и ООО — по счёту. Формат выбирается при первом запросе на выплату.",
    },
    {
      q: "Какую скидку получает мой клиент?",
      a: "Клиент, приведённый по реферальной ссылке, получает 10% скидку на первый платёж. Скидка суммируется с промокодами на запуске (например, START).",
    },
    {
      q: "Можно ли быть и реферальным, и интегратором одновременно?",
      a: "Нет — у партнёра один тип. Реферал может перейти в интеграторы после прохождения короткого обучения и подтверждения первых активных клиентов. Связь от реферальных клиентов сохраняется.",
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const referralRate = REFERRAL_SCALES[0].rate; // 20%
  const integratorMax = INTEGRATOR_SCALES[INTEGRATOR_SCALES.length - 1].rate; // 50%

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: fg, minHeight: "100vh", overflowX: "hidden" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <style>{`
        * { box-sizing: border-box; }
        .pp-btn { transition: all 0.15s ease; cursor: pointer; }
        .pp-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .pp-card { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; }
        @keyframes pp-fade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .pp-fade { animation: pp-fade 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
        @keyframes pp-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%      { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
        }
        .pp-pulse-dot { animation: pp-pulse 2.2s ease-in-out infinite; }
        .pp-faq summary::-webkit-details-marker { display: none; }
        .pp-faq summary { list-style: none; }
        .pp-faq[open] .pp-chev { transform: rotate(180deg); }
        .pp-faq[open] { border-color: rgba(99,102,241,0.35) !important; box-shadow: 0 0 0 1px rgba(99,102,241,0.15), 0 0 28px -8px rgba(99,102,241,0.35); }
        @media (max-width: 640px) {
          .pp-cols { grid-template-columns: 1fr !important; }
          .pp-hero-stats { flex-direction: column !important; gap: 20px !important; }
          .pp-hero-stats > div { border-left: none !important; }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 60, borderBottom: `1px solid ${border}`, background: bg + "f0", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: fg }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${accent},#818cf8)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>MR</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>MarketRadar</span>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/" className="pp-btn" style={{ color: muted, textDecoration: "none", fontSize: 13, padding: "7px 14px" }}>
            ← На главную
          </Link>
          <Link href="/partner/apply" className="pp-btn" style={{ background: accent, border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none", boxShadow: `0 2px 12px ${accent}50` }}>
            Стать партнёром
          </Link>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 1. HERO                                                 */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "80px 20px 56px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "5%", left: "15%", width: 520, height: 520, borderRadius: "50%", background: `${accent}22`, filter: "blur(130px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "5%", right: "12%", width: 420, height: 420, borderRadius: "50%", background: `${neonMagenta}15`, filter: "blur(120px)", pointerEvents: "none" }} />

        <div className="pp-fade" style={{ position: "relative", zIndex: 1, maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: `${accent}15`, color: "#a5b4fc", borderRadius: 999, padding: "8px 20px 8px 12px", fontSize: 13, fontWeight: 600, marginBottom: 28, border: `1px solid ${accent}40` }}>
            <span className="pp-pulse-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: neonGreen, display: "inline-block" }} />
            Партнёрская программа MarketRadar
          </div>

          <h1 style={{ fontSize: "clamp(36px,6vw,68px)", fontWeight: 900, lineHeight: 1.05, margin: "0 auto 22px", maxWidth: 900, letterSpacing: "-0.035em" }}>
            Зарабатывайте{" "}
            <span style={{ background: `linear-gradient(135deg, ${accent} 0%, ${neonMagenta} 50%, ${neonCyan} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              от 20% до 50%
            </span>
            {" "}с каждого платежа вашего клиента
          </h1>

          <p style={{ fontSize: 17, color: muted, maxWidth: 720, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Приводите компании, которые хотят расти системно, — и получайте ежемесячную
            комиссию, пока они остаются на подписке. Клиент получает 10% скидку. Вы — долю от всего LTV.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 44 }}>
            <Link href="/partner/apply" className="pp-btn" style={{ background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 30px", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: `0 4px 24px ${accent}55`, display: "inline-flex", alignItems: "center", gap: 8 }}>
              Зарегистрироваться <ArrowRight size={16} />
            </Link>
            <a href="#how" className="pp-btn" style={{ background: "transparent", color: fg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 30px", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
              Как работает
            </a>
          </div>

          {/* Hero stats */}
          <div className="pp-hero-stats" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", borderTop: `1px solid ${border}`, paddingTop: 32 }}>
            {[
              { num: `${referralRate}%`, label: "реферальная комиссия", color: neonCyan },
              { num: `до ${integratorMax}%`, label: "для интеграторов", color: neonMagenta },
              { num: "10%", label: "скидка клиенту", color: neonGreen },
              { num: "3 000 ₽", label: "минимум к выплате", color: "#FFB547" },
            ].map(({ num, label, color }, i) => (
              <div key={label} style={{ textAlign: "center", padding: "10px 32px", borderLeft: i > 0 ? `1px solid ${border}` : "none" }}>
                <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.035em", color, textShadow: `0 0 20px ${color}55`, lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 2. MISSION                                              */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "56px 20px", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ background: `linear-gradient(145deg, ${accent}14, ${neonMagenta}08)`, borderRadius: 24, border: `1px solid ${accent}35`, padding: "48px 44px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.12em", marginBottom: 18, background: `${accent}18`, padding: "6px 14px", borderRadius: 20 }}>
            <Sparkles size={12} /> НАША МИССИЯ
          </div>
          <h2 style={{ fontSize: "clamp(26px,3.4vw,36px)", fontWeight: 800, margin: "0 0 20px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Чтобы ваши клиенты процветали и были впереди конкурентов
          </h2>
          <blockquote style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.7, fontStyle: "italic", borderLeft: `3px solid ${accent}`, paddingLeft: 24, margin: "0 auto", maxWidth: 680, textAlign: "left" }}>
            Интегратор MarketRadar — это не просто реферал. Это партнёр, который глубоко понимает
            продукт и индустрию клиента, помогает внедрять рекомендации (а не просто продаёт доступ),
            берёт ответственность за результаты.
          </blockquote>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 3. HOW IT WORKS — 3 steps                                */}
      {/* ─────────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: "40px 20px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 10 }}>КАК ЭТО РАБОТАЕТ</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Три шага до первой выплаты</h2>
        </div>
        <div className="pp-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { icon: <Handshake size={22} />, n: "01", title: "Зарегистрируйтесь", desc: "Заполните короткую анкету — тип партнёрства, компания, сайт. Модерация до 24 часов.", color: neonCyan },
            { icon: <Send size={22} />, n: "02", title: "Делитесь ссылкой", desc: "Получите персональный код и ссылку вида marketradar24.ru/?rf=XXXX. Добавляйте в рассылки, UTM, презентации.", color: neonMagenta },
            { icon: <Wallet size={22} />, n: "03", title: "Получайте комиссию", desc: "С каждого платежа привлечённого клиента — на ваш баланс. Выплата по запросу от 3 000 ₽.", color: neonGreen },
          ].map(({ icon, n, title, desc, color }) => (
            <div
              key={n}
              className="pp-card"
              style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, padding: "24px 22px" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}55`;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 12px 32px -14px ${color}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}50`, color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px ${color}35` }}>{icon}</div>
                <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: "0.08em" }}>ШАГ {n}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 13.5, color: muted, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 4. REFERRAL + INTEGRATOR — two-column detail             */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "40px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="pp-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Referral */}
          <div className="pp-card" style={{ background: card, border: `1px solid ${border}`, borderRadius: 22, padding: "32px 30px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: `${neonCyan}20`, border: `1px solid ${neonCyan}50`, color: neonCyan, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: neonCyan, letterSpacing: "0.08em" }}>РЕФЕРАЛЬНЫЙ ПАРТНЁР</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", marginTop: 2 }}>Приводите — получайте</div>
              </div>
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, color: neonCyan, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 18, textShadow: `0 0 22px ${neonCyan}55` }}>
              {referralRate}%
              <span style={{ fontSize: 16, color: muted, fontWeight: 600, marginLeft: 8 }}>с каждого платежа</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              {[
                "Единая ставка — 20% без зависимости от объёма",
                "Клиент получает 10% скидку на первый платёж",
                "Пожизненная атрибуция: комиссия со всех повторных платежей",
                "Без обязательств по сопровождению клиента",
                "Подходит блогерам, консультантам, агентствам",
              ].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: fg, lineHeight: 1.5 }}>
                  <Check size={16} style={{ color: neonCyan, flexShrink: 0, marginTop: 2 }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/partner/apply" className="pp-btn" style={{ background: neonCyan, color: "#0a0b0f", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Стать реферальным партнёром <ArrowRight size={14} />
            </Link>
          </div>

          {/* Integrator */}
          <div className="pp-card" style={{ background: `linear-gradient(145deg, ${accent}18, ${neonMagenta}0c)`, border: `1px solid ${accent}50`, borderRadius: 22, padding: "32px 30px", position: "relative", boxShadow: `0 8px 40px ${accent}30` }}>
            <div style={{ position: "absolute", top: -11, left: 30, background: "#f59e0b", color: "#000", borderRadius: 20, padding: "3px 14px", fontSize: 10, fontWeight: 800, letterSpacing: "0.05em" }}>
              ПОПУЛЯРНО
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: `${accent}30`, border: `1px solid ${accent}60`, color: "#a5b4fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Target size={24} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.08em" }}>ИНТЕГРАТОР</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", marginTop: 2 }}>Работаете с клиентом — зарабатываете больше</div>
              </div>
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, color: "#a5b4fc", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8, textShadow: `0 0 22px ${accent}55` }}>
              до {integratorMax}%
            </div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 16 }}>прогрессивная ставка в зависимости от числа активных клиентов</div>

            {/* Scale table */}
            <div style={{ background: isDark ? "#0a0b0f" : "#ffffff", border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              {INTEGRATOR_SCALES.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < INTEGRATOR_SCALES.length - 1 ? `1px solid ${border}` : "none", fontSize: 13 }}>
                  <span style={{ color: muted }}>
                    {s.maxClients === Infinity
                      ? `от ${s.minClients} клиентов`
                      : `${s.minClients}–${s.maxClients} клиентов`}
                  </span>
                  <span style={{ fontWeight: 700, color: s.rate >= 50 ? neonGreen : "#a5b4fc" }}>{s.rate}%</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              {[
                "Обучение и сертификация по продукту",
                "White-label-материалы и co-brand кейсы",
                "Приоритетная поддержка и выделенный менеджер",
                "Ответственность за внедрение и результат клиента",
                "Доступ к расширенным тарифам Agency/Enterprise",
              ].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: fg, lineHeight: 1.5 }}>
                  <Check size={16} style={{ color: "#a5b4fc", flexShrink: 0, marginTop: 2 }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/partner/apply" className="pp-btn" style={{ background: "#fff", color: accent, border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Стать интегратором <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 5. WHY MARKETRADAR — partner-centric benefits            */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "40px 20px 64px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 10 }}>ПРЕИМУЩЕСТВА ПАРТНЁРСТВА</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Почему партнёры выбирают MarketRadar</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            { icon: <TrendingUp size={22} />, title: "Высокий LTV", desc: "Клиенты остаются на подписке 8+ месяцев. Ваша комиссия накапливается с каждым месяцем.", color: neonGreen },
            { icon: <ShieldCheck size={22} />, title: "Прозрачная атрибуция", desc: "Cookie на 180 дней + запись в БД. Видите статус каждого клиента в кабинете.", color: neonCyan },
            { icon: <Briefcase size={22} />, title: "Готовый продукт", desc: "Единая платформа вместо 10 сервисов. Клиенту легче купить, вам — легче продать.", color: "#a5b4fc" },
            { icon: <Building2 size={22} />, title: "Поддержка Enterprise", desc: "Большие сделки на 99 900+ ₽/мес с выделенным менеджером. Комиссия пропорциональна.", color: "#FFB547" },
          ].map(({ icon, title, desc, color }) => (
            <div
              key={title}
              className="pp-card"
              style={{ background: card, borderRadius: 16, border: `1px solid ${border}`, padding: "22px 22px" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}55`;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 10px 26px -14px ${color}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}20`, border: `1px solid ${color}50`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 6. FAQ                                                   */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "40px 20px 64px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em", marginBottom: 10 }}>ВОПРОСЫ И ОТВЕТЫ</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Часто задаваемые вопросы</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faq.map(({ q, a }, idx) => (
            <details
              key={idx}
              className="pp-faq"
              style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: "18px 22px" }}
            >
              <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 15, fontWeight: 600, color: fg, letterSpacing: "-0.005em", gap: 14 }}>
                <span>{q}</span>
                <ChevronDown size={18} className="pp-chev" style={{ color: muted, flexShrink: 0, transition: "transform 0.2s" }} />
              </summary>
              <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.7, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${border}` }}>
                {a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 7. CTA                                                   */}
      {/* ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "60px 20px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${accent}18 0%, transparent 70%)` }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 900, margin: "0 0 14px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            Готовы привести первого клиента уже сегодня?
          </h2>
          <p style={{ fontSize: 16, color: muted, margin: "0 0 32px", lineHeight: 1.55 }}>
            Регистрация бесплатная. Модерация до 24 часов. Не нужно ИП — можно работать как самозанятый.
          </p>
          <Link href="/partner/apply" className="pp-btn" style={{ background: accent, color: "#fff", border: "none", borderRadius: 14, padding: "15px 34px", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: `0 4px 28px ${accent}60`, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Подать заявку <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${border}`, padding: "28px 32px", maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 12, color: muted }}>
        <div>© 2026 MarketRadar · Company24.pro</div>
        <div style={{ display: "flex", gap: 18 }}>
          <Link href="/" style={{ color: muted, textDecoration: "none" }}>На главную</Link>
          <Link href="/partner/apply" style={{ color: muted, textDecoration: "none" }}>Кабинет партнёра</Link>
          <a href="mailto:support@marketradar24.ru" style={{ color: muted, textDecoration: "none" }}>support@marketradar24.ru</a>
        </div>
      </footer>

    </div>
  );
}
