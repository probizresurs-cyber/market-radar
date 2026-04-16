"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const S = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" } as React.CSSProperties,
  card: { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 16, padding: "40px 36px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" } as React.CSSProperties,
  logo: { fontSize: 28, fontWeight: 800, color: "#7c3aed", marginBottom: 4 } as React.CSSProperties,
  sub: { fontSize: 13, color: "#64748b", marginBottom: 32 } as React.CSSProperties,
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 } as React.CSSProperties,
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2d3748", background: "#0f1117", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" as const, marginBottom: 16 },
  btn: { width: "100%", padding: "11px 0", borderRadius: 8, background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" } as React.CSSProperties,
  err: { background: "rgba(220,38,38,0.15)", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 } as React.CSSProperties,
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.ok) { setErr(data.error || "Ошибка входа"); return; }
      if (data.user?.role !== "admin") { setErr("Нет прав администратора"); return; }
      router.push("/admin/dashboard");
    } catch { setErr("Сетевая ошибка"); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>⚡ MarketRadar</div>
        <div style={S.sub}>Панель администратора</div>
        {err && <div style={S.err}>{err}</div>}
        <form onSubmit={submit}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <label style={S.label}>Пароль</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={S.btn} disabled={loading}>{loading ? "Вход..." : "Войти"}</button>
        </form>
      </div>
    </div>
  );
}
