"use client";

import { useState } from "react";
import type { Colors } from "@/lib/colors";
import { type UserAccount, NICHE_COMPETITORS, authSetCurrentUser } from "@/lib/user";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";

export function OnboardingView({ c, user, onComplete }: {
  c: Colors;
  user: UserAccount;
  onComplete: (updatedUser: UserAccount, companyUrl: string, competitorUrls: string[]) => void;
}) {
  void c;
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | "">(user.businessType ?? "");
  const [companyName, setCompanyName] = useState(user.companyName || "");
  const [companyUrl, setCompanyUrl] = useState(user.companyUrl || "");
  const [vk, setVk] = useState("");
  const [tg, setTg] = useState("");
  const [hh, setHh] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [customUrl, setCustomUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Map selected business type → niche competitor suggestions
  const selectedBizConfig = BUSINESS_TYPES.find(t => t.id === businessType);
  const suggestions = selectedBizConfig ? (NICHE_COMPETITORS[selectedBizConfig.nicheKey] ?? []) : [];
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
      ...user,
      niche: selectedBizConfig?.nicheKey ?? "other",
      businessType: businessType as BusinessType,
      companyName: companyName.trim(),
      companyUrl: companyUrl.trim(),
      vk: vk.trim() || undefined,
      tg: tg.trim() || undefined,
      hhUrl: hh.trim() || undefined,
      onboardingDone: true,
    };
    authSetCurrentUser(updatedUser);
    onComplete(updatedUser, companyUrl.trim(), Array.from(selectedCompetitors));
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>MR</div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>MarketRadar</span>
          </div>
          <span className="ds-body-sm" style={{ color: "var(--muted-foreground)" }}>Шаг {step} из 3</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / 3) * 100}%`, background: "var(--primary)", borderRadius: 2, transition: "width 0.4s var(--ease)" }} />
        </div>
      </div>

      <div className="ds-card-elevated" style={{ width: "100%", maxWidth: 560 }}>
        {/* ── Step 1: Business Type ── */}
        {step === 1 && (
          <>
            <h2 className="ds-h2" style={{ margin: "0 0 6px" }}>Выберите тип бизнеса</h2>
            <p className="ds-body-sm" style={{ color: "var(--muted-foreground)", margin: "0 0 22px" }}>
              Это настроит ИИ под вашу модель — анализ, рекомендации и акценты будут другими
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {BUSINESS_TYPES.map(bt => (
                <div key={bt.id} onClick={() => setBusinessType(bt.id)}
                  className="ds-card-interactive"
                  style={{
                    border: `2px solid ${businessType === bt.id ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: "var(--radius)", padding: 16, cursor: "pointer",
                    background: businessType === bt.id ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent",
                    position: "relative",
                  }}>
                  {businessType === bt.id && (
                    <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>
                    </div>
                  )}
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{bt.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{bt.label}</div>
                  <div className="ds-body-sm" style={{ color: "var(--muted-foreground)" }}>{bt.desc}</div>
                </div>
              ))}
            </div>
            <button disabled={!businessType} onClick={() => setStep(2)} className="ds-btn ds-btn-primary" style={{ marginTop: 20, width: "100%", height: 44, fontSize: 14 }}>
              Далее →
            </button>
          </>
        )}

        {/* ── Step 2: Company details ── */}
        {step === 2 && (
          <>
            <h2 className="ds-h2" style={{ margin: "0 0 6px" }}>Расскажите о компании</h2>
            <p className="ds-body-sm" style={{ color: "var(--muted-foreground)", margin: "0 0 20px" }}>Обязательные поля помогут нам запустить анализ</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                { label: "Название компании *", value: companyName, setter: setCompanyName, placeholder: "ООО Ромашка" },
                { label: "Сайт компании *", value: companyUrl, setter: setCompanyUrl, placeholder: "example.ru" },
                { label: "VK-группа", value: vk, setter: (v: string) => setVk(v), placeholder: "vk.com/company" },
                { label: "Telegram-канал", value: tg, setter: (v: string) => setTg(v), placeholder: "t.me/company" },
                { label: "Профиль на hh.ru", value: hh, setter: (v: string) => setHh(v), placeholder: "hh.ru/employer/123" },
              ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string }>).map(field => (
                <div key={field.label}>
                  <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>{field.label}</label>
                  <input type="text" value={field.value} onChange={e => field.setter(e.target.value)} placeholder={field.placeholder} className="ds-input" />
                </div>
              ))}
            </div>
            {error && <div className="ds-badge ds-badge-destructive" style={{ display: "block", borderRadius: "var(--radius)", padding: "8px 12px", marginTop: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => { setError(null); setStep(1); }} className="ds-btn ds-btn-secondary" style={{ flex: 1 }}>← Назад</button>
              <button onClick={() => {
                setError(null);
                if (!companyName.trim()) { setError("Введите название компании"); return; }
                if (!companyUrl.trim()) { setError("Введите URL сайта"); return; }
                setStep(3);
              }} className="ds-btn ds-btn-primary" style={{ flex: 2, height: 44 }}>
                Далее →
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Competitors ── */}
        {step === 3 && (
          <>
            <h2 className="ds-h2" style={{ margin: "0 0 4px" }}>Выберите конкурентов</h2>
            <p className="ds-body-sm" style={{ color: "var(--muted-foreground)", margin: "0 0 4px" }}>Выберите до {MAX_COMPETITORS} конкурентов (тариф Free)</p>
            <div className="ds-caption" style={{ marginBottom: 14 }}>Выбрано: {selectedCompetitors.size} из {MAX_COMPETITORS}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {suggestions.map(s => {
                const selected = selectedCompetitors.has(s.url);
                const disabled = !selected && selectedCompetitors.size >= MAX_COMPETITORS;
                return (
                  <div key={s.url} onClick={() => !disabled && toggleCompetitor(s.url)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: "var(--radius)", border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`, background: selected ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all var(--motion-fast) var(--ease)" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`, background: selected ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <div className="ds-body-sm" style={{ color: "var(--muted-foreground)" }}>{s.url}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Добавить своего конкурента</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="competitor.ru"
                  className="ds-input" style={{ flex: 1 }} />
                <button onClick={addCustom} disabled={!customUrl.trim() || selectedCompetitors.size >= MAX_COMPETITORS} className="ds-btn ds-btn-secondary">
                  + Добавить
                </button>
              </div>
              {error && <div className="ds-badge ds-badge-destructive" style={{ display: "block", borderRadius: "var(--radius)", padding: "6px 10px", marginTop: 5 }}>{error}</div>}
            </div>
            {Array.from(selectedCompetitors).filter(url => !suggestions.find(s => s.url === url)).map(url => (
              <div key={url} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "var(--radius)", border: "2px solid var(--primary)", background: "color-mix(in oklch, var(--primary) 8%, transparent)", marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{url}</span>
                <span onClick={() => toggleCompetitor(url)} style={{ fontSize: 13, color: "var(--destructive)", cursor: "pointer", fontWeight: 600 }}>✕</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(2)} className="ds-btn ds-btn-secondary" style={{ flex: 1 }}>← Назад</button>
              <button onClick={handleFinish} className="ds-btn ds-btn-primary" style={{ flex: 2, height: 44 }}>
                {selectedCompetitors.size > 0 ? `Запустить анализ (${1 + selectedCompetitors.size} сайта) →` : "Пропустить и продолжить →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
