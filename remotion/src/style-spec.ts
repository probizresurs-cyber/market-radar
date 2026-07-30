/**
 * StyleSpec — генеративная спецификация стиля ролика (v3).
 *
 * Вместо фиксированных пресетов: ИИ-арт-директор (content/video/plan)
 * собирает под КАЖДЫЙ ролик свою комбинацию из ограниченного словаря
 * значений — тема, ниша, брендбук и пользовательский стиль-промпт
 * («неон и глитч», «мягкий пастельный») превращаются в конкретные
 * параметры. Словарь ограничен енумами и клампами не из недоверия к
 * модели, а чтобы ЛЮБАЯ комбинация рендерилась корректно — генерация
 * произвольного React-кода на прод-рендере недопустима.
 *
 * Файл шарится между Remotion-проектом (композиция) и Next-приложением
 * (санитайзер в render-content-reel) — держи без импортов из remotion.
 */
import { z } from "zod";

export const styleSpecSchema = z.object({
  /** Цветовая схема. Палитра приходит из брендбука клиента — арт-директор
   *  выбирает, КАК её применить, а не придумывает цвета сам. */
  palette: z.object({
    /** Индекс акцентного цвета в brandBook.colors (0-4). */
    accentIndex: z.number().optional(),
    /** Индекс цвета фоновой базы; если не задан — тёмная нейтраль. */
    baseIndex: z.number().optional(),
    /** Насколько ярко фон окрашен брендовым цветом: 0 — почти чёрный, 1 — насыщенный. */
    baseTint: z.number().optional(),
    /** Светлая схема (тёмный текст на светлом фоне) вместо тёмной. */
    light: z.boolean().optional(),
  }).optional(),
  /** Композиция кадра — куда и как ставится текст. */
  layout: z.object({
    hookPosition: z.enum(["center", "top", "bottom"]).optional(),
    hookAlign: z.enum(["center", "left"]).optional(),
    captionPosition: z.enum(["low", "middle", "high"]).optional(),
  }).optional(),
  /** Голос за кадром — ElevenLabs. */
  voice: z.object({
    /** Готовый пресет тембра (см. VOICE_PRESETS в lib/voice-presets.ts). */
    preset: z.enum(["female-warm", "female-energetic", "male-calm", "male-bold", "neutral-narrator"]).optional(),
    /** 0..1 — ровность подачи. Ниже = живее и эмоциональнее. */
    stability: z.number().optional(),
    /** 0..1 — экспрессия. Выше = ярче игра голосом. */
    expressiveness: z.number().optional(),
    speed: z.number().optional(),
  }).optional(),
  typography: z.object({
    uppercase: z.boolean().optional(),
    /** 700 | 800 | 900 */
    weight: z.number().optional(),
    /** px, -3..4 */
    letterSpacing: z.number().optional(),
    /** множитель размера шрифта хука, 0.8..1.25 */
    fontScale: z.number().optional(),
  }).optional(),
  hook: z.object({
    wordAnimation: z.enum(["spring-up", "blur-in", "slide-left", "scale-pop", "typewriter"]).optional(),
    accentTarget: z.enum(["longest", "last", "first", "none"]).optional(),
    underline: z.boolean().optional(),
  }).optional(),
  broll: z.object({
    transition: z.enum(["fade", "slide-left", "slide-right", "slide-up", "wipe", "flip", "clock-wipe", "punch", "whip"]).optional(),
    kenBurns: z.enum(["subtle", "strong", "off"]).optional(),
  }).optional(),
  decor: z.object({
    /** 0..1 — интенсивность плёночного зерна (0 = выкл) */
    grain: z.number().optional(),
    /** 0..1 — сила виньетки */
    vignette: z.number().optional(),
    shapes: z.boolean().optional(),
    /** тёплые световые «протечки» на склейках */
    lightLeak: z.boolean().optional(),
  }).optional(),
  captions: z.object({
    mode: z.enum(["pill", "bare", "boxed"]).optional(),
    karaoke: z.boolean().optional(),
  }).optional(),
  progressBar: z.boolean().optional(),
});

export type StyleSpec = z.infer<typeof styleSpecSchema>;

