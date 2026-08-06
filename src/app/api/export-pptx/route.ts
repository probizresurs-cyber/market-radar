import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Strip # from hex color (pptxgenjs requires no # prefix)
function hex(color: string): string {
  return color.replace(/^#/, "").toUpperCase().slice(0, 6);
}

// Lighten a hex color by mixing with white
function lighten(color: string, amount: number): string {
  const h = hex(color);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0").toUpperCase();
  return `${mix(r)}${mix(g)}${mix(b)}`;
}

// Darken a hex color
function darken(color: string, amount: number): string {
  const h = hex(color);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * (1 - amount)).toString(16).padStart(2, "0").toUpperCase();
  return `${mix(r)}${mix(g)}${mix(b)}`;
}

const makeShadow = () => ({ type: "outer" as const, blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.12 });

interface Slide {
  title: string;
  subtitle?: string;
  type: string;
  content?: string;
  bullets?: string[];
  stats?: Array<{ value: string; label: string }>;
  quote?: string;
  note?: string;
  items?: Array<{ title: string; description?: string }>;
  /** AI-иллюстрация (короткий /api/image/... или абсолютный URL). */
  imageUrl?: string;
}

interface StyleInput {
  colors?: string[]; // [primary, secondary, accent, bg, text]
  fontHeader?: string;
  fontBody?: string;
}

interface BrandBook {
  brandName?: string;
  tagline?: string;
  colors?: string[];
  fontHeader?: string;
  fontBody?: string;
  logoDataUrl?: string;
}

