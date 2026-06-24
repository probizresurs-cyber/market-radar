"use client";

import { useState } from "react";
import { PRODUCTS } from "@/lib/products";

// Управление доступом юзера к продуктам (блокам) из его карточки в админке.
// Подключить = выдать подписку (grant), отключить = revoke. Идёт через
// /api/admin/products/<product> по email пользователя.
export function ProductBlocks({ email, active: initial }: { email: string; active: string[] }) {
  const [active, setActive] = useState<Set<string>>(new Set(initial));
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (product: string, on: boolean) => {
    setBusy(product);
    try {
      const r = await fetch(`/api/admin/products/${product}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(on
          ? { action: "grant", email, plan: "pro", days: 365 }
          : { action: "revoke", email }),
      });
      const j = await r.json();
      if (!j.ok) { alert(j.error ?? "Ошибка"); return; }
      setActive(prev => { const n = new Set(prev); if (on) n.add(product); else n.delete(product); return n; });
    } catch { alert("Ошибка соединения"); } finally { setBusy(null); }
  };

  return (
    <div style={{ border: "1px solid #2d3748", borderRadius: 10, overflow: "hidden" }}>
      {PRODUCTS.map((p, i) => {
        const on = active.has(p.id);
        const isCore = p.id === "core";
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderTop: i ? "1px solid #232a3a" : "none" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{p.label}</div>
              <div style={{ fontSize: 12, color: on ? "#22c55e" : "#64748b" }}>{on ? "подключён" : "нет доступа"}</div>
            </div>
            <button
              disabled={busy === p.id || isCore}
              onClick={() => toggle(p.id, !on)}
              title={isCore ? "Аналитика доступна всегда" : ""}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600,
                cursor: busy === p.id || isCore ? "default" : "pointer", fontFamily: "inherit",
                background: isCore ? "#243042" : busy === p.id ? "#374151" : on ? "#334155" : "#22c55e",
                color: isCore ? "#64748b" : "#fff",
              }}
            >
              {isCore ? "всегда вкл" : on ? "Отключить" : "Подключить"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
