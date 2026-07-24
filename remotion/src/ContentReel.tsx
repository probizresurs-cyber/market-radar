/**
 * ContentReel v3 — генеративный стиль вместо пресетов.
 *
 * Манеру ролика описывает StyleSpec (см. style-spec.ts): ИИ-арт-директор
 * собирает его под каждый ролик из ограниченного словаря значений, либо
 * пользователь задаёт стиль словами и агент переводит его в спек. Любая
 * комбинация значений обязана рендериться корректно — поэтому словарь
 * закрыт (енумы + клампы), а не произвольный код.
 *
 * Из Remotion используется: TransitionSeries (официальные переходы fade/
 * slide/wipe/flip/clockWipe между b-roll сегментами), spring/interpolate
 * с bezier-easing (кинетическая типографика, 5 анимаций слов), рукописные
 * панч/вип-переходы, световые «протечки» на склейках (CSS, без WebGL —
 * безопасно для headless-рендера на VPS).
 *
 * PromoReel и его сцены не тронуты. Легаси styleVariant поддержан мостом.
 */
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { z } from "zod";
import { CaptionsLayer } from "./CaptionsLayer";
import { styleSpecSchema, resolveStyleSpec, specFromLegacyVariant, type ResolvedStyleSpec } from "./style-spec";

const captionWordSchema = z.object({ word: z.string(), start: z.number(), end: z.number() });

export const contentReelSchema = z.object({
  hookText: z.string(),
  ctaText: z.string(),
  brandName: z.string(),
  brandColor: z.string(),
  accentColor: z.string(),
  voiceoverUrl: z.string().nullable(),
  musicUrl: z.string().nullable().optional(),
  hookBgImageUrl: z.string().nullable().optional(),
  ctaBgImageUrl: z.string().nullable().optional(),
  /** Fullscreen b-roll — видео (Replicate) и/или картинки вперемешку, в порядке показа. */
  brollUrls: z.array(z.string()).optional(),
  videoDurationSec: z.number().optional(),
  captionsEnabled: z.boolean().optional(),
  captionsScript: z.string().optional(),
  /** Точные пословные тайминги (Whisper) — если заданы, субтитры идут в такт голосу. */
  captionsWords: z.array(captionWordSchema).optional(),
  /** Генеративная спецификация стиля. Приоритетнее styleVariant. */
  styleSpec: styleSpecSchema.optional(),
  /** Легаси: три старых пресета. Используется только если styleSpec не задан. */
  styleVariant: z.enum(["dynamic", "clean", "bold"]).optional(),
});

export type ContentReelProps = z.infer<typeof contentReelSchema>;

export const defaultContentReelProps: ContentReelProps = {
  hookText: "Вы теряете клиентов на нижних позициях в поиске?",
  ctaText: "Узнайте, что видит ИИ о вашей компании",
  brandName: "MarketRadar",
  brandColor: "#0a0e1a",
  accentColor: "#22d3ee",
  voiceoverUrl: null,
  musicUrl: null,
  hookBgImageUrl: null,
  ctaBgImageUrl: null,
  brollUrls: [],
  videoDurationSec: 30,
  captionsEnabled: true,
};

/** Та же пропорция, что в PromoReel: хук и CTA короткие, основное время — контент. */
function calcSceneDurations(totalSec: number) {
  const hook = Math.max(2, Math.round(totalSec * 0.12));
  const cta = Math.max(3, Math.round(totalSec * 0.14));
  const broll = Math.max(5, totalSec - hook - cta);
  return { hook, broll, cta };
}

const EXPO_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const FONT = "Inter, -apple-system, system-ui, sans-serif";

// ── Декор-слои ──────────────────────────────────────────────────────────────

const GRAIN_URI = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter><rect width="240" height="240" filter="url(#n)" opacity="0.5"/></svg>`,
)}`;

function GrainOverlay({ amount }: { amount: number }) {
  const frame = useCurrentFrame();
  const jitterX = (frame % 6) * 37;
  const jitterY = (frame % 4) * 53;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${GRAIN_URI}")`,
        backgroundPosition: `${jitterX}px ${jitterY}px`,
        opacity: 0.04 + amount * 0.08,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
}

