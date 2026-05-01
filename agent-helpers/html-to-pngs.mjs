#!/usr/bin/env node
// html-to-pngs.mjs — Render an HTML deck into PNG screenshots + a clean PDF.
//
// Usage:
//   node html-to-pngs.mjs <path-to-html> <png-out-dir> [pdf-out-path]
//
// Each .slide div gets one PNG named slide-001.png at 1920x1080.
// If pdf-out-path is provided, also outputs a PDF (one slide per page).
//
// Critical: animations (.reveal, fadeIn, etc.) are FORCE-DISABLED before
// screenshot so we always capture the final visible state, not transparent
// mid-animation. Otherwise PPTX/PDF show half-empty slides.

import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, mkdirSync } from "fs";
import { join, extname, dirname, basename } from "path";

const HTML_PATH = process.argv[2];
const OUT_DIR = process.argv[3];
const OUT_PDF = process.argv[4] || null;

if (!HTML_PATH || !OUT_DIR) {
  console.error("Usage: node html-to-pngs.mjs <html> <png-dir> [pdf-out]");
  process.exit(1);
}

const VP_W = parseInt(process.env.VP_W || "1920", 10);
const VP_H = parseInt(process.env.VP_H || "1080", 10);

const SERVE_DIR = dirname(HTML_PATH);
const HTML_FILE = basename(HTML_PATH);

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  const path = join(SERVE_DIR, url === "/" ? HTML_FILE : url);
  try {
    const content = readFileSync(path);
    const ext = extname(path).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

const port = await new Promise(resolve => server.listen(0, () => resolve(server.address().port)));
console.log(`Local server on port ${port}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: VP_W, height: VP_H } });

// CRITICAL — kill all animations and force reveals visible BEFORE the page runs.
// addInitScript fires for every navigation, before any of the page's own scripts.
await page.addInitScript(() => {
  const css = `
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0s !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0s !important;
      animation-iteration-count: 1 !important;
    }
    .reveal, [data-animate], [data-aos], [data-reveal] {
      opacity: 1 !important;
      transform: none !important;
      visibility: visible !important;
      filter: none !important;
    }
    /* Common opacity-0 utility classes that get faded in */
    .opacity-0, .invisible { opacity: 1 !important; visibility: visible !important; }
  `;
  const inject = () => {
    const style = document.createElement("style");
    style.setAttribute("data-injected-by", "screenshot-tool");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
});

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

// Defensive second injection (in case the first got overwritten by inline styles)
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0s !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0s !important;
    }
    .reveal, [data-animate], [data-aos], [data-reveal] {
      opacity: 1 !important;
      transform: none !important;
      visibility: visible !important;
      filter: none !important;
    }
  `
});

// Force any hidden reveal-like elements visible via JS too
await page.evaluate(() => {
  document.querySelectorAll(".reveal, [data-animate], [data-aos], [data-reveal]").forEach(el => {
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.visibility = "visible";
    el.style.filter = "none";
    el.classList.add("active", "visible", "in-view");
  });
});

await page.waitForTimeout(500);

const slideCount = await page.evaluate(() => document.querySelectorAll(".slide").length);
if (slideCount === 0) {
  console.error("ERROR: No .slide elements found in the HTML.");
  await browser.close();
  server.close();
  process.exit(1);
}

console.log(`Found ${slideCount} slides`);
mkdirSync(OUT_DIR, { recursive: true });

const screenshotPaths = [];

for (let i = 0; i < slideCount; i++) {
  await page.evaluate(idx => {
    const slides = document.querySelectorAll(".slide");
    slides.forEach((s, j) => {
      const active = j === idx;
      s.style.display = active ? "" : "none";
      s.style.opacity = active ? "1" : "";
      s.style.visibility = active ? "visible" : "";
      s.style.position = active ? "relative" : "";
      s.style.transform = active ? "none" : "";
      s.classList.toggle("active", active);
      s.classList.toggle("visible", active);
      // Force every reveal-like child visible
      if (active) {
        s.querySelectorAll(".reveal, [data-animate], [data-aos], [data-reveal], .opacity-0, .invisible").forEach(el => {
          el.style.opacity = "1";
          el.style.transform = "none";
          el.style.visibility = "visible";
          el.style.filter = "none";
          el.classList.add("active", "visible", "in-view");
        });
      }
    });
    if (window.presentation && typeof window.presentation.goToSlide === "function") {
      window.presentation.goToSlide(idx);
    }
    slides[idx]?.scrollIntoView({ behavior: "instant" });
  }, i);

  await page.waitForTimeout(300);

  const filename = `slide-${String(i + 1).padStart(3, "0")}.png`;
  const fullPath = join(OUT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  screenshotPaths.push(fullPath);
  console.log(`Captured ${i + 1}/${slideCount}`);
}

// Build PDF in the same browser session by feeding PNGs to a second page
if (OUT_PDF) {
  console.log("Building PDF from screenshots...");
  const pdfPage = await browser.newPage();
  const imagesHtml = screenshotPaths.map(p => {
    const data = readFileSync(p).toString("base64");
    return `<div class="page"><img src="data:image/png;base64,${data}" /></div>`;
  }).join("\n");

  const pdfHtml = `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; }
    @page { size: ${VP_W}px ${VP_H}px; margin: 0; }
    .page {
      width: ${VP_W}px; height: ${VP_H}px;
      page-break-after: always; overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    img { width: ${VP_W}px; height: ${VP_H}px; display: block; }
  </style></head><body>${imagesHtml}</body></html>`;

  await pdfPage.setContent(pdfHtml, { waitUntil: "load" });
  await pdfPage.pdf({
    path: OUT_PDF,
    width: `${VP_W}px`,
    height: `${VP_H}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await pdfPage.close();
  console.log(`PDF saved: ${OUT_PDF}`);
}

await browser.close();
server.close();
console.log(`Done — PNGs in ${OUT_DIR}${OUT_PDF ? ", PDF at " + OUT_PDF : ""}`);
