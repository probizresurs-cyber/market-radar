"use client";

import { useEffect, useState } from "react";
import { Phone, Send } from "lucide-react";
import type { Colors } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import { authSetCurrentUser } from "@/lib/user";

type ContactType = "phone" | "telegram";

export function RegisterView({ c, onSuccess, onLogin, onBack }: {
  c: Colors;
  onSuccess: (user: UserAccount) => void;
  onLogin: () => void;
  onBack?: () => void;
}) {
  void c;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [contactType, setContactType] = useState<ContactType>("phone");
  const [contactValue, setContactValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep the referral banner so visitors coming via an admin-issued referral
  // link still see what bonus they're about to get — we just no longer ask
  // for the company name (it's derived from the website).
  const [refState, setRefState] = useState<{ hasReferral: boolean; name: string | null }>({
    hasReferral: false,
    name: null,
  });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/ref-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) {
          setRefState({ hasReferral: !!d.hasReferral, name: d.name ?? null });
        }
      })
      .catch(() => { /* silent — fall back to non-referral form */ });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Введите имя"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Введите корректный email"); return; }
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return; }
    if (!website.trim()) { setError("Введите сайт компании"); return; }
    if (!contactValue.trim()) {
      setError(contactType === "phone" ? "Введите номер телефона" : "Введите Telegram");
      return;
    }
    if (!consent) { setError("Необходимо согласие на обработку персональных данных"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          website: website.trim(),
          contactType,
          contactValue: contactValue.trim(),
          consent: true,
        }),
        credentials: "include",
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "Ошибка регистрации"); return; }
      const user: UserAccount = {
        id: json.user.id,
        name: json.user.name ?? name.trim(),
        email: json.user.email,
        password: "",
        phone: json.user.phone ?? (contactType === "phone" ? contactValue.trim() : undefined),
        telegram: json.user.telegram ?? (contactType === "telegram" ? contactValue.trim() : undefined),
        website: json.user.website ?? website.trim(),
        // Use the website as the company URL so the app can immediately
        // auto-trigger the first analysis without asking again.
        companyUrl: json.user.website ?? website.trim(),
        onboardingDone: true,
        role: json.user.role,
      };
      authSetCurrentUser(user);
      onSuccess(user);
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  const contactPlaceholder = contactType === "phone" ? "+7 (999) 123-45-67" : "@username";
  const contactInputType = contactType === "phone" ? "tel" : "text";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", padding: 20 }}>
      <div className="ds-card-elevated" style={{ width: "100%", maxWidth: 440, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
            <span style={{ fontWeight: 800, fontSize: 18 }}>MarketRadar</span>
          </div>
          {onBack && (
            <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 13, display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)10")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              ← На главную
            </button>
          )}
        </div>
        <h1 className="ds-h1" style={{ margin: "0 0 4px" }}>Создать аккаунт</h1>
        <p className="ds-body-sm" style={{ color: "var(--muted-foreground)", margin: "0 0 22px" }}>Бесплатно · Без кредитной карты</p>
        {refState.hasReferral && (
          <div
            style={{
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 40%, var(--border))",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 12,
              color: "var(--foreground)",
              lineHeight: 1.5,
            }}
          >
            <strong>Регистрация по реферальной ссылке</strong>
            {refState.name ? <> · {refState.name}</> : null}
            <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
              Расширенный бонус будет применён автоматически после регистрации.
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Имя *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" className="ds-input" />
          </div>
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@example.com" className="ds-input" />
          </div>
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Пароль * (мин. 6 символов)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="ds-input" />
          </div>
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Сайт компании *</label>
            <input type="text" value={website} onChange={e => setWebsite(e.target.value)} placeholder="example.ru" className="ds-input" />
            <div className="ds-caption" style={{ color: "var(--muted-foreground)", marginTop: 4 }}>
              Мы автоматически определим название компании по сайту
            </div>
          </div>

          {/* Phone / Telegram toggle — one field, icon-driven switch */}
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Контакт для связи *</label>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--background)",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", borderRight: "1px solid var(--border)" }}>
                {([
                  { id: "phone" as const, Icon: Phone, label: "Телефон" },
                  { id: "telegram" as const, Icon: Send, label: "Telegram" },
                ]).map(({ id, Icon, label }) => {
                  const active = contactType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => { setContactType(id); setContactValue(""); }}
                      style={{
                        width: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: active ? "var(--primary)" : "transparent",
                        color: active ? "#fff" : "var(--muted-foreground)",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
              <input
                type={contactInputType}
                value={contactValue}
                onChange={e => setContactValue(e.target.value)}
                placeholder={contactPlaceholder}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--foreground)",
                  padding: "10px 12px",
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer", flexShrink: 0 }}
            />
            <span>
              Я согласен(а) на обработку персональных данных в соответствии с{" "}
              <a
                href="https://company24.pro/politicahr2026"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--primary)", textDecoration: "underline" }}
              >
                Политикой конфиденциальности
              </a>
              .
            </span>
          </label>
          {error && <div className="ds-badge ds-badge-destructive" style={{ display: "block", borderRadius: "var(--radius)", padding: "10px 14px" }}>{error}</div>}
          <button type="submit" disabled={loading || !consent} className="ds-btn ds-btn-primary" style={{ height: 44, fontSize: 14, opacity: (loading || !consent) ? 0.6 : 1, cursor: (loading || !consent) ? "not-allowed" : "pointer" }}>
            {loading ? "Создаём аккаунт…" : "Создать аккаунт →"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--muted-foreground)" }}>
          Уже есть аккаунт?{" "}
          <span onClick={onLogin} style={{ color: "var(--primary)", fontWeight: 600, cursor: "pointer" }}>Войти</span>
        </p>
      </div>
    </div>
  );
}
