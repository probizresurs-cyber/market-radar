"use client";

/**
 * Фоновая радарная развёртка для первых экранов лендингов.
 *
 * Почему именно радар, а не абстрактная «аврора» или частицы: продукт
 * называется MarketRadar, логотип — радар с кольцами и лучом. Фон,
 * повторяющий этот же приём, работает как продолжение знака, а не как
 * покупная декорация. У конкурентов такого нет: у Zenlink схема-микросхема,
 * у Head Promo коллаж из скриншотов.
 *
 * Метафора рабочая, а не украшательская: луч обходит поле и подсвечивает
 * отметки — это ровно то, что делает продукт, обнаруживает конкурентов в
 * выдаче. Отметки загораются при проходе луча и медленно гаснут.
 *
 * Производительность и доступность:
 *  - canvas 2D, без WebGL и зависимостей;
 *  - учитывает devicePixelRatio, но не выше 2 — на 3x рисовать незачем;
 *  - при prefers-reduced-motion рисует ОДИН статичный кадр без анимации;
 *  - останавливается, когда вкладка скрыта, и когда элемент вне экрана;
 *  - pointer-events: none, aria-hidden — для чтения с экрана его нет.
 */
import { useEffect, useRef } from "react";

type Blip = { a: number; r: number; size: number; lit: number };

export function RadarField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0, h = 0, cx = 0, cy = 0, radius = 0;
    let sweep = -Math.PI / 2;
    let blips: Blip[] = [];
    let running = true;

    // Цвета берём из CSS-переменных страницы: фон обязан следовать теме,
    // а не хранить собственную копию палитры.
    const readVar = (name: string, fallback: string) => {
      const v = getComputedStyle(cv).getPropertyValue(name).trim();
      return v || fallback;
    };
    let hue = readVar("--mrc-cyan", "#00d4ff");
    let ring = readVar("--mrc-logo-ring", "#1a3f5c");

    const resize = () => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Центр развёртки — правее и выше середины: слева живёт текст,
      // и луч не должен ходить под заголовком.
      cx = w * 0.78;
      cy = h * 0.42;
      radius = Math.max(w, h) * 0.62;
      hue = readVar("--mrc-cyan", "#00d4ff");
      ring = readVar("--mrc-logo-ring", "#1a3f5c");
    };

    const seed = () => {
      // Отметки раскиданы по кольцам, чтобы поле не выглядело случайным шумом.
      const n = 14;
      blips = Array.from({ length: n }, (_, i) => ({
        a: (i / n) * Math.PI * 2 + (i % 3) * 0.37,
        r: 0.28 + ((i * 7) % 10) / 14,
        size: i % 4 === 0 ? 2.6 : 1.8,
        lit: 0,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Кольца — как на логотипе
      ctx.strokeStyle = ring;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      for (const k of [0.32, 0.55, 0.78, 1]) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * k, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Крестовина
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // Луч: клин с градиентом от прозрачного к цвету по ходу вращения
      const span = 0.55;
      const g = ctx.createConicGradient
        ? ctx.createConicGradient(sweep - span, cx, cy)
        : null;
      if (g) {
        g.addColorStop(0, "transparent");
        g.addColorStop(span / (Math.PI * 2), hue);
        g.addColorStop(span / (Math.PI * 2) + 0.001, "transparent");
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Передняя кромка луча
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = hue;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius);
      ctx.stroke();

      // Отметки
      for (const b of blips) {
        const x = cx + Math.cos(b.a) * radius * b.r;
        const y = cy + Math.sin(b.a) * radius * b.r;
        ctx.globalAlpha = 0.18 + b.lit * 0.72;
        ctx.fillStyle = hue;
        ctx.beginPath();
        ctx.arc(x, y, b.size + b.lit * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (!running) return;
      sweep += 0.006;
      if (sweep > Math.PI * 1.5) sweep -= Math.PI * 2;
      for (const b of blips) {
        // Угол отметки относительно луча: загорается при проходе.
        let d = b.a - sweep;
        while (d < -Math.PI) d += Math.PI * 2;
        while (d > Math.PI) d -= Math.PI * 2;
        if (Math.abs(d) < 0.06) b.lit = 1;
        else b.lit *= 0.985;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    resize();
    seed();

    if (reduced) {
      // Статичный кадр: поле видно, движения нет.
      blips.forEach((b, i) => { b.lit = i % 5 === 0 ? 0.8 : 0; });
      draw();
      return;
    }

    // Не крутим за кадром и вне экрана — это фон, а не работа.
    const io = new IntersectionObserver(([e]) => {
      const visible = e.isIntersecting && !document.hidden;
      if (visible && !raf) { running = true; raf = requestAnimationFrame(tick); }
      if (!visible && raf) { running = false; cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0 });
    io.observe(cv);

    const onVis = () => {
      if (document.hidden && raf) { running = false; cancelAnimationFrame(raf); raf = 0; }
      else if (!document.hidden && !raf) { running = true; raf = requestAnimationFrame(tick); }
    };
    document.addEventListener("visibilitychange", onVis);

    const onResize = () => { resize(); draw(); };
    window.addEventListener("resize", onResize);

    running = true;
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/** Стили слоя — подключаются страницей вместе с остальным CSS. */
export const RADAR_FIELD_CSS = `
.mrc-root canvas.mrc-radar {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 0;
  /* Маска: поле плотное справа, где развёртка, и растворяется слева,
     под текстом — иначе заголовок читается по решётке. */
  -webkit-mask-image: radial-gradient(120% 100% at 78% 42%, #000 0%, #000 38%, transparent 78%);
  mask-image: radial-gradient(120% 100% at 78% 42%, #000 0%, #000 38%, transparent 78%);
  opacity: 0.9;
}
/* Контент первого экрана — над полем */
.mrc-hero > .mrc-wrap { position: relative; z-index: 1; }
@media (max-width: 900px) {
  /* На узком экране развёртка ушла бы прямо под текст — гасим сильнее. */
  .mrc-root canvas.mrc-radar { opacity: 0.5; }
}
`;
