// MarketRadar pitch deck generator
// Dark premium tech aesthetic — deep navy, electric purple, cyan accent
//
// Usage: node build-deck.js
// Requires pptxgenjs, react-icons, react, react-dom, sharp installed globally

const path = require("path");
const globalRoot = require("child_process").execSync("npm root -g").toString().trim();
// Resolve modules from the global node_modules so `node` can load them
// regardless of the current working directory.
const req = (name) => require(path.join(globalRoot, name));

const pptxgen = req("pptxgenjs");
const React = req("react");
const ReactDOMServer = req("react-dom/server");
const sharp = req("sharp");
const Fa = req("react-icons/fa");
const Hi = req("react-icons/hi2");
const Md = req("react-icons/md");
const Bi = req("react-icons/bi");

// ─── Palette ────────────────────────────────────────────────────────────────
const P = {
  bgDark:    "0F0F1A",  // primary background
  bgMid:     "1A1A2E",  // secondary background
  bgCard:    "1E1E38",  // card fill
  bgCardHi:  "26264A",  // card hover / elevated
  bgAccent:  "16162C",  // subtle accent block
  border:    "2D2D4F",  // subtle dividers
  purple:    "7C3AED",  // primary accent (electric violet)
  indigo:    "6366F1",  // secondary accent
  cyan:      "22D3EE",  // accent #2 (cyan)
  pink:      "EC4899",  // tertiary accent
  white:     "FFFFFF",
  textMuted: "94A3B8",  // muted body text
  textSoft:  "CBD5E1",  // softer body text
  green:     "10B981",
};

// Font pairing: Impact / Arial Black for headers (strong tech feel), Calibri body.
const FONT_HEAD = "Impact";
const FONT_BODY = "Calibri";

