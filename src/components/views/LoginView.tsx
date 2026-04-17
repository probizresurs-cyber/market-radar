"use client";

import { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import { authSetCurrentUser } from "@/lib/user";

export function LoginView({ c, onSuccess, onRegister, onBack }: {
  c: Colors;
  onSuccess: (user: UserAccount) => void;
  onRegister: () => void;
  onBack?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onFocusL = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = `0 0 0 3px var(--primary)20`; e.currentTarget.style.borderColor = "var(--primary)"; };
  const onBlurL = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border)"; };
  void onFocusL; void onBlurL;

  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
        credentials: "include",
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "Неверный email или пароль"); return; }
      const user: UserAccount = {
        id: json.user.id,
        name: json.user.name ?? "",
        email: json.user.email,
        password: "",
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", padding: 20 }}>
      <div className="ds-card-elevated" style={{ width: "100%", maxWidth: 400, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
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
        <h1 className="ds-h1" style={{ margin: "0 0 4px" }}>Войти</h1>
        <p className="ds-body-sm" style={{ color: "var(--muted-foreground)", margin: "0 0 22px" }}>Добро пожаловать обратно</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@example.com" className="ds-input" />
          </div>
          <div>
            <label className="ds-caption" style={{ display: "block", marginBottom: 5 }}>Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="ds-input" />
          </div>
          {error && <div className="ds-badge ds-badge-destructive" style={{ display: "block", borderRadius: "var(--radius)", padding: "10px 14px" }}>{error}</div>}
          <button type="submit" disabled={loading} className="ds-btn ds-btn-primary" style={{ height: 44, fontSize: 14 }}>
            {loading ? "Входим…" : "Войти →"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--muted-foreground)" }}>
          Нет аккаунта?{" "}
          <span onClick={onRegister} style={{ color: "var(--primary)", fontWeight: 600, cursor: "pointer" }}>Зарегистрироваться</span>
        </p>
      </div>
    </div>
  );
}