/** Развёрнутый спек со всеми дефолтами — композиция работает только с ним. */
export interface ResolvedStyleSpec {
  palette: { accentIndex: number; baseIndex: number | null; baseTint: number; light: boolean };
  layout: { hookPosition: "center" | "top" | "bottom"; hookAlign: "center" | "left"; captionPosition: "low" | "middle" | "high" };
  voice: { preset: VoicePresetName; stability: number; expressiveness: number; speed: number };
  typography: { uppercase: boolean; weight: number; letterSpacing: number; fontScale: number };
  hook: { wordAnimation: "spring-up" | "blur-in" | "slide-left" | "scale-pop" | "typewriter"; accentTarget: "longest" | "last" | "first" | "none"; underline: boolean };
  broll: { transition: "fade" | "slide-left" | "slide-right" | "slide-up" | "wipe" | "flip" | "clock-wipe" | "punch" | "whip"; kenBurns: "subtle" | "strong" | "off" };
  decor: { grain: number; vignette: number; shapes: boolean; lightLeak: boolean };
  captions: { mode: "pill" | "bare" | "boxed"; karaoke: boolean };
  progressBar: boolean;
}

export type VoicePresetName = "female-warm" | "female-energetic" | "male-calm" | "male-bold" | "neutral-narrator";

const clamp = (v: number | undefined, min: number, max: number, dflt: number): number =>
  typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;

const VOICE_PRESET_NAMES: VoicePresetName[] = ["female-warm", "female-energetic", "male-calm", "male-bold", "neutral-narrator"];

export function resolveStyleSpec(raw?: StyleSpec | null): ResolvedStyleSpec {
  const s = raw ?? {};
  return {
    palette: {
      accentIndex: Math.round(clamp(s.palette?.accentIndex, 0, 4, 0)),
      baseIndex: typeof s.palette?.baseIndex === "number" ? Math.round(clamp(s.palette.baseIndex, 0, 4, 0)) : null,
      baseTint: clamp(s.palette?.baseTint, 0, 1, 0.25),
      light: s.palette?.light ?? false,
    },
    layout: {
      hookPosition: s.layout?.hookPosition ?? "center",
      hookAlign: s.layout?.hookAlign ?? "center",
      captionPosition: s.layout?.captionPosition ?? "low",
    },
    voice: {
      preset: VOICE_PRESET_NAMES.includes(s.voice?.preset as VoicePresetName) ? (s.voice!.preset as VoicePresetName) : "female-warm",
      stability: clamp(s.voice?.stability, 0, 1, 0.35),
      expressiveness: clamp(s.voice?.expressiveness, 0, 1, 0.55),
      speed: clamp(s.voice?.speed, 0.85, 1.1, 1),
    },
    typography: {
      uppercase: s.typography?.uppercase ?? false,
      weight: [700, 800, 900].includes(s.typography?.weight ?? 0) ? (s.typography!.weight as number) : 900,
      letterSpacing: clamp(s.typography?.letterSpacing, -3, 4, -2),
      fontScale: clamp(s.typography?.fontScale, 0.8, 1.25, 1),
    },
    hook: {
      wordAnimation: s.hook?.wordAnimation ?? "spring-up",
      accentTarget: s.hook?.accentTarget ?? "longest",
      underline: s.hook?.underline ?? true,
    },
    broll: {
      transition: s.broll?.transition ?? "punch",
      kenBurns: s.broll?.kenBurns ?? "subtle",
    },
    decor: {
      grain: clamp(s.decor?.grain, 0, 1, 0.5),
      vignette: clamp(s.decor?.vignette, 0, 1, 0.6),
      shapes: s.decor?.shapes ?? true,
      lightLeak: s.decor?.lightLeak ?? false,
    },
    captions: {
      mode: s.captions?.mode ?? "pill",
      karaoke: s.captions?.karaoke ?? true,
    },
    progressBar: s.progressBar ?? true,
  };
}

/** Легаси-мост: три старых пресета (styleVariant) → StyleSpec. */
export function specFromLegacyVariant(variant?: string | null): StyleSpec {
  switch (variant) {
    case "clean":
      return {
        hook: { wordAnimation: "blur-in", underline: false },
        broll: { transition: "fade", kenBurns: "subtle" },
        decor: { grain: 0, vignette: 0.4, shapes: false },
        captions: { mode: "pill" },
      };
    case "bold":
      return {
        typography: { uppercase: true, letterSpacing: 0 },
        hook: { wordAnimation: "slide-left" },
        broll: { transition: "slide-left", kenBurns: "strong" },
        decor: { grain: 0.7, vignette: 0.7, shapes: true },
        captions: { mode: "boxed" },
      };
    default: // dynamic
      return {
        hook: { wordAnimation: "spring-up" },
        broll: { transition: "punch", kenBurns: "subtle" },
        decor: { grain: 0.5, vignette: 0.6, shapes: true },
        captions: { mode: "pill" },
      };
  }
}
