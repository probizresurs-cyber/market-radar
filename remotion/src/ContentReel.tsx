/**
 * ContentReel — универсальная композиция для роликов из Контент-завода
 * (в отличие от PromoReel, который жёстко заточен под самопродвижение
 * MarketRadar — там в ProductDemoScene зашиты шаги "Введи URL / AI-анализ"
 * и мокап дашборда, это НЕЛЬЗЯ показывать в видео стоматологии/автосервиса
 * клиента). Здесь только универсальные блоки: крючок → b-roll с озвучкой
 * и субтитрами → призыв к действию.
 *
 * Хук/CTA-сцены и слой субтитров переиспользованы из PromoReel как есть
 * (HookScene/CTAScene/CaptionsLayer уже брендонезависимы — принимают текст,
 * цвета, картинку фона). B-roll-блок написан заново (упрощённая версия
 * BrollFullscreen из ProductDemoScene — без phone-frame и мокапов, которые
 * там ни к чему).
 */
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { HookScene } from "./scenes/HookScene";
import { CTAScene } from "./scenes/CTAScene";
import { CaptionsLayer } from "./CaptionsLayer";

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
  /** Fullscreen b-roll — видео (Pexels) и/или картинки вперемешку, в порядке показа. */
  brollUrls: z.array(z.string()).optional(),
  videoDurationSec: z.number().optional(),
  captionsEnabled: z.boolean().optional(),
  captionsScript: z.string().optional(),
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

const MOTION_PATTERNS = [
  { scaleFrom: 1.04, scaleTo: 1.22, xFrom: 0, xTo: 0 },
  { scaleFrom: 1.2, scaleTo: 1.04, xFrom: 0, xTo: 0 },
  { scaleFrom: 1.16, scaleTo: 1.16, xFrom: -30, xTo: 30 },
  { scaleFrom: 1.16, scaleTo: 1.16, xFrom: 30, xTo: -30 },
];

function BrollSegment({ url, index, durationInFrames }: { url: string; index: number; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const fadeFrames = Math.min(18, durationInFrames * 0.2);
  const opacity = interpolate(
    frame, [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const m = MOTION_PATTERNS[index % MOTION_PATTERNS.length];
  const scale = interpolate(frame, [0, durationInFrames], [m.scaleFrom, m.scaleTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(frame, [0, durationInFrames], [m.xFrom, m.xTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);

  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      {isVideo ? (
        <OffthreadVideo src={url} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${x}px)` }} />
      ) : (
        <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${x}px)` }} />
      )}
      {/* Затемнение снизу — держит субтитры читаемыми поверх любого b-roll. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}

function BrollBlock({ urls, totalFrames, brandColor }: { urls: string[]; totalFrames: number; brandColor: string }) {
  if (urls.length === 0) {
    // Честный фолбэк — нет ни одного b-roll ассета (Pexels не нашёл/упал).
    // Показываем ровный фон бренда, а не мокап MarketRadar — тексту важнее
    // не соврать про чужой продукт, чем заполнить кадр красиво.
    return <AbsoluteFill style={{ backgroundColor: brandColor }} />;
  }
  const segFrames = totalFrames / urls.length;
  return (
    <AbsoluteFill>
      {urls.map((url, i) => (
        <Sequence key={i} from={Math.round(i * segFrames)} durationInFrames={Math.ceil(segFrames)}>
          <BrollSegment url={url} index={i} durationInFrames={Math.ceil(segFrames)} />
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

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookScene text={props.hookText} accentColor={props.accentColor} bgImageUrl={props.hookBgImageUrl ?? null} />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={brollFrames}>
        <BrollBlock urls={props.brollUrls ?? []} totalFrames={brollFrames} brandColor={props.brandColor} />
      </Sequence>

      <Sequence from={hookFrames + brollFrames} durationInFrames={ctaFrames}>
        <CTAScene text={props.ctaText} brandName={props.brandName} accentColor={props.accentColor} bgImageUrl={props.ctaBgImageUrl ?? null} />
      </Sequence>

      {props.captionsEnabled ? (
        <CaptionsLayer script={props.captionsScript ?? `${props.hookText}. ${props.ctaText}`} />
      ) : null}

      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} volume={1} /> : null}
      {props.musicUrl ? <Audio src={props.musicUrl} volume={props.voiceoverUrl ? 0.15 : 0.5} /> : null}
    </AbsoluteFill>
  );
};
