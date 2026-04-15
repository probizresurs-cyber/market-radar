"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";

export function CollapsibleSection({ c, title, defaultOpen = true, extra, children }: {
  c: Colors;
  title: string;
  defaultOpen?: boolean;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  void c; // kept for API compatibility
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: open ? 12 : 0, cursor: "pointer", userSelect: "none", padding: "4px 0" }}>
        <span className="ds-h3" style={{ flex: 1 }}>{title}</span>
        {extra && <div onClick={e => e.stopPropagation()}>{extra}</div>}
        <span style={{ fontSize: 10, color: "var(--muted-foreground)", transition: "transform 0.18s", display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>▶</span>
      </div>
      {open && children}
    </div>
  );
}