function Vignette({ amount }: { amount: number }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,${(0.25 + amount * 0.35).toFixed(2)}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}

function FloatingShapes({ accentColor }: { accentColor: string }) {
  const frame = useCurrentFrame();
  const drift1 = Math.sin(frame / 55) * 90;
  const drift2 = Math.cos(frame / 70) * 110;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", width: 620, height: 620, borderRadius: "50%",
        background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`,
        filter: "blur(40px)", left: -180 + drift1, top: -140 + drift2 * 0.5,
      }} />
      <div style={{
        position: "absolute", width: 520, height: 520, borderRadius: "50%",
        background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
        filter: "blur(50px)", right: -160 - drift2 * 0.6, bottom: 240 + drift1 * 0.4,
      }} />
    </AbsoluteFill>
  );
}

/** Тёплая световая «протечка» на склейке — CSS-имитация плёночного light leak
 *  (без WebGL: @remotion/light-leaks требует GL-контекст, на headless-рендере
 *  VPS это лишний риск). Разгорается к центру своего окна и гаснет. */
function LightLeakSweep({ durationInFrames, fromLeft }: { durationInFrames: number; fromLeft: boolean }) {
  const frame = useCurrentFrame();
  const bell = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sweep = interpolate(frame, [0, durationInFrames], fromLeft ? [-30, 130] : [130, -30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: bell * 0.75 }}>
      <div style={{
        position: "absolute", top: "-20%", bottom: "-20%", width: "70%",
        left: `${sweep - 35}%`,
        background: "radial-gradient(ellipse at center, rgba(255,190,120,0.9) 0%, rgba(255,120,60,0.45) 40%, transparent 72%)",
        filter: "blur(30px)",
        rotate: fromLeft ? "-14deg" : "14deg",
      }} />
    </AbsoluteFill>
  );
}

function ProgressBar({ accentColor }: { accentColor: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: "rgba(255,255,255,0.12)", zIndex: 30 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 0 14px ${accentColor}99` }} />
    </div>
  );
}

// ── Хук-сцена: 5 анимаций слов по спеку ────────────────────────────────────

