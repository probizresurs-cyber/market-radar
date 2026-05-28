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
  /** B-roll картинки. Появляются как плавающие декорации по углам кадра
   *  в разных отрезках центральной сцены. До 3 штук имеют смысл. */
  brollImageUrls?: string[];
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
  brollImageUrls = [],
}) => {
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

      {/* Phone frame */}
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

      {/* B-roll floating-картинки. Каждая выезжает в свой отрезок,
          в свой угол, и плавно исчезает. Без них ничего не ломается. */}
      <BrollLayer urls={brollImageUrls} accentColor={accentColor} sec={sec} fps={fps} frame={frame} />

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
