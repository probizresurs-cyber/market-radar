"use client";

import React, { useState, useEffect } from "react";
import { Zap, Clock, AlertTriangle, CheckCircle, Gift, Palette } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import { authSetCurrentUser } from "@/lib/user";
import { loadWhiteLabel, saveWhiteLabel, ACCENT_PRESETS, type WhiteLabelConfig } from "@/lib/whitelabel";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";

interface SubState {
  plan: string;
  tokensUsed: number;
  tokensLimit: number;
  tokensLeft: number;
  daysLeft: number;
  hoursLeft?: number;
  totalHoursLeft?: number;
  msLeft?: number;
  planExpiresAt?: string | null;
  hasAccess: boolean;
  isExpired: boolean;
  isExhausted: boolean;
  isAdmin?: boolean;
  // Referral bonus (from ?ref=<code> applied at signup)
  referralCode?: string | null;
  discountPct?: number;
  discountExpiresAt?: string | null;
  discountMonths?: number;
}

function formatTrialTime(sub: SubState): string {
  const expiresMs = sub.planExpiresAt ? new Date(sub.planExpiresAt).getTime() : null;
  const ms = expiresMs !== null ? Math.max(0, expiresMs - Date.now()) : (sub.msLeft ?? 0);
  const DAY = 86400000, HOUR = 3600000, MIN = 60000;
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const totalH = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (ms <= 0) return "0 дней";
  if (d >= 1) return `${d} ${plural(d, "день", "дня", "дней")} ${h} ч`;
  if (totalH >= 1) return `${totalH} ч ${m} мин`;
  return `${m} мин`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}


