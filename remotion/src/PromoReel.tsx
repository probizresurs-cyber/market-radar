import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { z } from "zod";
import { HookScene } from "./scenes/HookScene";
import { ProductDemoScene } from "./scenes/ProductDemoScene";
import { CTAScene } from "./scenes/CTAScene";

export const promoReelSchema = z.object({
  hookText: z.string(),
  problemText: z.string(),
  ctaText: z.string(),
  brandName: z.string(),
  brandColor: z.string(),
  accentColor: z.string(),
  screencastUrl: z.string().nullable(),
  voiceoverUrl: z.string().nullable(),
  // Фоновая музыка. Тихая (volume 0.15) — чтобы не перекрывать voiceover.
  // Если voiceover нет, музыка играет обычной громкости (0.5).
  musicUrl: z.string().nullable().optional(),
  // AI-сгенерированные фоновые картинки. Если null — используется
  // градиент по умолчанию. Иначе картинка кладётся фоном с тёмным
  // оверлеем поверх для читаемости текста.
  hookBgImageUrl: z.string().nullable().optional(),
  ctaBgImageUrl: z.string().nullable().optional(),
  // B-roll картинки (опц): плавающие декоративные изображения в
  // ProductDemoScene. Максимум 3 штуки имеют смысл.
  brollImageUrls: z.array(z.string()).optional(),
});

export type PromoReelProps = z.infer<typeof promoReelSchema>;

export const defaultPromoReelProps: PromoReelProps = {
  hookText: "Вы тратите 40 часов в месяц на маркетинг?",
  problemText: "Анализ конкурентов, контент-план, отчёты — всё вручную.",
  ctaText: "MarketRadar делает это за 5 минут",
  brandName: "MarketRadar",
  brandColor: "#0a0e1a",
  accentColor: "#22d3ee",
  screencastUrl: null,
  voiceoverUrl: null,
  musicUrl: null,
  hookBgImageUrl: null,
  ctaBgImageUrl: null,
  brollImageUrls: [],
};

const HOOK_SEC = 5;
const DEMO_SEC = 20;
const CTA_SEC = 5;

export const PromoReel: React.FC<PromoReelProps> = (props) => {
  const { fps } = useVideoConfig();
  const hookFrames = HOOK_SEC * fps;
  const demoFrames = DEMO_SEC * fps;
  const ctaFrames = CTA_SEC * fps;

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookScene
          text={props.hookText}
          accentColor={props.accentColor}
          bgImageUrl={props.hookBgImageUrl ?? null}
        />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={demoFrames}>
        <ProductDemoScene
          problemText={props.problemText}
          screencastUrl={props.screencastUrl}
          accentColor={props.accentColor}
          brandName={props.brandName}
          brollImageUrls={props.brollImageUrls ?? []}
        />
      </Sequence>

      <Sequence
        from={hookFrames + demoFrames}
        durationInFrames={ctaFrames}
      >
        <CTAScene
          text={props.ctaText}
          brandName={props.brandName}
          accentColor={props.accentColor}
          bgImageUrl={props.ctaBgImageUrl ?? null}
        />
      </Sequence>

      {/* Voiceover — на 1.0 громкости, главный звуковой слой. */}
      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} volume={1} /> : null}
      {/* Музыка — тихая (0.15) если есть voiceover, иначе 0.5.
          В Remotion <Audio> миксуется автоматически — оба слоя играют
          параллельно, ffmpeg склеит в финале. */}
      {props.musicUrl ? (
        <Audio src={props.musicUrl} volume={props.voiceoverUrl ? 0.15 : 0.5} />
      ) : null}
    </AbsoluteFill>
  );
};