function ContentHookScene({ text, accentColor, bgImageUrl, spec }: {
  text: string; accentColor: string; bgImageUrl: string | null; spec: ResolvedStyleSpec;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = spec.typography;

  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.06, 1.16]);

  const words = text.split(" ").filter(Boolean);
  const accentIdx =
    spec.hook.accentTarget === "none" ? -1 :
    spec.hook.accentTarget === "first" ? 0 :
    spec.hook.accentTarget === "last" ? words.length - 1 :
    words.reduce((best, w, i) => (w.length > words[best].length ? i : best), 0);

  const allWordsIn = words.length * 2 + 10;
  const underline = interpolate(frame, [allWordsIn, allWordsIn + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT });

  // Тайпрайтер считает по символам всего текста, остальные — по словам.
  const totalChars = text.length;
  const typedChars = interpolate(frame, [0, Math.min(durationInFrames * 0.55, totalChars * 0.9)], [0, totalChars], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  let charOffset = 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {bgImageUrl ? (
        <AbsoluteFill style={{ scale: String(bgZoom) }}>
          <Img src={bgImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 25%, ${accentColor}2e 0%, transparent 62%)` }} />
      )}
      <AbsoluteFill style={{ background: bgImageUrl ? "linear-gradient(180deg, rgba(8,10,18,0.55) 0%, rgba(8,10,18,0.88) 100%)" : "transparent" }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 76 }}>
        <div style={{
          opacity: exit,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: t.weight,
          fontSize: Math.round(112 * t.fontScale),
          lineHeight: 1.08,
          color: "#fff",
          letterSpacing: t.uppercase ? Math.max(0, t.letterSpacing) : t.letterSpacing,
          textTransform: t.uppercase ? "uppercase" : "none",
        }}>
          {words.map((w, i) => {
            const delay = i * 2;
            const isAccent = i === accentIdx;
            const myCharStart = charOffset;
            charOffset += w.length + 1;

            let style: React.CSSProperties = {};
            switch (spec.hook.wordAnimation) {
              case "blur-in": {
                const p = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT });
                style = { opacity: p, filter: `blur(${(1 - p) * 16}px)`, scale: String(0.96 + p * 0.04) };
                break;
              }
              case "slide-left": {
                const p = interpolate(frame, [delay, delay + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT });
                style = { opacity: p, translate: `${(1 - p) * 120}px 0px` };
                break;
              }
              case "scale-pop": {
                const s = spring({ frame: frame - delay, fps, config: { damping: 9, stiffness: 200 } });
                style = { opacity: Math.min(1, s * 1.4), scale: String(0.3 + s * 0.7) };
                break;
              }
              case "typewriter": {
                const visibleChars = Math.max(0, Math.min(w.length, typedChars - myCharStart));
                const partial = visibleChars < w.length;
                style = { opacity: visibleChars > 0 ? 1 : 0 };
                if (partial && visibleChars > 0) {
                  // Частично напечатанное слово — обрезаем через clip-path по доле символов.
                  style.clipPath = `inset(0 ${100 - (visibleChars / w.length) * 100}% 0 0)`;
                }
                break;
              }
              default: { // spring-up
                const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
                const blur = interpolate(frame, [delay, delay + 7], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                style = { opacity: Math.min(1, s * 1.2), translate: `0px ${(1 - s) * 56}px`, scale: String(0.86 + s * 0.14), filter: `blur(${blur}px)` };
              }
            }

            return (
              <span key={i} style={{
                display: "inline-block", position: "relative", marginRight: 26,
                ...style,
                color: isAccent ? accentColor : "#fff",
                textShadow: isAccent
                  ? `0 0 70px ${accentColor}cc, 0 6px 30px rgba(0,0,0,0.85)`
                  : "0 6px 30px rgba(0,0,0,0.85)",
              }}>
                {w}
                {isAccent && spec.hook.underline && (
                  <span style={{
                    position: "absolute", left: "2%", bottom: -6, height: 14, borderRadius: 7,
                    width: `${underline * 96}%`,
                    background: `linear-gradient(90deg, ${accentColor}, ${accentColor}66)`,
                    boxShadow: `0 0 26px ${accentColor}88`,
                  }} />
                )}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── CTA-сцена ───────────────────────────────────────────────────────────────

function ContentCtaScene({ text, brandName, accentColor, bgImageUrl, spec }: {
  text: string; brandName: string; accentColor: string; bgImageUrl: string | null; spec: ResolvedStyleSpec;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 11, stiffness: 130 } });
  const chipIn = spring({ frame: frame - 8, fps, config: { damping: 13, stiffness: 150 } });
  const pulse = 1 + Math.sin(frame / 5) * 0.02;
  const glowPulse = 0.55 + Math.sin(frame / 7) * 0.25;
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.12, 1.04]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {bgImageUrl ? (
        <AbsoluteFill style={{ scale: String(bgZoom) }}>
          <Img src={bgImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 70%, ${accentColor}30 0%, transparent 60%)` }} />
      )}
      <AbsoluteFill style={{ background: bgImageUrl ? "linear-gradient(180deg, rgba(8,10,18,0.6) 0%, rgba(8,10,18,0.9) 100%)" : "transparent" }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity: exit }}>
        <div style={{
          opacity: Math.min(1, chipIn),
          translate: `0px ${(1 - chipIn) * -30}px`,
          background: "rgba(255,255,255,0.1)",
          border: `2px solid ${accentColor}66`,
          borderRadius: 999,
          padding: "14px 34px",
          marginBottom: 44,
          fontFamily: FONT, fontWeight: 800, fontSize: 34,
          letterSpacing: 3, textTransform: "uppercase", color: "#fff",
        }}>
          {brandName}
        </div>

        <div style={{
          scale: String(enter * pulse),
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: spec.typography.weight,
          fontSize: 92,
          lineHeight: 1.12,
          color: "#fff",
          letterSpacing: -1.5,
          textShadow: `0 0 ${60 * glowPulse}px ${accentColor}bb, 0 6px 30px rgba(0,0,0,0.85)`,
          maxWidth: 900,
          textTransform: spec.typography.uppercase ? "uppercase" : "none",
        }}>
          {text}
        </div>

        <div style={{
          marginTop: 52,
          width: 120, height: 120, borderRadius: "50%",
          background: accentColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          scale: String(enter * (1 + Math.sin(frame / 6) * 0.05)),
          boxShadow: `0 0 ${50 * glowPulse}px ${accentColor}`,
          fontSize: 56, color: "#0a0e1a", fontWeight: 900, fontFamily: FONT,
        }}>
          →
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── B-roll ──────────────────────────────────────────────────────────────────