// ─── Icon helpers ───────────────────────────────────────────────────────────
async function iconPng(IconComponent, color = "#7C3AED", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ─── Reusable slide decoration ──────────────────────────────────────────────
function applyBase(slide) {
  slide.background = { color: P.bgDark };
}

function addHeaderBadge(slide, pres, text) {
  // Small colored-dot + small label top-left, like a chapter marker
  slide.addShape(pres.shapes.OVAL, {
    x: 0.55, y: 0.52, w: 0.14, h: 0.14,
    fill: { color: P.purple }, line: { color: P.purple },
  });
  slide.addText(text, {
    x: 0.78, y: 0.42, w: 6, h: 0.35,
    fontFace: FONT_BODY, fontSize: 11, color: P.textMuted,
    charSpacing: 4, bold: true, margin: 0,
  });
}

function addFooter(slide, pres, slideNum, total) {
  // Bottom-right page counter
  slide.addText(`${String(slideNum).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: 12.0, y: 7.05, w: 1.0, h: 0.25,
    fontFace: FONT_BODY, fontSize: 10, color: P.textMuted,
    align: "right", margin: 0,
  });
  slide.addText("marketradar24.ru", {
    x: 0.55, y: 7.05, w: 4, h: 0.25,
    fontFace: FONT_BODY, fontSize: 10, color: P.textMuted,
    align: "left", margin: 0,
  });
  // Thin divider line above footer
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 6.95, w: 12.2, h: 0.01,
    fill: { color: P.border }, line: { color: P.border },
  });
}

// Glow-like accent blob (stack of ovals with transparency)
function addGlow(slide, pres, { x, y, size, color }) {
  slide.addShape(pres.shapes.OVAL, {
    x: x - size / 2, y: y - size / 2, w: size, h: size,
    fill: { color, transparency: 85 }, line: { color, transparency: 100 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: x - size / 3, y: y - size / 3, w: (size * 2) / 3, h: (size * 2) / 3,
    fill: { color, transparency: 75 }, line: { color, transparency: 100 },
  });
}

// ─── Main build ─────────────────────────────────────────────────────────────
(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333" x 7.5"
  pres.author = "MarketRadar";
  pres.title = "MarketRadar — ИИ-анализ конкурентов и бренд-стратегия";

  const TOTAL = 12;

  // Pre-render all icons we need
  const icons = {
    radar: await iconPng(Bi.BiRadar, "#FFFFFF", 256),
    brain: await iconPng(Fa.FaBrain, "#" + P.purple, 256),
    chart: await iconPng(Fa.FaChartLine, "#" + P.cyan, 256),
    users: await iconPng(Fa.FaUsers, "#" + P.indigo, 256),
    palette: await iconPng(Fa.FaPalette, "#" + P.pink, 256),
    rocket: await iconPng(Fa.FaRocket, "#" + P.purple, 256),
    bolt: await iconPng(Fa.FaBolt, "#" + P.cyan, 256),
    search: await iconPng(Fa.FaSearchPlus, "#" + P.purple, 256),
    globe: await iconPng(Fa.FaGlobe, "#" + P.cyan, 256),
    file: await iconPng(Fa.FaFileAlt, "#" + P.indigo, 256),
    film: await iconPng(Fa.FaFilm, "#" + P.pink, 256),
    image: await iconPng(Fa.FaImage, "#" + P.purple, 256),
    instagram: await iconPng(Fa.FaInstagram, "#" + P.pink, 256),
    video: await iconPng(Fa.FaVideo, "#" + P.cyan, 256),
    robot: await iconPng(Fa.FaRobot, "#" + P.purple, 256),
    book: await iconPng(Fa.FaBook, "#" + P.indigo, 256),
    presentation: await iconPng(Md.MdSlideshow, "#" + P.cyan, 256),
    map: await iconPng(Fa.FaMapMarkerAlt, "#" + P.pink, 256),
    building: await iconPng(Fa.FaBuilding, "#" + P.indigo, 256),
    briefcase: await iconPng(Fa.FaBriefcase, "#" + P.purple, 256),
    gauge: await iconPng(Md.MdSpeed, "#" + P.cyan, 256),
    key: await iconPng(Fa.FaKey, "#" + P.purple, 256),
    pin: await iconPng(Fa.FaMapPin, "#" + P.cyan, 256),
    telegram: await iconPng(Fa.FaTelegramPlane, "#" + P.cyan, 256),
    bell: await iconPng(Fa.FaBell, "#" + P.purple, 256),
    refresh: await iconPng(Fa.FaSyncAlt, "#" + P.cyan, 256),
    userCircle: await iconPng(Fa.FaUserCircle, "#" + P.indigo, 256),
    lightning: await iconPng(Hi.HiBolt, "#" + P.cyan, 256),
    star: await iconPng(Fa.FaStar, "#" + P.cyan, 256),
    check: await iconPng(Fa.FaCheckCircle, "#" + P.green, 256),
    arrowRight: await iconPng(Fa.FaArrowRight, "#" + P.purple, 256),
    handshake: await iconPng(Fa.FaHandshake, "#" + P.purple, 256),
    percent: await iconPng(Fa.FaPercent, "#" + P.cyan, 256),
    code: await iconPng(Fa.FaCode, "#" + P.purple, 256),
    db: await iconPng(Fa.FaDatabase, "#" + P.cyan, 256),
    server: await iconPng(Fa.FaServer, "#" + P.indigo, 256),
    cloud: await iconPng(Fa.FaCloud, "#" + P.pink, 256),
    shield: await iconPng(Fa.FaShieldAlt, "#" + P.purple, 256),
    heart: await iconPng(Fa.FaHeart, "#" + P.pink, 256),
    clock: await iconPng(Fa.FaClock, "#" + P.cyan, 256),
    dollar: await iconPng(Fa.FaRubleSign, "#" + P.purple, 256),
    cart: await iconPng(Fa.FaShoppingCart, "#" + P.cyan, 256),
    target: await iconPng(Fa.FaBullseye, "#" + P.pink, 256),
    warning: await iconPng(Fa.FaExclamationTriangle, "#" + P.pink, 256),
    time: await iconPng(Md.MdOutlineAccessTime, "#" + P.pink, 256),
    phone: await iconPng(Fa.FaPhone, "#" + P.cyan, 256),
    envelope: await iconPng(Fa.FaEnvelope, "#" + P.indigo, 256),
    magic: await iconPng(Fa.FaMagic, "#" + P.purple, 256),
    lock: await iconPng(Fa.FaLock, "#" + P.cyan, 256),
    landing: await iconPng(Fa.FaDesktop, "#" + P.indigo, 256),
    compass: await iconPng(Fa.FaCompass, "#" + P.pink, 256),
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — Cover
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);

    // Glow blobs in background corners
    addGlow(s, pres, { x: 1.5, y: 6.0, size: 4.5, color: P.purple });
    addGlow(s, pres, { x: 12.0, y: 1.5, size: 3.8, color: P.cyan });
    addGlow(s, pres, { x: 11.0, y: 6.5, size: 3.2, color: P.indigo });

    // Top-left logo badge: "M|R"
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.55, y: 0.55, w: 0.6, h: 0.6, rectRadius: 0.12,
      fill: { color: P.purple }, line: { color: P.purple },
    });
    s.addText("MR", {
      x: 0.55, y: 0.55, w: 0.6, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 20, color: P.white,
      bold: true, align: "center", valign: "middle", margin: 0,
    });
    s.addText("MarketRadar", {
      x: 1.25, y: 0.62, w: 4, h: 0.45,
      fontFace: FONT_BODY, fontSize: 16, color: P.white,
      bold: true, margin: 0, valign: "middle",
    });

    // "PITCH 2026" top-right
    s.addText("PITCH · 2026", {
      x: 10.0, y: 0.7, w: 2.8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: P.cyan,
      charSpacing: 8, bold: true, align: "right", margin: 0,
    });

    // Big title
    s.addText("MarketRadar", {
      x: 0.8, y: 2.2, w: 12, h: 1.6,
      fontFace: FONT_HEAD, fontSize: 96, color: P.white,
      bold: true, margin: 0, charSpacing: -2,
    });

    // Accent sub-label with cyan color
    s.addText([
      { text: "ИИ-АНАЛИЗ ", options: { color: P.cyan, bold: true } },
      { text: "·", options: { color: P.textMuted } },
      { text: " КОНКУРЕНТЫ ", options: { color: P.white, bold: true } },
      { text: "·", options: { color: P.textMuted } },
      { text: " БРЕНД-СТРАТЕГИЯ", options: { color: P.white, bold: true } },
    ], {
      x: 0.8, y: 3.85, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 16, charSpacing: 6, margin: 0,
    });

    // Tagline body
    s.addText(
      "SaaS-платформа для конкурентной разведки, контент-маркетинга и бренд-стратегии. Всё, что маркетологу нужно знать о рынке — за 60 секунд.",
      {
        x: 0.8, y: 4.5, w: 9.5, h: 1.2,
        fontFace: FONT_BODY, fontSize: 16, color: P.textSoft,
        margin: 0, lineSpacingMultiple: 1.3,
      }
    );

    // CTA-style pill
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 6.0, w: 3.5, h: 0.7, rectRadius: 0.35,
      fill: { color: P.purple }, line: { color: P.purple },
    });
    s.addText("marketradar24.ru  →", {
      x: 0.8, y: 6.0, w: 3.5, h: 0.7,
      fontFace: FONT_BODY, fontSize: 15, color: P.white,
      bold: true, align: "center", valign: "middle", margin: 0,
    });

    // Rails (thin vertical purple accent)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.3, y: 2.3, w: 0.06, h: 4.4,
      fill: { color: P.purple }, line: { color: P.purple },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — Problem
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 13.0, y: 7.5, size: 4, color: P.pink });
    addHeaderBadge(s, pres, "01 · ПРОБЛЕМА");

    s.addText("Ручной анализ рынка\nсъедает недели", {
      x: 0.55, y: 1.05, w: 9, h: 1.8,
      fontFace: FONT_HEAD, fontSize: 52, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 1.0,
    });

    s.addText(
      "Маркетолог тратит дни на сбор данных из десятков источников. К тому времени, когда отчёт готов, конкуренты уже двинулись дальше.",
      {
        x: 0.55, y: 3.0, w: 8.2, h: 1.0,
        fontFace: FONT_BODY, fontSize: 15, color: P.textSoft,
        margin: 0, lineSpacingMultiple: 1.35,
      }
    );

    // Three pain stat cards
    const pains = [
      { n: "3–5", unit: "дней", label: "на ручной сбор данных по одному конкуренту", icon: icons.time, color: P.pink },
      { n: "12+", unit: "источников", label: "сайты, соцсети, карты, HH, реестры — всё вручную", icon: icons.warning, color: P.purple },
      { n: "0%", unit: "автоматизации", label: "мониторинг конкурентов просто не ведётся", icon: icons.refresh, color: P.cyan },
    ];
    pains.forEach((p, i) => {
      const x = 0.55 + i * 4.25;
      const y = 4.35;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.0, h: 2.3,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      // Accent left bar
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 2.3,
        fill: { color: p.color }, line: { color: p.color },
      });
      s.addImage({ data: p.icon, x: x + 0.35, y: y + 0.3, w: 0.4, h: 0.4 });
      s.addText(p.n, {
        x: x + 0.3, y: y + 0.8, w: 3.5, h: 0.9,
        fontFace: FONT_HEAD, fontSize: 54, color: P.white,
        bold: true, margin: 0,
      });
      s.addText(p.unit, {
        x: x + 0.3, y: y + 1.7, w: 3.5, h: 0.3,
        fontFace: FONT_BODY, fontSize: 11, color: p.color,
        charSpacing: 4, bold: true, margin: 0,
      });
      s.addText(p.label, {
        x: x + 0.3, y: y + 2.0, w: 3.5, h: 0.5,
        fontFace: FONT_BODY, fontSize: 10.5, color: P.textMuted,
        margin: 0, lineSpacingMultiple: 1.25,
      });
    });

    addFooter(s, pres, 2, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — Solution
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 6.66, y: 3.5, size: 6, color: P.purple });
    addHeaderBadge(s, pres, "02 · РЕШЕНИЕ");

    s.addText("MarketRadar в", {
      x: 0.55, y: 1.1, w: 12, h: 0.8,
      fontFace: FONT_HEAD, fontSize: 44, color: P.white,
      bold: true, margin: 0, align: "center",
    });
    // Huge "60 sec" center piece
    s.addText("60", {
      x: 2.8, y: 1.95, w: 3.8, h: 3.2,
      fontFace: FONT_HEAD, fontSize: 220, color: P.purple,
      bold: true, margin: 0, align: "center", charSpacing: -6,
    });
    s.addText("СЕКУНД", {
      x: 6.6, y: 2.85, w: 4, h: 1.0,
      fontFace: FONT_HEAD, fontSize: 64, color: P.cyan,
      bold: true, margin: 0, align: "left", charSpacing: 2,
    });
    s.addText("от URL компании\nдо полного дашборда", {
      x: 6.65, y: 3.85, w: 4.5, h: 1.0,
      fontFace: FONT_BODY, fontSize: 15, color: P.textSoft,
      margin: 0, lineSpacingMultiple: 1.25,
    });

    // Three pillars row at bottom
    const pillars = [
      { icon: icons.brain, title: "ИИ-движок", desc: "Claude AI анализирует всё целиком" },
      { icon: icons.bolt, title: "Реальные данные", desc: "HH, DaData, Yandex, 2GIS, Keys.so" },
      { icon: icons.refresh, title: "Автомониторинг", desc: "Обновления каждые 30 дней" },
    ];
    pillars.forEach((p, i) => {
      const x = 0.55 + i * 4.25;
      const y = 5.4;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.0, h: 1.35,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      s.addImage({ data: p.icon, x: x + 0.3, y: y + 0.32, w: 0.7, h: 0.7 });
      s.addText(p.title, {
        x: x + 1.2, y: y + 0.22, w: 2.7, h: 0.42,
        fontFace: FONT_BODY, fontSize: 16, color: P.white,
        bold: true, margin: 0,
      });
      s.addText(p.desc, {
        x: x + 1.2, y: y + 0.65, w: 2.7, h: 0.55,
        fontFace: FONT_BODY, fontSize: 11, color: P.textMuted,
        margin: 0, lineSpacingMultiple: 1.25,
      });
    });

    addFooter(s, pres, 3, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — Key features (6 modules)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 0, y: 0, size: 5, color: P.purple });
    addGlow(s, pres, { x: 13.3, y: 7.5, size: 5, color: P.cyan });
    addHeaderBadge(s, pres, "03 · ВОЗМОЖНОСТИ");

    s.addText("Шесть модулей — одна платформа", {
      x: 0.55, y: 0.95, w: 12, h: 0.8,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white,
      bold: true, margin: 0,
    });
    s.addText("От первичного аудита до готовой презентации и видео-рилса — без переключений между инструментами.", {
      x: 0.55, y: 1.75, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    const modules = [
      { icon: icons.search, title: "Анализ компании", desc: "Сайт, SEO, соцсети, вакансии, карты, отзывы — единый дашборд.", color: P.purple },
      { icon: icons.chart, title: "Конкуренты", desc: "Сравнительный дашборд, AI-инсайты, парсинг офферов.", color: P.cyan },
      { icon: icons.users, title: "Портрет ЦА", desc: "Сегменты, страхи, мотивы, цитаты — на основе реальных данных.", color: P.indigo },
      { icon: icons.palette, title: "СММ + Брендбук", desc: "Архетип, tone of voice, цвета, шрифты.", color: P.pink },
      { icon: icons.film, title: "Контент-завод", desc: "Посты, рилсы, сторис, видео-аватары, SEO-статьи.", color: P.purple },
      { icon: icons.presentation, title: "Бренд-презентация", desc: "9–14 слайдов из данных анализа → PDF / PPTX.", color: P.cyan },
    ];
    modules.forEach((m, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.55 + col * 4.25;
      const y = 2.4 + row * 2.2;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.0, h: 2.05,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      // Icon in colored circle
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.3, y: y + 0.3, w: 0.7, h: 0.7,
        fill: { color: m.color, transparency: 70 }, line: { color: m.color, transparency: 100 },
      });
      s.addImage({ data: m.icon, x: x + 0.42, y: y + 0.42, w: 0.46, h: 0.46 });
      s.addText(m.title, {
        x: x + 1.15, y: y + 0.35, w: 2.75, h: 0.5,
        fontFace: FONT_BODY, fontSize: 16, color: P.white,
        bold: true, margin: 0, valign: "middle",
      });
      s.addText(m.desc, {
        x: x + 0.3, y: y + 1.15, w: 3.5, h: 0.8,
        fontFace: FONT_BODY, fontSize: 11, color: P.textSoft,
        margin: 0, lineSpacingMultiple: 1.3,
      });
    });

    addFooter(s, pres, 4, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — How it works (3 steps)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 6.66, y: 7.5, size: 5, color: P.indigo });
    addHeaderBadge(s, pres, "04 · КАК ЭТО РАБОТАЕТ");

    s.addText("Три шага. Никаких брифов.", {
      x: 0.55, y: 0.95, w: 12, h: 0.8,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white, bold: true, margin: 0,
    });
    s.addText("Пользователь вводит URL — платформа делает остальное.", {
      x: 0.55, y: 1.75, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    // Step columns with big numbers
    const steps = [
      { n: "01", title: "Ввод URL", desc: "Укажите сайт — система сама определит нишу, название компании и ключевых конкурентов.", icon: icons.globe, color: P.purple },
      { n: "02", title: "Анализ Claude AI", desc: "Парсим сайт, соцсети, карты, вакансии. Обогащаем данными HH, DaData, Keys.so, 2GIS.", icon: icons.brain, color: P.cyan },
      { n: "03", title: "Готовый дашборд", desc: "Оценки, сравнения, ЦА, СММ-стратегия, брендбук, посты и презентация — всё сразу.", icon: icons.rocket, color: P.indigo },
    ];
    steps.forEach((st, i) => {
      const x = 0.55 + i * 4.25;
      const y = 2.45;

      // Connector arrow between steps
      if (i < 2) {
        s.addShape(pres.shapes.RECTANGLE, {
          x: x + 4.0, y: y + 2.1, w: 0.25, h: 0.04,
          fill: { color: P.border }, line: { color: P.border },
        });
      }

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.0, h: 4.05,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      // Big step number
      s.addText(st.n, {
        x: x + 0.25, y: y + 0.2, w: 2, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 96, color: st.color,
        bold: true, margin: 0, charSpacing: -4,
      });
      // Icon top-right
      s.addImage({ data: st.icon, x: x + 3.1, y: y + 0.4, w: 0.55, h: 0.55 });
      // Divider line
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.3, y: y + 1.95, w: 1, h: 0.03,
        fill: { color: st.color }, line: { color: st.color },
      });
      s.addText(st.title, {
        x: x + 0.3, y: y + 2.15, w: 3.5, h: 0.5,
        fontFace: FONT_BODY, fontSize: 20, color: P.white,
        bold: true, margin: 0,
      });
      s.addText(st.desc, {
        x: x + 0.3, y: y + 2.75, w: 3.5, h: 1.2,
        fontFace: FONT_BODY, fontSize: 12, color: P.textSoft,
        margin: 0, lineSpacingMultiple: 1.4,
      });
    });

    addFooter(s, pres, 5, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — AI Analysis deep dive
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 3, y: 4, size: 5, color: P.purple });
    addHeaderBadge(s, pres, "05 · ИИ-ДВИЖОК");

    s.addText("Под капотом — Claude AI", {
      x: 0.55, y: 0.95, w: 12, h: 0.8,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white, bold: true, margin: 0,
    });
    s.addText("Модель claude-sonnet-4-6 от Anthropic, дополненная реальными источниками данных и доменной экспертизой.", {
      x: 0.55, y: 1.75, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    // Left: big AI brain card with stats
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.55, y: 2.45, w: 5.6, h: 4.3,
      fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
    });
    // Icon + title
    s.addImage({ data: icons.brain, x: 0.85, y: 2.75, w: 0.8, h: 0.8 });
    s.addText("Claude\nSonnet 4.6", {
      x: 1.85, y: 2.75, w: 4, h: 0.9,
      fontFace: FONT_HEAD, fontSize: 28, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 1.0,
    });
    // Divider
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.85, y: 3.85, w: 5, h: 0.02,
      fill: { color: P.border }, line: { color: P.border },
    });

    // Stats inside AI card
    const aiStats = [
      { n: "200K", label: "токенов контекста — видит весь сайт целиком" },
      { n: "10K", label: "токенов на ответ — глубокая аналитика" },
      { n: "RU", label: "нативная работа с русским языком" },
    ];
    aiStats.forEach((st, i) => {
      const y = 4.05 + i * 0.85;
      s.addText(st.n, {
        x: 0.85, y, w: 1.4, h: 0.65,
        fontFace: FONT_HEAD, fontSize: 30, color: P.cyan,
        bold: true, margin: 0,
      });
      s.addText(st.label, {
        x: 2.35, y: y + 0.1, w: 3.6, h: 0.6,
        fontFace: FONT_BODY, fontSize: 12, color: P.textSoft,
        margin: 0, lineSpacingMultiple: 1.3, valign: "middle",
      });
    });

    // Right: What Claude analyzes — checklist
    s.addText("ЧТО АНАЛИЗИРУЕТ", {
      x: 6.5, y: 2.55, w: 6, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: P.cyan,
      charSpacing: 6, bold: true, margin: 0,
    });
    const analyzes = [
      "Позиционирование и УТП компании",
      "SEO-видимость и ключевые запросы",
      "Социальные сети и контент-стратегию",
      "Вакансии и скорость найма",
      "Отзывы на Google, Yandex, 2GIS",
      "Офферы конкурентов и ценовую политику",
      "Архетип бренда и tone of voice",
      "Потенциал роста и точки кратного масштаба",
    ];
    analyzes.forEach((text, i) => {
      const col = Math.floor(i / 4);
      const row = i % 4;
      const x = 6.5 + col * 3.15;
      const y = 3.05 + row * 0.85;
      s.addImage({ data: icons.check, x, y: y + 0.1, w: 0.28, h: 0.28 });
      s.addText(text, {
        x: x + 0.4, y, w: 2.75, h: 0.5,
        fontFace: FONT_BODY, fontSize: 12, color: P.textSoft,
        margin: 0, valign: "middle",
      });
    });

    addFooter(s, pres, 6, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — Real data sources
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 13, y: 0, size: 4.5, color: P.cyan });
    addHeaderBadge(s, pres, "06 · ИСТОЧНИКИ ДАННЫХ");

    s.addText("Не галлюцинации ИИ —\nреальные данные РФ", {
      x: 0.55, y: 0.95, w: 12, h: 1.6,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 1.0,
    });
    s.addText("Каждое утверждение в отчёте опирается на живой источник — официальные API и каталоги.", {
      x: 0.55, y: 2.55, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    const sources = [
      { name: "HH.ru", desc: "Вакансии, темпы найма, зарплаты", icon: icons.briefcase, color: P.cyan },
      { name: "DaData", desc: "Реестр компаний, ИНН, ОГРН, руководители", icon: icons.building, color: P.purple },
      { name: "Yandex Maps", desc: "Рейтинги и отзывы на Яндекс.Картах", icon: icons.map, color: P.pink },
      { name: "2GIS", desc: "Каталог, рейтинги и отзывы 2GIS", icon: icons.pin, color: P.cyan },
      { name: "Keys.so", desc: "Ключевые запросы, SEO-видимость", icon: icons.key, color: P.indigo },
      { name: "PageSpeed", desc: "Core Web Vitals и производительность сайта", icon: icons.gauge, color: P.purple },
      { name: "Google Places", desc: "Рейтинги и отзывы Google Business", icon: icons.globe, color: P.pink },
      { name: "Telegram API", desc: "Уведомления и автоматические дайджесты", icon: icons.telegram, color: P.cyan },
    ];
    sources.forEach((src, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.55 + col * 3.15;
      const y = 3.3 + row * 1.8;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.95, h: 1.6,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55,
        fill: { color: src.color, transparency: 70 }, line: { color: src.color, transparency: 100 },
      });
      s.addImage({ data: src.icon, x: x + 0.34, y: y + 0.34, w: 0.37, h: 0.37 });
      s.addText(src.name, {
        x: x + 0.95, y: y + 0.2, w: 1.9, h: 0.5,
        fontFace: FONT_BODY, fontSize: 15, color: P.white,
        bold: true, margin: 0, valign: "middle",
      });
      s.addText(src.desc, {
        x: x + 0.25, y: y + 0.95, w: 2.55, h: 0.65,
        fontFace: FONT_BODY, fontSize: 10.5, color: P.textMuted,
        margin: 0, lineSpacingMultiple: 1.3,
      });
    });

    addFooter(s, pres, 7, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — Content Factory
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 1, y: 7.5, size: 4.5, color: P.pink });
    addGlow(s, pres, { x: 12, y: 2, size: 3.5, color: P.purple });
    addHeaderBadge(s, pres, "07 · КОНТЕНТ-ЗАВОД");

    s.addText("От стратегии —\nк готовому контенту", {
      x: 0.55, y: 0.95, w: 8, h: 1.5,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 1.0,
    });
    s.addText("AI-фабрика превращает дашборд в публикации, пригодные к запуску — тексты, видео, сценарии.", {
      x: 0.55, y: 2.5, w: 8, h: 0.5,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    // Right-side hero stat
    s.addShape(pres.shapes.RECTANGLE, {
      x: 9.1, y: 0.95, w: 3.65, h: 2.1,
      fill: { color: P.bgCardHi }, line: { color: P.purple, width: 1.5 },
    });
    s.addText("100+", {
      x: 9.1, y: 0.98, w: 3.65, h: 1.3,
      fontFace: FONT_HEAD, fontSize: 80, color: P.cyan,
      bold: true, align: "center", margin: 0,
    });
    s.addText("единиц контента в месяц на одном аккаунте", {
      x: 9.3, y: 2.15, w: 3.25, h: 0.7,
      fontFace: FONT_BODY, fontSize: 11, color: P.textSoft,
      align: "center", margin: 0, lineSpacingMultiple: 1.3,
    });

    // Content type cards
    const content = [
      { icon: icons.file, title: "Посты", desc: "Генерация текстов с tone of voice и проверкой ToV" },
      { icon: icons.film, title: "Рилсы", desc: "Сценарии, хуки, CTA — готовы к съёмке" },
      { icon: icons.image, title: "Сторис", desc: "Серии сторис на неделю с темами и подписями" },
      { icon: icons.video, title: "Видео-аватар", desc: "Готовые видео через HeyGen с вашим лицом и голосом" },
      { icon: icons.book, title: "SEO-статьи", desc: "Длинные формы под ключевые запросы из Keys.so" },
      { icon: icons.compass, title: "Customer Journey", desc: "Карта пути клиента и точки касания" },
    ];
    content.forEach((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.55 + col * 4.15;
      const y = 3.4 + row * 1.75;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.9, h: 1.6,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      s.addImage({ data: c.icon, x: x + 0.3, y: y + 0.3, w: 0.5, h: 0.5 });
      s.addText(c.title, {
        x: x + 0.95, y: y + 0.25, w: 2.85, h: 0.5,
        fontFace: FONT_BODY, fontSize: 15, color: P.white,
        bold: true, margin: 0, valign: "middle",
      });
      s.addText(c.desc, {
        x: x + 0.3, y: y + 0.9, w: 3.4, h: 0.65,
        fontFace: FONT_BODY, fontSize: 11, color: P.textMuted,
        margin: 0, lineSpacingMultiple: 1.3,
      });
    });

    addFooter(s, pres, 8, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — Business metrics / traction
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 6.66, y: 3.5, size: 6, color: P.purple });
    addHeaderBadge(s, pres, "08 · ТРАКШН");

    s.addText("Рынок, который ждёт автоматизации", {
      x: 0.55, y: 0.95, w: 12, h: 0.8,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white, bold: true, margin: 0,
    });
    s.addText("Конкурентная разведка в РФ — ниша без крупных игроков. Мы первыми соединяем Claude AI с локальными источниками.", {
      x: 0.55, y: 1.75, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    // Big metrics row — 4 large cards
    const metrics = [
      { n: "60×", label: "быстрее ручного аудита", color: P.purple },
      { n: "12", label: "интеграций с API", color: P.cyan },
      { n: "30", label: "дней автомониторинга", color: P.indigo },
      { n: "9–14", label: "слайдов в готовой презентации", color: P.pink },
    ];
    metrics.forEach((m, i) => {
      const x = 0.55 + i * 3.15;
      const y = 2.5;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.95, h: 2.3,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.95, h: 0.08,
        fill: { color: m.color }, line: { color: m.color },
      });
      s.addText(m.n, {
        x, y: y + 0.35, w: 2.95, h: 1.3,
        fontFace: FONT_HEAD, fontSize: 72, color: P.white,
        bold: true, align: "center", margin: 0, charSpacing: -2,
      });
      s.addText(m.label, {
        x: x + 0.2, y: y + 1.7, w: 2.55, h: 0.5,
        fontFace: FONT_BODY, fontSize: 12, color: m.color,
        align: "center", bold: true, margin: 0,
        lineSpacingMultiple: 1.2, charSpacing: 2,
      });
    });

    // Target audience row
    s.addText("ДЛЯ КОГО", {
      x: 0.55, y: 5.0, w: 12, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: P.cyan,
      charSpacing: 6, bold: true, margin: 0,
    });
    const audience = [
      { icon: icons.palette, title: "Маркетинговые агентства" },
      { icon: icons.briefcase, title: "Бренд-менеджеры" },
      { icon: icons.rocket, title: "Малый и средний бизнес РФ" },
      { icon: icons.handshake, title: "Интеграторы и консультанты" },
    ];
    audience.forEach((a, i) => {
      const x = 0.55 + i * 3.15;
      const y = 5.45;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.95, h: 1.15,
        fill: { color: P.bgAccent }, line: { color: P.border, width: 1 },
      });
      s.addImage({ data: a.icon, x: x + 0.3, y: y + 0.3, w: 0.55, h: 0.55 });
      s.addText(a.title, {
        x: x + 1.0, y, w: 1.9, h: 1.15,
        fontFace: FONT_BODY, fontSize: 12, color: P.white,
        bold: true, margin: 0, valign: "middle",
        lineSpacingMultiple: 1.25,
      });
    });

    addFooter(s, pres, 9, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 10 — Pricing & Partner program
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 13.3, y: 7.5, size: 4.5, color: P.purple });
    addHeaderBadge(s, pres, "09 · ЭКОНОМИКА");

    s.addText("SaaS по подписке\n+ партнёрская программа", {
      x: 0.55, y: 0.95, w: 12, h: 1.5,
      fontFace: FONT_HEAD, fontSize: 38, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 1.0,
    });

    // Pricing card (left, big)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.55, y: 2.75, w: 5.8, h: 4.0,
      fill: { color: P.bgCardHi }, line: { color: P.purple, width: 2 },
    });
    s.addText("ПОДПИСКА", {
      x: 0.85, y: 2.95, w: 5, h: 0.35,
      fontFace: FONT_BODY, fontSize: 11, color: P.purple,
      charSpacing: 6, bold: true, margin: 0,
    });
    s.addText("MarketRadar Pro", {
      x: 0.85, y: 3.35, w: 5.4, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 28, color: P.white, bold: true, margin: 0,
    });
    s.addText("Полный доступ ко всем модулям, автомониторинг, интеграции с API источников данных, Telegram-уведомления.", {
      x: 0.85, y: 4.0, w: 5.2, h: 1.0,
      fontFace: FONT_BODY, fontSize: 12, color: P.textSoft,
      margin: 0, lineSpacingMultiple: 1.4,
    });
    const proFeatures = [
      "Безлимитный анализ компаний и конкурентов",
      "Контент-завод: посты, рилсы, сторис, видео",
      "Брендбук + бренд-презентация (PDF/PPTX)",
      "Автообновление дашборда каждые 30 дней",
    ];
    proFeatures.forEach((f, i) => {
      s.addImage({ data: icons.check, x: 0.85, y: 5.1 + i * 0.38, w: 0.22, h: 0.22 });
      s.addText(f, {
        x: 1.2, y: 5.05 + i * 0.38, w: 5.0, h: 0.35,
        fontFace: FONT_BODY, fontSize: 11.5, color: P.textSoft,
        margin: 0, valign: "middle",
      });
    });

    // Partner cards (right, stacked)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.75, y: 2.75, w: 6.0, h: 1.9,
      fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.75, y: 2.75, w: 0.1, h: 1.9,
      fill: { color: P.cyan }, line: { color: P.cyan },
    });
    s.addImage({ data: icons.handshake, x: 7.05, y: 2.95, w: 0.55, h: 0.55 });
    s.addText("ПАРТНЁРСКАЯ ПРОГРАММА", {
      x: 7.75, y: 2.92, w: 4.8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 10, color: P.cyan,
      charSpacing: 5, bold: true, margin: 0,
    });
    s.addText("20% комиссии", {
      x: 7.75, y: 3.25, w: 4.8, h: 0.5,
      fontFace: FONT_HEAD, fontSize: 24, color: P.white, bold: true, margin: 0,
    });
    s.addText("Реферальная комиссия с каждого клиента + 10% скидка для приглашённых.", {
      x: 7.05, y: 3.85, w: 5.5, h: 0.75,
      fontFace: FONT_BODY, fontSize: 11.5, color: P.textMuted,
      margin: 0, lineSpacingMultiple: 1.35,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.75, y: 4.85, w: 6.0, h: 1.9,
      fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.75, y: 4.85, w: 0.1, h: 1.9,
      fill: { color: P.pink }, line: { color: P.pink },
    });
    s.addImage({ data: icons.rocket, x: 7.05, y: 5.05, w: 0.55, h: 0.55 });
    s.addText("ПРОГРАММА ИНТЕГРАТОРА", {
      x: 7.75, y: 5.02, w: 4.8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 10, color: P.pink,
      charSpacing: 5, bold: true, margin: 0,
    });
    s.addText("до 50% комиссии", {
      x: 7.75, y: 5.35, w: 4.8, h: 0.5,
      fontFace: FONT_HEAD, fontSize: 24, color: P.white, bold: true, margin: 0,
    });
    s.addText("Для агентств и студий, продающих MarketRadar как услугу под своим брендом.", {
      x: 7.05, y: 5.95, w: 5.5, h: 0.75,
      fontFace: FONT_BODY, fontSize: 11.5, color: P.textMuted,
      margin: 0, lineSpacingMultiple: 1.35,
    });

    addFooter(s, pres, 10, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 11 — Team / Technology stack
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 0, y: 0, size: 5, color: P.cyan });
    addHeaderBadge(s, pres, "10 · ТЕХНОЛОГИИ");

    s.addText("Production-grade стек\nс первого дня", {
      x: 0.55, y: 0.95, w: 12, h: 1.5,
      fontFace: FONT_HEAD, fontSize: 40, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 1.0,
    });
    s.addText("Современные технологии, собственный VPS в Москве, независимость от внешних площадок.", {
      x: 0.55, y: 2.5, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: P.textMuted, margin: 0,
    });

    const stack = [
      { icon: icons.code, title: "Next.js 16", desc: "App Router, React 19, SSR", color: P.purple },
      { icon: icons.brain, title: "Claude AI", desc: "Sonnet 4.6 + резерв GPT-4o", color: P.cyan },
      { icon: icons.db, title: "PostgreSQL", desc: "Надёжное хранение данных клиентов", color: P.indigo },
      { icon: icons.server, title: "Moscow VPS", desc: "Собственные серверы · PM2", color: P.pink },
      { icon: icons.cloud, title: "Cloudflare", desc: "Worker-прокси для Anthropic API", color: P.purple },
      { icon: icons.shield, title: "152-ФЗ", desc: "Соответствие закону о персданных", color: P.cyan },
      { icon: icons.telegram, title: "Telegram Bot", desc: "Уведомления, отчёты, воронка", color: P.indigo },
      { icon: icons.video, title: "HeyGen", desc: "Видео-аватары премиум-класса", color: P.pink },
    ];
    stack.forEach((t, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.55 + col * 3.15;
      const y = 3.15 + row * 1.85;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.95, h: 1.65,
        fill: { color: P.bgCard }, line: { color: P.border, width: 1 },
      });
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55,
        fill: { color: t.color, transparency: 70 }, line: { color: t.color, transparency: 100 },
      });
      s.addImage({ data: t.icon, x: x + 0.34, y: y + 0.34, w: 0.37, h: 0.37 });
      s.addText(t.title, {
        x: x + 0.95, y: y + 0.2, w: 1.9, h: 0.5,
        fontFace: FONT_BODY, fontSize: 14, color: P.white,
        bold: true, margin: 0, valign: "middle",
      });
      s.addText(t.desc, {
        x: x + 0.25, y: y + 0.95, w: 2.55, h: 0.65,
        fontFace: FONT_BODY, fontSize: 10.5, color: P.textMuted,
        margin: 0, lineSpacingMultiple: 1.3,
      });
    });

    addFooter(s, pres, 11, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 12 — CTA
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    applyBase(s);
    addGlow(s, pres, { x: 2, y: 6.5, size: 6, color: P.purple });
    addGlow(s, pres, { x: 11, y: 1, size: 5, color: P.cyan });
    addGlow(s, pres, { x: 6.66, y: 3.75, size: 4, color: P.indigo });

    // Vertical accent bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.3, y: 1.5, w: 0.06, h: 4.5,
      fill: { color: P.purple }, line: { color: P.purple },
    });

    s.addText("СТАРТ · БЕЗ КАРТЫ · 14 ДНЕЙ", {
      x: 0.55, y: 1.35, w: 12, h: 0.35,
      fontFace: FONT_BODY, fontSize: 12, color: P.cyan,
      charSpacing: 8, bold: true, margin: 0,
    });

    s.addText("Попробуйте\nбесплатно.", {
      x: 0.55, y: 1.75, w: 12, h: 3.2,
      fontFace: FONT_HEAD, fontSize: 110, color: P.white,
      bold: true, margin: 0, lineSpacingMultiple: 0.95, charSpacing: -3,
    });

    s.addText(
      "Регистрация за минуту — и платформа сама проанализирует вашу компанию и конкурентов.",
      {
        x: 0.55, y: 5.0, w: 11.5, h: 0.7,
        fontFace: FONT_BODY, fontSize: 18, color: P.textSoft,
        margin: 0, lineSpacingMultiple: 1.3,
      }
    );

    // Big CTA button
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.55, y: 5.95, w: 4.2, h: 0.8, rectRadius: 0.4,
      fill: { color: P.purple }, line: { color: P.purple },
    });
    s.addText("marketradar24.ru  →", {
      x: 0.55, y: 5.95, w: 4.2, h: 0.8,
      fontFace: FONT_BODY, fontSize: 18, color: P.white,
      bold: true, align: "center", valign: "middle", margin: 0,
    });

    // Secondary contact block
    s.addText("probizresurs@gmail.com", {
      x: 5.0, y: 6.05, w: 4.5, h: 0.3,
      fontFace: FONT_BODY, fontSize: 13, color: P.textSoft,
      margin: 0, valign: "middle",
    });
    s.addImage({ data: icons.envelope, x: 5.0, y: 6.45, w: 0.25, h: 0.25 });
    s.addText("Напишите нам для демо или партнёрства", {
      x: 5.3, y: 6.42, w: 5, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: P.textMuted,
      margin: 0, valign: "middle",
    });

    // Bottom "MR" mark
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 11.9, y: 6.25, w: 0.7, h: 0.7, rectRadius: 0.14,
      fill: { color: P.purple }, line: { color: P.purple },
    });
    s.addText("MR", {
      x: 11.9, y: 6.25, w: 0.7, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 22, color: P.white,
      bold: true, align: "center", valign: "middle", margin: 0,
    });
  }

  // ── Write file ──
  const outPath = path.resolve(__dirname, "marketradar-pitch.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("Written:", outPath);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
