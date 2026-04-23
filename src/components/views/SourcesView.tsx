"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import { SOURCES_FREE } from "@/lib/data/sources";

export function SourcesView({ c }: { c: Colors }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? SOURCES_FREE : SOURCES_FREE.filter(s => s.phase === filter);
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Источники данных</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px" }}>Бесплатные источники для конкурентного анализа</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "MVP", "v2", "v3"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === f ? "var(--primary)" : "var(--border)"}`, background: filter === f ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent", color: filter === f ? "var(--primary)" : "var(--foreground-secondary)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, overflow: "hidden", boxShadow: "var(--shadow)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {["Источник", "Метод / API", "Фаза"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "12px 16px", borderBottom: `2px solid var(--border)`, color: "var(--muted-foreground)", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 600, color: "var(--foreground)" }}>{s.name}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, color: "var(--foreground-secondary)", fontFamily: "monospace", fontSize: 12 }}>{s.method}</td>
                <td style={{ padding: "10px 16px", borderBottom: `1px solid var(--muted)`, fontWeight: 600, fontSize: 12, color: s.phase === "MVP" ? "var(--primary)" : "var(--muted-foreground)" }}>{s.phase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
