// ─── Design-token colour palette ──────────────────────────────────────────────
// Sidebar is ALWAYS dark regardless of theme.

export const COLORS = {
  light: {
    bg: "#F5F3F0", bgCard: "#FEFEFE",
    bgSidebar: "#1C1A35", bgSidebarHover: "#272450", bgSidebarActive: "#332F60",
    sidebarText: "#E8E6EF", sidebarTextMuted: "#9B97B8", sidebarBorder: "#332F60",
    accent: "#1E40AF", accentWarm: "#D4A017", accentGreen: "#16A34A",
    accentRed: "#DC2626", accentYellow: "#D4A017",
    textPrimary: "#1A1A2E", textSecondary: "#2D2B3A", textMuted: "#6B6979",
    border: "#D1D0D7", borderLight: "#EBEAF0",
    shadow: "0 1px 2px rgba(26,26,46,0.04), 0 4px 16px rgba(124,58,237,0.06)",
    shadowLg: "0 4px 6px rgba(26,26,46,0.05), 0 10px 40px rgba(124,58,237,0.10)",
  },
  dark: {
    bg: "#1E1B2E", bgCard: "#2A2740",
    bgSidebar: "#141126", bgSidebarHover: "#201C38", bgSidebarActive: "#2A2544",
    sidebarText: "#E8E6EF", sidebarTextMuted: "#8F8BA8", sidebarBorder: "#2A2544",
    accent: "#3B82F6", accentWarm: "#FBBF24", accentGreen: "#34D399",
    accentRed: "#F87171", accentYellow: "#FBBF24",
    textPrimary: "#E8E6EF", textSecondary: "#B0ADC3", textMuted: "#7F7C94",
    border: "#4A4660", borderLight: "#3A3652",
    shadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.4)",
    shadowLg: "0 4px 8px rgba(0,0,0,0.6), 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.06)",
  },
  warm: {
    bg: "#F8F4EC", bgCard: "#FAF6F0",
    bgSidebar: "#2A2418", bgSidebarHover: "#3A3020", bgSidebarActive: "#463A27",
    sidebarText: "#F0E6D4", sidebarTextMuted: "#B8A888", sidebarBorder: "#463A27",
    accent: "#5B4FC7", accentWarm: "#D4A017", accentGreen: "#16A34A",
    accentRed: "#DC2626", accentYellow: "#D4A017",
    textPrimary: "#2E2418", textSecondary: "#4A3E2E", textMuted: "#7A6E5E",
    border: "#D4C9B8", borderLight: "#E8DFCC",
    shadow: "0 1px 2px rgba(46,36,24,0.04), 0 4px 16px rgba(91,79,199,0.06)",
    shadowLg: "0 4px 6px rgba(46,36,24,0.05), 0 10px 40px rgba(91,79,199,0.10)",
  },
} as const;

export type Theme = keyof typeof COLORS;
export type Colors = (typeof COLORS)[Theme];
