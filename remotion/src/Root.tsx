import { Composition } from "remotion";
import { PromoReel, promoReelSchema, defaultPromoReelProps } from "./PromoReel";

const FPS = 30;
const DURATION_SEC = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PromoReel"
      component={PromoReel}
      durationInFrames={FPS * DURATION_SEC}
      fps={FPS}
      width={1080}
      height={1920}
      schema={promoReelSchema}
      defaultProps={defaultPromoReelProps}
    />
  );
};