export async function POST(req: Request) {
  // Auth: без него анонимный пользователь гоняет pptxgenjs без лимита.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const slides: Slide[] = body.slides ?? [];
    // Клиент шлёт presTitle; body.title — легаси-фолбэк. Раньше роут читал
    // только body.title, и каждый экспорт назывался «Презентация».
    const presTitle: string = body.presTitle ?? body.title ?? "Презентация";
    const brandBook: BrandBook = body.brandBook ?? {};
    const style: StyleInput = body.style ?? {};

    // Цвета/шрифты: приоритет — выбранный пользователем стиль презентации,
    // фолбэк — брендбук. Раньше style игнорировался и PPTX всегда выходил
    // в сырых цветах брендбука (или в дефолтных indigo/green).
    const styleColors = Array.isArray(style.colors) ? style.colors : [];
    const primary = hex(styleColors[0] || brandBook.colors?.[0] || "#6366f1");
    const secondary = hex(styleColors[1] || brandBook.colors?.[1] || "#10b981");
    const darkPrimary = darken(primary, 0.3);
    const lightPrimary = lighten(primary, 0.88);
    const headerFont = style.fontHeader || brandBook.fontHeader || "Calibri";
    const bodyFont = style.fontBody || brandBook.fontBody || "Calibri";

    // Лого готовим один раз: большое — на тёмных слайдах (cover/cta/last),
    // маленькая марка в верхнем правом углу — на всех остальных.
    let logoData: string | null = null;
    if (brandBook.logoDataUrl && brandBook.logoDataUrl.includes("base64,")) {
      const b64 = brandBook.logoDataUrl.split("base64,")[1];
      const ext = brandBook.logoDataUrl.includes("png") ? "png" : "jpg";
      logoData = `image/${ext};base64,${b64}`;
    }

    // AI-иллюстрации слайдов: pptxgenjs в Node принимает только base64-data,
    // поэтому короткие /api/image/... скачиваем заранее с этого же сервера.
    const origin = new URL(req.url).origin;
    const slideBg: Array<string | null> = await Promise.all(slides.map(async (sl) => {
      if (!sl.imageUrl) return null;
      const abs = sl.imageUrl.startsWith("/") ? origin + sl.imageUrl : sl.imageUrl;
      if (!/^https?:\/\//i.test(abs)) return null;
      try {
        const r = await fetch(abs);
        if (!r.ok) return null;
        const mime = r.headers.get("content-type") || "image/png";
        if (!mime.startsWith("image/")) return null;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 8_000_000) return null; // не раздуваем pptx
        return `${mime};base64,${buf.toString("base64")}`;
      } catch { return null; }
    }));

    // Dynamic import (server-side only)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pptxgen = require("pptxgenjs");
    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9"; // 10" x 5.625"
    pres.title = presTitle;
    pres.author = "MarketRadar";

    for (const [i, slide] of slides.entries()) {
      const s = pres.addSlide();
      const isCover = slide.type === "cover" || i === 0;
      const isCTA = slide.type === "cta";
      const isLast = i === slides.length - 1;

      if (isCover || isCTA || isLast) {
        // ── DARK SLIDE (cover / cta / last) ──────────────────────────────
        // С иллюстрацией: картинка фоном + полупрозрачная фирменная подложка,
        // чтобы белый текст оставался читабельным.
        const bgData = slideBg[i];
        if (bgData) {
          try { s.background = { data: bgData }; } catch { s.background = { color: darkPrimary }; }
          s.addShape(pres.shapes.RECTANGLE, {
            x: 0, y: 0, w: 10, h: 5.625,
            fill: { color: darkPrimary, transparency: 18 },
            line: { color: darkPrimary, transparency: 18 },
          });
        } else {
          s.background = { color: darkPrimary };
        }

        // Decorative circles (top-right, bottom-left)
        s.addShape(pres.shapes.OVAL, {
          x: 7.5, y: -1.2, w: 4, h: 4,
          fill: { color: primary, transparency: 55 }, line: { color: primary, transparency: 55 },
        });
        s.addShape(pres.shapes.OVAL, {
          x: -1.2, y: 3.2, w: 3.5, h: 3.5,
          fill: { color: secondary, transparency: 65 }, line: { color: secondary, transparency: 65 },
        });

        // Logo (if provided and valid base64)
        if (logoData) {
          try {
            s.addImage({ data: logoData, x: 0.5, y: 0.4, w: 0.9, h: 0.9 });
          } catch { /* ignore */ }
        }

        if (isCover) {
          s.addText(slide.title, {
            x: 0.8, y: 1.5, w: 8.4, h: 1.6,
            fontSize: 42, fontFace: headerFont, bold: true,
            color: "FFFFFF", align: "center", valign: "middle",
          });
          if (slide.subtitle) {
            s.addText(slide.subtitle, {
              x: 1, y: 3.2, w: 8, h: 0.7,
              fontSize: 18, fontFace: bodyFont, color: "FFFFFFCC",
              align: "center", transparency: 20,
            });
          }
          if (slide.content) {
            s.addText(slide.content, {
              x: 1.5, y: 4.0, w: 7, h: 0.9,
              fontSize: 14, fontFace: bodyFont, color: "FFFFFFAA",
              align: "center",
            });
          }
        } else {
          // CTA / last slide
          s.addText(slide.title, {
            x: 0.8, y: 1.8, w: 8.4, h: 1.2,
            fontSize: 36, fontFace: headerFont, bold: true,
            color: "FFFFFF", align: "center",
          });
          if (slide.content) {
            s.addText(slide.content, {
              x: 1.5, y: 3.1, w: 7, h: 0.8,
              fontSize: 16, fontFace: bodyFont, color: "FFFFFFCC", align: "center",
            });
          }
          // CTA button-like element
          if (slide.subtitle) {
            s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
              x: 3.5, y: 4.0, w: 3, h: 0.7,
              fill: { color: secondary }, line: { color: secondary },
              rectRadius: 0.1,
            });
            s.addText(slide.subtitle, {
              x: 3.5, y: 4.0, w: 3, h: 0.7,
              fontSize: 14, fontFace: bodyFont, bold: true,
              color: "FFFFFF", align: "center", valign: "middle",
            });
          }
        }

      } else if ((slide.stats ?? []).length > 0) {
        // ── STATS SLIDE ────────────────────────────────────────────────────
        s.background = { color: "FAFAFA" };

        // Title bar
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0, y: 0, w: 10, h: 1.1,
          fill: { color: darkPrimary }, line: { color: darkPrimary },
        });
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0, y: 1.05, w: 10, h: 0.08,
          fill: { color: secondary }, line: { color: secondary },
        });
        s.addText(slide.title, {
          x: 0.5, y: 0, w: 9, h: 1.1, margin: 0,
          fontSize: 26, fontFace: headerFont, bold: true,
          color: "FFFFFF", valign: "middle",
        });

        const stats = slide.stats ?? [];
        const cols = Math.min(stats.length, 4);
        const cardW = (9.0) / cols;
        const cardX = 0.5;
        const cardY = 1.45;

        stats.slice(0, 4).forEach((stat, si) => {
          const cx = cardX + si * cardW;
          // Card bg
          s.addShape(pres.shapes.RECTANGLE, {
            x: cx, y: cardY, w: cardW - 0.2, h: 2.8,
            fill: { color: "FFFFFF" }, line: { color: "E2E8F0" },
            shadow: makeShadow(),
          });
          // Top accent
          s.addShape(pres.shapes.RECTANGLE, {
            x: cx, y: cardY, w: cardW - 0.2, h: 0.12,
            fill: { color: si % 2 === 0 ? primary : secondary },
            line: { color: si % 2 === 0 ? primary : secondary },
          });
          // Big number
          s.addText(stat.value, {
            x: cx, y: cardY + 0.5, w: cardW - 0.2, h: 1.4,
            fontSize: 44, fontFace: headerFont, bold: true,
            color: si % 2 === 0 ? primary : secondary,
            align: "center", valign: "middle",
          });
          // Label
          s.addText(stat.label, {
            x: cx, y: cardY + 1.9, w: cardW - 0.2, h: 0.7,
            fontSize: 13, fontFace: bodyFont,
            color: "64748B", align: "center",
          });
        });

        if (slide.content) {
          s.addText(slide.content, {
            x: 0.5, y: 4.5, w: 9, h: 0.7,
            fontSize: 13, fontFace: bodyFont,
            color: "64748B", align: "center",
          });
        }

      } else if (slide.quote) {
        // ── QUOTE SLIDE ────────────────────────────────────────────────────
        s.background = { color: lightPrimary };

        // Large decorative quote mark
        s.addText("\u201C", {
          x: 0.3, y: 0.2, w: 2, h: 1.8,
          fontSize: 120, fontFace: headerFont,
          color: primary, transparency: 70,
        });

        s.addText(slide.title, {
          x: 0.5, y: 0.3, w: 9, h: 0.8,
          fontSize: 20, fontFace: headerFont, bold: true, color: darkPrimary,
        });

        s.addShape(pres.shapes.RECTANGLE, {
          x: 0.5, y: 1.2, w: 0.1, h: 2.6,
          fill: { color: primary }, line: { color: primary },
        });

        s.addText(slide.quote, {
          x: 0.8, y: 1.3, w: 8.4, h: 2.4,
          fontSize: 20, fontFace: bodyFont, italic: true,
          color: "1E293B", valign: "middle", lineSpacingMultiple: 1.3,
        });

        if (slide.content) {
          s.addText(`— ${slide.content}`, {
            x: 0.8, y: 3.9, w: 8, h: 0.5,
            fontSize: 13, fontFace: bodyFont, bold: true, color: primary,
          });
        }

      } else if (slide.type === "grid" && (slide.items ?? []).length > 0) {
        // ── GRID SLIDE (карточки услуг/преимуществ) ────────────────────────
        // Раньше grid-слайды падали в bullets-ветку и items терялись целиком.
        s.background = { color: "FFFFFF" };

        s.addShape(pres.shapes.RECTANGLE, {
          x: 0, y: 0, w: 0.15, h: 5.625,
          fill: { color: primary }, line: { color: primary },
        });
        s.addText(slide.title, {
          x: 0.4, y: 0.35, w: 9.2, h: 0.8,
          fontSize: 26, fontFace: headerFont, bold: true, color: darkPrimary,
        });
        if (slide.subtitle) {
          s.addText(slide.subtitle, {
            x: 0.4, y: 1.1, w: 9.2, h: 0.4,
            fontSize: 13, fontFace: bodyFont, color: "64748B",
          });
        }

        const items = (slide.items ?? []).slice(0, 6);
        const cols = items.length <= 4 ? 2 : 3;
        const rows = Math.ceil(items.length / cols);
        const areaX = 0.5, areaY = slide.subtitle ? 1.6 : 1.35, areaW = 9.0;
        const areaH = 5.1 - areaY;
        const gap = 0.25;
        const cw = (areaW - gap * (cols - 1)) / cols;
        const ch = (areaH - gap * (rows - 1)) / rows;

        items.forEach((it, ii) => {
          const cx = areaX + (ii % cols) * (cw + gap);
          const cy = areaY + Math.floor(ii / cols) * (ch + gap);
          s.addShape(pres.shapes.RECTANGLE, {
            x: cx, y: cy, w: cw, h: ch,
            fill: { color: "F8FAFC" }, line: { color: "E2E8F0" },
            shadow: makeShadow(),
          });
          s.addShape(pres.shapes.RECTANGLE, {
            x: cx, y: cy, w: 0.06, h: ch,
            fill: { color: ii % 2 === 0 ? primary : secondary },
            line: { color: ii % 2 === 0 ? primary : secondary },
          });
          s.addText(it.title, {
            x: cx + 0.18, y: cy + 0.1, w: cw - 0.32, h: 0.5,
            fontSize: 14, fontFace: headerFont, bold: true, color: darkPrimary,
          });
          if (it.description) {
            s.addText(it.description, {
              x: cx + 0.18, y: cy + 0.58, w: cw - 0.32, h: Math.max(0.4, ch - 0.72),
              fontSize: 10.5, fontFace: bodyFont, color: "475569", lineSpacingMultiple: 1.15,
            });
          }
        });

      } else if (slide.type === "two-column" && (slide.bullets ?? []).length > 0) {
        // ── TWO-COLUMN SLIDE ───────────────────────────────────────────────
        s.background = { color: "FFFFFF" };

        // Left accent bar + title
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0, y: 0, w: 0.15, h: 5.625,
          fill: { color: primary }, line: { color: primary },
        });
        s.addText(slide.title, {
          x: 0.4, y: 0.35, w: 9.2, h: 0.8,
          fontSize: 26, fontFace: headerFont, bold: true, color: darkPrimary,
        });
        if (slide.subtitle) {
          s.addText(slide.subtitle, {
            x: 0.4, y: 1.1, w: 9.2, h: 0.4,
            fontSize: 13, fontFace: bodyFont, color: "64748B",
          });
        }

        const half = Math.ceil((slide.bullets ?? []).length / 2);
        const col1 = (slide.bullets ?? []).slice(0, half);
        const col2 = (slide.bullets ?? []).slice(half);

        [col1, col2].forEach((colBullets, ci) => {
          const cx = ci === 0 ? 0.4 : 5.3;
          s.addShape(pres.shapes.RECTANGLE, {
            x: cx, y: 1.6, w: 4.5, h: col1.length * 0.65 + 0.3,
            fill: { color: ci === 0 ? lightPrimary : "F8FAFC" },
            line: { color: ci === 0 ? lighten(primary, 0.6) : "E2E8F0" },
            shadow: makeShadow(),
          });
          s.addText(colBullets.map((b, bi) => ({
            text: b,
            options: { bullet: true, breakLine: bi < colBullets.length - 1, color: "1E293B", fontSize: 14, fontFace: bodyFont, paraSpaceAfter: 6 },
          })), {
            x: cx + 0.15, y: 1.75, w: 4.2, h: col1.length * 0.65,
          });
        });

      } else {
        // ── STANDARD BULLETS SLIDE ─────────────────────────────────────────
        s.background = { color: "FFFFFF" };

        // Left accent bar (full height)
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0, y: 0, w: 0.15, h: 5.625,
          fill: { color: primary }, line: { color: primary },
        });

        // Header band
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0.15, y: 0, w: 9.85, h: 1.1,
          fill: { color: "FAFAFA" }, line: { color: "F1F5F9" },
        });
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0.15, y: 1.05, w: 9.85, h: 0.06,
          fill: { color: secondary }, line: { color: secondary },
        });

        // Slide number dot
        s.addShape(pres.shapes.OVAL, {
          x: 0.35, y: 0.25, w: 0.55, h: 0.55,
          fill: { color: primary }, line: { color: primary },
        });
        s.addText(String(i + 1), {
          x: 0.35, y: 0.25, w: 0.55, h: 0.55, margin: 0,
          fontSize: 11, fontFace: bodyFont, bold: true, color: "FFFFFF",
          align: "center", valign: "middle",
        });

        s.addText(slide.title, {
          x: 1.05, y: 0.12, w: 8.5, h: 0.85, margin: 0,
          fontSize: 24, fontFace: headerFont, bold: true, color: darkPrimary,
          valign: "middle",
        });
        if (slide.subtitle) {
          s.addText(slide.subtitle, {
            x: 1.05, y: 0.88, w: 8, h: 0.28,
            fontSize: 11, fontFace: bodyFont, color: "94A3B8",
          });
        }

        let contentY = 1.35;

        if (slide.content) {
          s.addText(slide.content, {
            x: 0.5, y: contentY, w: 9.2, h: 0.65,
            fontSize: 14, fontFace: bodyFont, color: "475569", lineSpacingMultiple: 1.2,
          });
          contentY += 0.8;
        }

        if ((slide.bullets ?? []).length > 0) {
          const bullets = slide.bullets ?? [];
          const bulletItems = bullets.map((b, bi) => ({
            text: b,
            options: {
              bullet: true,
              breakLine: bi < bullets.length - 1,
              color: "1E293B",
              fontSize: 14,
              fontFace: bodyFont,
              paraSpaceAfter: 4,
            },
          }));

          const bulletH = Math.min(bullets.length * 0.55 + 0.3, 3.9 - contentY + 1.35);

          // Subtle card behind bullets
          s.addShape(pres.shapes.RECTANGLE, {
            x: 0.4, y: contentY, w: 9.2, h: bulletH,
            fill: { color: "F8FAFC" }, line: { color: "E2E8F0" },
            shadow: makeShadow(),
          });
          // Left micro-accent
          s.addShape(pres.shapes.RECTANGLE, {
            x: 0.4, y: contentY, w: 0.06, h: bulletH,
            fill: { color: secondary }, line: { color: secondary },
          });

          s.addText(bulletItems, {
            x: 0.6, y: contentY + 0.12, w: 8.9, h: bulletH - 0.2,
          });
        }
      }

      // Маленькая марка лого в верхнем правом углу светлых слайдов
      // (на тёмных cover/cta/last уже стоит большое лого).
      if (logoData && !(isCover || isCTA || isLast)) {
        try {
          s.addImage({ data: logoData, x: 9.35, y: 0.18, w: 0.45, h: 0.45 });
        } catch { /* ignore */ }
      }

      // Footer on all non-cover slides
      if (!isCover) {
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0, y: 5.3, w: 10, h: 0.325,
          fill: { color: "F1F5F9" }, line: { color: "F1F5F9" },
        });
        s.addText(presTitle, {
          x: 0.4, y: 5.3, w: 8, h: 0.32, margin: 0,
          fontSize: 9, fontFace: bodyFont, color: "94A3B8", valign: "middle",
        });
        s.addText(`${i + 1} / ${slides.length}`, {
          x: 8.5, y: 5.3, w: 1.1, h: 0.32, margin: 0,
          fontSize: 9, fontFace: bodyFont, color: "94A3B8", valign: "middle", align: "right",
        });
      }
    }

    // Write to buffer and stream back
    const buf = await pres.write({ outputType: "nodebuffer" }) as Buffer;

    return new Response(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(presTitle)}.pptx"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
