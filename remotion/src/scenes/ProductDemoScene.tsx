/**
 * ProductDemoScene — центральная сцена рилса (5..25 сек = 20 сек).
 *
 * Композиция:
 *  - сверху: заголовок problemText (анимация: спуск+fade)
 *  - центр: «iPhone-frame» с экраном внутри — там либо реальный скринкаст
 *    платформы (если передан screencastUrl), либо живой fallback-дашборд
 *  - справа от телефона: floating step-карточки, появляются по одной
 *
 * Phone frame собран чистыми div'ами (без SVG/PNG-ассетов):
 *  - корпус: rounded rect 720×1280 с градиентным «металлическим» бордером
 *  - notch: чёрная капсула наверху
 *  - экран: внутренний rounded rect с overflow:hidden, в него вписывается
 *    видео или дашборд через 100%/100%
 *
 * Аспект экрана (680×1208) = 0.563 ≈ 9:16, точно совпадает с разрешением
 * записи Playwright (450×800), так что видео ложится 1:1 без letterbox'а.
 */
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Props {
  problemText: string;
  screencastUrl: string | null;
  accentColor: string;
  brandName: string;
  /** B-roll AI-картинки для углов phone-frame. Появляются как плавающие
   *  декорации по 3 углам. Активны только когда есть screencast. */
  brollCornerImageUrls?: string[];
  /** B-roll AI-картинки для fullscreen-сегментов. С screencast'ом — чередуются
   *  с phone, без screencast'а — full-broll с Ken-burns. Миксуются со
   *  stockVideoUrls для чередования (interleave). */
  brollFullscreenImageUrls?: string[];
  /** Стоковые видео (Pexels) — всегда fullscreen. Cinematic движение. */
  stockVideoUrls?: string[];
  /** Режим когда есть И screencast И fullscreen-источники.
   *   Оркестратор сам определяет: "alternate" если оба → чередование,
   *   "corners" если только углы → углы поверх phone. */
  demoMixMode?: "corners" | "alternate";
}

const STEPS = [
  { label: "Введи URL", icon: "🔗", at: 1 },
  { label: "AI-анализ", icon: "⚡", at: 5 },
  { label: "Стратегия", icon: "🎯", at: 10 },
  { label: "Контент", icon: "📱", at: 15 },
];

// Геометрия phone-frame (в координатах композиции 1080×1920).
// Phone сдвинули вниз чтобы заголовок не наезжал на корпус.
// Сам корпус сделали чуть уже (680 vs 720) — освобождает 20px с каждой
// стороны под step-badges, чтобы они не перекрывали скринкаст внутри.
const PHONE_W = 680;
const PHONE_H = 1240;
const PHONE_X = (1080 - PHONE_W) / 2; // = 200
const PHONE_Y = 360;
const BEZEL = 16; // толщина рамки

