/**
 * ContentReel — универсальная композиция для роликов из Контент-завода
 * (в отличие от PromoReel, который жёстко заточен под самопродвижение
 * MarketRadar — там в ProductDemoScene зашиты мокапы дашборда, это НЕЛЬЗЯ
 * показывать в видео стоматологии/автосервиса клиента).
 *
 * v2 (по мотивам официального Remotion-скилла): собственные сцены хука и CTA
 * с кинетической типографикой (стаггер слов, blur-вход, expo-easing,
 * акцентная плашка-подчёркивание), три визуальных стиля (styleVariant),
 * панч/слайд-переходы между b-roll сегментами, прогресс-бар, виньетка,
 * плёночное зерно (SVG feTurbulence) и дрейфующие цветовые пятна.
 * Карооке-подсветка активного слова — в CaptionsLayer (точный режим).
 *
 * НИКАКИХ новых npm-зависимостей — только ядро remotion: прод-рендер на VPS
 * работает без переустановки node_modules.
 *
 * PromoReel и его сцены (HookScene/CTAScene) НЕ тронуты.
 */
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { CaptionsLayer } from "./CaptionsLayer";

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
  /** Точные пословные тайминги (Whisper) — если заданы, субтитры идут в такт голосу, а не оценочно. */
  captionsWords: z.array(captionWordSchema).optional(),
  /** Визуальный стиль: dynamic (энергичный), clean (спокойный премиум), bold (дерзкий). */
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
  styleVariant: "dynamic",
};

// ── Стилевые пресеты ────────────────────────────────────────────────────────
// Разные ролики не должны выглядеть под копирку: Director-агент выбирает
// стиль под тему (см. content/video/plan). Пресет управляет только МАНЕРОЙ
// подачи; бренд-цвета всегда приходят из brandbook'а клиента.
interface StylePreset {
  transition: "punch" | "fade" | "slide";
  grain: boolean;
  shapes: boolean;
  hookUppercase: boolean;
  progressBar: boolean;
}

const STYLE_PRESETS: Record<"dynamic" | "clean" | "bold", StylePreset> = {
  dynamic: { transition: "punch", grain: true, shapes: true, hookUppercase: false, progressBar: true },
  clean: { transition: "fade", grain: false, shapes: false, hookUppercase: false, progressBar: true },
  bold: { transition: "slide", grain: true, shapes: true, hookUppercase: true, progressBar: true },
};

/** Та же пропорция, что в PromoReel: хук и CTA короткие, основное время — контент. */
function calcSceneDurations(totalSec: number) {
  const hook = Math.max(2, Math.round(totalSec * 0.12));
  const cta = Math.max(3, Math.round(totalSec * 0.14));
  const broll = Math.max(5, totalSec - hook - cta);
  return { hook, broll, cta };
}

const EXPO_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// Плёночное зерно без зависимостей: SVG feTurbulence как data-uri.
// Статичный паттерн + лёгкое подрагивание позиции по кадрам = живое зерно.
const GRAIN_URI = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter><rect width="240" height="240" filter="url(#n)" opacity="0.5"/></svg>`,
)}`;

function GrainOverlay() {
  const frame = useCurrentFrame();
  // Сдвигаем паттерн каждые 2 кадра — зерно «дышит», как на плёнке.
  const jitterX = (frame % 6) * 37;
  const jitterY = (frame % 4) * 53;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${GRAIN_URI}")`,
        backgroundPosition: `${jitterX}px ${jitterY}px`,
        opacity: 0.07,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
}

function Vignette() {
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.42) 100%)",
        pointerEvents: "none",
      }}
    />
  );
}

/** Дрейфующие размытые цветовые пятна — глубина фона без ассетов. */
function FloatingShapes({ accentColor }: { accentColor: string }) {
  const frame = useCurrentFrame();
  const drift1 = Math.sin(frame / 55) * 90;
  const drift2 = Math.cos(frame / 70) * 110;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", width: 620, height: 620, borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`,
          filter: "blur(40px)",
          left: -180 + drift1, top: -140 + drift2 * 0.5,
        }}
      />
      <div
        style={{
          position: "absolute", width: 520, height: 520, borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          filter: "blur(50px)",
          right: -160 - drift2 * 0.6, bottom: 240 + drift1 * 0.4,
        }}
      />
    </AbsoluteFill>
  );
}

