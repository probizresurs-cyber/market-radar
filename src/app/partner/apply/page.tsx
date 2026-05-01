"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { trackGoal } from "@/lib/metrika";

const S = {
  page: { minHeight: "100vh", background: "#0a0b0f", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: "rgba(15,17,26,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e2737", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 50 },
  logo: { fontSize: 18, fontWeight: 800, color: "#7c3aed", letterSpacing: "-0.02em" } as React.CSSProperties,
  main: { padding: "48px 24px", maxWidth: 560, margin: "0 auto" } as React.CSSProperties,
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 16, padding: "32px 28px" } as React.CSSProperties,
  label: { fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block", fontWeight: 600, letterSpacing: "0.04em" } as React.CSSProperties,
  input: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 10, color: "#e2e8f0", padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.15s" },
  select: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 10, color: "#e2e8f0", padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", cursor: "pointer", boxSizing: "border-box" as const },
  btn: { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", cursor: "pointer", fontWeight: 700, fontSize: 15, width: "100%", transition: "opacity 0.15s", letterSpacing: "-0.01em" } as React.CSSProperties,
  hint: { fontSize: 12, color: "#475569", marginTop: 6 } as React.CSSProperties,
  typeCard: (active: boolean) => ({
    border: `2px solid ${active ? "#7c3aed" : "#1e2737"}`,
    borderRadius: 12,
    padding: "16px 18px",
    cursor: "pointer",
    background: active ? "#7c3aed11" : "#0a0b0f",
    transition: "all 0.15s",
    flex: 1,
  } as React.CSSProperties),
};

const BASE_PRICE_RUB = 3900; // базовая цена MarketRadar в рублях

export default function PartnerApplyPage() {
  const [type, setType] = useState<"referral" | "integrator">("referral");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [desc, setDesc] = useState("");
  const [clientPrice, setClientPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const clientPriceNum = parseInt(clientPrice.replace(/\D/g, ""), 10) || 0;
  const markup = clientPriceNum > BASE_PRICE_RUB ? clientPriceNum - BASE_PRICE_RUB : 0;

  async function handleSubmit() {
    if (!name.trim()) { setError("Введите ваше имя"); return; }
    if (!email.trim()) { setError("Введите email"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company_name: company.trim() || undefined,
          website: website.trim() || undefined,
          type,
          description: desc.trim() || undefined,
          client_price_amount: type === "integrator" && clientPriceNum > 0 ? clientPriceNum * 100 : undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        trackGoal("partner_apply", { type, has_client_price: type === "integrator" && clientPriceNum > 0 });
        setDone(true);
      } else {
        setError(json.error || "Ошибка отправки");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={S.page}>
        <header style={S.header}>
          <span style={S.logo}>MarketRadar</span>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>На главную</Link>
        </header>
        <main style={{ ...S.main, textAlign: "center", paddingTop: 80 }}>
          <CheckCircle2 size={56} color="#4ade80" style={{ marginBottom: 20 }} />
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 12 }}>Заявка отправлена!</div>
          <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.6, marginBottom: 32 }}>
            Мы получили вашу заявку и свяжемся с вами в течение 1 рабочего дня.<br />
            Проверьте почту <strong style={{ color: "#e2e8f0" }}>{email}</strong>
          </div>
          <Link href="/" style={{ ...S.btn, display: "inline-block", textDecoration: "none", width: "auto", padding: "12px 28px" }}>
            ← На главную
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.logo}>MarketRadar</span>
        <Link href="/partners" style={{ color: "#64748b", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={13} /> О программе
        </Link>
      </header>

      <main style={S.main}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", marginBottom: 8 }}>
            Стать партнёром
          </div>
          <div style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>
            Заполните форму — мы рассмотрим заявку в течение 1 рабочего дня и вышлем доступ в личный кабинет.
          </div>
        </div>

        <div style={S.card}>
          {/* Тип партнёрства */}
          <div style={{ marginBottom: 24 }}>
            <label style={S.label}>ТИП ПАРТНЁРСТВА</label>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={S.typeCard(type === "referral")} onClick={() => setType("referral")}>
                <div style={{ fontWeight: 700, fontSize: 14, color: type === "referral" ? "#a78bfa" : "#94a3b8", marginBottom: 4 }}>
                  Реферальный
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  20% с каждого платежа. Приводите клиентов по ссылке.
                </div>
              </div>
              <div style={S.typeCard(type === "integrator")} onClick={() => setType("integrator")}>
                <div style={{ fontWeight: 700, fontSize: 14, color: type === "integrator" ? "#a78bfa" : "#94a3b8", marginBottom: 4 }}>
                  Интегратор
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  25–50% прогрессивно. Внедряете платформу у клиентов.
                </div>
              </div>
            </div>
          </div>

          {/* Основные поля */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={S.label}>ИМЯ *</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" />
            </div>
            <div>
              <label style={S.label}>EMAIL *</label>
              <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@company.ru" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={S.label}>ТЕЛЕФОН</label>
              <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" />
            </div>
            <div>
              <label style={S.label}>КОМПАНИЯ</label>
              <input style={S.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="ООО Агентство" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>САЙТ</label>
            <input style={S.input} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://agency.ru" />
          </div>

          <div style={{ marginBottom: type === "integrator" ? 14 : 20 }}>
            <label style={S.label}>КАК ПЛАНИРУЕТЕ ПРИВЛЕКАТЬ КЛИЕНТОВ</label>
            <textarea
              style={{ ...S.input, minHeight: 80, resize: "vertical" } as React.CSSProperties}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Расскажите немного о себе: ниша, аудитория, каналы привлечения..."
            />
          </div>

          {/* Своя цена — только для интеграторов */}
          {type === "integrator" && (
            <div style={{ marginBottom: 20, padding: "16px 18px", background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 12 }}>
              <label style={{ ...S.label, marginBottom: 10 }}>ВАША ЦЕНА ДЛЯ КЛИЕНТОВ (₽/мес)</label>
              <input
                style={S.input}
                type="number"
                min={BASE_PRICE_RUB}
                step={100}
                value={clientPrice}
                onChange={e => setClientPrice(e.target.value)}
                placeholder={`от ${BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽`}
              />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  Базовая цена MarketRadar: <strong style={{ color: "#94a3b8" }}>{BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽/мес</strong>
                </div>
                {clientPriceNum >= BASE_PRICE_RUB && (
                  <div style={{ fontSize: 12, color: "#4ade80" }}>
                    Ваша наценка: <strong>+{markup.toLocaleString("ru-RU")} ₽/мес</strong> с каждого клиента
                  </div>
                )}
                {clientPriceNum > 0 && clientPriceNum < BASE_PRICE_RUB && (
                  <div style={{ fontSize: 12, color: "#f59e0b" }}>
                    Цена не может быть ниже базовой ({BASE_PRICE_RUB.toLocaleString("ru-RU")} ₽)
                  </div>
                )}
                <div style={{ ...S.hint, marginTop: 4 }}>
                  Вы можете устанавливать любую цену для клиентов. Ваш доход = наценка + комиссия {"{"}25–50%{"}"} от базовой цены.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "#ef444411", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button
            style={{ ...S.btn, opacity: submitting ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Отправка..." : "Подать заявку →"}
          </button>

          <div style={{ marginTop: 14, fontSize: 12, color: "#334155", textAlign: "center", lineHeight: 1.6 }}>
            Нажимая «Подать заявку», вы соглашаетесь с{" "}
            <a href="https://company24.pro/politicahr2026" target="_blank" rel="noopener noreferrer" style={{ color: "#64748b" }}>
              политикой конфиденциальности
            </a>
          </div>
        </div>

        {/* Что будет дальше */}
        <div style={{ marginTop: 20, padding: "18px 20px", background: "#11131c", border: "1px solid #1e2737", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 12 }}>ЧТО ДАЛЬШЕ</div>
          {[
            "Мы рассмотрим заявку в течение 1 рабочего дня",
            "Пришлём приглашение на email с доступом в партнёрский кабинет",
            "В кабинете — реферальная ссылка, статистика и история выплат",
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#7c3aed22", color: "#a78bfa", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
