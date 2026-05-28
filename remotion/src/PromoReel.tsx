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
  // B-roll AI-картинки для УГЛОВ phone-frame (3 декоративные карточки).
  // Активны только когда есть screencast — иначе им просто негде размещаться.
  brollCornerImageUrls: z.array(z.string()).optional(),
  // B-roll AI-картинки для FULLSCREEN-сегментов demo. Если есть screencast +
  // эти картинки → чередуются с phone-frame через один. Если screencast'а
  // нет → fullscreen с Ken-burns. Миксуются с stockVideoUrls в одну
  // последовательность для чередования.
  brollFullscreenImageUrls: z.array(z.string()).optional(),
  // Legacy поле — для обратной совместимости со старыми вызовами рендера.
  // Если передано — раскладывается между corner и fullscreen как было.
  brollImageUrls: z.array(z.string()).optional(),
  // Стоковые видео из Pexels (опц). Если переданы — В full-broll режиме
  // показываются ВМЕСТО brollImageUrls. Cinematic движение из коробки,
  // без Ken-burns костылей. Видео автоматически обрезаются по слоту.
  stockVideoUrls: z.array(z.string()).optional(),
  /** Режим демо-сцены когда И screencast, И broll/stocks активны:
   *   "corners" — фон phone-frame со скринкастом + 3 brolla в углах (default)
   *   "alternate" — phone-frame со скринкастом ЧЕРЕДУЕТСЯ с full-screen broll/stock
   *                 (segments × 2: phone → broll → phone → broll → ...)
   *  Если только что-то одно — этот флаг игнорируется. */
  demoMixMode: z.enum(["corners", "alternate"]).optional(),
  // Длительность всего ролика в секундах. Перебирается в Root через
  // calculateMetadata. Сцены пропорциональны: hook ~17%, demo ~66%, CTA ~17%.
  // Допустимо 10..90 сек. Дефолт 30.
  videoDurationSec: z.number().optional(),
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
  brollCornerImageUrls: [],
  brollFullscreenImageUrls: [],
  stockVideoUrls: [],
  demoMixMode: "corners",
  videoDurationSec: 30,
};

/**
 * Раскладка по сценам пропорциональна общему хронометражу.
 * Hook ~17% (всегда минимум 3 сек), CTA ~17%, остальное — demo.
 * Для 30 сек: 5+20+5. Для 60 сек: 10+40+10. Для 15 сек: 3+9+3.
 */
function calcSceneDurations(totalSec: number) {
  const hook = Math.max(3, Math.round(totalSec * 0.17));
  const cta = Math.max(3, Math.round(totalSec * 0.17));
  const demo = Math.max(5, totalSec - hook - cta);
  return { hook, demo, cta };
}

export const PromoReel: React.FC<PromoReelProps> = (props) => {
  const { fps } = useVideoConfig();
  const totalSec = props.videoDurationSec ?? 30;
  const { hook: HOOK_SEC, demo: DEMO_SEC, cta: CTA_SEC } = calcSceneDurations(totalSec);
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
          brollCornerImageUrls={
            props.brollCornerImageUrls ??
            // Legacy fallback: если пришёл только brollImageUrls — первые 3
            // используем как углы, остальные как fullscreen
            (props.brollImageUrls ?? []).slice(0, 3)
          }
          brollFullscreenImageUrls={
            props.brollFullscreenImageUrls ??
            (props.brollImageUrls ?? []).slice(3)
          }
          stockVideoUrls={props.stockVideoUrls ?? []}
          demoMixMode={props.demoMixMode ?? "corners"}
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
