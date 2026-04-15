import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Stat  { value: string; label: string }
interface Slide {
  title: string; subtitle?: string;
  type: "cover" | "bullets" | "stats" | "quote" | "two-column" | "cta";
  content?: string; bullets?: string[]; stats?: Stat[];
  quote?: string; note?: string;
  leftContent?: string; rightContent?: string;
}
interface Style {
  id?: string; name?: string; mood?: string;
  colors?: string[];   // [primary, secondary, accent, bg, text]
  fontHeader?: string; fontBody?: string;
}

// ─── Theme CSS vars ───────────────────────────────────────────────────────────
function themeVars(style?: Style): string {
  const c = style?.colors ?? [];
  const primary   = c[0] || "#1a1a2e";
  const secondary = c[1] || "#e2e8f0";
  const accent    = c[2] || "#6366f1";
  const bg        = c[3] || "#ffffff";
  const text      = c[4] || "#1a1a2e";
  const fh = style?.fontHeader || "Inter";
  const fb = style?.fontBody   || "Inter";
  return `
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --accent: ${accent};
      --bg: ${bg};
      --text: ${text};
      --font-h: '${fh}', sans-serif;
      --font-b: '${fb}', sans-serif;
    }
  `;
}

// ─── Mermaid chart ────────────────────────────────────────────────────────────
function mermaidChart(stats: Stat[]): string {
  if (!stats?.length) return "";
  const allNum = stats.every(s => !isNaN(parseFloat(s.value.replace(/[^0-9.]/g, ""))));
  if (!allNum) return "";
  const hasPct = stats.some(s => s.value.includes("%"));
  if (hasPct) {
    const rows = stats.map(s => `  "${s.label.replace(/"/g,"'")}" : ${parseFloat(s.value.replace(/[^0-9.]/g,""))||10}`).join("\n");
    return `<div class="mermaid">pie\n${rows}</div>`;
  }
  const labels = stats.map(s => `"${s.label.replace(/"/g,"'").slice(0,18)}"`).join(", ");
  const vals   = stats.map(s => parseFloat(s.value.replace(/[^0-9.]/g,""))||0).join(", ");
  return `<div class="mermaid">xychart-beta\n  x-axis [${labels}]\n  bar [${vals}]</div>`;
}