/** Тонкий прогресс-бар сверху — приём удержания из TikTok. */
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

// ── Хук-сцена v2: кинетическая типографика ─────────────────────────────────
function ContentHookScene({ text, accentColor, bgImageUrl, uppercase }: {
  text: string; accentColor: string; bgImageUrl: string | null; uppercase: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.06, 1.16]);

  const words = text.split(" ").filter(Boolean);
  // Акцентируем самое длинное слово (обычно смысловое ядро), а не просто последнее.
  const accentIdx = words.reduce((best, w, i) => (w.length > words[best].length ? i : best), 0);

  // Плашка-подчёркивание выезжает после появления всех слов.
  const allWordsIn = words.length * 2 + 10;
  const underline = interpolate(frame, [allWordsIn, allWordsIn + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT });

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
        <div
          style={{
            opacity: exit,
            textAlign: "center",
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 112,
            lineHeight: 1.08,
            color: "#fff",
            letterSpacing: uppercase ? 0 : -2.5,
            textTransform: uppercase ? "uppercase" : "none",
          }}
        >
          {words.map((w, i) => {
            const delay = i * 2;
            const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
            const blur = interpolate(frame, [delay, delay + 7], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const isAccent = i === accentIdx;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  position: "relative",
                  marginRight: 26,
                  opacity: Math.min(1, s * 1.2),
                  translate: `0px ${(1 - s) * 56}px`,
                  scale: String(0.86 + s * 0.14),
                  filter: `blur(${blur}px)`,
                  color: isAccent ? accentColor : "#fff",
                  textShadow: isAccent
                    ? `0 0 70px ${accentColor}cc, 0 6px 30px rgba(0,0,0,0.85)`
                    : "0 6px 30px rgba(0,0,0,0.85)",
                }}
              >
                {w}
                {isAccent && (
                  <span
                    style={{
                      position: "absolute", left: "2%", bottom: -6, height: 14, borderRadius: 7,
                      width: `${underline * 96}%`,
                      background: `linear-gradient(90deg, ${accentColor}, ${accentColor}66)`,
                      boxShadow: `0 0 26px ${accentColor}88`,
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── CTA-сцена v2: overshoot-вход, пульс кнопки, бренд-чип ──────────────────
function ContentCtaScene({ text, brandName, accentColor, bgImageUrl }: {
  text: string; brandName: string; accentColor: string; bgImageUrl: string | null;
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
        {/* Бренд-чип */}
        <div
          style={{
            opacity: Math.min(1, chipIn),
            translate: `0px ${(1 - chipIn) * -30}px`,
            background: "rgba(255,255,255,0.1)",
            border: `2px solid ${accentColor}66`,
            borderRadius: 999,
            padding: "14px 34px",
            marginBottom: 44,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          {brandName}
        </div>

        <div
          style={{
            scale: String(enter * pulse),
            textAlign: "center",
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 92,
            lineHeight: 1.12,
            color: "#fff",
            letterSpacing: -1.5,
            textShadow: `0 0 ${60 * glowPulse}px ${accentColor}bb, 0 6px 30px rgba(0,0,0,0.85)`,
            maxWidth: 900,
          }}
        >
          {text}
        </div>

        {/* Стрелка-индикатор действия */}
        <div
          style={{
            marginTop: 52,
            width: 120, height: 120, borderRadius: "50%",
            background: accentColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            scale: String(enter * (1 + Math.sin(frame / 6) * 0.05)),
            boxShadow: `0 0 ${50 * glowPulse}px ${accentColor}`,
            fontSize: 56, color: "#0a0e1a", fontWeight: 900,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
          }}
        >
          →
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const MOTION_PATTERNS = [
  { scaleFrom: 1.06, scaleTo: 1.24, xFrom: 0, xTo: 0 },
  { scaleFrom: 1.22, scaleTo: 1.06, xFrom: 0, xTo: 0 },
  { scaleFrom: 1.18, scaleTo: 1.18, xFrom: -34, xTo: 34 },
  { scaleFrom: 1.18, scaleTo: 1.18, xFrom: 34, xTo: -34 },
];

function BrollSegment({ url, index, durationInFrames, transition }: {
  url: string; index: number; durationInFrames: number; transition: StylePreset["transition"];
}) {
  const frame = useCurrentFrame();
  const fadeFrames = Math.min(14, durationInFrames * 0.18);
  const opacity = interpolate(
    frame, [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const m = MOTION_PATTERNS[index % MOTION_PATTERNS.length];
  const kenScale = interpolate(frame, [0, durationInFrames], [m.scaleFrom, m.scaleTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kenX = interpolate(frame, [0, durationInFrames], [m.xFrom, m.xTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Переход входа по стилю: punch — резкий зум-удар; slide — врез сбоку; fade — как было.
  const punch = transition === "punch"
    ? interpolate(frame, [0, 9], [1.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT })
    : 1;
  const slideX = transition === "slide"
    ? interpolate(frame, [0, 11], [index % 2 === 0 ? 220 : -220, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO_OUT })
    : 0;

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const mediaStyle: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover",
    scale: String(kenScale * punch),
    translate: `${kenX + slideX}px 0px`,
  };

  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      {isVideo
        ? <OffthreadVideo src={url} muted style={mediaStyle} />
        : <Img src={url} style={mediaStyle} />}
      {/* Затемнение снизу — держит субтитры читаемыми поверх любого b-roll. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}

function BrollBlock({ urls, totalFrames, brandColor, accentColor, preset }: {
  urls: string[]; totalFrames: number; brandColor: string; accentColor: string; preset: StylePreset;
}) {
  if (urls.length === 0) {
    // Честный фолбэк — нет ни одного b-roll ассета. Ровный фон бренда с
    // дрейфующими пятнами, а не мокап MarketRadar — тексту важнее не соврать
    // про чужой продукт, чем заполнить кадр красиво.
    return (
      <AbsoluteFill style={{ backgroundColor: brandColor }}>
        <FloatingShapes accentColor={accentColor} />
      </AbsoluteFill>
    );
  }
  const segFrames = totalFrames / urls.length;
  return (
    <AbsoluteFill>
      {urls.map((url, i) => (
        <Sequence key={i} from={Math.round(i * segFrames)} durationInFrames={Math.ceil(segFrames)}>
          <BrollSegment url={url} index={i} durationInFrames={Math.ceil(segFrames)} transition={preset.transition} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export const ContentReel: React.FC<ContentReelProps> = (props) => {
  const { fps } = useVideoConfig();
  const totalSec = props.videoDurationSec ?? 30;
  const { hook: HOOK_SEC, broll: BROLL_SEC, cta: CTA_SEC } = calcSceneDurations(totalSec);
  const hookFrames = HOOK_SEC * fps;
  const brollFrames = BROLL_SEC * fps;
  const ctaFrames = CTA_SEC * fps;
  const preset = STYLE_PRESETS[props.styleVariant ?? "dynamic"];

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      <Sequence from={0} durationInFrames={hookFrames}>
        <ContentHookScene
          text={props.hookText}
          accentColor={props.accentColor}
          bgImageUrl={props.hookBgImageUrl ?? null}
          uppercase={preset.hookUppercase}
        />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={brollFrames}>
        <BrollBlock
          urls={props.brollUrls ?? []}
          totalFrames={brollFrames}
          brandColor={props.brandColor}
          accentColor={props.accentColor}
          preset={preset}
        />
      </Sequence>

      <Sequence from={hookFrames + brollFrames} durationInFrames={ctaFrames}>
        <ContentCtaScene
          text={props.ctaText}
          brandName={props.brandName}
          accentColor={props.accentColor}
          bgImageUrl={props.ctaBgImageUrl ?? null}
        />
      </Sequence>

      {/* Глобальные слои поверх всех сцен */}
      {preset.shapes ? (
        <Sequence from={hookFrames} durationInFrames={brollFrames}>
          <AbsoluteFill style={{ opacity: 0.5 }}>
            <FloatingShapes accentColor={props.accentColor} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
      <Vignette />
      {preset.grain ? <GrainOverlay /> : null}
      {preset.progressBar ? <ProgressBar accentColor={props.accentColor} /> : null}

      {props.captionsEnabled ? (
        <CaptionsLayer
          script={props.captionsScript ?? `${props.hookText}. ${props.ctaText}`}
          words={props.captionsWords}
          accentColor={props.accentColor}
        />
      ) : null}

      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} volume={1} /> : null}
      {props.musicUrl ? <Audio src={props.musicUrl} volume={props.voiceoverUrl ? 0.15 : 0.5} /> : null}
    </AbsoluteFill>
  );
};