export const ProductDemoScene: React.FC<Props> = ({
  problemText,
  screencastUrl,
  accentColor,
  brandName,
  brollCornerImageUrls = [],
  brollFullscreenImageUrls = [],
  stockVideoUrls = [],
  demoMixMode = "corners",
}) => {
  // Fullscreen-визуал: микс broll-картинок и стоковых видео. Если оба есть —
  // чередуем через один (stocks первыми, они задают темп). Если только что-то
  // одно — оно. Если оба пусты — fullscreen режим неактивен.
  const fullscreenMedia =
    stockVideoUrls.length > 0 && brollFullscreenImageUrls.length > 0
      ? interleaveMedia(stockVideoUrls, brollFullscreenImageUrls)
      : stockVideoUrls.length > 0
        ? stockVideoUrls
        : brollFullscreenImageUrls;

  // Alternate-режим активен когда есть И screencast И fullscreen-визуал.
  // Иначе либо чистый phone (со screencast), либо чистый full-broll, либо
  // фолбэк-дашборд внутри phone.
  const useAlternate = demoMixMode === "alternate" && !!screencastUrl && fullscreenMedia.length > 0;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sec = frame / fps;

  // Заголовок вверху — spring-вход
  const titleEnter = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Phone-frame появляется с лёгкой задержкой и spring-анимацией
  const phoneEnter = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  // Выход на последних 15 кадрах
  const exitStart = durationInFrames - 15;
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0e1a 0%, #161b2e 100%)",
        opacity: exit,
      }}
    >
      {/* Particle-фон (декоративные точки) — динамика без отвлечения */}
      <ParticleField accentColor={accentColor} sec={sec} />

      {/* Заголовок — фиксированный блок высотой 240px чтобы phone-frame
          никогда не наезжал. Длинный текст обрезается через -webkit-line-clamp
          (макс 4 строки) — лучше отрезать чем перекрыть phone. */}
      <div
        style={{
          position: "absolute",
          left: 50,
          right: 50,
          top: 80,
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleEnter,
          transform: `translateY(${(1 - titleEnter) * -40}px)`,
        }}
      >
        <div
          style={{
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            fontSize: 48,
            textAlign: "center",
            lineHeight: 1.15,
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            wordBreak: "break-word" as const,
          }}
        >
          {problemText}
        </div>
      </div>

      {/* Главный визуал в центре сцены. Три режима:
       *
       *  1) "alternate" (требует screencast+broll): чередуем phone-frame
       *     со скринкастом и full-screen broll-кадры. Сегменты по 2.5 сек.
       *  2) screencast есть → phone-frame со скринкастом (классический)
       *  3) screencast нет, но есть broll → full-screen broll с Ken-burns
       *  4) Ничего нет → phone-frame с анимированным fallback-дашбордом
       */}
      {useAlternate ? (
        <AlternatingDemo
          screencastUrl={screencastUrl!}
          mediaUrls={fullscreenMedia}
          accentColor={accentColor}
          frame={frame}
          totalFrames={useVideoConfig().durationInFrames}
          opacity={phoneEnter}
        />
      ) : !screencastUrl && fullscreenMedia.length > 0 ? (
        <BrollFullscreen
          urls={fullscreenMedia}
          accentColor={accentColor}
          frame={frame}
          fps={fps}
          totalFrames={useVideoConfig().durationInFrames}
          opacity={phoneEnter}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            left: PHONE_X,
            top: PHONE_Y,
            width: PHONE_W,
            height: PHONE_H,
            opacity: phoneEnter,
            transform: `scale(${0.85 + phoneEnter * 0.15})`,
          }}
        >
          <PhoneFrame accentColor={accentColor}>
            {screencastUrl ? (
              <OffthreadVideo
                src={screencastUrl}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <DemoPlaceholder accentColor={accentColor} brandName={brandName} sec={sec} />
            )}
          </PhoneFrame>
        </div>
      )}

      {/* B-roll floating-картинки в углах — рисуем когда есть screencast
          (т.е. phone-frame на экране). Работает И в corners-режиме (phone
          всё время), И в alternate (phone в чётных сегментах). В углах
          максимум 3 карточки. */}
      {screencastUrl && brollCornerImageUrls.length > 0 ? (
        <BrollLayer urls={brollCornerImageUrls} accentColor={accentColor} sec={sec} fps={fps} frame={frame} />
      ) : null}

      {/* Floating step-карточки справа. Уменьшили font + padding чтобы
          гарантированно не перекрывать содержимое скринкаста внутри
          phone-frame. Размещены в правом 180px-канале между phone и
          краем композиции. */}
      <div
        style={{
          position: "absolute",
          right: 16,
          top: PHONE_Y + 80,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          width: 156,
        }}
      >
        {STEPS.map((step, i) => {
          const start = step.at * fps;
          const stepEnter = spring({
            frame: frame - start,
            fps,
            config: { damping: 12, stiffness: 90 },
          });
          if (frame < start) return null;
          return (
            <div
              key={i}
              style={{
                opacity: stepEnter,
                transform: `translateX(${(1 - stepEnter) * 80}px)`,
                background: "rgba(13, 18, 36, 0.9)",
                border: `2px solid ${accentColor}`,
                borderRadius: 14,
                padding: "10px 12px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 20,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                backdropFilter: "blur(8px)",
                boxShadow: `0 8px 32px ${accentColor}55`,
              }}
            >
              <span style={{ fontSize: 26 }}>{step.icon}</span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Alternate-режим: чередуем сегменты «phone-frame со screencast» и
 * «full-screen broll/stock». Demo делится на 2*N сегментов где N —
 * число broll-кадров. Чётные сегменты (0, 2, 4) — phone, нечётные —
 * full-screen.
 *
 * Например для 4 broll'ов на 20-сек demo:
 *   0.0-2.5  : phone (screencast offset 0)
 *   2.5-5.0  : broll #1 full-screen
 *   5.0-7.5  : phone (screencast offset 2.5 сек)
 *   7.5-10.0 : broll #2 full-screen
 *   10.0-12.5: phone (screencast offset 5 сек)
 *   12.5-15.0: broll #3 full-screen
 *   15.0-17.5: phone (screencast offset 7.5 сек)
 *   17.5-20.0: broll #4 full-screen
 *
 * Screencast в phone-сегментах продолжается с правильного offset'а
 * чтобы юзер не видел один и тот же первый кадр платформы по 4 раза.
 */
const AlternatingDemo: React.FC<{
  screencastUrl: string;
  mediaUrls: string[];
  accentColor: string;
  frame: number;
  totalFrames: number;
  opacity: number;
}> = ({ screencastUrl, mediaUrls, accentColor, frame, totalFrames, opacity }) => {
  const totalSegments = mediaUrls.length * 2;
  const segmentFrames = totalFrames / totalSegments;
  const fadeFrames = Math.min(10, segmentFrames * 0.15);

  // Какой сегмент сейчас активен
  const segmentIndex = Math.min(Math.floor(frame / segmentFrames), totalSegments - 1);
  const isPhoneSegment = segmentIndex % 2 === 0;
  const segmentStart = segmentIndex * segmentFrames;
  const segmentLocalFrame = frame - segmentStart;

  // Cross-fade на границах: затемнение при переходе между сегментами
  const segmentOpacity = interpolate(
    segmentLocalFrame,
    [0, fadeFrames, segmentFrames - fadeFrames, segmentFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (isPhoneSegment) {
    // Сколько прошло "phone-времени" до этого сегмента — для startFrom screencast'а
    const phoneSlotIndex = segmentIndex / 2;
    const screencastOffsetFrames = Math.floor(phoneSlotIndex * segmentFrames);
    return (
      <div
        style={{
          position: "absolute",
          left: PHONE_X,
          top: PHONE_Y,
          width: PHONE_W,
          height: PHONE_H,
          opacity: opacity * segmentOpacity,
          transform: `scale(${0.95 + segmentOpacity * 0.05})`,
        }}
      >
        <PhoneFrame accentColor={accentColor}>
          <OffthreadVideo
            src={screencastUrl}
            muted
            startFrom={screencastOffsetFrames}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </PhoneFrame>
      </div>
    );
  }

  // Full-screen broll-сегмент
  const mediaIndex = Math.floor(segmentIndex / 2);
  const url = mediaUrls[mediaIndex];
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  // Лёгкий zoom-эффект в сегменте — оживляет статичные картинки
  const scale = interpolate(segmentLocalFrame, [0, segmentFrames], [1.05, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: opacity * segmentOpacity, overflow: "hidden" }}>
      {isVideo ? (
        <OffthreadVideo
          src={url}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
        />
      ) : (
        <Img
          src={url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
        />
      )}
      {/* Затемнение сверху/снизу для читаемости заголовка и step-badges */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.7) 0%, rgba(10,14,26,0.25) 30%, rgba(10,14,26,0.25) 70%, rgba(10,14,26,0.7) 100%)",
        }}
      />
      {/* Виньетка с брендовым свечением по периметру */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`,
          boxShadow: `inset 0 0 200px ${accentColor}22`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Чередует элементы двух массивов через один. Стоки идут первыми в каждой
 * паре — они задают темп, AI-картинки заполняют между. Если массивы разной
 * длины, остатки прицепляются в конец без перемешивания.
 *
 * interleaveMedia([s1,s2,s3], [i1,i2]) → [s1, i1, s2, i2, s3]
 */
function interleaveMedia<T>(stocks: T[], images: T[]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(stocks.length, images.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < stocks.length) result.push(stocks[i]);
    if (i < images.length) result.push(images[i]);
  }
  return result;
}

/**
 * Full-screen B-roll режим — для роликов БЕЗ скринкаста. Картинки/видео
 * занимают ВСЁ пространство кадра 1080×1920 (а не вписаны в phone-frame!),
 * сменяются с кросс-fade'ом. На каждой — Ken-burns с РАЗНОЙ траекторией
 * движения (zoom-in, zoom-out, pan-left, pan-right, diagonal) — чтобы серия
 * не смотрелась монотонно.
 *
 * Сверху накладывается тёмный gradient-оверлей чтобы заголовок и step-badges
 * читались поверх любого визуала.
 *
 * Принимает либо картинки (Img), либо видео (OffthreadVideo) — определяется
 * по расширению URL'а.
 */
const BrollFullscreen: React.FC<{
  urls: string[];
  accentColor: string;
  frame: number;
  fps: number;
  totalFrames: number;
  opacity: number;
}> = ({ urls, accentColor, frame, totalFrames, opacity }) => {
  if (!urls.length) return null;
  const segmentFrames = totalFrames / urls.length;
  const fadeFrames = Math.min(20, segmentFrames * 0.2);

  // 5 разных Ken-burns траекторий. Циклятся по индексу картинки —
  // даже на 8 картинках в серии мы не повторим одну и ту же 2 раза подряд.
  const motionPatterns = [
    { scaleFrom: 1.05, scaleTo: 1.25, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0 }, // zoom-in center
    { scaleFrom: 1.25, scaleTo: 1.05, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0 }, // zoom-out center
    { scaleFrom: 1.2, scaleTo: 1.2, xFrom: -40, xTo: 40, yFrom: 0, yTo: 0 }, // pan right
    { scaleFrom: 1.2, scaleTo: 1.2, xFrom: 40, xTo: -40, yFrom: 0, yTo: 0 }, // pan left
    { scaleFrom: 1.1, scaleTo: 1.3, xFrom: -30, xTo: 30, yFrom: -20, yTo: 20 }, // diagonal zoom
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      {urls.map((url, i) => {
        const start = i * segmentFrames;
        const end = start + segmentFrames;
        if (frame < start - fadeFrames || frame > end + fadeFrames) return null;

        const op = interpolate(
          frame,
          [start - fadeFrames, start, end - fadeFrames, end],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const motion = motionPatterns[i % motionPatterns.length];
        const scale = interpolate(frame, [start, end], [motion.scaleFrom, motion.scaleTo], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = interpolate(frame, [start, end], [motion.xFrom, motion.xTo], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(frame, [start, end], [motion.yFrom, motion.yTo], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);

        return (
          <AbsoluteFill key={i} style={{ opacity: op, overflow: "hidden" }}>
            {isVideo ? (
              <OffthreadVideo
                src={url}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${scale}) translate(${x}px, ${y}px)`,
                }}
              />
            ) : (
              <Img
                src={url}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${scale}) translate(${x}px, ${y}px)`,
                }}
              />
            )}
          </AbsoluteFill>
        );
      })}

      {/* Тёмный gradient-оверлей — чтобы текст и badges были читаемы
          поверх любого визуала. Темнее сверху (где title) и снизу (где
          могут быть подписи), светлее в центре где главный визуал. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.75) 0%, rgba(10,14,26,0.3) 30%, rgba(10,14,26,0.3) 70%, rgba(10,14,26,0.75) 100%)",
        }}
      />

      {/* Тонкая виньетка по краям для cinematic ощущения */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`,
          boxShadow: `inset 0 0 200px ${accentColor}22`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * B-roll layer — до 3 декоративных картинок по углам кадра.
 * Каждая занимает свой временной слот:
 *   #0: 3..8 сек, верх-лево
 *   #1: 9..14 сек, верх-право (под step'ами не залезаем)
 *   #2: 15..20 сек, низ-лево
 * Размер: 220×220 с небольшим тилтом и тенью. Fade-in 12 кадров,
 * hold, fade-out 12 кадров.
 */
const BROLL_SLOTS: Array<{
  startSec: number;
  durSec: number;
  x: number;
  y: number;
  rotate: number;
}> = [
  { startSec: 3, durSec: 5, x: 30, y: 240, rotate: -6 },
  { startSec: 9, durSec: 5, x: 30, y: 1380, rotate: 4 },
  { startSec: 15, durSec: 5, x: 820, y: 1420, rotate: -3 },
];

const BrollLayer: React.FC<{
  urls: string[];
  accentColor: string;
  sec: number;
  fps: number;
  frame: number;
}> = ({ urls, accentColor, fps, frame }) => {
  if (!urls.length) return null;
  return (
    <>
      {urls.slice(0, 3).map((url, i) => {
        const slot = BROLL_SLOTS[i];
        if (!slot) return null;
        const start = slot.startSec * fps;
        const end = (slot.startSec + slot.durSec) * fps;
        const fadeFrames = 12;
        const op = interpolate(
          frame,
          [start, start + fadeFrames, end - fadeFrames, end],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        if (op <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: slot.x,
              top: slot.y,
              width: 220,
              height: 220,
              opacity: op,
              transform: `rotate(${slot.rotate}deg)`,
              borderRadius: 18,
              overflow: "hidden",
              border: `3px solid ${accentColor}`,
              boxShadow: `0 16px 40px rgba(0,0,0,0.6), 0 0 24px ${accentColor}55`,
              background: "#0a0e1a",
            }}
          >
            <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
    </>
  );
};

/** Phone-frame: корпус + notch + экран. children рисуется внутри экрана. */
const PhoneFrame: React.FC<{ accentColor: string; children: React.ReactNode }> = ({
  accentColor,
  children,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 64,
      background: "linear-gradient(135deg, #2a3045 0%, #0d1224 50%, #2a3045 100%)",
      padding: BEZEL,
      boxShadow: `
        0 0 100px ${accentColor}55,
        inset 0 0 0 2px ${accentColor}66,
        0 30px 80px rgba(0,0,0,0.5)
      `,
      position: "relative",
    }}
  >
    {/* Notch (камера + speaker) */}
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: 200,
        height: 30,
        background: "#000",
        borderRadius: 18,
        zIndex: 10,
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.8)",
      }}
    />
    {/* Side button (right) — деталь, добавляет реализма */}
    <div
      style={{
        position: "absolute",
        top: 200,
        right: -4,
        width: 6,
        height: 80,
        background: "linear-gradient(90deg, #1a1f3a, #3a4055)",
        borderRadius: "3px 0 0 3px",
      }}
    />
    {/* Side buttons (left) — volume up/down */}
    <div
      style={{
        position: "absolute",
        top: 180,
        left: -4,
        width: 6,
        height: 50,
        background: "linear-gradient(-90deg, #1a1f3a, #3a4055)",
        borderRadius: "0 3px 3px 0",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 250,
        left: -4,
        width: 6,
        height: 80,
        background: "linear-gradient(-90deg, #1a1f3a, #3a4055)",
        borderRadius: "0 3px 3px 0",
      }}
    />
    {/* Screen */}
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 48,
        overflow: "hidden",
        background: "#000",
        position: "relative",
      }}
    >
      {children}
    </div>
  </div>
);

