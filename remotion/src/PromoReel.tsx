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
        />
      </Sequence>

      <Sequence from={hookFrames} durationInFrames={demoFrames}>
        <ProductDemoScene
          problemText={props.problemText}
          screencastUrl={props.screencastUrl}
          accentColor={props.accentColor}
          brandName={props.brandName}
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
        />
      </Sequence>

      {props.voiceoverUrl ? <Audio src={props.voiceoverUrl} /> : null}
    </AbsoluteFill>
  );
};