const MOTION_PATTERNS = [
  { scaleFrom: 1.06, scaleTo: 1.24, xFrom: 0, xTo: 0 },
  { scaleFrom: 1.22, scaleTo: 1.06, xFrom: 0, xTo: 0 },
  { scaleFrom: 1.18, scaleTo: 1.18, xFrom: -34, xTo: 34 },
  { scaleFrom: 1.18, scaleTo: 1.18, xFrom: 34, xTo: -34 },
];

function BrollMedia({ url, index, durationInFrames, spec, manualTransition }: {
  url: string; index: number; durationInFrames: number; spec: ResolvedStyleSpec;
  /** punch/whip — рукописные входы; официальные переходы делает TransitionSeries. */
  manualTransition: "punch" | "whip" | null;
}) {
  const frame = useCurrentFrame();
  const m = MOTION_PATTERNS[index % MOTION_PATTERNS.length];
  const kenAmp = spec.broll.kenBurns === "off" ? 0 : spec.broll.kenBurns === "strong" ? 1.6 : 1;
  const kenScale = 1 + (interpolate(frame, [0, durationInFrames], [m.scaleFrom, m.scaleTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) - 1) * kenAmp;
  const kenX = interpolate(frame, [0, durationInFrames], [m.xFrom, m.xTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * kenAmp;

  const punch = manualTransition === "punch"
    ? interpolate(frame, [0, 9], [1.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT })
    : 1;
  const whipX = manualTransition === "whip"
    ? interpolate(frame, [0, 7], [index % 2 === 0 ? 340 : -340, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT })
    : 0;
  const whipBlur = manualTransition === "whip"
    ? interpolate(frame, [0, 7], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const mediaStyle: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover",
    scale: String(Math.max(1.01, kenScale) * punch),
    translate: `${kenX + whipX}px 0px`,
    filter: whipBlur > 0.5 ? `blur(${whipBlur}px)` : undefined,
  };

  // Кросс-фейд краёв только в ручном режиме (TransitionSeries фейдит сам).
  const fadeFrames = Math.min(12, durationInFrames * 0.15);
  const opacity = manualTransition
    ? interpolate(frame, [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames], [0.15, 1, 1, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity }}>
      {isVideo
        ? <OffthreadVideo src={url} muted style={mediaStyle} />
        : <Img src={url} style={mediaStyle} />}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}

const TRANSITION_FRAMES = 14;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function presentationFor(t: ResolvedStyleSpec["broll"]["transition"], width: number, height: number): TransitionPresentation<any> {
  switch (t) {
    case "slide-left": return slide({ direction: "from-right" });
    case "slide-right": return slide({ direction: "from-left" });
    case "slide-up": return slide({ direction: "from-bottom" });
    case "wipe": return wipe({ direction: "from-left" });
    case "flip": return flip();
    case "clock-wipe": return clockWipe({ width, height });
    default: return fade();
  }
}

function BrollBlock({ urls, totalFrames, brandColor, accentColor, spec }: {
  urls: string[]; totalFrames: number; brandColor: string; accentColor: string; spec: ResolvedStyleSpec;
}) {
  const { width, height } = useVideoConfig();

  if (urls.length === 0) {
    // Честный фолбэк — нет ни одного b-roll ассета. Ровный фон бренда, а не
    // мокап MarketRadar: тексту важнее не соврать про чужой продукт.
    return (
      <AbsoluteFill style={{ backgroundColor: brandColor }}>
        <FloatingShapes accentColor={accentColor} />
      </AbsoluteFill>
    );
  }

  const manual = spec.broll.transition === "punch" || spec.broll.transition === "whip";

  if (manual) {
    const segFrames = totalFrames / urls.length;
    return (
      <AbsoluteFill>
        {urls.map((url, i) => (
          <Sequence key={i} from={Math.round(i * segFrames)} durationInFrames={Math.ceil(segFrames)}>
            <BrollMedia url={url} index={i} durationInFrames={Math.ceil(segFrames)} spec={spec} manualTransition={spec.broll.transition as "punch" | "whip"} />
          </Sequence>
        ))}
        {spec.decor.lightLeak && urls.slice(1).map((_, i) => (
          <Sequence key={`leak-${i}`} from={Math.max(0, Math.round((i + 1) * segFrames) - 10)} durationInFrames={20}>
            <LightLeakSweep durationInFrames={20} fromLeft={i % 2 === 0} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  }

  // Официальные переходы: TransitionSeries съедает по TRANSITION_FRAMES на
  // каждый переход — удлиняем сегменты, чтобы блок занял ровно totalFrames.
  const n = urls.length;
  const segFrames = Math.ceil((totalFrames + (n - 1) * TRANSITION_FRAMES) / n);
  const cutPoints = urls.slice(1).map((_, i) => (i + 1) * (segFrames - TRANSITION_FRAMES));

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {urls.flatMap((url, i) => {
          const seg = (
            <TransitionSeries.Sequence key={`seg-${i}`} durationInFrames={segFrames}>
              <BrollMedia url={url} index={i} durationInFrames={segFrames} spec={spec} manualTransition={null} />
            </TransitionSeries.Sequence>
          );
          if (i === 0) return [seg];
          return [
            <TransitionSeries.Transition
              key={`tr-${i}`}
              presentation={presentationFor(spec.broll.transition, width, height)}
              timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
            />,
            seg,
          ];
        })}
      </TransitionSeries>
      {spec.decor.lightLeak && cutPoints.map((cut, i) => (
        <Sequence key={`leak-${i}`} from={Math.max(0, cut - 10)} durationInFrames={20}>
          <LightLeakSweep durationInFrames={20} fromLeft={i % 2 === 0} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

// ── Композиция ──────────────────────────────────────────────────────────────

export const ContentReel: React.FC<ContentReelProps> = (props) => {
  const { fps } = useVideoConfig();
  const totalSec = props.videoDurationSec ?? 30;
  const { hook: HOOK_SEC, broll: BROLL_SEC, cta: CTA_SEC } = calcSceneDurations(totalSec);
  const hookFrames = HOOK_SEC * fps;
  const brollFrames = BROLL_SEC * fps;
  const ctaFrames = CTA_SEC * fps;

  const spec = resolveStyleSpec(props.styleSpec ?? specFromLegacyVariant(props.styleVariant));

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      <Sequence from={0} durationInFrames={hookFrames}>
        <ContentHookScene text={props.hookText} accentColor={props.accentColor} bgImageUrl={props.hookBgImageUrl ?? null} spec={spec} />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={brollFrames}>
        <BrollBlock urls={props.brollUrls ?? []} totalFrames={brollFrames} brandColor={props.brandColor} accentColor={props.accentColor} spec={spec} />
      </Sequence>

      <Sequence from={hookFrames + brollFrames} durationInFrames={ctaFrames}>
        <ContentCtaScene text={props.ctaText} brandName={props.brandName} accentColor={props.accentColor} bgImageUrl={props.ctaBgImageUrl ?? null} spec={spec} />
      </Sequence>

      {spec.decor.shapes ? (
        <Sequence from={hookFrames} durationInFrames={brollFrames}>
          <AbsoluteFill style={{ opacity: 0.5 }}>
            <FloatingShapes accentColor={props.accentColor} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
      {spec.decor.vignette > 0.02 ? <Vignette amount={spec.decor.vignette} /> : null}
      {spec.decor.grain > 0.02 ? <GrainOverlay amount={spec.decor.grain} /> : null}
      {spec.progressBar ? <ProgressBar accentColor={props.accentColor} /> : null}

      {props.captionsEnabled ? (
        <CaptionsLayer
          script={props.captionsScript ?? `${props.hookText}. ${props.ctaText}`}
          words={props.captionsWords}
          accentColor={props.accentColor}
          mode={spec.captions.mode}
          karaoke={spec.captions.karaoke}
        />
      ) : null}

      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} volume={1} /> : null}
      {props.musicUrl ? <Audio src={props.musicUrl} volume={props.voiceoverUrl ? 0.15 : 0.5} /> : null}
    </AbsoluteFill>
  );
};
