/* eslint-disable */
// MarketRadar Pitch Deck — 12-slide dark premium PPTX
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

const {
  FaBrain, FaChartLine, FaUsers, FaFileAlt, FaRocket, FaBell,
  FaSearch, FaComments, FaImage, FaVideo, FaPalette, FaMagic,
  FaBullseye, FaBolt, FaCheckCircle, FaArrowRight, FaRobot,
  FaGlobe, FaMapMarkedAlt, FaStar, FaBriefcase, FaDatabase,
  FaLaptopCode, FaCode, FaServer, FaNodeJs, FaReact, FaCloud
} = require("react-icons/fa");
const { HiLightningBolt, HiSparkles } = require("react-icons/hi");
const { MdAnalytics, MdCampaign, MdAutoAwesome, MdSpeed, MdGroups } = require("react-icons/md");
const { SiOpenai, SiAnthropic, SiTelegram, SiGoogle, SiNextdotjs, SiTypescript } = require("react-icons/si");

// ============================================================
// COLOR PALETTE
// ============================================================
const C = {
  bg1: "0b0b1a",        // deepest navy
  bg2: "13132a",        // slightly lighter
  card: "1b1b36",       // card/panel
  cardAlt: "242446",    // elevated card
  border: "2d2d5f",     // subtle border
  purple: "7c3aed",     // primary purple
  purple2: "6366f1",    // indigo
  purple3: "a78bfa",    // light purple
  cyan: "22d3ee",       // primary cyan
  cyan2: "06b6d4",      // darker cyan
  white: "ffffff",
  text: "e2e8f0",
  muted: "94a3b8",
  muted2: "64748b",
  green: "10b981",
  orange: "f59e0b",
  pink: "ec4899",
};

// ============================================================
// HELPERS
// ============================================================
async function iconPng(Component, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Component, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const makeShadow = (opacity = 0.45, blur = 14, offset = 4) => ({
  type: "outer", color: "000000", blur, offset, angle: 135, opacity
});

const makeGlow = (color, opacity = 0.5) => ({
  type: "outer", color, blur: 20, offset: 0, angle: 0, opacity
});

// Add a "glow orb" (blurred decorative circle with high transparency)
function addOrb(slide, pres, x, y, size, color, transparency = 75) {
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: size, h: size,
    fill: { color, transparency },
    line: { color, transparency: 100 }
  });
}

// Add a dot grid texture (manual dots as small ovals)
function addDotGrid(slide, pres, x, y, w, h, color = "ffffff", opacity = 92) {
  const spacing = 0.25;
  const dotSize = 0.025;
  for (let px = x; px < x + w; px += spacing) {
    for (let py = y; py < y + h; py += spacing) {
      slide.addShape(pres.shapes.OVAL, {
        x: px, y: py, w: dotSize, h: dotSize,
        fill: { color, transparency: opacity },
        line: { color, transparency: 100 }
      });
    }
  }
}