// ─── Slide HTML ───────────────────────────────────────────────────────────────
function slideHtml(slide: Slide): string {
  const bullets = (slide.bullets ?? []).filter(Boolean);

  switch (slide.type) {
    case "cover":
      return `
        <section class="slide cover">
          <div class="cover-inner">
            <div class="cover-badge">${slide.subtitle || ""}</div>
            <h1>${slide.title}</h1>
            ${slide.content ? `<p class="cover-sub">${slide.content}</p>` : ""}
          </div>
        </section>`;

    case "bullets":
      return `
        <section class="slide bullets-slide">
          <div class="slide-header">
            <h2>${slide.title}</h2>
            ${slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : ""}
          </div>
          <div class="slide-body">
            ${slide.content ? `<p class="lead">${slide.content}</p>` : ""}
            ${bullets.length ? `<ul>${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>` : ""}
          </div>
        </section>`;

    case "stats":
      return `
        <section class="slide stats-slide">
          <div class="slide-header">
            <h2>${slide.title}</h2>
            ${slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : ""}
          </div>
          <div class="slide-body stats-body">
            ${(slide.stats?.length ?? 0) > 0
              ? `<div class="stats-grid">
                   ${(slide.stats ?? []).map(s => `
                     <div class="stat-card">
                       <div class="stat-value">${s.value}</div>
                       <div class="stat-label">${s.label}</div>
                     </div>`).join("")}
                 </div>
                 ${mermaidChart(slide.stats ?? [])}`
              : slide.content ? `<p>${slide.content}</p>` : ""}
          </div>
        </section>`;

    case "quote":
      return `
        <section class="slide quote-slide">
          <div class="quote-inner">
            <div class="quote-mark">&ldquo;</div>
            <blockquote>${slide.quote || slide.content || ""}</blockquote>
            ${slide.subtitle ? `<cite>— ${slide.subtitle}</cite>` : ""}
            <p class="quote-title">${slide.title}</p>
          </div>
        </section>`;

    case "two-column":
      return `
        <section class="slide two-col-slide">
          <div class="slide-header">
            <h2>${slide.title}</h2>
            ${slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : ""}
          </div>
          <div class="two-col-body">
            <div class="col-left">
              <p>${slide.leftContent || slide.content || ""}</p>
            </div>
            <div class="col-right">
              <p>${slide.rightContent || ""}</p>
              ${bullets.length ? `<ul>${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>` : ""}
            </div>
          </div>
        </section>`;

    case "cta":
      return `
        <section class="slide cta-slide">
          <div class="cta-inner">
            <h2>${slide.title}</h2>
            ${slide.subtitle ? `<p class="cta-sub">${slide.subtitle}</p>` : ""}
            ${slide.content ? `<p class="cta-body">${slide.content}</p>` : ""}
            ${bullets.length
              ? `<div class="cta-bullets">${bullets.map(b=>`<div class="cta-bullet">${b}</div>`).join("")}</div>`
              : ""}
          </div>
        </section>`;

    default:
      return `
        <section class="slide bullets-slide">
          <div class="slide-header"><h2>${slide.title}</h2></div>
          <div class="slide-body"><p>${slide.content || ""}</p></div>
        </section>`;
  }
}

// ─── Full HTML document ───────────────────────────────────────────────────────
function buildHtml(slides: Slide[], style?: Style, title?: string): string {
  const fonts = [style?.fontHeader, style?.fontBody, "Inter"]
    .filter(Boolean)
    .map(f => f!.replace(/ /g, "+"))
    .filter((f, i, a) => a.indexOf(f) === i);
  const fontLink = `https://fonts.googleapis.com/css2?${fonts.map(f=>`family=${f}:wght@400;600;700`).join("&")}&display=swap`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title || "Presentation"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${fontLink}" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
${themeVars(style)}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: #333;
  font-family: "var(--font-b)";
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Slide base ── */
.slide {
  width: 297mm;
  height: 210mm;
  background: "var(--bg)";
  color: "var(--text)";
  position: relative;
  overflow: hidden;
  page-break-after: always;
  display: flex;
  flex-direction: column;
}

/* ── Cover ── */
.cover {
  background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, var(--accent)) 100%);
  color: #fff;
  justify-content: center;
  align-items: center;
}
.cover::after {
  content: '';
  position: absolute;
  right: -60px; bottom: -60px;
  width: 280px; height: 280px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
}
.cover::before {
  content: '';
  position: absolute;
  right: 80px; bottom: 80px;
  width: 160px; height: 160px;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
}
.cover-inner {
  text-align: center;
  padding: 48px;
  z-index: 1;
  max-width: 80%;
}
.cover-badge {
  display: inline-block;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 20px;
  padding: 4px 16px;
  font-size: 13px;
  letter-spacing: 0.05em;
  margin-bottom: 20px;
  text-transform: uppercase;
}
.cover h1 {
  font-family: "var(--font-h)";
  font-size: 48px;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 16px;
  color: #fff;
}
.cover-sub {
  font-size: 18px;
  opacity: 0.85;
  line-height: 1.5;
  max-width: 500px;
  margin: 0 auto;
}

/* ── Slide header ── */
.slide-header {
  padding: 36px 48px 20px;
  border-bottom: 2px solid var(--accent);
  flex-shrink: 0;
}
.slide-header h2 {
  font-family: "var(--font-h)";
  font-size: 28px;
  font-weight: 700;
  color: "var(--primary)";
  line-height: 1.2;
}
.subtitle {
  font-size: 14px;
  color: color-mix(in srgb, var(--text) 60%, transparent);
  margin-top: 6px;
}

/* ── Slide body ── */
.slide-body {
  padding: 24px 48px 32px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lead {
  font-size: 15px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--text) 80%, transparent);
}
ul {
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
li {
  font-size: 15px;
  line-height: 1.5;
  padding-left: 20px;
  position: relative;
}
li::before {
  content: '';
  position: absolute;
  left: 0; top: 9px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: "var(--accent)";
}

/* ── Stats ── */
.stats-body { flex-direction: row; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  width: 100%;
}
.stat-card {
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
}
.stat-value {
  font-family: "var(--font-h)";
  font-size: 32px;
  font-weight: 700;
  color: "var(--accent)";
  line-height: 1;
}
.stat-label {
  font-size: 12px;
  color: color-mix(in srgb, var(--text) 65%, transparent);
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.mermaid { width: 100%; max-height: 160px; }
svg { max-width: 100%; }

/* ── Quote ── */
.quote-slide {
  background: linear-gradient(160deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, var(--accent)) 100%);
  color: #fff;
  justify-content: center;
  align-items: center;
}
.quote-inner {
  padding: 60px 80px;
  text-align: center;
  max-width: 85%;
}
.quote-mark {
  font-size: 80px;
  line-height: 0.5;
  color: rgba(255,255,255,0.25);
  font-family: Georgia, serif;
  margin-bottom: 24px;
}
blockquote {
  font-family: "var(--font-h)";
  font-size: 24px;
  font-weight: 600;
  line-height: 1.5;
  color: #fff;
  margin-bottom: 20px;
}
cite {
  font-size: 14px;
  opacity: 0.7;
  display: block;
  margin-bottom: 8px;
}
.quote-title {
  font-size: 12px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Two-column ── */
.two-col-slide { flex-direction: column; }
.two-col-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
.col-left {
  padding: 24px 32px 32px 48px;
  border-right: 1px solid color-mix(in srgb, var(--primary) 15%, transparent);
}
.col-right {
  padding: 24px 48px 32px 32px;
  background: color-mix(in srgb, var(--primary) 4%, var(--bg));
}
.col-left p, .col-right p { font-size: 14px; line-height: 1.65; }

/* ── CTA ── */
.cta-slide {
  background: "var(--primary)";
  color: #fff;
  justify-content: center;
  align-items: center;
}
.cta-inner {
  text-align: center;
  padding: 48px 80px;
  max-width: 85%;
}
.cta-inner h2 {
  font-family: "var(--font-h)";
  font-size: 40px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 16px;
}
.cta-sub {
  font-size: 20px;
  opacity: 0.85;
  margin-bottom: 20px;
}
.cta-body {
  font-size: 15px;
  opacity: 0.75;
  line-height: 1.6;
  margin-bottom: 24px;
}
.cta-bullets {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
.cta-bullet {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 20px;
  padding: 6px 18px;
  font-size: 13px;
}

/* ── Print ── */
@media print {
  body { background: none; }
  .slide { page-break-after: always; break-after: page; }
}
</style>
</head>
<body>
${slides.map(s => slideHtml(s)).join("\n")}
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
</script>
</body>
</html>`;
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { slides, style, title } = await req.json() as {
      slides: Slide[];
      style?: Style;
      title?: string;
    };

    if (!slides?.length) {
      return NextResponse.json({ ok: false, error: "No slides" }, { status: 400 });
    }

    const html = buildHtml(slides, style, title);

    // Dynamic import so it doesn't break edge/build-time
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1122, height: 794 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for Mermaid to render diagrams
    await new Promise(r => setTimeout(r, 1500));

    const pdf = await page.pdf({
      width:  "297mm",
      height: "210mm",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(title || "presentation").replace(/[^a-z0-9]/gi, "_")}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error("export-slides-pdf error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
