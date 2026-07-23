import { Composition } from "remotion";
import { PromoReel, promoReelSchema, defaultPromoReelProps } from "./PromoReel";
import { ContentReel, contentReelSchema, defaultContentReelProps } from "./ContentReel";

const FPS = 30;
const DEFAULT_DURATION_SEC = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoReel"
        component={PromoReel}
        // Дефолт-длительность 30 сек, реальная вычисляется из props через
        // calculateMetadata — позволяет рендерить ролики 15/30/45/60 сек
        // без необходимости заводить отдельные композиции.
        durationInFrames={FPS * DEFAULT_DURATION_SEC}
        fps={FPS}
        width={1080}
        height={1920}
        schema={promoReelSchema}
        defaultProps={defaultPromoReelProps}
        calculateMetadata={({ props }) => {
          const sec = props.videoDurationSec ?? DEFAULT_DURATION_SEC;
          return { durationInFrames: Math.round(FPS * sec) };
        }}
      />
      {/* ContentReel — генерация роликов из Контент-завода (b-roll клиента,
          без промо-мокапов MarketRadar). См. комментарий в ContentReel.tsx. */}
      <Composition
        id="ContentReel"
        component={ContentReel}
        durationInFrames={FPS * DEFAULT_DURATION_SEC}
        fps={FPS}
        width={1080}
        height={1920}
        schema={contentReelSchema}
        defaultProps={defaultContentReelProps}
        calculateMetadata={({ props }) => {
          const sec = props.videoDurationSec ?? DEFAULT_DURATION_SEC;
          return { durationInFrames: Math.round(FPS * sec) };
        }}
      />
    </>
  );
};
