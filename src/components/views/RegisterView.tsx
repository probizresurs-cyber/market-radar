"use client";

import { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import { authSetCurrentUser } from "@/lib/user";

export function RegisterView({ c, onSuccess, onLogin }: {
  c: Colors;
  onSuccess: (user: UserAccount) => void;
  onLogin: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = `0 0 0 3px var(--primary)20`; e.currentTarget.style.borderColor = "var(--primary)"; };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border)"; };
  void onFocus; void onBlur;

  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Введите имя"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Введите корректный email"); return; }
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.toLowerCase().trim(), password }),
        credentials: "include",
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "Ошибка регистрации"); return; }
      const user: UserAccount = {
        id: json.user.id,
        name: json.user.name ?? name.trim(),
        email: json.user.email,
        password: "",
        phone: phone.trim() || undefined,
        onboardingDone: false,
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", padding: 20 }}>
      <div className="ds-card-elevated" style={{ width: "100%", maxWidth: 440, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>MR</div>
          <span style={{ fontWeight: 800, fontSize: 18 }}>MarketRadar</span>
        </div>
        <h1 className="ds-h1" style={{ margin: "0 0 4px" }}>Создать аккаунт</h1>
        <p className="ds-body-sm" style={{ color: "var(--muted-foreground)", margin: "0 0 22px" }}>Бесплатно · Без кредитной карты</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Имя *", type: "text", value: name, setter: setName, placeholder: "Иван Иванов" },
            { label: "Email *", type: "email", value: email, setter: setEmail, placeholder: "ivan@example.com" },
            { label: "Пароль * (мин. 6 символов)", type: "password", value: password, setter: setPassword, placeholder: "••••••••" },
            { label: "Телефон", type: "tel", value: phone, setter: setPhone, placeholder: "+7 (999) 123-45-67" },
          ].map(f => (
            <div key={f.label}>
              <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} className="ds-input" />
            </div>
          ))}
          {error && <div className="ds-badge ds-badge-destructive" style={{ display: "block", borderRadius: "var(--radius)", padding: "10px 14px" }}>{error}</div>}
          <button type="submit" disabled={loading} className="ds-btn ds-btn-primary" style={{ height: 44, fontSize: 14 }}>
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
