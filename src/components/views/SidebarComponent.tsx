"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Sword, BookOpen, BarChart2, BarChart3, Settings, Menu, ChevronRight,
  Gauge, Building2, Search, TrendingUp, FolderOpen, Swords, Target, Scale, Lightbulb, Brain, Pencil,
  Map, Share2, Palette, Star, FileText, Plus, Library, Key, Factory, ClipboardList, FileEdit, Film,
  Smartphone, Wallet, Globe, Presentation, Link2, Moon, Sun, Coffee, LogOut, Layers, Eye,
  Network, HelpCircle, ScanLine, Grid3x3, DollarSign, LineChart,
  Pin, Clock, Bot, Sparkles, Trash2, User,
} from "lucide-react";
import { COLORS } from "@/lib/colors";
import type { Colors, Theme } from "@/lib/colors";
import type { UserAccount } from "@/lib/user";
import type { NavItem, NavSection } from "@/lib/nav";
import { MarketRadarLogo } from "@/components/ui/MarketRadarLogo";

// ── Pinned / Recently used (sidebar) ─────────────────────────────────
// Хранится в localStorage per-userId. Pinned — explicit user choice (max 6),
// Recent — last 5 visited items (excludes pinned to avoid duplication).

const PIN_KEY = (uid: string) => `mr_sidebar_pinned_${uid || "anon"}`;
const RECENT_KEY = (uid: string) => `mr_sidebar_recent_${uid || "anon"}`;
const MAX_PINNED = 6;
const MAX_RECENT = 3;

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* ignore */ }
}

// Find a NavItem by id walking the nav tree, return label/icon for sidebar render.
function findItemById(sections: NavSection[], id: string): NavItem | null {
  for (const sect of sections) {
    for (const item of sect.items) {
      if (item.id === id) return item;
      if (item.children) {
        for (const ch of item.children) if (ch.id === id) return ch;
      }
    }
  }
  return null;
}

// Map icon names from nav.ts → actual Lucide components.
// Anything not in this map falls back to rendering the string (legacy emoji support).
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  LayoutDashboard, Users, BarChart2, BarChart3, Settings, Gauge, Building2, Search, TrendingUp,
  FolderOpen, Swords, Target, Scale, Lightbulb, Brain, Pencil, Map, Share2, Palette, Star,
  FileText, Plus, Library, Key, Factory, ClipboardList, FileEdit, Film, Smartphone, Wallet,
  Globe, Presentation, Link2, BookOpen, Sword, Layers, Eye,
  Network, HelpCircle, ScanLine, Grid3x3, DollarSign, LineChart, Bot, Sparkles,
};

function NavIcon({ name, size = 15, active }: { name: string; size?: number; active?: boolean }) {
  const Icon = ICON_MAP[name];
  if (!Icon) {
    // Legacy emoji fallback
    return <span style={{ fontSize: size, lineHeight: 1 }}>{name}</span>;
  }
  return <Icon size={size} style={{ color: active ? "#C4B8F5" : "currentColor", strokeWidth: 1.75, opacity: active ? 1 : 0.75 }} />;
}


// ============================================================
// Sidebar Component
// ============================================================

