"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import { SOURCES_FREE } from "@/lib/data/sources";

export function SourcesView({ c }: { c: Colors }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? SOURCES_FREE : SOURCES_FREE.filter(s => s.phase === filter);
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: c.textPrimary }}>Источники данных</h1>
      <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 16px" }}>Бесплатные источники для конкурентного анализа</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "MVP", "v2", "v3"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === f ? c.accent : c.border}`, background: filter === f ? c.accent + "15" : "transparent", color: filter === f ? c.accent : c.textSecondary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>
      <div style={{ background: c.bgCard, borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden", boxShadow: c.shadow }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {["Источник", "Метод / API", "Цена", "Фаза"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid ${c.border}`, color: c.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, color: c.textPrimary }}>{s.name}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, color: c.textSecondary, fontFamily: "monospace", fontSize: 12 }}>{s.method}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: c.accentGreen + "18", color: c.accentGreen }}>{s.price}</span>
                </td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid ${c.borderLight}`, fontWeight: 600, fontSize: 12, color: s.phase === "MVP" ? c.accent : c.textMuted }}>{s.phase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