/** Фоновые точки — еле заметная динамика без отвлечения от центра кадра. */
const ParticleField: React.FC<{ accentColor: string; sec: number }> = ({ accentColor, sec }) => {
  const dots = Array.from({ length: 30 }, (_, i) => {
    const seed = (i * 137.5) % 360;
    const x = (Math.sin(seed) * 0.5 + 0.5) * 1080;
    const baseY = (Math.cos(seed * 1.3) * 0.5 + 0.5) * 1920;
    const y = (baseY + sec * 30) % 1920;
    const size = 2 + (i % 4);
    const op = 0.15 + ((i % 5) * 0.05);
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          background: accentColor,
          borderRadius: "50%",
          opacity: op,
          filter: "blur(0.5px)",
        }}
      />
    );
  });
  return <>{dots}</>;
};

const DemoPlaceholder: React.FC<{ accentColor: string; brandName: string; sec: number }> = ({
  accentColor,
  brandName,
  sec,
}) => {
  const bar1 = 30 + Math.sin(sec * 1.2) * 20 + sec * 2;
  const bar2 = 50 + Math.cos(sec * 0.8) * 15 + sec * 1.5;
  const bar3 = 70 + Math.sin(sec * 1.5 + 1) * 10 + sec;
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0e1a 0%, #1a1f3a 100%)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          color: accentColor,
          fontFamily: "Inter, sans-serif",
          fontWeight: 900,
          fontSize: 32,
        }}
      >
        {brandName}
      </div>
      <div style={{ color: "#9ca3af", fontFamily: "Inter, sans-serif", fontSize: 18, marginTop: -8 }}>
        Дашборд
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Stat label="Конкуренты" value={`${Math.min(12, Math.floor(sec * 1.2))}`} accent={accentColor} />
        <Stat label="Score" value={`${Math.min(94, Math.floor(40 + sec * 3.5))}`} accent={accentColor} />
        <Stat label="Постов" value={`${Math.min(28, Math.floor(sec * 1.8))}`} accent={accentColor} />
      </div>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 16 }}>
        <Bar value={Math.min(100, bar1)} label="SEO" color={accentColor} />
        <Bar value={Math.min(100, bar2)} label="SMM" color="#a78bfa" />
        <Bar value={Math.min(100, bar3)} label="Бренд" color="#f472b6" />
      </div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div
    style={{
      flex: 1,
      background: "rgba(13, 18, 36, 0.8)",
      borderRadius: 14,
      padding: 14,
      border: `2px solid ${accent}33`,
    }}
  >
    <div style={{ color: "#9ca3af", fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 600 }}>
      {label}
    </div>
    <div style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 42, fontWeight: 900 }}>
      {value}
    </div>
  </div>
);

const Bar: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <div>
    <div
      style={{
        color: "#fff",
        fontFamily: "Inter, sans-serif",
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 5,
      }}
    >
      {label} <span style={{ color }}>{Math.round(value)}%</span>
    </div>
    <div style={{ height: 16, background: "#1f2738", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        }}
      />
    </div>
  </div>
);
