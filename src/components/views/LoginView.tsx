"use client";

import { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import { authSetCurrentUser } from "@/lib/user";
import { trackGoal, setUserId } from "@/lib/metrika";
import { MarketRadarLogo } from "@/components/ui/MarketRadarLogo";
import { ArrowLeft, Mail, Lock, Loader2 } from "lucide-react";

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
      setUserId(user.id);
      trackGoal("login", { role: user.role });
      onSuccess(user);
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  const inputWrap: React.CSSProperties = { position: "relative" };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 14px 13px 44px", borderRadius: 11,
    border: "1.5px solid var(--border)", background: "var(--background)",
    color: "var(--foreground)", fontSize: 15, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  const iconLeft: React.CSSProperties = {
    position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
    color: "var(--muted-foreground)", display: "flex", alignItems: "center", pointerEvents: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, var(--background) 0%, color-mix(in srgb, var(--primary) 5%, var(--background)) 100%)",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "var(--card)",
        borderRadius: 20,
        border: "1px solid var(--border)",
        padding: 36,
        boxShadow: "0 24px 70px rgba(0,0,0,0.18), 0 6px 18px rgba(0,0,0,0.06)",
      }}>
        {/* Header — logo + back */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <MarketRadarLogo size={40} variant="dark" animated={false} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
              <span style={{ fontWeight: 400, opacity: 0.55 }}>Market</span>Radar<span style={{ color: "var(--primary)" }}>24</span>
            </span>
          </div>
          {onBack && (
            <button onClick={onBack} style={{
              background: "transparent", border: "1px solid var(--border)", cursor: "pointer",
              color: "var(--muted-foreground)", fontSize: 13, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "8px 12px", borderRadius: 9,
            }}>
              <ArrowLeft size={14}/> Главная
            </button>
          )}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "var(--foreground)", letterSpacing: -0.5 }}>
          С возвращением 👋
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", margin: "0 0 28px", lineHeight: 1.55 }}>
          Войдите в свой аккаунт. Все ваши анализы, посты и реквизиты ждут вас на месте.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase" }}>Email</label>
            <div style={inputWrap}>
              <span style={iconLeft}><Mail size={17}/></span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ivan@example.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase" }}>Пароль</label>
            <div style={inputWrap}>
              <span style={iconLeft}><Lock size={17}/></span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
            </div>
          </div>

          {error && (
            <div style={{
              padding: "12px 14px", borderRadius: 10, fontSize: 14,
              background: "color-mix(in oklch, var(--destructive) 10%, transparent)",
              color: "var(--destructive)",
              border: "1px solid color-mix(in oklch, var(--destructive) 25%, transparent)",
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: "14px 20px", borderRadius: 11, border: "none",
            background: loading ? "var(--muted)" : "var(--primary)",
            color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            minHeight: 48, marginTop: 6,
            boxShadow: loading ? "none" : "0 8px 22px color-mix(in oklch, var(--primary) 35%, transparent)",
            transition: "background 0.15s, box-shadow 0.15s",
          }}>
            {loading
              ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }}/> Входим…</>
              : <>Войти →</>}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 14, color: "var(--muted-foreground)" }}>
          Нет аккаунта?{" "}
          <span onClick={onRegister} style={{ color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}>
            Зарегистрироваться →
          </span>
        </div>
      </div>
    </div>
  );
}
