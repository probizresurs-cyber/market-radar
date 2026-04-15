"use client";

import React, { useState, useEffect } from "react";
import type { Colors } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import { authSetCurrentUser } from "@/lib/user";

const NICHE_LABELS: Record<string, string> = {
  digital: "Digital-агентство",
  clinic: "Клиника или салон",
  b2b: "B2B-торговля или SaaS",
  other: "Другое",
};

export function SettingsView({ c, user, onUpdateUser }: { c: Colors; user?: UserAccount | null; onUpdateUser?: (u: UserAccount) => void }) {
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
    authSetCurrentUser(updated);
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

export function NotificationsTab({ c, user, onUpdateUser }: { c: Colors; user: UserAccount | null; onUpdateUser: (u: UserAccount) => void }) {
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
