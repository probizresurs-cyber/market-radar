"use client";

import React, { useState, useEffect } from "react";
import { LayoutDashboard, Users, Sword, BookOpen, BarChart2, Settings, Menu, ChevronRight, X } from "lucide-react";
import { COLORS } from "@/lib/colors";
import type { Colors, Theme } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import type { NavItem, NavSection } from "@/lib/nav";


// ============================================================
// Sidebar Component
// ============================================================

export function SidebarComponent({ c, theme, setTheme, activeNav, setActiveNav, navSections, companyUrl, user, onLogout }: {
  c: Colors; theme: Theme; setTheme: (t: Theme) => void;
  activeNav: string; setActiveNav: (id: string) => void;
  navSections: NavSection[]; companyUrl: string;
  user?: UserAccount | null; onLogout?: () => void;
}) {
  // Auto-expand groups that contain the active item
  const getDefaultExpanded = () => {
    const expanded = new Set<string>();
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children?.some(child => child.id === activeNav)) expanded.add(item.id);
      }
    }
    return expanded;
  };
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(getDefaultExpanded);

  // When activeNav changes, ensure parent group is expanded
  useEffect(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children?.some(ch => ch.id === activeNav)) {
          setExpandedGroups(prev => { const next = new Set(prev); next.add(item.id); return next; });
        }
      }
    }
  }, [activeNav]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SB = (c as typeof COLORS["dark"]); // sidebar always reads dark-style tokens
  void SB; // suppress unused var warning

  const renderItem = (item: NavItem, depth = 0) => {
    const isGroup = !!(item.children && item.children.length > 0);
    const isExpanded = expandedGroups.has(item.id);
    const isActive = activeNav === item.id;
    const childActive = isGroup && item.children!.some(ch => ch.id === activeNav);

    return (
      <div key={item.id}>
        <div
          onClick={() => isGroup ? toggleGroup(item.id) : setActiveNav(item.id)}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: depth > 0 ? "7px 10px 7px 28px" : "8px 10px",
            borderRadius: 8, cursor: "pointer",
            background: isActive ? "var(--sidebar-active)" : "transparent",
            color: isActive ? "#C4B8F5" : childActive ? "#C4B8F5" : "var(--sidebar-fg)",
            fontWeight: isActive || (childActive && !isExpanded) ? 600 : 400, fontSize: 13,
            transition: "background 0.15s ease, color 0.15s ease", marginBottom: 1,
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ fontSize: depth > 0 ? 13 : 15, flexShrink: 0, opacity: isActive || childActive ? 1 : 0.8 }}>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.count !== null && !isGroup && (
            <span style={{ fontSize: 10, fontWeight: 700, background: isActive ? "rgba(196,184,245,0.15)" : "rgba(255,255,255,0.07)", color: isActive ? "#C4B8F5" : "var(--sidebar-muted)", borderRadius: 8, padding: "1px 7px" }}>{item.count}</span>
          )}
          {isGroup && (
            <ChevronRight size={13} style={{ color: "var(--sidebar-muted)", transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
          )}
        </div>
        {isGroup && isExpanded && (
          <div style={{ borderLeft: `2px solid var(--sidebar-border)`, marginLeft: 18, marginBottom: 2 }}>
            {item.children!.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="ds-sidebar-desktop" style={{ width: 240, minWidth: 240, background: "var(--sidebar-bg)", borderRight: `1px solid var(--sidebar-border)`, display: "flex", flexDirection: "column", overflow: "auto" }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid var(--sidebar-border)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: "-0.02em", boxShadow: "0 2px 10px rgba(124,58,237,0.4)", flexShrink: 0 }}>MR</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--sidebar-fg)", letterSpacing: "-0.02em" }}>MarketRadar</div>
            {companyUrl && <div style={{ fontSize: 10, color: "var(--sidebar-muted)", marginTop: 1 }}>{companyUrl}</div>}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "8px", flex: 1, overflowY: "auto" }}>
        {navSections.map(section => (
          <div key={section.title}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sidebar-muted)", letterSpacing: "0.1em", padding: "14px 10px 6px", textTransform: "uppercase" }}>{section.title}</div>
            {section.items.map(item => renderItem(item))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ padding: "8px", borderTop: `1px solid var(--sidebar-border)` }}>
        <div onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "warm" : "light")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "var(--sidebar-fg)", transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--sidebar-hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span>{theme === "light" ? "🌙" : theme === "dark" ? "☕" : "☀️"}</span>
          <span style={{ opacity: 0.85 }}>{theme === "light" ? "Тёмная тема" : theme === "dark" ? "Тёплая тема" : "Светлая тема"}</span>
        </div>
        {user && (
          <div style={{ padding: "10px", borderTop: `1px solid var(--sidebar-border)`, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#16A34A", border: `2px solid var(--sidebar-bg)` }} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sidebar-fg)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                <div style={{ fontSize: 10, color: "var(--sidebar-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
              </div>
            </div>
            <div onClick={onLogout}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#F87171", cursor: "pointer", padding: "5px 0", opacity: 0.85, transition: "opacity 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}>
              <span>↩</span><span>Выйти</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ============================================================
// Mobile Bottom Navigation (visible on <768px)
// ============================================================
export function MobileBottomNav({ activeNav, setActiveNav, onOpenMenu }: {
  activeNav: string; setActiveNav: (id: string) => void; onOpenMenu: () => void;
}) {
  const items = [
    { id: "dashboard",    label: "Главная",    icon: <LayoutDashboard size={22} /> },
    { id: "competitors",  label: "Конкуренты", icon: <Sword size={22} /> },
    { id: "ta-dashboard", label: "ЦА",         icon: <Users size={22} /> },
    { id: "content-plan", label: "Контент",    icon: <BookOpen size={22} /> },
    { id: "__menu__",     label: "Ещё",        icon: <Menu size={22} /> },
  ];
  return (
    <nav className="ds-bottom-nav ds-mobile-only" style={{ display: "flex" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", width: "100%", height: "100%" }}>
        {items.map((it) => {
          const isActive = activeNav === it.id;
          return (
            <button key={it.id}
              onClick={() => it.id === "__menu__" ? onOpenMenu() : setActiveNav(it.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, color: isActive ? "#C4B8F5" : "rgba(255,255,255,0.45)",
                cursor: "pointer", fontSize: 10, fontWeight: 500, background: "transparent",
                border: "none", fontFamily: "inherit", padding: "4px 2px",
                transition: "color 0.15s",
              }}>
              {it.icon}
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
