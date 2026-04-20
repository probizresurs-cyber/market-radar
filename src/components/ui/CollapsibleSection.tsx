"use client";

import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Colors } from "@/lib/colors";

export function CollapsibleSection({ c, title, icon, defaultOpen = true, extra, children }: {
  c: Colors;
  title: string;
  /** Optional Lucide icon (16×16, muted) rendered to the left of the title. */
  icon?: React.ReactNode;
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
        {icon && (
          <span style={{ color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <span className="ds-h3" style={{ flex: 1 }}>{title}</span>
        {extra && <div onClick={e => e.stopPropagation()}>{extra}</div>}
        <ChevronRight size={14} style={{ color: "var(--muted-foreground)", transition: "transform 0.18s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
      </div>
      {open && children}
    </div>
  );
}