export function SettingsView({ c, user, onUpdateUser, onWhiteLabelChange }: { c: Colors; user?: UserAccount | null; onUpdateUser?: (u: UserAccount) => void; onWhiteLabelChange?: (cfg: WhiteLabelConfig) => void }) {
  const [tab, setTab] = useState<"profile" | "subscription" | "notifications" | "whitelabel">("profile");
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [companyUrl, setCompanyUrl] = useState(user?.companyUrl || "");
  const [vk, setVk] = useState(user?.vk || "");
  const [tg, setTg] = useState(user?.tg || "");
  const [hhUrl, setHhUrl] = useState(user?.hhUrl || "");
  const [businessType, setBusinessType] = useState<BusinessType | "">(user?.businessType ?? "");
  const [saved, setSaved] = useState(false);
  const [sub, setSub] = useState<SubState | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [wl, setWl] = useState<WhiteLabelConfig | null>(null);
  const [wlSaved, setWlSaved] = useState(false);

  // Load white-label config from localStorage
  useEffect(() => {
    if (!user) return;
    setWl(loadWhiteLabel(user.id));
  }, [user]);

  // Load subscription data whenever user opens subscription tab
  useEffect(() => {
    if (tab !== "subscription" || !user) return;
    setSubLoading(true);
    fetch("/api/subscription", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setSub(d); })
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, [tab, user]);

  const handleSave = () => {
    if (!user) return;
    const updated: UserAccount = {
      ...user,
      name: name.trim(),
      phone: phone.trim() || undefined,
      companyName: companyName.trim() || undefined,
      companyUrl: companyUrl.trim() || undefined,
      vk: vk.trim() || undefined,
      tg: tg.trim() || undefined,
      hhUrl: hhUrl.trim() || undefined,
      businessType: (businessType || undefined) as BusinessType | undefined,
    };
    authSetCurrentUser(updated);
    onUpdateUser?.(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveWhiteLabel = () => {
    if (!user || !wl) return;
    saveWhiteLabel(user.id, wl);
    onWhiteLabelChange?.(wl);
    setWlSaved(true);
    setTimeout(() => setWlSaved(false), 2000);
  };

  const tabs = [
    { id: "profile" as const, label: "Профиль" },
    { id: "subscription" as const, label: "Подписка" },
    { id: "notifications" as const, label: "Уведомления" },
    { id: "whitelabel" as const, label: "Внешний вид" },
  ];

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "var(--foreground)" }}>Настройки</h1>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${tab === t.id ? "var(--primary)" : "var(--border)"}`, background: tab === t.id ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: tab === t.id ? "var(--primary)" : "var(--foreground-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)" }}>
          {/* Read-only: email */}
          <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 10, background: "var(--background)", border: `1px solid var(--muted)` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 3 }}>Email</div>
            <div style={{ fontSize: 14, color: "var(--foreground)" }}>{user?.email || "—"}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Personal */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>ЛИЧНЫЕ ДАННЫЕ</div>
            {([
              { label: "Имя", value: name, setter: (v: string) => setName(v), placeholder: "Иван Иванов", type: "text" },
              { label: "Телефон", value: phone, setter: (v: string) => setPhone(v), placeholder: "+7 (999) 123-45-67", type: "tel" },
            ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string; type: string }>).map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}

            {/* Company */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginTop: 4 }}>КОМПАНИЯ</div>
            {([
              { label: "Название компании", value: companyName, setter: (v: string) => setCompanyName(v), placeholder: "ООО Ромашка" },
              { label: "Сайт", value: companyUrl, setter: (v: string) => setCompanyUrl(v), placeholder: "example.ru" },
            ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string }>).map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 5 }}>{f.label}</label>
                <input type="text" value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}

            {/* Business Type */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginTop: 4 }}>ТИП БИЗНЕСА</div>
            <div>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
                Влияет на акценты ИИ-анализа, рекомендации и инсайты. Применяется при следующем анализе.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BUSINESS_TYPES.map(bt => (
                  <div key={bt.id} onClick={() => setBusinessType(bt.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      border: `2px solid ${businessType === bt.id ? "var(--primary)" : "var(--border)"}`,
                      background: businessType === bt.id ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent",
                      transition: "all 0.15s",
                    }}>
                    <span style={{ fontSize: 20 }}>{bt.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: businessType === bt.id ? "var(--primary)" : "var(--foreground)" }}>{bt.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{bt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginTop: 4 }}>СОЦСЕТИ</div>
            {([
              { label: "ВКонтакте", value: vk, setter: (v: string) => setVk(v), placeholder: "vk.com/company" },
              { label: "Telegram", value: tg, setter: (v: string) => setTg(v), placeholder: "t.me/company" },
              { label: "hh.ru", value: hhUrl, setter: (v: string) => setHhUrl(v), placeholder: "hh.ru/employer/123" },
            ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string }>).map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 5 }}>{f.label}</label>
                <input type="text" value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleSave} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
            {saved && <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>✓ Сохранено</span>}
          </div>
        </div>
      )}

      {tab === "subscription" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Referral bonus card (only shown when user signed up via a referral link) ── */}
          {!subLoading && sub && sub.referralCode && ((sub.discountPct ?? 0) > 0 || (sub.daysLeft ?? 0) > 7) && (
            (() => {
              const totalTrialDays = sub.planExpiresAt && sub.planExpiresAt
                ? Math.round((new Date(sub.planExpiresAt).getTime() - Date.now()) / 86400000) + 0
                : sub.daysLeft;
              const discountLabel = (sub.discountPct ?? 0) > 0
                ? ((sub.discountMonths ?? 0) > 0
                    ? `Скидка ${sub.discountPct}% на ${sub.discountMonths} мес. после триала`
                    : `Скидка ${sub.discountPct}% после триала`)
                : null;
              const discountEnd = sub.discountExpiresAt
                ? new Date(sub.discountExpiresAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
                : null;
              return (
                <div style={{
                  background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--card)), var(--card))",
                  borderRadius: 14,
                  border: "1px solid color-mix(in srgb, var(--primary) 35%, var(--border))",
                  padding: 20,
                  boxShadow: "var(--shadow)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "color-mix(in srgb, var(--primary) 22%, transparent)",
                      color: "var(--primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Gift size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                        Реферальный бонус активирован
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        Код: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{sub.referralCode}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Бесплатный триал</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)", marginTop: 4 }}>
                        {Math.max(0, totalTrialDays)} {plural(totalTrialDays, "день", "дня", "дней")}
                      </div>
                    </div>
                    {discountLabel && (
                      <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>После триала</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success, #16a34a)", marginTop: 4 }}>
                          −{sub.discountPct}%
                          {(sub.discountMonths ?? 0) > 0 && (
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)", marginLeft: 6 }}>
                              × {sub.discountMonths} мес.
                            </span>
                          )}
                        </div>
                        {discountEnd && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                            до {discountEnd}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}

          {/* ── Token usage card ── */}
          {subLoading && (
            <div style={{ background: "var(--card)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, color: "var(--muted-foreground)", fontSize: 13 }}>
              Загрузка данных подписки…
            </div>
          )}
          {!subLoading && sub && !sub.isAdmin && (
            (() => {
              const warning = sub.isExpired || sub.isExhausted;
              const pct = sub.tokensLimit > 0 ? Math.min(100, Math.round((sub.tokensUsed / sub.tokensLimit) * 100)) : 0;
              const low = !warning && sub.tokensLeft < sub.tokensLimit * 0.15;
              const accent = warning ? "var(--destructive)" : low ? "#f59e0b" : "var(--primary)";
              const planLabel = sub.plan === "trial" ? "Пробный период" : sub.plan === "free" ? "Free" : sub.plan;

              return (
                <div style={{
                  background: "var(--card)",
                  borderRadius: 14,
                  border: `1px solid ${warning ? "var(--destructive)" : low ? "#f59e0b44" : "var(--border)"}`,
                  padding: 20,
                  boxShadow: "var(--shadow)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {warning ? <AlertTriangle size={18} /> : sub.plan !== "trial" ? <CheckCircle size={18} /> : <Zap size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{planLabel}</div>
                      <div style={{ fontSize: 12, color: warning ? accent : "var(--muted-foreground)" }}>
                        {warning
                          ? (sub.isExpired ? "Пробный период завершён" : "Лимит токенов исчерпан")
                          : `Активна · осталось ${formatTrialTime(sub)}`}
                      </div>
                    </div>
                  </div>

                  {/* Tokens row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      <Zap size={14} color={accent} />
                      AI-кредиты (токены)
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                      {sub.tokensLeft.toLocaleString("ru-RU")} / {sub.tokensLimit.toLocaleString("ru-RU")}
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "var(--muted)", overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: accent, borderRadius: 999, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted-foreground)" }}>
                    <span>Использовано: {sub.tokensUsed.toLocaleString("ru-RU")}</span>
                    <span>{pct}%</span>
                  </div>

                  {/* Days row (only for trial) */}
                  {sub.plan === "trial" && !warning && (
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                      <Clock size={13} />
                      Пробный период заканчивается через {formatTrialTime(sub)}
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* ── Plan cards ── */}
          {[
            { name: "Free", price: "₽0", features: ["1 компания", "3 конкурента", "2 анализа/мес", "Базовые рекомендации"], current: true },
            { name: "Базовый", price: "₽4 990/мес", features: ["1 компания", "10 конкурентов", "Безлимит анализов", "PDF-отчёты", "Telegram-уведомления"], current: false },
            { name: "PRO", price: "₽9 990/мес", features: ["3 компании", "30 конкурентов", "Battle cards", "API-доступ", "White-label отчёты"], current: false },
            { name: "Agency", price: "₽14 990/мес", features: ["10 компаний", "100 конкурентов", "Real-time обновление", "5 мест", "Брендированные отчёты"], current: false },
          ].map(plan => (
            <div key={plan.name} style={{ background: "var(--card)", borderRadius: 14, border: `1px solid ${plan.current ? "var(--primary)" : "var(--border)"}`, padding: 20, boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>{plan.name}</span>
                  {plan.current && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 8%, transparent)", padding: "2px 8px", borderRadius: 6 }}>Текущий</span>}
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>{plan.price}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                {plan.features.map(f => <span key={f} style={{ fontSize: 12, color: "var(--foreground-secondary)" }}>✓ {f}</span>)}
              </div>
              {!plan.current && (
                <button style={{ marginTop: 12, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Перейти на {plan.name}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "notifications" && (
        <NotificationsTab c={c} user={user ?? null} onUpdateUser={onUpdateUser ?? (() => { })} />
      )}

      {tab === "whitelabel" && wl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Master toggle */}
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Palette size={18} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>Кастомизация интерфейса</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Цвет акцента и оформление платформы</div>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div
                  onClick={() => setWl(w => w ? { ...w, enabled: !w.enabled } : w)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, position: "relative", cursor: "pointer",
                    background: wl.enabled ? "var(--primary)" : "var(--muted)",
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: wl.enabled ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }} />
                </div>
                <span style={{ fontSize: 13, color: wl.enabled ? "var(--primary)" : "var(--muted-foreground)", fontWeight: 600 }}>
                  {wl.enabled ? "Включено" : "Выключено"}
                </span>
              </label>
            </div>
          </div>

          {/* Accent color */}
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", opacity: wl.enabled ? 1 : 0.5, pointerEvents: wl.enabled ? "auto" : "none" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Цвет акцента</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Меняет кнопки, ссылки и активные элементы интерфейса</div>

            {/* Color presets */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ACCENT_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setWl(w => w ? { ...w, accentColor: preset.value } : w)}
                  title={preset.label}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: `3px solid ${wl.accentColor === preset.value ? "var(--foreground)" : "transparent"}`,
                    background: preset.value, cursor: "pointer", flexShrink: 0,
                    boxShadow: wl.accentColor === preset.value ? "0 0 0 1px var(--background)" : "none",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>

            {/* Custom hex input */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: wl.accentColor, flexShrink: 0, border: "1px solid var(--border)" }} />
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>Hex-код</label>
                <input
                  type="text"
                  value={wl.accentColor}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setWl(w => w ? { ...w, accentColor: v } : w);
                  }}
                  placeholder="#3b82f6"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <input
                type="color"
                value={wl.accentColor.length === 7 ? wl.accentColor : "#3b82f6"}
                onChange={e => setWl(w => w ? { ...w, accentColor: e.target.value } : w)}
                title="Открыть палитру"
                style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid var(--border)`, cursor: "pointer", padding: 2, background: "var(--card)", flexShrink: 0 }}
              />
            </div>

            {/* Live preview */}
            <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "var(--background)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 10 }}>ПРЕДПРОСМОТР</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: wl.accentColor, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "default" }}>Кнопка</button>
                <span style={{ fontSize: 13, color: wl.accentColor, fontWeight: 600, display: "flex", alignItems: "center" }}>Ссылка</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: wl.accentColor, background: wl.accentColor + "18", padding: "3px 10px", borderRadius: 6 }}>Бейдж</span>
                <div style={{ width: 60, height: 8, borderRadius: 4, background: wl.accentColor + "33", overflow: "hidden", display: "flex", alignItems: "center" }}>
                  <div style={{ width: "60%", height: "100%", background: wl.accentColor, borderRadius: 4 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Hide branding */}
          <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", opacity: wl.enabled ? 1 : 0.5, pointerEvents: wl.enabled ? "auto" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", marginBottom: 2 }}>Скрыть надпись MarketRadar</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Убирает «MarketRadar» из нижней части сайдбара (для агентств)</div>
              </div>
              <div
                onClick={() => setWl(w => w ? { ...w, hideBranding: !w.hideBranding } : w)}
                style={{
                  width: 44, height: 24, borderRadius: 12, position: "relative", cursor: "pointer",
                  background: wl.hideBranding ? "var(--primary)" : "var(--muted)",
                  transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: wl.hideBranding ? 23 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }} />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSaveWhiteLabel}
              style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Сохранить настройки
            </button>
            {wlSaved && (
              <span style={{ fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle size={15} /> Сохранено
              </span>
            )}
            <button
              onClick={() => {
                const def = { enabled: false, accentColor: "#3b82f6", hideBranding: false };
                setWl(def);
                if (user) saveWhiteLabel(user.id, def);
                onWhiteLabelChange?.(def);
              }}
              style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontWeight: 600, fontSize: 13, cursor: "pointer", marginLeft: "auto" }}
            >
              Сбросить
            </button>
          </div>
        </div>
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

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const boxStyle: React.CSSProperties = { background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Connection block */}
      <div style={boxStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Telegram-уведомления</div>
        <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 16 }}>Получайте уведомления о новых анализах и изменениях конкурентов прямо в Telegram.</div>

        {step === "done" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "color-mix(in oklch, var(--success) 13%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✓</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>Подключено</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chat ID: {user?.tgChatId}</div>
            </div>
            <button onClick={handleDisconnect} style={{ marginLeft: "auto", background: "transparent", border: `1px solid var(--border)`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "var(--foreground-secondary)", cursor: "pointer" }}>Отключить</button>
          </div>
        ) : step === "idle" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 4 }}>
              1. Откройте бота и отправьте ему код ниже:
            </div>
            <a href={botUsername ? `https://t.me/${botUsername}` : "https://t.me/"} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: "#229ED9", color: "#fff", fontWeight: 600, fontSize: 13, textDecoration: "none", alignSelf: "flex-start" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.88 13.47l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.946l-.564-.857z" /></svg>
              {botUsername ? `Открыть @${botUsername}` : "Открыть бота в Telegram"}
            </a>
            <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginTop: 4 }}>2. Отправьте ему этот код:</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...inputStyle, width: "auto", flex: 1, fontFamily: "monospace", fontWeight: 700, fontSize: 18, letterSpacing: 2, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 6%, transparent)", border: `1.5px solid var(--primary)33` }}>{code}</div>
              <button onClick={() => { navigator.clipboard.writeText(code); }} style={{ background: "color-mix(in oklch, var(--primary) 8%, transparent)", border: `1px solid var(--primary)33`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--primary)", cursor: "pointer", whiteSpace: "nowrap" }}>Копировать</button>
            </div>
            <button onClick={() => setStep("waiting")} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}>Я отправил →</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--foreground-secondary)" }}>Нажмите кнопку — мы проверим, получили ли ваш код.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={handlePoll} disabled={polling} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: polling ? "not-allowed" : "pointer", opacity: polling ? 0.7 : 1 }}>
                {polling ? "Проверяем…" : "Проверить подключение"}
              </button>
              <button onClick={() => { setStep("idle"); setPollError(""); }} style={{ background: "transparent", border: `1px solid var(--border)`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "var(--foreground-secondary)", cursor: "pointer" }}>Назад</button>
            </div>
            {pollError && <div style={{ fontSize: 13, color: "var(--destructive)" }}>{pollError}</div>}
          </div>
        )}
      </div>

      {/* Preferences (only when connected) */}
      {step === "done" && (
        <div style={boxStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 14 }}>Что уведомлять</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {([
              { key: "analysis", label: "Завершение нового анализа" },
              { key: "competitors", label: "Добавление нового конкурента" },
              { key: "vacancies", label: "Новые вакансии конкурентов" },
              { key: "digest", label: "Еженедельный дайджест" },
            ] as { key: keyof typeof prefs; label: string }[]).map(item => (
              <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={prefs[item.key]} onChange={e => setPrefs(p => ({ ...p, [item.key]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }} />
                <span style={{ fontSize: 13, color: "var(--foreground)" }}>{item.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleSavePrefs} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Сохранить</button>
            {prefsSaved && <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>✓ Сохранено</span>}
          </div>
        </div>
      )}
    </div>
  );
}
