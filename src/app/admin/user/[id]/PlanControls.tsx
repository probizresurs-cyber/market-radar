"use client";

import { useState } from "react";

// Продление подписки/триала из карточки пользователя в админке.
// Кнопки +7/+14/+30 дней зовут /api/admin/users/[id]/extend-plan —
// продление идёт от max(сейчас, текущая дата окончания), счётчик
// токенов сбрасывается.
export function PlanControls({ userId, plan, planExpiresAt, tokensUsed, tokensLimit }: {
  userId: string;
  plan: string | null;
  planExpiresAt: string | null;
  tokensUsed: number | null;
  tokensLimit: number | null;
}) {
  const [expiresAt, setExpiresAt] = useState<string | null>(planExpiresAt);
  const [used, setUsed] = useState<number | null>(tokensUsed);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expired = expiresAt !== null && new Date(expiresAt).getTime() < Date.now();

  const extend = async (days: number) => {
    setBusy(days); setError(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/extend-plan`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ days }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "Ошибка"); return; }
      setExpiresAt(j.planExpiresAt);
      setUsed(0);
    } catch { setError("Ошибка соединения"); } finally { setBusy(null); }
  };

  return (
    <div style={{ border: "1px solid #2d3748", borderRadius: 10, padding: "13px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
          Тариф: {plan ?? "—"}
          {expiresAt && (
            <span style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 600, color: expired ? "#ef4444" : "#22c55e" }}>
              {expired ? "истёк " : "до "}
              {new Date(expiresAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          Токены: {used ?? "—"} / {tokensLimit ?? "—"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[7, 14, 30].map(d => (
          <button
            key={d}
            disabled={busy !== null}
            onClick={() => extend(d)}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
              cursor: busy !== null ? "default" : "pointer", fontFamily: "inherit",
              background: busy === d ? "#374151" : "#22c55e", color: "#fff",
            }}
          >
            {busy === d ? "…" : `+${d} дн`}
          </button>
        ))}
      </div>
      {error && <div style={{ width: "100%", fontSize: 12.5, color: "#ef4444" }}>{error}</div>}
    </div>
  );
}
