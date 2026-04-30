"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const S = {
  page: { minHeight: "100vh", background: "#0a0b0f", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, sans-serif" } as React.CSSProperties,
  card: { background: "#11131c", border: "1px solid #1e2737", borderRadius: 16, padding: "36px 40px", width: "100%", maxWidth: 420 } as React.CSSProperties,
  logo: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, textAlign: "center" as const } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "#475569", marginBottom: 32, textAlign: "center" as const } as React.CSSProperties,
  label: { fontSize: 12, color: "#94a3b8", marginBottom: 7, display: "block", fontWeight: 600, letterSpacing: "0.04em" } as React.CSSProperties,
  input: { background: "#0a0b0f", border: "1px solid #2d3748", borderRadius: 10, color: "#e2e8f0", padding: "12px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.15s" } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 10, padding: "13px", cursor: "pointer", fontWeight: 700, fontSize: 15, width: "100%", marginTop: 8, letterSpacing: "-0.01em", transition: "opacity 0.15s" } as React.CSSProperties,
  error: { color: "#f87171", fontSize: 13, padding: "10px 14px", background: "#ef444411", borderRadius: 8, marginBottom: 16 } as React.CSSProperties,
  tabs: { display: "flex", gap: 0, marginBottom: 28, borderRadius: 10, overflow: "hidden", border: "1px solid #1e2737" } as React.CSSProperties,
  tab: (active: boolean) => ({
    flex: 1, padding: "10px", textAlign: "center" as const, fontSize: 13, fontWeight: 600, cursor: "pointer",
    background: active ? "#7c3aed" : "#0a0b0f",
    color: active ? "#fff" : "#64748b",
    border: "none", transition: "all 0.15s",
  } as React.CSSProperties),
};

export default function PartnerLogin() {
  const router = useRouter();
  const [partnerType, setPartnerType] = useState<"referral" | "integrator">("referral");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Введите email и пароль"); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Неверный email или пароль");
        setLoading(false);
        return;
      }

      // Check partner type and redirect accordingly
      const dashRes = await fetch("/api/partner/dashboard");
      const dashData = await dashRes.json();

      if (dashData.ok && dashData.partner) {
        if (dashData.partner.type === "integrator") {
          router.push("/integrator");
        } else {
          router.push("/partner");
        }
      } else {
        // Logged in but no partner record yet — redirect based on selected tab
        router.push(partnerType === "integrator" ? "/integrator" : "/partner");
      }
    } catch {
      setError("Ошибка соединения");
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <span style={{ color: "#7c3aed" }}>MarketRadar</span>{" "}
          <span style={{ color: "#94a3b8", fontWeight: 400 }}>Partner</span>
        </div>
        <div style={S.subtitle}>Войдите в партнёрский кабинет</div>

        {/* Type tabs */}
        <div style={S.tabs}>
          <button style={S.tab(partnerType === "referral")} onClick={() => setPartnerType("referral")}>
            Реферальный партнёр
          </button>
          <button style={S.tab(partnerType === "integrator")} onClick={() => setPartnerType("integrator")}>
            Интегратор
          </button>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>EMAIL</label>
            <input
              style={S.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>ПАРОЛЬ</label>
            <input
              style={S.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={S.error}>{error}</div>}

          <button type="submit" style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? "Вход..." : "Войти →"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
          Ещё нет аккаунта?{" "}
          <Link href="/partner/apply" style={{ color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}>
            Подать заявку
          </Link>
          <br />
          <span style={{ fontSize: 12, color: "#1e293b" }}>
            После одобрения администратором вы получите данные для входа
          </span>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "#1e293b" }}>
        <Link href="/" style={{ color: "#334155", textDecoration: "none" }}>← Главная MarketRadar</Link>
      </div>
    </div>
  );
}