// Branded footer
function addFooter(slide, pres, pageNum, total) {
  // Bottom accent line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 5.35, w: 0.4, h: 0.03,
    fill: { color: C.purple }, line: { color: C.purple, transparency: 100 }
  });
  slide.addText("MARKETRADAR", {
    x: 0.9, y: 5.28, w: 2.5, h: 0.2,
    fontSize: 8, color: C.muted, fontFace: "Montserrat", bold: true,
    charSpacing: 3, valign: "middle", margin: 0
  });
  slide.addText(`${pageNum} / ${total}`, {
    x: 8.7, y: 5.28, w: 1, h: 0.2,
    fontSize: 8, color: C.muted, fontFace: "Montserrat", bold: true,
    align: "right", valign: "middle", margin: 0
  });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const TOTAL = 12;

  // Pre-render icons
  const ic = {
    brain: await iconPng(FaBrain, "#22d3ee"),
    chart: await iconPng(FaChartLine, "#22d3ee"),
    users: await iconPng(FaUsers, "#22d3ee"),
    content: await iconPng(FaFileAlt, "#22d3ee"),
    rocket: await iconPng(FaRocket, "#22d3ee"),
    bell: await iconPng(FaBell, "#22d3ee"),
    search: await iconPng(FaSearch, "#a78bfa"),
    comments: await iconPng(FaComments, "#a78bfa"),
    palette: await iconPng(FaPalette, "#a78bfa"),
    magic: await iconPng(FaMagic, "#a78bfa"),
    robot: await iconPng(FaRobot, "#22d3ee"),
    bolt: await iconPng(HiLightningBolt, "#22d3ee"),
    sparkles: await iconPng(HiSparkles, "#22d3ee"),
    target: await iconPng(FaBullseye, "#22d3ee"),
    check: await iconPng(FaCheckCircle, "#22d3ee"),
    arrow: await iconPng(FaArrowRight, "#7c3aed"),
    globe: await iconPng(FaGlobe, "#22d3ee"),
    map: await iconPng(FaMapMarkedAlt, "#22d3ee"),
    star: await iconPng(FaStar, "#f59e0b"),
    briefcase: await iconPng(FaBriefcase, "#22d3ee"),
    database: await iconPng(FaDatabase, "#a78bfa"),
    video: await iconPng(FaVideo, "#ec4899"),
    image: await iconPng(FaImage, "#22d3ee"),
    image2: await iconPng(FaImage, "#a78bfa"),
    code: await iconPng(FaCode, "#22d3ee"),
    server: await iconPng(FaServer, "#a78bfa"),
    cloud: await iconPng(FaCloud, "#22d3ee"),
    telegram: await iconPng(SiTelegram, "#22d3ee"),
    openai: await iconPng(SiOpenai, "#a78bfa"),
    anthropic: await iconPng(SiAnthropic, "#a78bfa"),
    nextjs: await iconPng(SiNextdotjs, "#ffffff"),
    campaign: await iconPng(MdCampaign, "#a78bfa"),
    aware: await iconPng(MdAutoAwesome, "#22d3ee"),
    groups: await iconPng(MdGroups, "#a78bfa"),
    speed: await iconPng(MdSpeed, "#22d3ee"),
    analytics: await iconPng(MdAnalytics, "#22d3ee"),
  };

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 × 5.625
  pres.title = "MarketRadar — Pitch Deck";
  pres.author = "MarketRadar";

  // ============================================================
  // SLIDE 1: COVER
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };

    // Ambient orbs
    addOrb(s, pres, 6.5, -2, 6, C.purple, 78);
    addOrb(s, pres, -2, 3, 5, C.cyan, 85);
    addOrb(s, pres, 7.5, 3.5, 3, C.purple2, 88);

    // Dot grid band
    addDotGrid(s, pres, 0.5, 0.5, 9, 4.6, "ffffff", 94);

    // Left vertical accent stripe
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 1.6, w: 0.07, h: 2.9,
      fill: { color: C.purple },
      line: { color: C.purple, transparency: 100 }
    });

    // Tag / badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.6, w: 2.9, h: 0.42,
      fill: { color: C.purple, transparency: 70 },
      line: { color: C.purple2, width: 1 },
      rectRadius: 0.08
    });
    s.addText("AI · SaaS · B2B · Russia", {
      x: 0.8, y: 1.6, w: 2.9, h: 0.42,
      fontSize: 10, color: C.cyan, bold: true, align: "center",
      valign: "middle", charSpacing: 4, fontFace: "Montserrat", margin: 0
    });

    // Main title — two lines for visual impact
    s.addText("Market", {
      x: 0.72, y: 2.15, w: 9, h: 1.15,
      fontSize: 80, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("Radar.", {
      x: 0.72, y: 3.1, w: 9, h: 1.15,
      fontSize: 80, fontFace: "Montserrat", color: C.cyan,
      bold: true, align: "left", valign: "middle", margin: 0
    });

    // Subtitle
    s.addText("ИИ-анализ конкурентов  ·  Бренд-стратегия  ·  Контент-фабрика", {
      x: 0.78, y: 4.25, w: 9, h: 0.4,
      fontSize: 16, fontFace: "Inter", color: C.text,
      align: "left", valign: "middle", margin: 0
    });

    // Tagline small
    s.addText("Вся маркетинговая аналитика бизнеса — за 60 секунд, в одном окне.", {
      x: 0.78, y: 4.65, w: 8.5, h: 0.35,
      fontSize: 12, fontFace: "Inter", color: C.muted,
      italic: true, align: "left", valign: "middle", margin: 0
    });

    // Bottom bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.35, w: 10, h: 0.28,
      fill: { color: C.purple, transparency: 60 },
      line: { color: C.purple, transparency: 100 }
    });
    s.addText("marketradar.ru   ·   Powered by Claude AI   ·   2026", {
      x: 0, y: 5.35, w: 10, h: 0.28,
      fontSize: 9, color: C.white, align: "center", valign: "middle",
      charSpacing: 3, fontFace: "Montserrat", bold: true, margin: 0
    });
  }

  // ============================================================
  // SLIDE 2: PROBLEM
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, -2, -1, 4, C.purple, 85);
    addOrb(s, pres, 8, 4, 3, C.cyan, 88);

    // Section label
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("01  ·  ПРОБЛЕМА", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    // Headline
    s.addText("Маркетинговый анализ —", {
      x: 0.5, y: 0.7, w: 9, h: 0.6,
      fontSize: 30, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("это всё ещё боль малого и среднего бизнеса.", {
      x: 0.5, y: 1.2, w: 9, h: 0.6,
      fontSize: 24, fontFace: "Inter", color: C.muted,
      italic: true, align: "left", valign: "middle", margin: 0
    });

    // 3 pain-point cards
    const pains = [
      {
        big: "5–10",
        unit: "дней",
        title: "Ручной разбор конкурентов",
        text: "Маркетологу нужно вручную собирать данные из десятков источников — сайты, соцсети, карты, вакансии."
      },
      {
        big: "7+",
        unit: "инструментов",
        title: "Разрозненный tooling",
        text: "Ahrefs, Similarweb, Keys.so, TGStat, Popsters — каждый сервис стоит денег и живёт в своей вкладке."
      },
      {
        big: "₽250k",
        unit: "/ мес.",
        title: "Агентство за ту же работу",
        text: "Классическое digital-агентство берёт от 150–250k ₽ за один бренд-аудит и ЦА-исследование."
      }
    ];
    pains.forEach((p, i) => {
      const x = 0.5 + i * 3.04;
      // Card
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 2.2, w: 2.8, h: 2.8,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.5, 14, 4)
      });
      // Top accent
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 2.2, w: 2.8, h: 0.05,
        fill: { color: i === 0 ? C.pink : i === 1 ? C.orange : C.purple },
        line: { color: "000000", transparency: 100 }
      });
      // Big number
      s.addText(p.big, {
        x: x + 0.2, y: 2.4, w: 2.4, h: 0.85,
        fontSize: 54, fontFace: "Montserrat", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Unit
      s.addText(p.unit, {
        x: x + 0.2, y: 3.2, w: 2.4, h: 0.3,
        fontSize: 11, fontFace: "Montserrat", color: C.cyan,
        bold: true, charSpacing: 2, align: "left", valign: "middle", margin: 0
      });
      // Title
      s.addText(p.title, {
        x: x + 0.2, y: 3.55, w: 2.4, h: 0.35,
        fontSize: 13, fontFace: "Inter", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Description
      s.addText(p.text, {
        x: x + 0.2, y: 3.95, w: 2.4, h: 0.95,
        fontSize: 10, fontFace: "Inter", color: C.muted,
        align: "left", valign: "top", margin: 0
      });
    });

    addFooter(s, pres, 2, TOTAL);
  }

  // ============================================================
  // SLIDE 3: SOLUTION
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, 6, -1.5, 5, C.purple, 80);
    addOrb(s, pres, -1.5, 3.5, 4, C.cyan, 85);
    addDotGrid(s, pres, 0.5, 0.5, 9, 4.5, "ffffff", 95);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("02  ·  РЕШЕНИЕ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    // Big headline
    s.addText("MarketRadar.", {
      x: 0.5, y: 0.85, w: 9, h: 0.9,
      fontSize: 56, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("Один дашборд — вся маркетинговая аналитика бизнеса.", {
      x: 0.5, y: 1.75, w: 9, h: 0.5,
      fontSize: 18, fontFace: "Inter", color: C.text,
      align: "left", valign: "middle", margin: 0
    });

    // Hero stat block
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 2.55, w: 4.3, h: 2.45,
      fill: { color: C.card },
      line: { color: C.purple, width: 2 },
      shadow: makeShadow(0.6, 18, 5)
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 2.55, w: 0.08, h: 2.45,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("60", {
      x: 0.75, y: 2.65, w: 4, h: 1.5,
      fontSize: 140, fontFace: "Montserrat", color: C.cyan,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("секунд", {
      x: 0.85, y: 3.95, w: 4, h: 0.4,
      fontSize: 20, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("от ссылки на сайт — до полного бренд-отчёта, ЦА, SMM-стратегии и бренд-презентации.", {
      x: 0.85, y: 4.35, w: 3.9, h: 0.55,
      fontSize: 10, fontFace: "Inter", color: C.muted,
      align: "left", valign: "top", margin: 0
    });

    // Right — outputs list
    s.addText("ЧТО ВЫ ПОЛУЧАЕТЕ:", {
      x: 5.2, y: 2.55, w: 4.3, h: 0.3,
      fontSize: 10, color: C.cyan, bold: true, charSpacing: 3,
      fontFace: "Montserrat", valign: "middle", margin: 0
    });

    const outputs = [
      "Полный скоринг компании по 6 категориям (SEO, соцсети, карты, отзывы, вакансии, бизнес)",
      "Анализ 3–10 конкурентов с AI-инсайтами и сравнением",
      "Портрет ЦА: сегменты, боли, страхи, возражения, цитаты",
      "Брендбук: цвета, шрифты, тон голоса, слоган, миссия",
      "План контента + генерация постов, рилсов, сторис",
      "Готовая 12-слайдовая бренд-презентация (PDF + PPTX)",
    ];
    outputs.forEach((t, i) => {
      const y = 2.95 + i * 0.33;
      // Check icon bg
      s.addShape(pres.shapes.OVAL, {
        x: 5.2, y: y + 0.04, w: 0.22, h: 0.22,
        fill: { color: C.cyan, transparency: 70 },
        line: { color: C.cyan, width: 1 }
      });
      s.addImage({ data: ic.check, x: 5.24, y: y + 0.08, w: 0.14, h: 0.14 });
      s.addText(t, {
        x: 5.5, y: y, w: 4.1, h: 0.3,
        fontSize: 11, fontFace: "Inter", color: C.text,
        align: "left", valign: "middle", margin: 0
      });
    });

    addFooter(s, pres, 3, TOTAL);
  }

  // ============================================================
  // SLIDE 4: KEY FEATURES — 6 modules
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, -2, -1, 4, C.purple, 85);
    addOrb(s, pres, 8, 3.5, 4, C.cyan, 88);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("03  ·  6 МОДУЛЕЙ ПЛАТФОРМЫ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Всё, что нужно маркетологу —", {
      x: 0.5, y: 0.7, w: 9, h: 0.55,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("в одном окне.", {
      x: 0.5, y: 1.2, w: 9, h: 0.5,
      fontSize: 22, fontFace: "Inter", color: C.cyan,
      italic: true, align: "left", valign: "middle", margin: 0
    });

    const features = [
      { icon: ic.analytics, accent: C.cyan, title: "Анализ компании", text: "Website + SEO + соцсети + карты + вакансии + отзывы → единый скоринг 0–100." },
      { icon: ic.target, accent: C.purple3, title: "Анализ конкурентов", text: "До 10 конкурентов: таблица сравнения, AI-инсайты, анализ офферов с парсингом сайтов." },
      { icon: ic.users, accent: C.cyan, title: "Портрет ЦА", text: "Сегменты, психографика, боли, страхи, цитаты, возражения → готовый бриф для креатива." },
      { icon: ic.campaign, accent: C.purple3, title: "SMM-стратегия", text: "Архетип бренда, платформы, tone of voice, примеры постов под ваш сегмент." },
      { icon: ic.magic, accent: C.cyan, title: "Контент-фабрика", text: "AI-посты, рилсы со сценариями, сторис, видео с HeyGen-аватаром, ToV-чекер." },
      { icon: ic.palette, accent: C.purple3, title: "Бренд-пакет", text: "Брендбук (цвета, шрифты, миссия) + бренд-презентация → экспорт в PDF / PPTX." },
    ];

    features.forEach((f, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.5 + col * 3.04;
      const y = 1.85 + row * 1.65;

      // Card
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.8, h: 1.45,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.4, 10, 3)
      });
      // Left accent
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.05, h: 1.45,
        fill: { color: f.accent }, line: { color: f.accent, transparency: 100 }
      });
      // Icon circle
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5,
        fill: { color: f.accent, transparency: 75 },
        line: { color: f.accent, width: 1 }
      });
      s.addImage({ data: f.icon, x: x + 0.28, y: y + 0.28, w: 0.3, h: 0.3 });
      // Title
      s.addText(f.title, {
        x: x + 0.8, y: y + 0.2, w: 1.9, h: 0.45,
        fontSize: 14, fontFace: "Montserrat", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Text
      s.addText(f.text, {
        x: x + 0.2, y: y + 0.78, w: 2.5, h: 0.6,
        fontSize: 9.5, fontFace: "Inter", color: C.muted,
        align: "left", valign: "top", margin: 0
      });
    });

    addFooter(s, pres, 4, TOTAL);
  }

  // ============================================================
  // SLIDE 5: HOW IT WORKS — 3 steps
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, 5, -1.5, 5, C.purple, 82);
    addOrb(s, pres, -2, 4, 4, C.cyan, 88);
    addDotGrid(s, pres, 0.5, 0.5, 9, 4.5, "ffffff", 95);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("04  ·  КАК ЭТО РАБОТАЕТ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("3 шага — от ссылки до пресса бренд-материалов", {
      x: 0.5, y: 0.85, w: 9, h: 0.6,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });

    const steps = [
      { n: "01", title: "Вводите компанию", text: "URL сайта или название. Мы сами находим соцсети, карты, реквизиты через DaData.", icon: ic.search },
      { n: "02", title: "AI запускает анализ", text: "Claude + GPT-4o параллельно читают сайт, соцсети, Key.so, HH.ru, Google/Yandex/2GIS.", icon: ic.robot },
      { n: "03", title: "Готовые материалы", text: "Дашборд, ЦА, SMM-стратегия, посты, рилсы, брендбук, бренд-презентация. Всё экспортируется.", icon: ic.rocket },
    ];

    steps.forEach((step, i) => {
      const x = 0.5 + i * 3.15;
      const y = 2.0;
      // Card
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.9, h: 3,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.55, 16, 4)
      });
      // Step big number (watermark)
      s.addText(step.n, {
        x: x + 0.15, y: y + 0.15, w: 2, h: 0.9,
        fontSize: 64, fontFace: "Montserrat", color: C.purple,
        bold: true, align: "left", valign: "middle", margin: 0,
        transparency: 30
      });
      // Icon on right
      s.addShape(pres.shapes.OVAL, {
        x: x + 2.2, y: y + 0.3, w: 0.55, h: 0.55,
        fill: { color: C.cyan, transparency: 75 },
        line: { color: C.cyan, width: 1 }
      });
      s.addImage({ data: step.icon, x: x + 2.32, y: y + 0.42, w: 0.31, h: 0.31 });
      // Title
      s.addText(step.title, {
        x: x + 0.25, y: y + 1.25, w: 2.5, h: 0.5,
        fontSize: 18, fontFace: "Montserrat", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Divider
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.25, y: y + 1.8, w: 0.5, h: 0.03,
        fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
      });
      // Text
      s.addText(step.text, {
        x: x + 0.25, y: y + 1.95, w: 2.45, h: 1,
        fontSize: 11, fontFace: "Inter", color: C.muted,
        align: "left", valign: "top", margin: 0
      });

      // Arrow between cards (except last)
      if (i < 2) {
        s.addShape(pres.shapes.OVAL, {
          x: x + 3.02, y: 3.3, w: 0.3, h: 0.3,
          fill: { color: C.purple },
          line: { color: C.cyan, width: 1 }
        });
        s.addImage({ data: ic.arrow, x: x + 3.08, y: 3.36, w: 0.18, h: 0.18 });
      }
    });

    addFooter(s, pres, 5, TOTAL);
  }

  // ============================================================
  // SLIDE 6: AI ANALYSIS DEEP DIVE
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, -2, -1, 4, C.purple, 82);
    addOrb(s, pres, 7, 4, 3.5, C.cyan, 88);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("05  ·  AI-ДВИЖОК", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Powered by Claude AI", {
      x: 0.5, y: 0.85, w: 9, h: 0.6,
      fontSize: 32, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("Лучшая языковая модель в мире — разбирает бренд так, как это сделал бы senior-маркетолог.", {
      x: 0.5, y: 1.4, w: 9, h: 0.4,
      fontSize: 14, fontFace: "Inter", color: C.muted,
      align: "left", valign: "middle", margin: 0
    });

    // LEFT — Big "CLAUDE" branding block
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 2.05, w: 4, h: 3,
      fill: { color: C.card },
      line: { color: C.purple, width: 2 },
      shadow: makeShadow(0.5, 14, 4)
    });
    s.addShape(pres.shapes.OVAL, {
      x: 1.5, y: 2.3, w: 2, h: 2,
      fill: { color: C.purple, transparency: 60 },
      line: { color: C.purple, width: 2 }
    });
    s.addImage({ data: ic.anthropic, x: 2, y: 2.7, w: 1, h: 1 });

    s.addText("claude-sonnet-4-6", {
      x: 0.6, y: 4.4, w: 3.8, h: 0.35,
      fontSize: 14, fontFace: "Montserrat", color: C.white,
      bold: true, align: "center", valign: "middle", margin: 0
    });
    s.addText("Anthropic · через Cloudflare-прокси (обход гео-блока РФ)", {
      x: 0.6, y: 4.7, w: 3.8, h: 0.3,
      fontSize: 9, fontFace: "Inter", color: C.muted,
      align: "center", valign: "middle", margin: 0
    });

    // RIGHT — What Claude analyzes
    s.addText("ЧТО АНАЛИЗИРУЕТ AI:", {
      x: 4.9, y: 2.05, w: 4.6, h: 0.3,
      fontSize: 10, color: C.cyan, bold: true, charSpacing: 3,
      fontFace: "Montserrat", valign: "middle", margin: 0
    });

    const aiItems = [
      { title: "Позиционирование бренда", text: "УТП, tone of voice, архетип, ценности" },
      { title: "SEO + контент-стратегия", text: "Семантика, структура, квик-винс" },
      { title: "Социальные сети", text: "Рубрикатор, вовлечённость, ошибки, рост" },
      { title: "Целевая аудитория", text: "Сегменты, инсайты, боли, цитаты" },
      { title: "Конкурентное поле", text: "Сильные и слабые стороны игроков" },
      { title: "Офферы и продукты", text: "Парсинг сайта → структура УТП" },
    ];
    aiItems.forEach((item, i) => {
      const y = 2.45 + i * 0.42;
      // Number badge
      s.addShape(pres.shapes.OVAL, {
        x: 4.9, y: y + 0.04, w: 0.28, h: 0.28,
        fill: { color: C.purple },
        line: { color: C.cyan, width: 1 }
      });
      s.addText(String(i + 1), {
        x: 4.9, y: y + 0.04, w: 0.28, h: 0.28,
        fontSize: 10, color: C.white, bold: true, fontFace: "Montserrat",
        align: "center", valign: "middle", margin: 0
      });
      // Title
      s.addText(item.title, {
        x: 5.3, y: y - 0.02, w: 4.2, h: 0.22,
        fontSize: 11, color: C.white, bold: true, fontFace: "Inter",
        align: "left", valign: "middle", margin: 0
      });
      // Text
      s.addText(item.text, {
        x: 5.3, y: y + 0.2, w: 4.2, h: 0.2,
        fontSize: 9, color: C.muted, fontFace: "Inter",
        align: "left", valign: "middle", margin: 0
      });
    });

    addFooter(s, pres, 6, TOTAL);
  }

  // ============================================================
  // SLIDE 7: DATA SOURCES
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, 6, -2, 5, C.cyan, 85);
    addOrb(s, pres, -2, 3, 4, C.purple, 85);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("06  ·  РЕАЛЬНЫЕ ДАННЫЕ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Не галлюцинации — живые интеграции", {
      x: 0.5, y: 0.8, w: 9, h: 0.55,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("Каждый скоринг подкреплён реальными API-данными из официальных источников.", {
      x: 0.5, y: 1.32, w: 9, h: 0.4,
      fontSize: 14, fontFace: "Inter", color: C.muted,
      align: "left", valign: "middle", margin: 0
    });

    const sources = [
      { name: "DaData", desc: "Реквизиты, ОКВЭД, финансы РФ", color: C.cyan, icon: ic.database },
      { name: "HH.ru", desc: "Вакансии компании, стек, команда", color: C.purple3, icon: ic.briefcase },
      { name: "Yandex Maps", desc: "Рейтинги, отзывы, геолокация", color: C.cyan, icon: ic.map },
      { name: "2GIS", desc: "Карточки организаций, отзывы, филиалы", color: C.purple3, icon: ic.map },
      { name: "Google Places", desc: "Рейтинги, отзывы, глобальный поиск", color: C.cyan, icon: ic.globe },
      { name: "Keys.so", desc: "SEO-семантика, поисковая видимость", color: C.purple3, icon: ic.search },
      { name: "PageSpeed", desc: "Скорость сайта, Core Web Vitals", color: C.cyan, icon: ic.speed },
      { name: "Telegram API", desc: "Уведомления, дайджесты, мониторинг", color: C.purple3, icon: ic.telegram },
    ];

    sources.forEach((src, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.5 + col * 2.28;
      const y = 1.95 + row * 1.55;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.1, h: 1.4,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.4, 10, 3)
      });
      // Top accent
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.1, h: 0.04,
        fill: { color: src.color }, line: { color: src.color, transparency: 100 }
      });
      // Icon
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.15, y: y + 0.2, w: 0.45, h: 0.45,
        fill: { color: src.color, transparency: 75 },
        line: { color: src.color, width: 1 }
      });
      s.addImage({ data: src.icon, x: x + 0.22, y: y + 0.27, w: 0.31, h: 0.31 });
      // Name
      s.addText(src.name, {
        x: x + 0.7, y: y + 0.22, w: 1.35, h: 0.4,
        fontSize: 13, fontFace: "Montserrat", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Desc
      s.addText(src.desc, {
        x: x + 0.15, y: y + 0.8, w: 1.85, h: 0.55,
        fontSize: 9, fontFace: "Inter", color: C.muted,
        align: "left", valign: "top", margin: 0
      });
    });

    addFooter(s, pres, 7, TOTAL);
  }

  // ============================================================
  // SLIDE 8: CONTENT FACTORY
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, -2, -1, 4, C.pink, 88);
    addOrb(s, pres, 7, 4, 3.5, C.cyan, 88);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("07  ·  КОНТЕНТ-ФАБРИКА", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Один бренд — тысяча единиц контента", {
      x: 0.5, y: 0.85, w: 9, h: 0.55,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("AI-генерация постов, рилсов, сторис и видео с аватаром — всё в одном тоне бренда.", {
      x: 0.5, y: 1.38, w: 9, h: 0.4,
      fontSize: 13, fontFace: "Inter", color: C.muted,
      align: "left", valign: "middle", margin: 0
    });

    const content = [
      { icon: ic.comments, color: C.cyan, title: "Посты", stat: "∞", unit: "вариаций", text: "Генерация с расширением промпта + ToV-чекер. Учитывается архетип бренда, ЦА и платформа." },
      { icon: ic.video, color: C.pink, title: "Рилсы + видео", stat: "HeyGen", unit: "аватар", text: "Полный сценарий + рендер видео с говорящим AI-аватаром. Готовый контент за 2–5 минут." },
      { icon: ic.image2, color: C.purple3, title: "Сторис", stat: "10+", unit: "форматов", text: "Сценарии сторис под ЦА — образовательные, продающие, развлекательные, закулисные." },
      { icon: ic.palette, color: C.cyan, title: "Брендбук", stat: "1-click", unit: "применение", text: "AI-рекомендации из ЦА → цвета, шрифты, слоган, миссия. Применяются к плану контента." },
    ];

    content.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.5 + col * 4.6;
      const y = 1.95 + row * 1.55;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.4, h: 1.4,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.5, 14, 4)
      });
      // Left accent
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.05, h: 1.4,
        fill: { color: item.color }, line: { color: item.color, transparency: 100 }
      });
      // Icon
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.2, y: y + 0.22, w: 0.55, h: 0.55,
        fill: { color: item.color, transparency: 75 },
        line: { color: item.color, width: 1 }
      });
      s.addImage({ data: item.icon, x: x + 0.3, y: y + 0.32, w: 0.35, h: 0.35 });
      // Title
      s.addText(item.title, {
        x: x + 0.9, y: y + 0.2, w: 2, h: 0.4,
        fontSize: 16, fontFace: "Montserrat", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Stat
      s.addText(item.stat, {
        x: x + 3, y: y + 0.15, w: 1.3, h: 0.5,
        fontSize: 24, fontFace: "Montserrat", color: item.color,
        bold: true, align: "right", valign: "middle", margin: 0
      });
      s.addText(item.unit, {
        x: x + 3, y: y + 0.65, w: 1.3, h: 0.25,
        fontSize: 8, fontFace: "Montserrat", color: C.muted,
        bold: true, charSpacing: 2, align: "right", valign: "middle", margin: 0
      });
      // Desc
      s.addText(item.text, {
        x: x + 0.2, y: y + 0.9, w: 4.1, h: 0.45,
        fontSize: 10, fontFace: "Inter", color: C.muted,
        align: "left", valign: "top", margin: 0
      });
    });

    addFooter(s, pres, 8, TOTAL);
  }

  // ============================================================
  // SLIDE 9: TRACTION / METRICS
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, 5, -1.5, 5, C.purple, 80);
    addOrb(s, pres, -2, 4, 4, C.cyan, 85);
    addDotGrid(s, pres, 0.5, 0.5, 9, 4.5, "ffffff", 94);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("08  ·  МЕТРИКИ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Замещаем 7 инструментов и агентство", {
      x: 0.5, y: 0.85, w: 9, h: 0.55,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });

    // 4 big stat blocks
    const stats = [
      { big: "×50", unit: "быстрее", text: "Чем ручной разбор маркетолога", color: C.cyan },
      { big: "6", unit: "модулей", text: "В одной платформе, одна подписка", color: C.purple3 },
      { big: "40+", unit: "API", text: "Реальных источников данных", color: C.cyan },
      { big: "–80%", unit: "затрат", text: "Vs digital-агентство (от 200k ₽)", color: C.pink },
    ];
    stats.forEach((st, i) => {
      const x = 0.5 + i * 2.28;
      const y = 1.85;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.1, h: 1.55,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.5, 14, 4)
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.1, h: 0.05,
        fill: { color: st.color }, line: { color: st.color, transparency: 100 }
      });
      s.addText(st.big, {
        x: x + 0.1, y: y + 0.15, w: 1.9, h: 0.85,
        fontSize: 54, fontFace: "Montserrat", color: C.white,
        bold: true, align: "center", valign: "middle", margin: 0
      });
      s.addText(st.unit, {
        x, y: y + 1, w: 2.1, h: 0.3,
        fontSize: 12, fontFace: "Montserrat", color: st.color,
        bold: true, charSpacing: 3, align: "center", valign: "middle", margin: 0
      });
      s.addText(st.text, {
        x: x + 0.1, y: y + 1.25, w: 1.9, h: 0.25,
        fontSize: 8.5, fontFace: "Inter", color: C.muted,
        align: "center", valign: "middle", margin: 0
      });
    });

    // Bottom wide block — value prop
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 3.65, w: 9, h: 1.3,
      fill: { color: C.card },
      line: { color: C.purple, width: 2 },
      shadow: makeShadow(0.55, 16, 4)
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 3.65, w: 0.07, h: 1.3,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });

    s.addText("Что мы замещаем:", {
      x: 0.75, y: 3.75, w: 8.5, h: 0.3,
      fontSize: 11, color: C.cyan, bold: true, charSpacing: 2,
      fontFace: "Montserrat", valign: "middle", margin: 0
    });
    s.addText("Ahrefs  ·  Similarweb  ·  Keys.so  ·  TGStat  ·  Popsters  ·  SemRush  ·  + маркетинговое агентство", {
      x: 0.75, y: 4.05, w: 8.5, h: 0.35,
      fontSize: 14, color: C.white, fontFace: "Inter", bold: true,
      valign: "middle", margin: 0
    });
    s.addText("Суммарная стоимость этих сервисов — от 80 000 ₽/месяц. MarketRadar — 7 900 ₽.", {
      x: 0.75, y: 4.4, w: 8.5, h: 0.45,
      fontSize: 11, color: C.muted, fontFace: "Inter", italic: true,
      valign: "middle", margin: 0
    });

    addFooter(s, pres, 9, TOTAL);
  }

  // ============================================================
  // SLIDE 10: PRICING & PARTNERS
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, 6, -2, 5, C.cyan, 85);
    addOrb(s, pres, -2, 3.5, 4, C.purple, 85);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("09  ·  ТАРИФЫ И ПАРТНЁРЫ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Прозрачная экономика", {
      x: 0.5, y: 0.85, w: 9, h: 0.55,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });

    // Pricing card (highlighted)
    const px = 0.5;
    s.addShape(pres.shapes.RECTANGLE, {
      x: px, y: 1.85, w: 4.3, h: 3.2,
      fill: { color: C.card },
      line: { color: C.cyan, width: 2 },
      shadow: makeShadow(0.6, 18, 5)
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: px, y: 1.85, w: 4.3, h: 0.06,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: px + 0.25, y: 2.05, w: 1.8, h: 0.3,
      fill: { color: C.cyan, transparency: 70 },
      line: { color: C.cyan, width: 1 },
      rectRadius: 0.1
    });
    s.addText("ПОДПИСКА SAAS", {
      x: px + 0.25, y: 2.05, w: 1.8, h: 0.3,
      fontSize: 8, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 3, align: "center", valign: "middle", margin: 0
    });

    s.addText("7 900", {
      x: px + 0.25, y: 2.45, w: 3.8, h: 1.1,
      fontSize: 80, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("₽ / месяц", {
      x: px + 0.3, y: 3.55, w: 3.8, h: 0.35,
      fontSize: 16, fontFace: "Montserrat", color: C.cyan,
      bold: true, align: "left", valign: "middle", margin: 0
    });

    const perks = [
      "Безлимитный анализ компаний и конкурентов",
      "Все 6 модулей: ЦА, SMM, контент, брендбук, презентации",
      "Мониторинг изменений раз в 30 дней",
      "Telegram-уведомления, экспорт в PDF/PPTX",
    ];
    perks.forEach((p, i) => {
      const y = 3.95 + i * 0.26;
      s.addShape(pres.shapes.OVAL, {
        x: px + 0.3, y: y + 0.02, w: 0.18, h: 0.18,
        fill: { color: C.cyan, transparency: 70 },
        line: { color: C.cyan, width: 1 }
      });
      s.addImage({ data: ic.check, x: px + 0.33, y: y + 0.05, w: 0.12, h: 0.12 });
      s.addText(p, {
        x: px + 0.55, y, w: 3.65, h: 0.22,
        fontSize: 9.5, color: C.text, fontFace: "Inter",
        align: "left", valign: "middle", margin: 0
      });
    });

    // Partner program card (right)
    const rx = 5.2;
    s.addShape(pres.shapes.RECTANGLE, {
      x: rx, y: 1.85, w: 4.3, h: 3.2,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
      shadow: makeShadow(0.45, 12, 3)
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: rx, y: 1.85, w: 4.3, h: 0.06,
      fill: { color: C.purple }, line: { color: C.purple, transparency: 100 }
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rx + 0.25, y: 2.05, w: 2.4, h: 0.3,
      fill: { color: C.purple, transparency: 70 },
      line: { color: C.purple, width: 1 },
      rectRadius: 0.1
    });
    s.addText("ПАРТНЁРСКАЯ ПРОГРАММА", {
      x: rx + 0.25, y: 2.05, w: 2.4, h: 0.3,
      fontSize: 8, color: C.white, bold: true, fontFace: "Montserrat",
      charSpacing: 3, align: "center", valign: "middle", margin: 0
    });

    // Two tiers
    const tiers = [
      {
        title: "Реферальный партнёр",
        commission: "20%",
        desc: "с каждого платежа клиента",
        extra: "+ 10% скидка клиенту"
      },
      {
        title: "Интегратор",
        commission: "до 50%",
        desc: "за внедрение и сопровождение",
        extra: "+ персональный менеджер"
      }
    ];
    tiers.forEach((t, i) => {
      const y = 2.55 + i * 1.25;
      // Divider between tiers
      if (i > 0) {
        s.addShape(pres.shapes.RECTANGLE, {
          x: rx + 0.3, y: y - 0.12, w: 3.7, h: 0.01,
          fill: { color: C.border }, line: { color: C.border, transparency: 100 }
        });
      }
      s.addText(t.title, {
        x: rx + 0.3, y, w: 2.3, h: 0.3,
        fontSize: 12, color: C.white, bold: true, fontFace: "Montserrat",
        valign: "middle", margin: 0
      });
      s.addText(t.commission, {
        x: rx + 2.6, y, w: 1.5, h: 0.55,
        fontSize: 28, color: C.cyan, bold: true, fontFace: "Montserrat",
        align: "right", valign: "middle", margin: 0
      });
      s.addText(t.desc, {
        x: rx + 0.3, y: y + 0.3, w: 3.8, h: 0.3,
        fontSize: 10, color: C.muted, fontFace: "Inter",
        valign: "middle", margin: 0
      });
      s.addText(t.extra, {
        x: rx + 0.3, y: y + 0.6, w: 3.8, h: 0.3,
        fontSize: 9, color: C.cyan, fontFace: "Inter", italic: true,
        valign: "middle", margin: 0
      });
    });

    addFooter(s, pres, 10, TOTAL);
  }

  // ============================================================
  // SLIDE 11: TECH STACK
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, -2, -1, 4, C.purple, 85);
    addOrb(s, pres, 7, 3.5, 4, C.cyan, 88);
    addDotGrid(s, pres, 0.5, 0.5, 9, 4.5, "ffffff", 95);

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 0.45, w: 0.3, h: 0.03,
      fill: { color: C.cyan }, line: { color: C.cyan, transparency: 100 }
    });
    s.addText("10  ·  ТЕХНОЛОГИИ", {
      x: 0.9, y: 0.35, w: 5, h: 0.25,
      fontSize: 10, color: C.cyan, bold: true, fontFace: "Montserrat",
      charSpacing: 4, valign: "middle", margin: 0
    });

    s.addText("Enterprise-grade стек", {
      x: 0.5, y: 0.85, w: 9, h: 0.55,
      fontSize: 28, fontFace: "Montserrat", color: C.white,
      bold: true, align: "left", valign: "middle", margin: 0
    });
    s.addText("Продуктовый стек построен на современных решениях с учётом требований российского рынка.", {
      x: 0.5, y: 1.38, w: 9, h: 0.4,
      fontSize: 13, fontFace: "Inter", color: C.muted,
      align: "left", valign: "middle", margin: 0
    });

    const tech = [
      { name: "Next.js 16", desc: "App Router, React 19", icon: ic.nextjs, color: C.white },
      { name: "Claude API", desc: "Anthropic — основной AI", icon: ic.anthropic, color: C.purple3 },
      { name: "GPT-4o", desc: "Vision + резервный AI", icon: ic.openai, color: C.cyan },
      { name: "HeyGen", desc: "Генерация видео-аватаров", icon: ic.video, color: C.pink },
      { name: "PptxGenJS", desc: "Экспорт презентаций", icon: ic.code, color: C.cyan },
      { name: "Telegram Bot", desc: "Webhooks, уведомления", icon: ic.telegram, color: C.cyan },
      { name: "Cloudflare Workers", desc: "Proxy-обход гео-блоков", icon: ic.cloud, color: C.orange },
      { name: "Moscow VPS", desc: "PM2, Node.js 24, pnpm", icon: ic.server, color: C.purple3 },
    ];
    tech.forEach((t, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.5 + col * 2.28;
      const y = 1.95 + row * 1.55;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.1, h: 1.4,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        shadow: makeShadow(0.4, 10, 3)
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.04, h: 1.4,
        fill: { color: t.color }, line: { color: t.color, transparency: 100 }
      });
      // Icon
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.15, y: y + 0.22, w: 0.45, h: 0.45,
        fill: { color: t.color, transparency: 75 },
        line: { color: t.color, width: 1 }
      });
      s.addImage({ data: t.icon, x: x + 0.22, y: y + 0.29, w: 0.31, h: 0.31 });
      // Name
      s.addText(t.name, {
        x: x + 0.7, y: y + 0.2, w: 1.35, h: 0.4,
        fontSize: 13, fontFace: "Montserrat", color: C.white,
        bold: true, align: "left", valign: "middle", margin: 0
      });
      // Desc
      s.addText(t.desc, {
        x: x + 0.15, y: y + 0.8, w: 1.85, h: 0.55,
        fontSize: 9, fontFace: "Inter", color: C.muted,
        align: "left", valign: "top", margin: 0
      });
    });

    addFooter(s, pres, 11, TOTAL);
  }

  // ============================================================
  // SLIDE 12: CTA
  // ============================================================
  {
    const s = pres.addSlide();
    s.background = { color: C.bg1 };
    addOrb(s, pres, -2, -2, 7, C.purple, 72);
    addOrb(s, pres, 7, 3, 5, C.cyan, 78);
    addOrb(s, pres, 5, -1.5, 3, C.purple2, 85);
    addDotGrid(s, pres, 0.5, 0.5, 9, 4.5, "ffffff", 92);

    // Pre-title small
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 3.3, y: 1, w: 3.4, h: 0.45,
      fill: { color: C.purple, transparency: 50 },
      line: { color: C.cyan, width: 1 },
      rectRadius: 0.12
    });
    s.addText("ПОПРОБУЙТЕ БЕСПЛАТНО  ·  БЕЗ КАРТЫ", {
      x: 3.3, y: 1, w: 3.4, h: 0.45,
      fontSize: 10, color: C.cyan, bold: true, charSpacing: 4,
      fontFace: "Montserrat", align: "center", valign: "middle", margin: 0
    });

    // Main CTA
    s.addText("Превратите конкурентов", {
      x: 0.5, y: 1.65, w: 9, h: 0.8,
      fontSize: 42, fontFace: "Montserrat", color: C.white,
      bold: true, align: "center", valign: "middle", margin: 0
    });
    s.addText("в вашу точку роста.", {
      x: 0.5, y: 2.4, w: 9, h: 0.8,
      fontSize: 42, fontFace: "Montserrat", color: C.cyan,
      bold: true, align: "center", valign: "middle", margin: 0
    });

    // CTA button
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 3.1, y: 3.5, w: 3.8, h: 0.7,
      fill: { color: C.cyan },
      line: { color: C.cyan, transparency: 100 },
      shadow: makeShadow(0.7, 20, 6),
      rectRadius: 0.12
    });
    s.addText("Начать анализ →", {
      x: 3.1, y: 3.5, w: 3.8, h: 0.7,
      fontSize: 18, color: C.bg1, bold: true, fontFace: "Montserrat",
      align: "center", valign: "middle", margin: 0
    });

    // Contact info
    s.addText("marketradar.ru   ·   t.me/marketradar_bot   ·   hello@marketradar.ru", {
      x: 0.5, y: 4.4, w: 9, h: 0.35,
      fontSize: 12, color: C.muted, fontFace: "Inter",
      align: "center", valign: "middle", margin: 0
    });

    // Bottom bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.35, w: 10, h: 0.28,
      fill: { color: C.purple, transparency: 60 },
      line: { color: C.purple, transparency: 100 }
    });
    s.addText("MARKETRADAR  ·  POWERED BY CLAUDE AI  ·  2026", {
      x: 0, y: 5.35, w: 10, h: 0.28,
      fontSize: 9, color: C.white, align: "center", valign: "middle",
      charSpacing: 4, fontFace: "Montserrat", bold: true, margin: 0
    });
  }

  // Write
  const outPath = "C:\\Users\\User\\Desktop\\MarketRadar-Pitch.pptx";
  await pres.writeFile({ fileName: outPath });
  console.log("✅ Written:", outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
