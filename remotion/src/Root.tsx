import { Composition } from "remotion";
import { PromoReel, promoReelSchema, defaultPromoReelProps } from "./PromoReel";

const FPS = 30;
const DEFAULT_DURATION_SEC = 30;

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
