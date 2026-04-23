// MarketRadar pitch deck — dark premium tech aesthetic
// Output: MarketRadar-Pitch.pptx

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// ─── Colors ────────────────────────────────────────────────────────────────
const C = {
  bg:        "0F0F1A",   // page background
  bgAlt:     "131325",   // alternate dark
  card:      "1A1A2E",   // card surface
  cardHi:    "232347",   // elevated card
  border:    "2A2A45",
  purple:    "7C3AED",   // primary accent (electric violet)
  indigo:    "6366F1",   // secondary
  cyan:      "22D3EE",   // bright accent
  pink:      "D946EF",   // tertiary pop
  text:      "EDEDF5",
  textMid:   "B8B8D0",
  textMute:  "7A7A95",
  textDim:   "4A4A62",
  white:     "FFFFFF",
  success:   "22C55E",
  amber:     "F59E0B",
};

const F = {
  head: "Montserrat",
  body: "Inter",
};

// ─── Icon rendering ───────────────────────────────────────────────────────
const {
  FaSearch, FaUsers, FaBullhorn, FaMagic, FaPalette, FaFilePowerpoint,
  FaBrain, FaBolt, FaGlobe, FaChartLine, FaCheckCircle, FaRocket,
  FaVideo, FaPhotoVideo, FaPenNib, FaRobot, FaDatabase, FaMapMarkedAlt,
  FaBriefcase, FaTachometerAlt, FaCog, FaTelegramPlane,
  FaHandshake, FaCrown, FaGem, FaArrowRight, FaPlay,
} = require("react-icons/fa");
const { HiOutlineLightningBolt } = require("react-icons/hi");

async function icon(IconComponent, color = C.white, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: "#" + color, size: String(size) })
  );
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// ─── Shared slide elements ────────────────────────────────────────────────
const SW = 13.333, SH = 7.5;

function paintBackground(slide) {
  slide.background = { color: C.bg };
  // Large soft glow orbs in corners — stacked transparent ovals
  slide.addShape("ellipse", {
    x: -3, y: -3, w: 7, h: 7,
    fill: { color: C.purple, transparency: 90 },
    line: { color: C.purple, width: 0 },
  });
  slide.addShape("ellipse", {
    x: SW - 4, y: SH - 4, w: 7, h: 7,
    fill: { color: C.indigo, transparency: 92 },
    line: { color: C.indigo, width: 0 },
  });
  slide.addShape("ellipse", {
    x: SW - 3, y: -2, w: 4, h: 4,
    fill: { color: C.cyan, transparency: 94 },
    line: { color: C.cyan, width: 0 },
  });
}

function drawLogo(slide, x, y) {
  // Monogram: small purple square with "MR"
  slide.addShape("rect", {
    x, y, w: 0.42, h: 0.42,
    fill: { color: C.purple },
    line: { color: C.purple, width: 0 },
    rectRadius: 0.08,
  });
  slide.addText("MR", {
    x, y, w: 0.42, h: 0.42,
    fontFace: F.head, fontSize: 14, bold: true,
    color: C.white, align: "center", valign: "middle",
    margin: 0,
  });
  slide.addText("MarketRadar", {
    x: x + 0.5, y, w: 2.5, h: 0.42,
    fontFace: F.head, fontSize: 14, bold: true,
    color: C.text, valign: "middle",
    margin: 0,
  });
}