export function SidebarComponent({
  c, theme, setTheme, activeNav, setActiveNav, navSections, companyUrl,
  user, onLogout, hideBranding,
  workspaces, activeWorkspaceId, onSwitchWorkspace,
  profiles, activeProfileId, onSwitchProfile, onCreateProfile, onDeleteProfile,
  canDeleteActiveProfile,
}: {
  c: Colors; theme: Theme; setTheme: (t: Theme) => void;
  activeNav: string; setActiveNav: (id: string) => void;
  navSections: NavSection[]; companyUrl: string;
  user?: UserAccount | null; onLogout?: () => void;
  hideBranding?: boolean;
  /** Список workspace'ов к которым у юзера есть доступ. Если 1 (=своя) — switcher скрыт. */
  workspaces?: Array<{ workspaceId: string; displayName: string; role: "owner" | "editor" | "viewer" }>;
  /** Активный workspace. По умолчанию = user.id. */
  activeWorkspaceId?: string;
  onSwitchWorkspace?: (workspaceId: string) => void;
  /** Профили под одним аккаунтом (компания + личный бренд и т.п.). */
  profiles?: Array<{ id: string; name: string; kind: "company" | "personal" }>;
  activeProfileId?: string;
  onSwitchProfile?: (profileId: string) => void;
  onCreateProfile?: () => void;
  onDeleteProfile?: (profileId: string) => void;
  /** true если активный профиль можно удалить (не default). */
  canDeleteActiveProfile?: boolean;
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

  // ── Pinned / Recently used state ─────────────────────────────
  const uid = user?.id || "anon";
  const [pinned, setPinned] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setPinned(readList(PIN_KEY(uid)).slice(0, MAX_PINNED));
    setRecent(readList(RECENT_KEY(uid)).slice(0, MAX_RECENT));
  }, [uid]);

  // Track recent visits (skip groups and items already pinned)
  useEffect(() => {
    if (!activeNav) return;
    const item = findItemById(navSections, activeNav);
    if (!item || (item.children && item.children.length > 0)) return; // skip groups
    setRecent(prev => {
      if (pinned.includes(activeNav)) return prev;
      const next = [activeNav, ...prev.filter(id => id !== activeNav)].slice(0, MAX_RECENT);
      writeList(RECENT_KEY(uid), next);
      return next;
    });
  }, [activeNav, navSections, pinned, uid]);

  const togglePin = (id: string) => {
    setPinned(prev => {
      const isPinned = prev.includes(id);
      const next = isPinned
        ? prev.filter(p => p !== id)
        : [...prev, id].slice(0, MAX_PINNED);
      writeList(PIN_KEY(uid), next);
      // Remove from recent when pinning (avoid duplicate)
      if (!isPinned) {
        setRecent(r => {
          const filt = r.filter(x => x !== id);
          writeList(RECENT_KEY(uid), filt);
          return filt;
        });
      }
      return next;
    });
  };

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

  const renderItem = (item: NavItem, depth = 0, showPin = true) => {
    const isGroup = !!(item.children && item.children.length > 0);
    const isExpanded = expandedGroups.has(item.id);
    const isActive = activeNav === item.id;
    const childActive = isGroup && item.children!.some(ch => ch.id === activeNav);
    const isPinned = pinned.includes(item.id);

    return (
      <div key={`${depth}-${item.id}`} className="ds-side-row">
        <div
          onClick={() => isGroup ? toggleGroup(item.id) : setActiveNav(item.id)}
          style={{
            display: "flex", alignItems: "center", gap: 11,
            padding: depth > 0 ? "9px 10px 9px 30px" : "10px 12px",
            borderRadius: 9, cursor: "pointer",
            background: isActive ? "var(--sidebar-active)" : "transparent",
            color: isActive ? "#C4B8F5" : childActive ? "#C4B8F5" : "var(--sidebar-fg)",
            fontWeight: isActive ? 700 : (childActive && !isExpanded) ? 600 : 500, fontSize: 14,
            transition: "background 0.15s ease, color 0.15s ease", marginBottom: 2,
            minHeight: depth > 0 ? 36 : 40,
            position: "relative",
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ width: depth > 0 ? 16 : 18, height: depth > 0 ? 16 : 18, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <NavIcon name={item.icon} size={depth > 0 ? 16 : 18} active={isActive || childActive} />
          </span>
          <span style={{ flex: 1, lineHeight: 1.3 }}>{item.label}</span>
          {item.count !== null && !isGroup && (
            <span style={{ fontSize: 12, fontWeight: 700, background: isActive ? "rgba(196,184,245,0.18)" : "rgba(255,255,255,0.08)", color: isActive ? "#C4B8F5" : "var(--sidebar-muted)", borderRadius: 10, padding: "2px 9px", minWidth: 22, textAlign: "center" }}>{item.count}</span>
          )}
          {/* Pin/unpin button — visible on hover for non-group items */}
          {showPin && !isGroup && (
            <button
              className="ds-pin-btn"
              onClick={(e) => { e.stopPropagation(); togglePin(item.id); }}
              aria-label={isPinned ? "Открепить" : "Закрепить"}
              title={isPinned ? "Открепить" : "Закрепить в избранное"}
              style={{
                background: "transparent",
                border: "none",
                padding: 4,
                borderRadius: 6,
                color: isPinned ? "#C4B8F5" : "var(--sidebar-muted)",
                cursor: "pointer",
                display: isPinned ? "inline-flex" : "none",
                alignItems: "center",
                justifyContent: "center",
                opacity: isPinned ? 0.9 : 0.7,
                flexShrink: 0,
              }}
            >
              <Pin size={12} fill={isPinned ? "currentColor" : "none"} strokeWidth={1.75} />
            </button>
          )}
          {isGroup && (
            <ChevronRight size={15} style={{ color: "var(--sidebar-muted)", transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
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

  // Helper to render a flat item (Pinned/Recent sections)
  const renderFlatItem = (id: string) => {
    const item = findItemById(navSections, id);
    if (!item) return null;
    return renderItem(item, 0, true);
  };

  // Filter recent: don't show currently active or already-pinned items
  const visibleRecent = recent.filter(id => !pinned.includes(id) && id !== activeNav).slice(0, MAX_RECENT);

  return (
    <aside className="ds-sidebar-desktop" style={{ width: 256, minWidth: 256, background: "var(--sidebar-bg)", borderRight: `1px solid var(--sidebar-border)`, display: "flex", flexDirection: "column", overflow: "auto" }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid var(--sidebar-border)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <MarketRadarLogo size={32} variant="dark" animated />
          {!hideBranding && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--sidebar-fg)", letterSpacing: "-0.02em" }}>
                <span style={{ fontWeight: 400, opacity: 0.6 }}>Market</span>Radar
              </div>
              {companyUrl && <div style={{ fontSize: 12, color: "var(--sidebar-muted)", marginTop: 2 }}>{companyUrl}</div>}
            </div>
          )}
          {hideBranding && companyUrl && (
            <div style={{ fontSize: 12, color: "var(--sidebar-muted)" }}>{companyUrl}</div>
          )}
        </div>
      </div>

      {/* Profile switcher — профили под одним аккаунтом (компания / личный
          бренд). Показываем только в своей workspace (parent передаёт profiles
          лишь тогда). Дропдаун + кнопка «＋» создать + «корзина» удалить. */}
      {profiles && profiles.length > 0 && onSwitchProfile && (
        <div style={{ padding: "10px 12px", borderBottom: `1px solid var(--sidebar-border)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sidebar-muted)", letterSpacing: "0.07em", marginBottom: 6, textTransform: "uppercase" }}>
            Профиль
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              value={activeProfileId ?? "default"}
              onChange={e => {
                const v = e.target.value;
                if (v === "__create__") { onCreateProfile?.(); return; }
                onSwitchProfile(v);
              }}
              style={{
                flex: 1, minWidth: 0,
                padding: "8px 10px", borderRadius: 8,
                border: "1px solid var(--sidebar-border)",
                background: "var(--sidebar-hover)",
                color: "var(--sidebar-fg)",
                fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                outline: "none",
              }}
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {onCreateProfile && <option value="__create__">+ Создать профиль…</option>}
            </select>
            {canDeleteActiveProfile && onDeleteProfile && activeProfileId && (
              <button
                onClick={() => onDeleteProfile(activeProfileId)}
                title="Удалить профиль"
                style={{
                  flexShrink: 0, width: 32, height: 34, borderRadius: 8,
                  border: "1px solid var(--sidebar-border)", background: "transparent",
                  color: "#F87171", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ padding: "8px", flex: 1, overflowY: "auto" }}>
        {/* Pin button visible on hover */}
        <style>{`
          .ds-side-row:hover .ds-pin-btn { display: inline-flex !important; }
          .ds-side-row:hover .ds-pin-btn:hover { opacity: 1 !important; background: rgba(255,255,255,0.08) !important; }
        `}</style>

        {/* Pinned section — only if there's anything pinned */}
        {pinned.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--sidebar-muted)", letterSpacing: "0.1em", padding: "16px 12px 8px", textTransform: "uppercase" }}>
              <Pin size={11} fill="currentColor" strokeWidth={1.5} style={{ opacity: 0.8 }} />
              Избранное
            </div>
            {pinned.map(id => renderFlatItem(id))}
          </div>
        )}

        {/* Recent section — only if non-empty after filtering */}
        {visibleRecent.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--sidebar-muted)", letterSpacing: "0.1em", padding: "16px 12px 8px", textTransform: "uppercase" }}>
              <Clock size={11} strokeWidth={1.75} style={{ opacity: 0.8 }} />
              Недавнее
            </div>
            {visibleRecent.map(id => renderFlatItem(id))}
          </div>
        )}

        {navSections.map(section => (
          <div key={section.title}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sidebar-muted)", letterSpacing: "0.1em", padding: "16px 12px 8px", textTransform: "uppercase" }}>{section.title}</div>
            {section.items.map(item => renderItem(item))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ padding: "8px", borderTop: `1px solid var(--sidebar-border)` }}>
        <div onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "warm" : "light")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, cursor: "pointer", fontSize: 14, color: "var(--sidebar-fg)", transition: "background 0.15s", minHeight: 40 }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--sidebar-hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span style={{ width: 15, display: "inline-flex", alignItems: "center" }}>
            {theme === "light" ? <Moon size={15} strokeWidth={1.75} /> : theme === "dark" ? <Coffee size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
          </span>
          <span style={{ opacity: 0.85 }}>{theme === "light" ? "Тёмная тема" : theme === "dark" ? "Тёплая тема" : "Светлая тема"}</span>
        </div>
        {/* Workspace switcher — показываем только если у юзера ≥ 2 доступных workspace'ов
            (своя + хотя бы одна чужая). При одной — нет смысла показывать. */}
        {workspaces && workspaces.length >= 2 && onSwitchWorkspace && (
          <div style={{ padding: "10px", borderTop: `1px solid var(--sidebar-border)`, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sidebar-muted)", letterSpacing: "0.07em", marginBottom: 6, textTransform: "uppercase" }}>
              Рабочее пространство
            </div>
            <select
              value={activeWorkspaceId ?? ""}
              onChange={e => onSwitchWorkspace(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px", borderRadius: 8,
                border: "1px solid var(--sidebar-border)",
                background: "var(--sidebar-hover)",
                color: "var(--sidebar-fg)",
                fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                outline: "none",
              }}
            >
              {workspaces.map(w => (
                <option key={w.workspaceId} value={w.workspaceId}>
                  {w.displayName}{w.role !== "owner" ? ` · ${w.role === "editor" ? "редактор" : "просмотр"}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {user && (
          <div style={{ padding: "10px", borderTop: `1px solid var(--sidebar-border)`, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #1E40AF, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#16A34A", border: `2px solid var(--sidebar-bg)` }} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--sidebar-fg)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                <div style={{ fontSize: 12, color: "var(--sidebar-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{user.email}</div>
              </div>
            </div>
            <div onClick={onLogout}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#F87171", cursor: "pointer", padding: "8px 4px", opacity: 0.85, transition: "opacity 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}>
              <LogOut size={13} strokeWidth={1.75} /><span>Выйти</span>
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
    { id: "dashboard",    label: "Главная",    icon: LayoutDashboard },
    { id: "competitors",  label: "Конкуренты", icon: Sword },
    { id: "ta-dashboard", label: "ЦА",         icon: Users },
    { id: "content-plan", label: "Контент",    icon: BookOpen },
    { id: "__menu__",     label: "Ещё",        icon: Menu },
  ];
  return (
    <nav className="ds-bottom-nav ds-mobile-only" style={{ display: "flex" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", width: "100%", height: "100%" }}>
        {items.map((it) => {
          const isActive = activeNav === it.id;
          const IconCmp = it.icon;
          return (
            <button key={it.id}
              onClick={() => it.id === "__menu__" ? onOpenMenu() : setActiveNav(it.id)}
              style={{
                position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 5,
                color: isActive ? "#C4B8F5" : "rgba(255,255,255,0.55)",
                cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                background: "transparent", border: "none",
                fontFamily: "inherit",
                padding: "6px 4px",
                minHeight: 56,
                transition: "color 0.15s",
              }}>
              {/* Active indicator (top dot) */}
              {isActive && (
                <span style={{
                  position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
                  width: 24, height: 3, borderRadius: 2, background: "#C4B8F5",
                }} />
              )}
              <IconCmp size={24} strokeWidth={isActive ? 2 : 1.75} />
              <span style={{ letterSpacing: -0.1 }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
