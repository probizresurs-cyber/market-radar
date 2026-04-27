// White-label configuration — per user, stored in localStorage.
// Sprint 4: accent color + hide-branding toggle.
// Future: logo URL, brand name (currently kept as MarketRadar).

export interface WhiteLabelConfig {
  enabled: boolean;
  accentColor: string;    // hex, e.g. "#7c3aed"
  hideBranding: boolean;  // hide "MarketRadar" credit in sidebar/exports
}

export const WL_DEFAULTS: WhiteLabelConfig = {
  enabled: false,
  accentColor: "#3b82f6",  // default matches --primary in globals.css
  hideBranding: false,
};

export const ACCENT_PRESETS = [
  { label: "Синий",       value: "#3b82f6" },
  { label: "Фиолетовый",  value: "#7c3aed" },
  { label: "Индиго",      value: "#6366f1" },
  { label: "Розовый",     value: "#ec4899" },
  { label: "Красный",     value: "#ef4444" },
  { label: "Оранжевый",   value: "#f97316" },
  { label: "Янтарный",    value: "#f59e0b" },
  { label: "Изумрудный",  value: "#10b981" },
  { label: "Циан",        value: "#06b6d4" },
  { label: "Серый",       value: "#64748b" },
];

function storageKey(userId: string) {
  return `mr_whitelabel_${userId}`;
}

export function loadWhiteLabel(userId: string): WhiteLabelConfig {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...WL_DEFAULTS };
    return { ...WL_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...WL_DEFAULTS };
  }
}

export function saveWhiteLabel(userId: string, cfg: WhiteLabelConfig): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(cfg));
  } catch { /* ignore */ }
}

/**
 * Derive CSS variables from accent color using simple lightness shifts.
 * Returns a block of CSS that overrides --primary and its variants.
 */
export function buildAccentCss(hex: string): string {
  return `
    :root {
      --primary: ${hex};
      --primary-hover: ${hex}dd;
      --primary-muted: ${hex}22;
    }
  `;
}
