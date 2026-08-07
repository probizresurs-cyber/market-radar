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
  /** Тезисы для текстовых карточек между клипами — дешёвая замена части AI-видео. */
  statementCards: z.array(z.string()).optional(),
  /**
   * Клип говорящей головы (HeyGen), собранный из НАШЕЙ озвучки.
   *
   * Ключевое свойство: его таймлайн совпадает с таймлайном ролика — t=0 клипа
   * это кадр 0 композиции, потому что аватар синтезирован по тому же самому
   * mp3, который играет дорожкой voiceoverUrl. Поэтому в любой точке ролика
   * достаточно взять кадр аватара с тем же номером (trimBefore), и губы будут
   * попадать в звук. Сам клип всегда идёт muted — звук в ролике один, наш.
   */
  avatarClipUrl: z.string().nullable().optional(),
  /** Фактическая длительность аватар-клипа (сек), если известна. Страховка:
   *  просить у OffthreadVideo кадр ЗА концом файла — это ошибка компоситора
   *  «No frame found at position», роняющая весь рендер; врезка живёт не
   *  дольше клипа. */
  avatarClipDurationSec: z.number().nullable().optional(),
  videoDurationSec: z.number().optional(),
  captionsEnabled: z.boolean().optional(),
  captionsScript: z.string().optional(),
  /** Точные пословные тайминги (Whisper) — если заданы, субтитры идут в такт голосу. */
  captionsWords: z.array(captionWordSchema).optional(),
  /**
   * Логотип бренда. Показывается дважды: небольшим знаком в углу на всём
   * ролике (фирменная метка, не мешающая кадру) и крупно на финальном
   * CTA-кадре вместо текстовой плашки с названием.
   *
   * Пустая строка/отсутствие — ролик рендерится как раньше, с текстовым
   * названием бренда: логотип есть далеко не у каждого клиента.
   */
  logoUrl: z.string().nullable().optional(),
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
  avatarClipUrl: null,
  logoUrl: null,
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

function ProgressBar({ accentColor, light }: { accentColor: string; light: boolean }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)", zIndex: 30 }}>
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

      <AbsoluteFill style={{
        justifyContent: spec.layout.hookPosition === "top" ? "flex-start" : spec.layout.hookPosition === "bottom" ? "flex-end" : "center",
        alignItems: spec.layout.hookAlign === "left" ? "flex-start" : "center",
        padding: spec.layout.hookPosition === "center" ? 76 : "180px 76px 320px",
      }}>
        <div style={{
          opacity: exit,
          textAlign: spec.layout.hookAlign === "left" ? "left" : "center",
          fontFamily: FONT,
          fontWeight: t.weight,
          fontSize: Math.round(112 * t.fontScale),
          lineHeight: 1.08,
          color: spec.palette.light ? "#0b0d14" : "#fff",
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
                color: isAccent ? accentColor : (spec.palette.light ? "#0b0d14" : "#fff"),
                textShadow: spec.palette.light
                  ? (isAccent ? `0 0 40px ${accentColor}55` : "none")
                  : (isAccent
                      ? `0 0 70px ${accentColor}cc, 0 6px 30px rgba(0,0,0,0.85)`
                      : "0 6px 30px rgba(0,0,0,0.85)"),
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

/**
 * Фирменный знак в углу кадра — присутствует весь ролик.
 *
 * Верхний правый угол выбран не случайно: слева вверху обычно идёт заголовок
 * хука, внизу — субтитры и врезка с аватаром. Правый верх — единственная зона,
 * свободная во всех трёх сценах.
 *
 * Логотипы приходят и светлые, и тёмные, поэтому знак лежит на полупрозрачной
 * подложке: без неё белый логотип пропадал бы на светлом b-roll.
 */
function LogoWatermark({ url }: { url: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Мягкое появление за полсекунды — резкий «выпрыгивающий» логотип с первого
  // кадра читается как баг, а не как фирменный элемент.
  const appear = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        top: 56,
        right: 56,
        opacity: appear * 0.92,
        padding: "14px 18px",
        borderRadius: 16,
        background: "rgba(0,0,0,0.28)",
        backdropFilter: "blur(6px)",
      }}>
        <Img src={url} style={{ height: 72, width: "auto", objectFit: "contain", display: "block" }} />
      </div>
    </AbsoluteFill>
  );
}