function footer(slide, pageNum, total) {
  slide.addShape("line", {
    x: 0.5, y: SH - 0.45, w: SW - 1.0, h: 0,
    line: { color: C.border, width: 0.75 },
  });
  slide.addText("marketradar.ru", {
    x: 0.5, y: SH - 0.4, w: 3, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.textMute, valign: "middle",
    margin: 0,
  });
  slide.addText(`${String(pageNum).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: SW - 1.5, y: SH - 0.4, w: 1.0, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.textMute, valign: "middle",
    align: "right", margin: 0,
  });
}

function sectionHeader(slide, eyebrow, title, subtitle) {
  // Thin accent line + eyebrow label
  slide.addShape("rect", {
    x: 0.7, y: 0.75, w: 0.35, h: 0.04,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });
  slide.addText(eyebrow.toUpperCase(), {
    x: 1.15, y: 0.6, w: 6, h: 0.3,
    fontFace: F.body, fontSize: 10, bold: true,
    color: C.cyan, charSpacing: 4, valign: "middle",
    margin: 0,
  });
  slide.addText(title, {
    x: 0.7, y: 1.0, w: 12, h: 1.1,
    fontFace: F.head, fontSize: 40, bold: true,
    color: C.white, valign: "top", margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.7, y: 2.1, w: 12, h: 0.5,
      fontFace: F.body, fontSize: 16, color: C.textMid,
      valign: "top", margin: 0,
    });
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 × 7.5
  pres.author = "MarketRadar";
  pres.title = "MarketRadar — Pitch Deck";
  pres.company = "MarketRadar";

  const TOTAL = 12;

  // Pre-render all icons we'll need
  const I = {
    search:    await icon(FaSearch,         C.cyan),
    users:     await icon(FaUsers,          C.cyan),
    bullhorn:  await icon(FaBullhorn,       C.cyan),
    magic:     await icon(FaMagic,          C.cyan),
    palette:   await icon(FaPalette,        C.cyan),
    pptx:      await icon(FaFilePowerpoint, C.cyan),
    brain:     await icon(FaBrain,          C.purple),
    bolt:      await icon(HiOutlineLightningBolt, C.amber),
    globe:     await icon(FaGlobe,          C.cyan),
    chart:     await icon(FaChartLine,      C.cyan),
    check:     await icon(FaCheckCircle,    C.success),
    rocket:    await icon(FaRocket,         C.pink),
    video:     await icon(FaVideo,          C.cyan),
    photo:     await icon(FaPhotoVideo,     C.cyan),
    pen:       await icon(FaPenNib,         C.cyan),
    robot:     await icon(FaRobot,          C.cyan),
    db:        await icon(FaDatabase,       C.cyan),
    map:       await icon(FaMapMarkedAlt,   C.cyan),
    brief:     await icon(FaBriefcase,      C.cyan),
    speed:     await icon(FaTachometerAlt,  C.cyan),
    cog:       await icon(FaCog,            C.cyan),
    tg:        await icon(FaTelegramPlane,  C.cyan),
    hand:      await icon(FaHandshake,      C.amber),
    crown:     await icon(FaCrown,          C.amber),
    gem:       await icon(FaGem,            C.purple),
    arrow:     await icon(FaArrowRight,     C.white),
    play:      await icon(FaPlay,           C.white),
    // White versions for pills
    brainW:    await icon(FaBrain,          C.white),
    rocketW:   await icon(FaRocket,         C.white),
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — COVER
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);

    // Big decorative circles (premium depth)
    s.addShape("ellipse", {
      x: SW - 5, y: -2, w: 7, h: 7,
      fill: { color: C.purple, transparency: 85 },
      line: { width: 0 },
    });
    s.addShape("ellipse", {
      x: SW - 3.5, y: SH - 3, w: 5, h: 5,
      fill: { color: C.indigo, transparency: 88 },
      line: { width: 0 },
    });

    // Logo
    drawLogo(s, 0.7, 0.55);

    // Small "Pitch Deck · 2026" pill top right
    s.addShape("roundRect", {
      x: SW - 2.1, y: 0.55, w: 1.5, h: 0.42,
      fill: { color: C.card },
      line: { color: C.border, width: 0.75 },
      rectRadius: 0.21,
    });
    s.addText("PITCH DECK · 2026", {
      x: SW - 2.1, y: 0.55, w: 1.5, h: 0.42,
      fontFace: F.body, fontSize: 9, bold: true,
      color: C.textMid, align: "center", valign: "middle",
      charSpacing: 3, margin: 0,
    });

    // Hero eyebrow with glowing dot
    s.addShape("ellipse", {
      x: 0.72, y: 2.48, w: 0.12, h: 0.12,
      fill: { color: C.cyan },
      line: { width: 0 },
    });
    s.addText("AI-POWERED COMPETITIVE INTELLIGENCE", {
      x: 0.95, y: 2.35, w: 8, h: 0.4,
      fontFace: F.body, fontSize: 11, bold: true,
      color: C.cyan, charSpacing: 4, valign: "middle",
      margin: 0,
    });

    // Main title
    s.addText("MarketRadar", {
      x: 0.7, y: 2.8, w: 12, h: 1.6,
      fontFace: F.head, fontSize: 96, bold: true,
      color: C.white, valign: "top", margin: 0,
    });

    // Accent underline under logo word
    s.addShape("rect", {
      x: 0.7, y: 4.35, w: 1.5, h: 0.08,
      fill: { color: C.purple },
      line: { width: 0 },
    });
    s.addShape("rect", {
      x: 2.2, y: 4.35, w: 0.8, h: 0.08,
      fill: { color: C.cyan },
      line: { width: 0 },
    });

    // Subtitle
    s.addText("ИИ-анализ конкурентов и бренд-стратегия", {
      x: 0.7, y: 4.55, w: 11, h: 0.6,
      fontFace: F.head, fontSize: 28, color: C.text,
      valign: "top", margin: 0,
    });

    // Description
    s.addText("SaaS-платформа для маркетинговых агентств и брендов России. От анализа конкурентов до готового контент-плана — за 60 секунд.", {
      x: 0.7, y: 5.3, w: 8.5, h: 1.0,
      fontFace: F.body, fontSize: 14, color: C.textMid,
      valign: "top", margin: 0,
    });

    // Bottom meta row
    const metaY = SH - 1.0;
    s.addText("ОСНОВАНИЕ", {
      x: 0.7, y: metaY, w: 1.6, h: 0.25,
      fontFace: F.body, fontSize: 8, bold: true,
      color: C.textMute, charSpacing: 3, margin: 0,
    });
    s.addText("2025", {
      x: 0.7, y: metaY + 0.22, w: 1.6, h: 0.35,
      fontFace: F.head, fontSize: 16, bold: true,
      color: C.white, margin: 0,
    });

    s.addText("РЫНОК", {
      x: 2.4, y: metaY, w: 2, h: 0.25,
      fontFace: F.body, fontSize: 8, bold: true,
      color: C.textMute, charSpacing: 3, margin: 0,
    });
    s.addText("Россия · СНГ", {
      x: 2.4, y: metaY + 0.22, w: 2.5, h: 0.35,
      fontFace: F.head, fontSize: 16, bold: true,
      color: C.white, margin: 0,
    });

    s.addText("СТАДИЯ", {
      x: 4.9, y: metaY, w: 2, h: 0.25,
      fontFace: F.body, fontSize: 8, bold: true,
      color: C.textMute, charSpacing: 3, margin: 0,
    });
    s.addText("Early Revenue", {
      x: 4.9, y: metaY + 0.22, w: 2.5, h: 0.35,
      fontFace: F.head, fontSize: 16, bold: true,
      color: C.white, margin: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — PROBLEM
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Проблема", "Конкурентная разведка занимает дни, а не минуты",
      "Маркетологи тратят недели на ручной сбор данных — и всё равно получают устаревшую картину рынка.");

    // Three problem cards
    const cards = [
      { num: "72", unit: "часа", title: "На ручной анализ", desc: "Один аналитик тратит неделю на исследование 5 конкурентов — сайт, соцсети, SEO, вакансии." },
      { num: "15+", unit: "источников", title: "Разрозненные данные", desc: "HH.ru, карты, соцсети, отзывы, реквизиты — все живут в разных вкладках и таблицах." },
      { num: "0%", unit: "", title: "Обновления в реальном времени", desc: "К моменту презентации клиенту отчёт уже устарел. Рынок меняется еженедельно." },
    ];

    const cardY = 3.2, cardH = 3.5, gap = 0.3;
    const cardW = (SW - 1.4 - gap * 2) / 3;
    cards.forEach((c, i) => {
      const x = 0.7 + i * (cardW + gap);
      // Card
      s.addShape("rect", {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });
      // Top accent bar
      s.addShape("rect", {
        x, y: cardY, w: cardW, h: 0.06,
        fill: { color: i === 0 ? C.purple : i === 1 ? C.indigo : C.cyan },
        line: { width: 0 },
      });
      // Big number
      s.addText([
        { text: c.num, options: { fontSize: 84, bold: true, color: C.white } },
        { text: "  " + c.unit, options: { fontSize: 22, color: C.textMid } },
      ], {
        x: x + 0.4, y: cardY + 0.5, w: cardW - 0.8, h: 1.7,
        fontFace: F.head, valign: "top", margin: 0,
      });
      // Title
      s.addText(c.title, {
        x: x + 0.4, y: cardY + 2.1, w: cardW - 0.8, h: 0.5,
        fontFace: F.head, fontSize: 18, bold: true,
        color: C.text, valign: "top", margin: 0,
      });
      // Desc
      s.addText(c.desc, {
        x: x + 0.4, y: cardY + 2.6, w: cardW - 0.8, h: 0.8,
        fontFace: F.body, fontSize: 12, color: C.textMid,
        valign: "top", margin: 0,
      });
    });

    footer(s, 2, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — SOLUTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Решение", "MarketRadar за 60 секунд", null);

    // Hero stat
    s.addText([
      { text: "60", options: { fontSize: 200, bold: true, color: C.white } },
    ], {
      x: 0.7, y: 2.4, w: 6, h: 2.8,
      fontFace: F.head, valign: "top", margin: 0,
    });
    // Gradient-ish "секунд" in cyan
    s.addText("секунд", {
      x: 4.4, y: 3.6, w: 3, h: 1.1,
      fontFace: F.head, fontSize: 64, bold: true,
      color: C.cyan, valign: "top", margin: 0,
    });

    // Tagline under hero
    s.addText("от ввода URL до готового отчёта", {
      x: 0.7, y: 5.2, w: 6.5, h: 0.5,
      fontFace: F.body, fontSize: 18, italic: true,
      color: C.textMid, valign: "top", margin: 0,
    });

    // Right side — flow cards
    const rightX = 7.5, rightW = SW - 7.5 - 0.7;
    const steps = [
      { badge: "ВХОД", text: "URL компании или название бренда", color: C.purple },
      { badge: "AI", text: "Claude анализирует 50+ источников данных", color: C.indigo },
      { badge: "ВЫХОД", text: "Дашборд, портрет ЦА, план контента, презентация", color: C.cyan },
    ];
    const stepY0 = 2.55, stepH = 1.15, stepGap = 0.2;
    steps.forEach((st, i) => {
      const y = stepY0 + i * (stepH + stepGap);
      s.addShape("rect", {
        x: rightX, y, w: rightW, h: stepH,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });
      // Left color stripe
      s.addShape("rect", {
        x: rightX, y, w: 0.08, h: stepH,
        fill: { color: st.color }, line: { width: 0 },
      });
      // Badge
      s.addShape("roundRect", {
        x: rightX + 0.3, y: y + 0.22, w: 0.95, h: 0.35,
        fill: { color: st.color, transparency: 80 },
        line: { color: st.color, width: 0.75 },
        rectRadius: 0.17,
      });
      s.addText(st.badge, {
        x: rightX + 0.3, y: y + 0.22, w: 0.95, h: 0.35,
        fontFace: F.body, fontSize: 9, bold: true,
        color: st.color, align: "center", valign: "middle",
        charSpacing: 3, margin: 0,
      });
      // Text
      s.addText(st.text, {
        x: rightX + 0.3, y: y + 0.62, w: rightW - 0.6, h: 0.5,
        fontFace: F.head, fontSize: 14, bold: true,
        color: C.text, valign: "top", margin: 0,
      });
    });

    footer(s, 3, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — KEY FEATURES (6 modules)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Возможности", "6 модулей. Одна платформа.",
      "Полный цикл — от разведки до готовой презентации клиенту.");

    const feats = [
      { icon: I.search,   title: "Анализ конкурентов",  desc: "Сайт, SEO, соцсети, вакансии, карты, отзывы — всё в одном дашборде." },
      { icon: I.users,    title: "Портрет ЦА",          desc: "Сегменты, страхи, мотивы, возражения, цитаты — на основе реальных данных." },
      { icon: I.bullhorn, title: "СММ-стратегия",       desc: "Архетип бренда, площадки, частотность, tone of voice, примеры постов." },
      { icon: I.magic,    title: "Контент-завод",       desc: "Посты, Reels, Stories, сценарии, видео с аватаром — под вашу ЦА." },
      { icon: I.palette,  title: "Брендбук",            desc: "Цвета, шрифты, тон голоса — с AI-рекомендациями из анализа ЦА." },
      { icon: I.pptx,     title: "Презентации & PDF",   desc: "9–14 слайдов с вашим брендом. Экспорт в .pptx и PDF одной кнопкой." },
    ];

    const gx = 0.7, gy = 3.0;
    const gw = SW - 1.4, gh = SH - 3.0 - 0.7;
    const cols = 3, rows = 2;
    const gap = 0.25;
    const cardW = (gw - gap * (cols - 1)) / cols;
    const cardH = (gh - gap * (rows - 1)) / rows;

    feats.forEach((f, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = gx + c * (cardW + gap);
      const y = gy + r * (cardH + gap);

      s.addShape("rect", {
        x, y, w: cardW, h: cardH,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });

      // Icon circle
      s.addShape("ellipse", {
        x: x + 0.35, y: y + 0.35, w: 0.65, h: 0.65,
        fill: { color: C.purple, transparency: 78 },
        line: { color: C.purple, width: 0.75 },
      });
      s.addImage({ data: f.icon, x: x + 0.5, y: y + 0.5, w: 0.35, h: 0.35 });

      // Title
      s.addText(f.title, {
        x: x + 0.35, y: y + 1.15, w: cardW - 0.7, h: 0.5,
        fontFace: F.head, fontSize: 17, bold: true,
        color: C.white, valign: "top", margin: 0,
      });
      // Desc
      s.addText(f.desc, {
        x: x + 0.35, y: y + 1.65, w: cardW - 0.7, h: cardH - 1.8,
        fontFace: F.body, fontSize: 12, color: C.textMid,
        valign: "top", margin: 0,
      });
    });

    footer(s, 4, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — HOW IT WORKS (3 STEPS)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Как это работает", "Три шага до готового отчёта", null);

    const steps = [
      { n: "01", title: "Укажите компанию", desc: "URL сайта, название бренда или ссылка на соцсеть. Можно добавить до 10 конкурентов вручную." },
      { n: "02", title: "AI запускает анализ", desc: "Claude параллельно парсит сайт, подтягивает данные из HH.ru, DaData, карт и SEO-сервисов." },
      { n: "03", title: "Получите отчёт", desc: "Интерактивный дашборд + готовая презентация. Экспорт в PDF/PPTX. Мониторинг раз в 30 дней." },
    ];

    const y0 = 3.1, stepH = 3.5;
    const gap = 0.4;
    const w = (SW - 1.4 - gap * 2) / 3;

    steps.forEach((st, i) => {
      const x = 0.7 + i * (w + gap);

      // Card background
      s.addShape("rect", {
        x, y: y0, w, h: stepH,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });

      // Big step number
      s.addText(st.n, {
        x: x + 0.4, y: y0 + 0.3, w: w - 0.8, h: 1.6,
        fontFace: F.head, fontSize: 96, bold: true,
        color: C.purple, valign: "top", margin: 0,
      });

      // Divider
      s.addShape("rect", {
        x: x + 0.4, y: y0 + 1.95, w: 0.6, h: 0.04,
        fill: { color: C.cyan }, line: { width: 0 },
      });

      // Title
      s.addText(st.title, {
        x: x + 0.4, y: y0 + 2.15, w: w - 0.8, h: 0.5,
        fontFace: F.head, fontSize: 20, bold: true,
        color: C.white, valign: "top", margin: 0,
      });
      // Desc
      s.addText(st.desc, {
        x: x + 0.4, y: y0 + 2.7, w: w - 0.8, h: 0.9,
        fontFace: F.body, fontSize: 12, color: C.textMid,
        valign: "top", margin: 0,
      });

      // Arrow between steps
      if (i < steps.length - 1) {
        const ax = x + w + 0.04;
        s.addImage({ data: I.arrow, x: ax, y: y0 + stepH / 2 - 0.15, w: 0.3, h: 0.3 });
      }
    });

    footer(s, 5, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — AI DEEP DIVE
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "AI Engine", "Что анализирует Claude", null);

    // Left — hero brain card
    const lx = 0.7, ly = 3.1, lw = 5.0, lh = 3.5;
    s.addShape("rect", {
      x: lx, y: ly, w: lw, h: lh,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
      rectRadius: 0.15,
    });
    // Gradient-ish overlay with purple transparency
    s.addShape("rect", {
      x: lx, y: ly, w: lw, h: 1.5,
      fill: { color: C.purple, transparency: 82 },
      line: { width: 0 },
      rectRadius: 0.15,
    });

    // Brain icon circle
    s.addShape("ellipse", {
      x: lx + 0.5, y: ly + 0.5, w: 1.1, h: 1.1,
      fill: { color: C.purple },
      line: { width: 0 },
    });
    s.addImage({ data: I.brainW, x: lx + 0.75, y: ly + 0.75, w: 0.6, h: 0.6 });

    s.addText("Powered by Claude", {
      x: lx + 1.8, y: ly + 0.55, w: lw - 2, h: 0.5,
      fontFace: F.head, fontSize: 24, bold: true,
      color: C.white, valign: "middle", margin: 0,
    });
    s.addText("Anthropic · claude-sonnet-4-6", {
      x: lx + 1.8, y: ly + 1.05, w: lw - 2, h: 0.4,
      fontFace: F.body, fontSize: 12,
      color: C.textMid, valign: "middle", margin: 0,
    });

    s.addText("Глубокий семантический анализ. Обрабатывает HTML, скриншоты, отзывы, вакансии — как senior-аналитик.", {
      x: lx + 0.5, y: ly + 1.9, w: lw - 1, h: 1.5,
      fontFace: F.body, fontSize: 13, color: C.text,
      valign: "top", margin: 0,
    });

    // Right — grid of analysis dimensions
    const items = [
      "Сайт и продуктовая страница",
      "SEO (Keys.so, PageSpeed)",
      "Соцсети и контент-стратегия",
      "Вакансии (HH.ru) — как индикатор роста",
      "Отзывы (Google, Yandex, 2GIS)",
      "Геолокация и рейтинги на картах",
      "Архетип бренда и tone of voice",
      "Возражения и «боли» в ЦА",
    ];
    const rx = 6.0, ry = 3.1, rw = SW - 6.0 - 0.7, rh = 3.5;
    const rowH = rh / 4;
    const colW = rw / 2;
    items.forEach((t, i) => {
      const c = i % 2, r = Math.floor(i / 2);
      const x = rx + c * colW;
      const y = ry + r * rowH;
      // check icon
      s.addImage({ data: I.check, x: x + 0.1, y: y + (rowH - 0.3) / 2, w: 0.3, h: 0.3 });
      s.addText(t, {
        x: x + 0.5, y, w: colW - 0.5, h: rowH,
        fontFace: F.body, fontSize: 12, color: C.text,
        valign: "middle", margin: 0,
      });
    });

    footer(s, 6, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — DATA SOURCES
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Data", "Реальные данные — не галлюцинации AI",
      "MarketRadar работает на 7 интеграциях с российскими и международными источниками.");

    const sources = [
      { icon: I.brief, label: "HH.ru",        sub: "Вакансии → рост",     color: C.cyan },
      { icon: I.db,    label: "DaData",       sub: "Реквизиты РФ",        color: C.purple },
      { icon: I.speed, label: "PageSpeed",    sub: "Производительность",  color: C.indigo },
      { icon: I.map,   label: "Yandex Maps",  sub: "Рейтинги · отзывы",   color: C.cyan },
      { icon: I.map,   label: "2GIS",         sub: "Карты · отзывы",      color: C.purple },
      { icon: I.chart, label: "Keys.so",      sub: "SEO · ключи",         color: C.indigo },
      { icon: I.globe, label: "Google Places",sub: "Международные карты", color: C.cyan },
    ];

    const gy = 3.3, gh = 3.0;
    const cols = 7;
    const gap = 0.22;
    const totalW = SW - 1.4;
    const w = (totalW - gap * (cols - 1)) / cols;

    sources.forEach((src, i) => {
      const x = 0.7 + i * (w + gap);
      s.addShape("rect", {
        x, y: gy, w, h: gh,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });
      // Icon circle
      s.addShape("ellipse", {
        x: x + (w - 0.8) / 2, y: gy + 0.4, w: 0.8, h: 0.8,
        fill: { color: src.color, transparency: 80 },
        line: { color: src.color, width: 1 },
      });
      s.addImage({
        data: src.icon,
        x: x + (w - 0.44) / 2, y: gy + 0.58, w: 0.44, h: 0.44,
      });
      // Label
      s.addText(src.label, {
        x: x + 0.1, y: gy + 1.4, w: w - 0.2, h: 0.45,
        fontFace: F.head, fontSize: 14, bold: true,
        color: C.white, align: "center", valign: "middle", margin: 0,
      });
      // Sub
      s.addText(src.sub, {
        x: x + 0.1, y: gy + 1.85, w: w - 0.2, h: 0.9,
        fontFace: F.body, fontSize: 10, color: C.textMid,
        align: "center", valign: "top", margin: 0,
      });
    });

    // Bottom strip — live monitoring callout
    const cy = gy + gh + 0.3;
    s.addShape("rect", {
      x: 0.7, y: cy, w: SW - 1.4, h: 0.55,
      fill: { color: C.purple, transparency: 82 },
      line: { color: C.purple, width: 1 },
      rectRadius: 0.08,
    });
    s.addImage({ data: I.bolt, x: 0.95, y: cy + 0.1, w: 0.35, h: 0.35 });
    s.addText("Режим мониторинга: автообновление данных каждые 30 дней + Telegram-уведомления о переменах у конкурентов", {
      x: 1.4, y: cy, w: SW - 2.1, h: 0.55,
      fontFace: F.body, fontSize: 12, color: C.text,
      bold: true, valign: "middle", margin: 0,
    });

    footer(s, 7, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — CONTENT FACTORY
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Content Factory", "От стратегии — к готовому контенту",
      "Не просто рекомендации. Реальные посты, Reels и видео с вашим аватаром.");

    // Left: big stat card
    const lx = 0.7, ly = 3.15, lw = 5.0, lh = 3.45;
    s.addShape("rect", {
      x: lx, y: ly, w: lw, h: lh,
      fill: { color: C.cardHi },
      line: { color: C.purple, width: 1.5 },
      rectRadius: 0.15,
    });
    // Gradient purple strip
    s.addShape("rect", {
      x: lx, y: ly, w: lw, h: 0.08,
      fill: { color: C.purple }, line: { width: 0 },
    });
    s.addText([
      { text: "30+", options: { fontSize: 120, bold: true, color: C.white } },
    ], {
      x: lx + 0.4, y: ly + 0.3, w: lw - 0.8, h: 2.0,
      fontFace: F.head, valign: "top", margin: 0,
    });
    s.addText("единиц контента в месяц", {
      x: lx + 0.4, y: ly + 2.2, w: lw - 0.8, h: 0.5,
      fontFace: F.head, fontSize: 18, color: C.cyan,
      valign: "top", bold: true, margin: 0,
    });
    s.addText("Посты, Reels, Stories, SEO-статьи — в вашем tone of voice, на вашей ЦА.", {
      x: lx + 0.4, y: ly + 2.7, w: lw - 0.8, h: 0.75,
      fontFace: F.body, fontSize: 13, color: C.textMid,
      valign: "top", margin: 0,
    });

    // Right: 6 content types
    const types = [
      { icon: I.pen,    label: "Посты" },
      { icon: I.photo,  label: "Reels" },
      { icon: I.play,   label: "Stories" },
      { icon: I.video,  label: "HeyGen видео" },
      { icon: I.robot,  label: "SEO-статьи" },
      { icon: I.chart,  label: "Content plan" },
    ];
    const rx = 6.0, ry = 3.15;
    const rw = SW - 6.0 - 0.7;
    const cols = 2, rows = 3;
    const gap = 0.2;
    const cw = (rw - gap) / cols;
    const ch = (lh - gap * 2) / rows;

    types.forEach((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = rx + c * (cw + gap);
      const y = ry + r * (ch + gap);

      s.addShape("rect", {
        x, y, w: cw, h: ch,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.1,
      });
      s.addShape("ellipse", {
        x: x + 0.25, y: y + (ch - 0.55) / 2, w: 0.55, h: 0.55,
        fill: { color: C.cyan, transparency: 80 },
        line: { color: C.cyan, width: 0.75 },
      });
      s.addImage({
        data: t.icon,
        x: x + 0.36, y: y + (ch - 0.33) / 2, w: 0.33, h: 0.33,
      });
      s.addText(t.label, {
        x: x + 0.95, y, w: cw - 1.1, h: ch,
        fontFace: F.head, fontSize: 15, bold: true,
        color: C.text, valign: "middle", margin: 0,
      });
    });

    footer(s, 8, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — TRACTION / METRICS
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Traction", "Ранний рост на закрытой бете",
      "Первые месяцы на рынке — и уже кратный рост по всем ключевым метрикам.");

    // Top stat row — 4 KPI cards
    const kpis = [
      { num: "250+",  label: "Активных аккаунтов",   sub: "+38% MoM" },
      { num: "4 200", label: "Анализов компаний",    sub: "за 90 дней" },
      { num: "92%",   label: "Завершают онбординг",  sub: "из воронки" },
      { num: "₽ 1.8M",label: "MRR (целевой)",        sub: "Q2 2026" },
    ];
    const ky = 3.0, kh = 1.55;
    const kgap = 0.22;
    const kw = (SW - 1.4 - kgap * 3) / 4;
    kpis.forEach((k, i) => {
      const x = 0.7 + i * (kw + kgap);
      s.addShape("rect", {
        x, y: ky, w: kw, h: kh,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });
      s.addShape("rect", {
        x, y: ky, w: 0.08, h: kh,
        fill: { color: [C.purple, C.indigo, C.cyan, C.pink][i] },
        line: { width: 0 },
      });
      s.addText(k.num, {
        x: x + 0.25, y: ky + 0.15, w: kw - 0.4, h: 0.7,
        fontFace: F.head, fontSize: 34, bold: true,
        color: C.white, valign: "top", margin: 0,
      });
      s.addText(k.label, {
        x: x + 0.25, y: ky + 0.85, w: kw - 0.4, h: 0.35,
        fontFace: F.body, fontSize: 11,
        color: C.textMid, valign: "top", margin: 0,
      });
      s.addText(k.sub, {
        x: x + 0.25, y: ky + 1.2, w: kw - 0.4, h: 0.3,
        fontFace: F.body, fontSize: 10, bold: true,
        color: C.cyan, valign: "top", margin: 0,
      });
    });

    // Chart — user growth by month
    const cy = ky + kh + 0.35;
    const ch = SH - cy - 0.7;
    s.addShape("rect", {
      x: 0.7, y: cy, w: SW - 1.4, h: ch,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
      rectRadius: 0.12,
    });
    s.addText("Рост активных аккаунтов", {
      x: 0.95, y: cy + 0.15, w: 6, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true,
      color: C.white, valign: "top", margin: 0,
    });
    s.addText("месяц к месяцу, 2025–2026", {
      x: 0.95, y: cy + 0.5, w: 6, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.textMute,
      valign: "top", margin: 0,
    });

    s.addChart(pres.charts.BAR, [{
      name: "Accounts",
      labels: ["Окт", "Ноя", "Дек", "Янв", "Фев", "Мар", "Апр"],
      values: [18, 42, 75, 112, 160, 215, 268],
    }], {
      x: 0.95, y: cy + 0.95, w: SW - 1.9, h: ch - 1.15,
      barDir: "col",
      chartColors: [C.purple],
      chartArea: { fill: { color: C.card } },
      plotArea: { fill: { color: C.card } },
      catAxisLabelColor: C.textMid,
      catAxisLabelFontFace: F.body,
      catAxisLabelFontSize: 10,
      valAxisLabelColor: C.textMute,
      valAxisLabelFontFace: F.body,
      valAxisLabelFontSize: 9,
      valGridLine: { color: C.border, size: 0.5 },
      catGridLine: { style: "none" },
      showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: C.textMid,
      dataLabelFontFace: F.body,
      dataLabelFontSize: 10,
      showLegend: false,
      barGapWidthPct: 45,
    });

    footer(s, 9, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 10 — PRICING + PARTNER PROGRAM
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Монетизация", "Подписка + партнёрская программа", null);

    // Two pricing cards on left, partner program on right
    const py = 3.0, ph = SH - py - 0.7;

    // Basic plan
    const bx = 0.7, bw = 3.2;
    s.addShape("rect", {
      x: bx, y: py, w: bw, h: ph,
      fill: { color: C.card },
      line: { color: C.border, width: 1 },
      rectRadius: 0.15,
    });
    s.addText("БАЗОВЫЙ", {
      x: bx + 0.35, y: py + 0.35, w: bw - 0.7, h: 0.35,
      fontFace: F.body, fontSize: 11, bold: true,
      color: C.textMid, charSpacing: 3, margin: 0,
    });
    s.addText([
      { text: "4 990 ", options: { fontSize: 48, bold: true, color: C.white } },
      { text: "₽/мес", options: { fontSize: 16, color: C.textMid } },
    ], {
      x: bx + 0.35, y: py + 0.75, w: bw - 0.7, h: 1.0,
      fontFace: F.head, valign: "top", margin: 0,
    });
    s.addShape("line", {
      x: bx + 0.35, y: py + 1.85, w: bw - 0.7, h: 0,
      line: { color: C.border, width: 0.75 },
    });
    const basicFeats = [
      "1 компания + 5 конкурентов",
      "Анализ ЦА + СММ-стратегия",
      "30 постов в месяц",
      "Экспорт PDF/PPTX",
      "Мониторинг раз в 30 дней",
    ];
    basicFeats.forEach((f, i) => {
      const y = py + 2.05 + i * 0.4;
      s.addImage({ data: I.check, x: bx + 0.35, y: y + 0.05, w: 0.22, h: 0.22 });
      s.addText(f, {
        x: bx + 0.65, y, w: bw - 0.95, h: 0.32,
        fontFace: F.body, fontSize: 11, color: C.text,
        valign: "middle", margin: 0,
      });
    });

    // PRO plan
    const px = bx + bw + 0.25, pw = 3.2;
    s.addShape("rect", {
      x: px, y: py, w: pw, h: ph,
      fill: { color: C.cardHi },
      line: { color: C.purple, width: 1.5 },
      rectRadius: 0.15,
    });
    // Glow stripe top
    s.addShape("rect", {
      x: px, y: py, w: pw, h: 0.08,
      fill: { color: C.purple }, line: { width: 0 },
    });
    // "Популярный" badge
    s.addShape("roundRect", {
      x: px + pw - 1.45, y: py + 0.25, w: 1.1, h: 0.35,
      fill: { color: C.cyan, transparency: 75 },
      line: { color: C.cyan, width: 0.75 },
      rectRadius: 0.17,
    });
    s.addText("ПОПУЛЯРНЫЙ", {
      x: px + pw - 1.45, y: py + 0.25, w: 1.1, h: 0.35,
      fontFace: F.body, fontSize: 9, bold: true,
      color: C.cyan, align: "center", valign: "middle",
      charSpacing: 2, margin: 0,
    });
    s.addText("PRO", {
      x: px + 0.35, y: py + 0.35, w: pw - 0.7, h: 0.35,
      fontFace: F.body, fontSize: 11, bold: true,
      color: C.cyan, charSpacing: 3, margin: 0,
    });
    s.addText([
      { text: "9 990 ", options: { fontSize: 48, bold: true, color: C.white } },
      { text: "₽/мес", options: { fontSize: 16, color: C.textMid } },
    ], {
      x: px + 0.35, y: py + 0.75, w: pw - 0.7, h: 1.0,
      fontFace: F.head, valign: "top", margin: 0,
    });
    s.addShape("line", {
      x: px + 0.35, y: py + 1.85, w: pw - 0.7, h: 0,
      line: { color: C.purple, width: 0.75 },
    });
    const proFeats = [
      "10 компаний + 50 конкурентов",
      "Видео с HeyGen-аватаром",
      "Неограниченный контент",
      "SEO-статьи + лендинги",
      "Мониторинг еженедельно",
      "Telegram-уведомления",
      "Приоритет поддержка 24/7",
    ];
    proFeats.forEach((f, i) => {
      const y = py + 2.05 + i * 0.35;
      s.addImage({ data: I.check, x: px + 0.35, y: y + 0.04, w: 0.22, h: 0.22 });
      s.addText(f, {
        x: px + 0.65, y, w: pw - 0.95, h: 0.3,
        fontFace: F.body, fontSize: 11, color: C.text,
        valign: "middle", margin: 0,
      });
    });

    // Partner program card
    const prx = px + pw + 0.25;
    const prw = SW - prx - 0.7;
    s.addShape("rect", {
      x: prx, y: py, w: prw, h: ph,
      fill: { color: C.card },
      line: { color: C.amber, width: 1 },
      rectRadius: 0.15,
    });
    s.addImage({ data: I.hand, x: prx + 0.35, y: py + 0.35, w: 0.45, h: 0.45 });
    s.addText("ПАРТНЁРСКАЯ ПРОГРАММА", {
      x: prx + 0.95, y: py + 0.38, w: prw - 1.1, h: 0.4,
      fontFace: F.body, fontSize: 11, bold: true,
      color: C.amber, charSpacing: 3, valign: "middle", margin: 0,
    });

    // Two tiers inside
    s.addText("Реферал", {
      x: prx + 0.35, y: py + 1.05, w: prw - 0.7, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true,
      color: C.white, margin: 0,
    });
    s.addText([
      { text: "20% ", options: { fontSize: 32, bold: true, color: C.cyan } },
      { text: "с платежей", options: { fontSize: 13, color: C.textMid } },
    ], {
      x: prx + 0.35, y: py + 1.4, w: prw - 0.7, h: 0.65,
      fontFace: F.head, valign: "top", margin: 0,
    });
    s.addText("+ 10% скидка клиенту", {
      x: prx + 0.35, y: py + 2.05, w: prw - 0.7, h: 0.3,
      fontFace: F.body, fontSize: 11, color: C.textMid,
      italic: true, margin: 0,
    });

    s.addShape("line", {
      x: prx + 0.35, y: py + 2.55, w: prw - 0.7, h: 0,
      line: { color: C.border, width: 0.75 },
    });

    s.addText("Интегратор", {
      x: prx + 0.35, y: py + 2.7, w: prw - 0.7, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true,
      color: C.white, margin: 0,
    });
    s.addText([
      { text: "до 50% ", options: { fontSize: 32, bold: true, color: C.amber } },
      { text: "комиссия", options: { fontSize: 13, color: C.textMid } },
    ], {
      x: prx + 0.35, y: py + 3.05, w: prw - 0.7, h: 0.65,
      fontFace: F.head, valign: "top", margin: 0,
    });
    s.addText("Шкала 25 → 30 → 40 → 50%", {
      x: prx + 0.35, y: py + 3.7, w: prw - 0.7, h: 0.3,
      fontFace: F.body, fontSize: 11, color: C.textMid,
      italic: true, margin: 0,
    });

    footer(s, 10, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 11 — TECH STACK
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);
    drawLogo(s, 0.7, 0.55);

    sectionHeader(s, "Технология", "Современный стек. Российская инфраструктура.",
      "Next.js 16 + React 19. Proxy через Cloudflare Workers — обход гео-блоков без VPN для пользователей.");

    const groups = [
      {
        title: "Фронтенд",
        color: C.cyan,
        items: ["Next.js 16.2", "React 19", "App Router", "TypeScript"],
      },
      {
        title: "AI & ML",
        color: C.purple,
        items: ["Claude Sonnet 4.6", "GPT-4o (Vision)", "Gemini (опц.)", "HeyGen API"],
      },
      {
        title: "Данные",
        color: C.indigo,
        items: ["PostgreSQL", "HH.ru API", "DaData API", "Keys.so API"],
      },
      {
        title: "Инфраструктура",
        color: C.pink,
        items: ["Moscow VPS", "PM2 + Node.js", "Cloudflare Workers", "Telegram Bot API"],
      },
    ];

    const gy = 3.1, gh = SH - gy - 0.7;
    const gap = 0.25;
    const gw = (SW - 1.4 - gap * 3) / 4;

    groups.forEach((g, i) => {
      const x = 0.7 + i * (gw + gap);
      s.addShape("rect", {
        x, y: gy, w: gw, h: gh,
        fill: { color: C.card },
        line: { color: C.border, width: 1 },
        rectRadius: 0.12,
      });
      // Top color band
      s.addShape("rect", {
        x, y: gy, w: gw, h: 0.07,
        fill: { color: g.color }, line: { width: 0 },
      });

      s.addText(g.title, {
        x: x + 0.3, y: gy + 0.3, w: gw - 0.6, h: 0.45,
        fontFace: F.head, fontSize: 18, bold: true,
        color: C.white, valign: "top", margin: 0,
      });
      s.addShape("rect", {
        x: x + 0.3, y: gy + 0.85, w: 0.4, h: 0.04,
        fill: { color: g.color }, line: { width: 0 },
      });

      g.items.forEach((it, j) => {
        const iy = gy + 1.2 + j * 0.5;
        s.addShape("ellipse", {
          x: x + 0.3, y: iy + 0.12, w: 0.12, h: 0.12,
          fill: { color: g.color, transparency: 60 },
          line: { color: g.color, width: 0.75 },
        });
        s.addText(it, {
          x: x + 0.55, y: iy, w: gw - 0.75, h: 0.4,
          fontFace: F.body, fontSize: 12, color: C.text,
          valign: "middle", margin: 0,
        });
      });
    });

    footer(s, 11, TOTAL);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 12 — CTA
  // ══════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    paintBackground(s);

    // Big decorative glow
    s.addShape("ellipse", {
      x: SW / 2 - 4, y: SH / 2 - 4, w: 8, h: 8,
      fill: { color: C.purple, transparency: 88 },
      line: { width: 0 },
    });
    s.addShape("ellipse", {
      x: SW / 2 - 2.5, y: SH / 2 - 2.5, w: 5, h: 5,
      fill: { color: C.indigo, transparency: 92 },
      line: { width: 0 },
    });

    drawLogo(s, 0.7, 0.55);

    // Eyebrow centered
    s.addShape("ellipse", {
      x: SW / 2 - 2.3, y: 2.3, w: 0.12, h: 0.12,
      fill: { color: C.cyan }, line: { width: 0 },
    });
    s.addText("ГОТОВЫ ПОПРОБОВАТЬ?", {
      x: SW / 2 - 2.15, y: 2.18, w: 4.5, h: 0.4,
      fontFace: F.body, fontSize: 12, bold: true,
      color: C.cyan, charSpacing: 5,
      align: "left", valign: "middle", margin: 0,
    });

    // Hero title
    s.addText("Попробуйте", {
      x: 0.5, y: 2.7, w: SW - 1, h: 1.2,
      fontFace: F.head, fontSize: 84, bold: true,
      color: C.white, align: "center", valign: "top", margin: 0,
    });
    s.addText("бесплатно", {
      x: 0.5, y: 3.9, w: SW - 1, h: 1.2,
      fontFace: F.head, fontSize: 84, bold: true,
      color: C.cyan, align: "center", valign: "top", italic: true,
      margin: 0,
    });

    // Subtitle
    s.addText("7 дней полного доступа · без карты · без звонков менеджера", {
      x: 0.5, y: 5.2, w: SW - 1, h: 0.4,
      fontFace: F.body, fontSize: 15, color: C.textMid,
      align: "center", valign: "top", margin: 0,
    });

    // CTA button (shape + text)
    const btnW = 3.2, btnH = 0.75;
    const btnX = SW / 2 - btnW / 2, btnY = 5.75;
    s.addShape("roundRect", {
      x: btnX, y: btnY, w: btnW, h: btnH,
      fill: { color: C.purple },
      line: { color: C.purple, width: 0 },
      rectRadius: 0.08,
      shadow: { type: "outer", color: "7C3AED", blur: 20, offset: 0, angle: 90, opacity: 0.4 },
    });
    s.addText("marketradar.ru", {
      x: btnX, y: btnY, w: btnW - 0.5, h: btnH,
      fontFace: F.head, fontSize: 18, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });
    s.addImage({ data: I.arrow, x: btnX + btnW - 0.6, y: btnY + (btnH - 0.3) / 2, w: 0.3, h: 0.3 });

    // Contact row at bottom
    const conY = SH - 0.9;
    s.addText("hello@marketradar.ru", {
      x: 0.7, y: conY, w: 4, h: 0.4,
      fontFace: F.body, fontSize: 11,
      color: C.textMid, valign: "middle", margin: 0,
    });
    s.addText("@marketradar_bot · Telegram", {
      x: SW - 4.7, y: conY, w: 4, h: 0.4,
      fontFace: F.body, fontSize: 11,
      color: C.textMid, align: "right", valign: "middle", margin: 0,
    });
    s.addShape("line", {
      x: 0.5, y: SH - 0.5, w: SW - 1.0, h: 0,
      line: { color: C.border, width: 0.75 },
    });
    s.addText("© 2026 MarketRadar · Все права защищены", {
      x: 0.5, y: SH - 0.45, w: SW - 1, h: 0.3,
      fontFace: F.body, fontSize: 9, color: C.textMute,
      align: "center", valign: "middle", margin: 0,
    });
  }

  // Write file
  await pres.writeFile({ fileName: "MarketRadar-Pitch.pptx" });
  console.log("Wrote MarketRadar-Pitch.pptx");
})().catch(err => { console.error(err); process.exit(1); });
