/**
 * Типы и санитайзер спецификации стиля видео — сторона Next-приложения.
 *
 * Словарь дублирует remotion/src/style-spec.ts осознанно: у Next нет zod и нет
 * импорта из remotion-проекта (раздельные сборки, разные tsconfig). Здесь —
 * жёсткая валидация того, что придумал ИИ-арт-директор, ДО передачи в рендер:
 * enum-whitelist + клампы чисел. Любая фантазия модели отбрасывается на
 * дефолт композиции, рендер упасть не может.
 *
 * При изменении словаря править ОБА файла.
 */

export type VoicePresetName = "female-warm" | "female-energetic" | "male-calm" | "male-bold" | "neutral-narrator";

export interface StyleSpecInput {
  palette?: { accentIndex?: number; baseIndex?: number; baseTint?: number; light?: boolean };
  layout?: { hookPosition?: string; hookAlign?: string; captionPosition?: string };
  voice?: { preset?: string; stability?: number; expressiveness?: number };
  typography?: { uppercase?: boolean; weight?: number; letterSpacing?: number; fontScale?: number };
  hook?: { wordAnimation?: string; accentTarget?: string; underline?: boolean };
  broll?: { transition?: string; kenBurns?: string };
  decor?: { grain?: number; vignette?: number; shapes?: boolean; lightLeak?: boolean };
  captions?: { mode?: string; karaoke?: boolean };
  progressBar?: boolean;
}

const WORD_ANIMS = new Set(["spring-up", "blur-in", "slide-left", "scale-pop", "typewriter"]);
const ACCENT_TARGETS = new Set(["longest", "last", "first", "none"]);
const TRANSITIONS = new Set(["fade", "slide-left", "slide-right", "slide-up", "wipe", "flip", "clock-wipe", "punch", "whip"]);
const KEN_BURNS = new Set(["subtle", "strong", "off"]);
const CAPTION_MODES = new Set(["pill", "bare", "boxed"]);
const HOOK_POSITIONS = new Set(["center", "top", "bottom"]);
const HOOK_ALIGNS = new Set(["center", "left"]);
const CAPTION_POSITIONS = new Set(["low", "middle", "high"]);
const VOICE_PRESET_SET = new Set<string>(["female-warm", "female-energetic", "male-calm", "male-bold", "neutral-narrator"]);

function num(v: unknown, min: number, max: number): number | undefined {
  return typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
}
function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function oneOf(v: unknown, set: Set<string>): string | undefined {
  return typeof v === "string" && set.has(v) ? v : undefined;
}

export function sanitizeStyleSpec(raw: unknown): StyleSpecInput | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, Record<string, unknown> | undefined>;
  return {
    palette: {
      accentIndex: num(r.palette?.accentIndex, 0, 4),
      baseIndex: num(r.palette?.baseIndex, 0, 4),
      baseTint: num(r.palette?.baseTint, 0, 1),
      light: bool(r.palette?.light),
    },
    layout: {
      hookPosition: oneOf(r.layout?.hookPosition, HOOK_POSITIONS),
      hookAlign: oneOf(r.layout?.hookAlign, HOOK_ALIGNS),
      captionPosition: oneOf(r.layout?.captionPosition, CAPTION_POSITIONS),
    },
    voice: {
      preset: oneOf(r.voice?.preset, VOICE_PRESET_SET),
      stability: num(r.voice?.stability, 0, 1),
      expressiveness: num(r.voice?.expressiveness, 0, 1),
    },
    typography: {
      uppercase: bool(r.typography?.uppercase),
      weight: [700, 800, 900].includes(r.typography?.weight as number) ? (r.typography!.weight as number) : undefined,
      letterSpacing: num(r.typography?.letterSpacing, -3, 4),
      fontScale: num(r.typography?.fontScale, 0.8, 1.25),
    },
    hook: {
      wordAnimation: oneOf(r.hook?.wordAnimation, WORD_ANIMS),
      accentTarget: oneOf(r.hook?.accentTarget, ACCENT_TARGETS),
      underline: bool(r.hook?.underline),
    },
    broll: {
      transition: oneOf(r.broll?.transition, TRANSITIONS),
      kenBurns: oneOf(r.broll?.kenBurns, KEN_BURNS),
    },
    decor: {
      grain: num(r.decor?.grain, 0, 1),
      vignette: num(r.decor?.vignette, 0, 1),
      shapes: bool(r.decor?.shapes),
      lightLeak: bool(r.decor?.lightLeak),
    },
    captions: {
      mode: oneOf(r.captions?.mode, CAPTION_MODES),
      karaoke: bool(r.captions?.karaoke),
    },
    progressBar: bool((raw as Record<string, unknown>).progressBar),
  };
}

/** #rrggbb / #rgb → нормализованный #rrggbb; null если не цвет. */
export function normalizeHex(c: unknown): string | null {
  if (typeof c !== "string") return null;
  const s = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return null;
}

/**
 * Цвета ролика из палитры брендбука по выбору арт-директора.
 *
 * Раньше цвета жёстко брались из дефолтов MarketRadar (#0a0e1a + #22d3ee) —
 * поэтому ролики ЛЮБОГО клиента выходили в наших фирменных цветах, и все
 * выглядели одинаково, как ни меняй стиль. Теперь: акцент и база берутся из
 * brandBook.colors по индексам из спека, фон подмешивается к почти-чёрному
 * (или почти-белому в светлой схеме) с силой baseTint.
 */
export function resolveVideoColors(
  brandColors: unknown,
  spec: StyleSpecInput | undefined,
  fallback: { brandColor: string; accentColor: string },
): { brandColor: string; accentColor: string } {
  const palette = (Array.isArray(brandColors) ? brandColors : [])
    .map(normalizeHex)
    .filter((c): c is string => c !== null);
  if (palette.length === 0) return fallback;

  const accentIdx = Math.min(palette.length - 1, Math.round(spec?.palette?.accentIndex ?? 0));
  const accentColor = palette[accentIdx];

  const light = spec?.palette?.light ?? false;
  const tint = spec?.palette?.baseTint ?? 0.25;
  const baseIdxRaw = spec?.palette?.baseIndex;
  const baseSource = typeof baseIdxRaw === "number"
    ? palette[Math.min(palette.length - 1, Math.round(baseIdxRaw))]
    : accentColor;

  // Смешиваем выбранный цвет с почти-чёрным/почти-белым: фон получает
  // брендовый оттенок, но остаётся читаемым под белым/тёмным текстом.
  const brandColor = mix(baseSource, light ? "#f7f8fb" : "#080a12", tint);
  return { brandColor, accentColor };
}

function mix(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexB;
  const w = Math.min(1, Math.max(0, weightA));
  const ch = (x: number, y: number) => Math.round(x * w + y * (1 - w));
  return rgbToHex(ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0")).join("")}`;
}