function ContentCtaScene({ text, brandName, accentColor, bgImageUrl, spec, logoUrl }: {
  text: string; brandName: string; accentColor: string; bgImageUrl: string | null;
  spec: ResolvedStyleSpec; logoUrl: string | null;
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
      <AbsoluteFill style={{
        background: !bgImageUrl
          ? "transparent"
          : spec.palette.light
            // Светлая схема: затемняющая шторка сделала бы тёмный CTA-текст
            // нечитаемым — осветляем картинку вместо затемнения.
            ? "linear-gradient(180deg, rgba(247,248,251,0.7) 0%, rgba(247,248,251,0.92) 100%)"
            : "linear-gradient(180deg, rgba(8,10,18,0.6) 0%, rgba(8,10,18,0.9) 100%)",
      }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity: exit }}>
        {/* На финальном кадре логотип заменяет текстовую плашку с названием:
            дублировать бренд дважды — и знаком, и словом — визуальный шум. */}
        {logoUrl ? (
          <div style={{
            opacity: Math.min(1, chipIn),
            translate: `0px ${(1 - chipIn) * -30}px`,
            marginBottom: 48,
          }}>
            <Img src={logoUrl} style={{ height: 190, width: "auto", objectFit: "contain", display: "block" }} />
          </div>
        ) : (
          <div style={{
            opacity: Math.min(1, chipIn),
            translate: `0px ${(1 - chipIn) * -30}px`,
            background: spec.palette.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
            border: `2px solid ${accentColor}66`,
            borderRadius: 999,
            padding: "14px 34px",
            marginBottom: 44,
            fontFamily: FONT, fontWeight: 800, fontSize: 34,
            letterSpacing: 3, textTransform: "uppercase",
            color: spec.palette.light ? "#0b0d14" : "#fff",
          }}>
            {brandName}
          </div>
        )}

        <div style={{
          scale: String(enter * pulse),
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: spec.typography.weight,
          fontSize: 92,
          lineHeight: 1.12,
          color: spec.palette.light ? "#0b0d14" : "#fff",
          letterSpacing: -1.5,
          textShadow: spec.palette.light
            ? `0 0 ${40 * glowPulse}px ${accentColor}44`
            : `0 0 ${60 * glowPulse}px ${accentColor}bb, 0 6px 30px rgba(0,0,0,0.85)`,
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

  // Punch и whip — это РЕЗКИЕ склейки, их выразительность в зуме и смазе, а не
  // в затемнении. Прежний фейд уводил края сегмента в opacity 0.15, и, так как
  // за клипом лежит только фон, стык читался как провал в черноту — b-roll на
  // кадрах вокруг склейки было почти не видно. Punch оставляем без фейда,
  // whip чуть притемняем — со смазом это выглядит как рывок камеры.
  const fadeFrames = Math.min(6, durationInFrames * 0.08);
  const opacity = manualTransition === "whip"
    ? interpolate(frame, [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames], [0.7, 1, 1, 0.7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
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

/**
 * Текстовая карточка — бесплатная замена части AI-клипов.
 *
 * Генерация b-roll на Replicate — 97% себестоимости ролика (~$0.40 за клип),
 * поэтому вместо четырёх клипов берём два, а промежутки закрываем тезисами
 * из сценария. Это не «заглушка»: короткий тезис крупным кеглем на брендовом
 * фоне — приём из обычного монтажа рилсов, он держит внимание не хуже
 * стокового видео и при этом всегда по теме, в отличие от AI-клипа, который
 * может промахнуться мимо смысла.
 */
function StatementCard({ text, accentColor, brandColor, spec, durationInFrames }: {
  text: string; accentColor: string; brandColor: string; spec: ResolvedStyleSpec; durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0.94], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drift = interpolate(frame, [0, durationInFrames], [0, -14]);
  const light = spec.palette.light;

  return (
    <AbsoluteFill style={{ backgroundColor: brandColor, overflow: "hidden" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 38%, ${accentColor}26 0%, transparent 62%)`,
      }} />
      {spec.decor.shapes ? <FloatingShapes accentColor={accentColor} /> : null}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 88px" }}>
        <div style={{
          width: 74, height: 5, borderRadius: 3, background: accentColor,
          marginBottom: 34, scale: String(Math.min(1, enter)),
        }} />
        <div style={{
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: spec.typography.weight,
          fontSize: 76 * spec.typography.fontScale,
          lineHeight: 1.18,
          letterSpacing: spec.typography.letterSpacing,
          textTransform: spec.typography.uppercase ? "uppercase" : "none",
          color: light ? "#0b0d14" : "#fff",
          opacity: Math.min(1, enter) * exit,
          translate: `0px ${(1 - Math.min(1, enter)) * 26 + drift}px`,
          textShadow: light ? "none" : "0 6px 30px rgba(0,0,0,0.5)",
        }}>
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Говорящий аватар ────────────────────────────────────────────────────────
//
// HeyGen отдаёт нам ТОЛЬКО говорящую голову на сплошном фоне — без своего
// монтажа, своего b-roll и своих субтитров. Раньше режим «аватар» был
// альтернативой нашему движку: HeyGen собирал ролик целиком, и от брендбука,
// арт-директора и караоке-субтитров не оставалось ничего. Теперь это просто
// ещё один слой поверх нашего видеоряда.
//
// Клип синтезирован по нашему же mp3, поэтому его кадр N соответствует кадру N
// композиции — отсюда trimBefore={абсолютный кадр} везде ниже. Звук клипа
// глушим: дорожка в ролике одна (voiceoverUrl), под неё же выставлены субтитры.

/** Аватар во весь кадр — отдельный сегмент видеоряда вместо AI-клипа. */
function AvatarFullSegment({ url, absStartFrame, brandColor, durationInFrames }: {
  url: string; absStartFrame: number; brandColor: string; durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  // Медленный наезд — статичная говорящая голова на 4-5 секунд «замирает»
  // в монтаже рядом с движущимся b-roll и читается как техническая пауза.
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.09], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: brandColor, overflow: "hidden" }}>
      <OffthreadVideo
        src={url}
        muted
        trimBefore={absStartFrame}
        style={{ width: "100%", height: "100%", objectFit: "cover", scale: String(zoom) }}
      />
      {/* Та же затемняющая шторка снизу, что у b-roll: под ней лежат субтитры. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}

/**
 * Круглая врезка с аватаром поверх b-roll.
 *
 * Кроп смещён вверх (objectPosition) не «на глаз»: HeyGen отдаёт 9:16 кадр,
 * где голова сидит примерно в верхней трети, а по центру оказывается грудь.
 * Без сдвига в кружок попадал бы корпус вместо лица.
 */
function AvatarBubble({ url, blockStartFrame, accentColor, lowCaptions }: {
  url: string; blockStartFrame: number; accentColor: string;
  /** Субтитры внизу — тогда врезка уезжает наверх, чтобы не спорить с ними. */
  lowCaptions: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  const SIZE = 360;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        right: 56,
        top: lowCaptions ? 150 : undefined,
        bottom: lowCaptions ? undefined : 300,
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        overflow: "hidden",
        border: `6px solid ${accentColor}`,
        boxShadow: `0 0 40px ${accentColor}66, 0 18px 40px rgba(0,0,0,0.55)`,
        scale: String(Math.min(1, enter)),
        opacity: Math.min(1, enter * 1.4),
      }}>
        <OffthreadVideo
          src={url}
          muted
          trimBefore={blockStartFrame}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
            objectPosition: "50% 20%",
            // Лёгкий доводочный зум: без него лицо занимает половину кружка
            // и врезка читается как «человек далеко», а не как собеседник.
            scale: "1.15",
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

/** Что показываем в очередном сегменте: AI-клип, текстовый тезис или аватар. */
type Segment = { kind: "video"; url: string } | { kind: "card"; text: string } | { kind: "avatar" };

/**
 * Чередует клипы и карточки: видео — карточка — видео — карточка. Начинаем с
 * видео (после хука зритель ждёт картинку, а не ещё один экран с текстом).
 *
 * Аватар (если он подан во весь кадр) идёт ПЕРВЫМ сегментом: сразу после
 * текстового хука зритель видит, кто с ним говорит, а дальше уже иллюстрации.
 */
function buildSegments(urls: string[], cards: string[], avatarFull: boolean): Segment[] {
  const out: Segment[] = [];
  if (avatarFull) out.push({ kind: "avatar" });
  const max = Math.max(urls.length, cards.length);
  for (let i = 0; i < max; i++) {
    if (urls[i]) out.push({ kind: "video", url: urls[i] });
    if (cards[i]) out.push({ kind: "card", text: cards[i] });
  }
  return out;
}

const TRANSITION_FRAMES = 14;

/** Длительность одного сегмента. Вынесено, чтобы окна карточек считались той
 *  же формулой, что и сама раскладка — иначе субтитры гасились бы не там. */
function segmentFrames(count: number, totalFrames: number, manual: boolean): number {
  return manual
    ? totalFrames / count
    : Math.ceil((totalFrames + (count - 1) * TRANSITION_FRAMES) / count);
}

/**
 * Окна (в кадрах композиции), где на экране текстовая карточка.
 *
 * Нужны субтитрам: карточка показывает ровно ту фразу, которая звучит в этот
 * момент, поэтому субтитр под ней дублирует её слово в слово — в кадре
 * оказывается один и тот же текст дважды. Гасим субтитры на этих отрезках.
 */
function cardWindows(segments: Segment[], totalFrames: number, manual: boolean, offset: number): Array<[number, number]> {
  if (segments.length === 0) return [];
  const seg = segmentFrames(segments.length, totalFrames, manual);
  const step = manual ? seg : seg - TRANSITION_FRAMES;
  const out: Array<[number, number]> = [];
  segments.forEach((s, i) => {
    if (s.kind !== "card") return;
    const start = offset + i * step;
    out.push([start, start + seg]);
  });
  return out;
}

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

function BrollBlock({ urls, cards, avatarClipUrl, blockStartFrame, totalFrames, brandColor, accentColor, spec }: {
  urls: string[]; cards: string[];
  /** Клип аватара; используется, только когда spec.avatar.placement === "full". */
  avatarClipUrl: string | null;
  /** Кадр композиции, с которого начинается блок — по нему считается trimBefore. */
  blockStartFrame: number;
  totalFrames: number; brandColor: string; accentColor: string; spec: ResolvedStyleSpec;
}) {
  const { width, height } = useVideoConfig();

  const avatarFull = spec.avatar.placement === "full" && Boolean(avatarClipUrl);
  const segments = buildSegments(urls, cards, avatarFull);

  /** absStart — кадр КОМПОЗИЦИИ, на котором сегмент появляется: аватару нужен
   *  именно он, чтобы взять из клипа тот же момент речи, что звучит сейчас. */
  const renderSegment = (seg: Segment, i: number, frames: number, manualTransition: "punch" | "whip" | null, absStart: number) => {
    if (seg.kind === "video") {
      return <BrollMedia url={seg.url} index={i} durationInFrames={frames} spec={spec} manualTransition={manualTransition} />;
    }
    if (seg.kind === "avatar") {
      return <AvatarFullSegment url={avatarClipUrl!} absStartFrame={absStart} brandColor={brandColor} durationInFrames={frames} />;
    }
    return <StatementCard text={seg.text} accentColor={accentColor} brandColor={brandColor} spec={spec} durationInFrames={frames} />;
  };

  if (segments.length === 0) {
    // Честный фолбэк — нет ни клипов, ни тезисов. Ровный фон бренда, а не
    // мокап MarketRadar: тексту важнее не соврать про чужой продукт.
    return (
      <AbsoluteFill style={{ backgroundColor: brandColor }}>
        <FloatingShapes accentColor={accentColor} />
      </AbsoluteFill>
    );
  }

  const manual = spec.broll.transition === "punch" || spec.broll.transition === "whip";

  if (manual) {
    const segFrames = segmentFrames(segments.length, totalFrames, true);
    return (
      <AbsoluteFill>
        {segments.map((seg, i) => (
          <Sequence key={i} from={Math.round(i * segFrames)} durationInFrames={Math.ceil(segFrames)}>
            {renderSegment(seg, i, Math.ceil(segFrames), spec.broll.transition as "punch" | "whip", blockStartFrame + Math.round(i * segFrames))}
          </Sequence>
        ))}
        {spec.decor.lightLeak && segments.slice(1).map((_, i) => (
          <Sequence key={`leak-${i}`} from={Math.max(0, Math.round((i + 1) * segFrames) - 10)} durationInFrames={20}>
            <LightLeakSweep durationInFrames={20} fromLeft={i % 2 === 0} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  }

  // Официальные переходы: TransitionSeries съедает по TRANSITION_FRAMES на
  // каждый переход — удлиняем сегменты, чтобы блок занял ровно totalFrames.
  const n = segments.length;
  const segFrames = segmentFrames(n, totalFrames, false);
  const cutPoints = segments.slice(1).map((_, i) => (i + 1) * (segFrames - TRANSITION_FRAMES));

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {segments.flatMap((segment, i) => {
          const seg = (
            <TransitionSeries.Sequence key={`seg-${i}`} durationInFrames={segFrames}>
              {renderSegment(segment, i, segFrames, null, blockStartFrame + i * (segFrames - TRANSITION_FRAMES))}
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

  // Раскладку b-roll считаем и здесь — субтитрам нужно знать, когда на экране
  // текстовая карточка, чтобы не дублировать её текст (карточка показывает ту
  // же фразу, которая звучит). Формула общая с BrollBlock, см. segmentFrames.
  const avatarClipUrl = props.avatarClipUrl ?? null;
  const avatarFull = spec.avatar.placement === "full" && Boolean(avatarClipUrl);
  const avatarPip = spec.avatar.placement === "pip" && Boolean(avatarClipUrl);
  const brollSegments = buildSegments(props.brollUrls ?? [], props.statementCards ?? [], avatarFull);
  const manualTransition = spec.broll.transition === "punch" || spec.broll.transition === "whip";
  const hiddenCaptionWindows = cardWindows(brollSegments, brollFrames, manualTransition, hookFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      <Sequence from={0} durationInFrames={hookFrames}>
        <ContentHookScene text={props.hookText} accentColor={props.accentColor} bgImageUrl={props.hookBgImageUrl ?? null} spec={spec} />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={brollFrames}>
        <BrollBlock urls={props.brollUrls ?? []} cards={props.statementCards ?? []} avatarClipUrl={avatarClipUrl} blockStartFrame={hookFrames} totalFrames={brollFrames} brandColor={props.brandColor} accentColor={props.accentColor} spec={spec} />
      </Sequence>

      <Sequence from={hookFrames + brollFrames} durationInFrames={ctaFrames}>
        <ContentCtaScene text={props.ctaText} brandName={props.brandName} accentColor={props.accentColor} bgImageUrl={props.ctaBgImageUrl ?? null} spec={spec} logoUrl={props.logoUrl ?? null} />
      </Sequence>

      {spec.decor.shapes ? (
        <Sequence from={hookFrames} durationInFrames={brollFrames}>
          <AbsoluteFill style={{ opacity: 0.5 }}>
            <FloatingShapes accentColor={props.accentColor} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
      {/* Врезка с аватаром — на ВЕСЬ ролик, не только над b-roll: это
          «говорящий ведущий», а не декоративная вставка, и он должен быть
          виден непрерывно, включая хук и CTA. trimBefore=0 (blockStartFrame)
          от начала композиции, а не от начала b-roll блока — клип синтезирован
          HeyGen по ТОМУ ЖЕ voiceoverUrl, что играет <Audio> без обёртки в
          Sequence, то есть с кадра 0 всей композиции; сдвиг на hookFrames
          рассинхронизировал бы губы с голосом на пару секунд.
          Ставится ПОСЛЕ FloatingShapes, чтобы блики не размывали лицо, и ДО
          виньетки с зерном — иначе врезка выпадала бы из общей обработки кадра. */}
      {avatarPip ? (
        <Sequence
          from={0}
          // Врезка не живёт дольше самого клипа: запрос кадра за концом файла
          // роняет рендер целиком («No frame found at position»). Клип обычно
          // равен озвучке и короче композиции на хвост (~1.2с) — врезка просто
          // исчезает на последней секунде, это дешевле сорванного рендера.
          durationInFrames={Math.min(
            hookFrames + brollFrames + ctaFrames,
            props.avatarClipDurationSec
              ? Math.max(fps, Math.floor(props.avatarClipDurationSec * fps) - 1)
              : hookFrames + brollFrames + ctaFrames,
          )}
        >
          <AvatarBubble
            url={avatarClipUrl!}
            blockStartFrame={0}
            accentColor={props.accentColor}
            lowCaptions={spec.layout.captionPosition !== "high"}
          />
        </Sequence>
      ) : null}
      {/* Знак в углу — поверх врезки с аватаром и декора, но ДО виньетки и
          зерна: логотип должен оставаться чистым, а не притемняться вместе с
          кадром. На финальном CTA-кадре его не рисуем — там логотип уже стоит
          крупно, два знака в одном кадре выглядят ошибкой. */}
      {props.logoUrl ? (
        <Sequence from={0} durationInFrames={hookFrames + brollFrames}>
          <LogoWatermark url={props.logoUrl} />
        </Sequence>
      ) : null}
      {spec.decor.vignette > 0.02 ? <Vignette amount={spec.decor.vignette} /> : null}
      {spec.decor.grain > 0.02 ? <GrainOverlay amount={spec.decor.grain} /> : null}
      {spec.progressBar ? <ProgressBar accentColor={props.accentColor} light={spec.palette.light} /> : null}

      {props.captionsEnabled ? (
        <CaptionsLayer
          script={props.captionsScript ?? `${props.hookText}. ${props.ctaText}`}
          words={props.captionsWords}
          accentColor={props.accentColor}
          mode={spec.captions.mode}
          karaoke={spec.captions.karaoke}
          position={spec.layout.captionPosition}
          light={spec.palette.light}
          // Только под b-roll. На хук-сцене субтитры дублировали крупный хук
          // (он и есть начало озвучки), на CTA — перебивали призыв обрывком
          // фразы: в кадре оказывалось два разных текста одновременно.
          visibleFrom={hookFrames}
          visibleUntil={hookFrames + brollFrames}
          hiddenWindows={hiddenCaptionWindows}
        />
      ) : null}

      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} volume={1} /> : null}
      {props.musicUrl ? <Audio src={props.musicUrl} volume={props.voiceoverUrl ? 0.15 : 0.5} /> : null}
    </AbsoluteFill>
  );
};
