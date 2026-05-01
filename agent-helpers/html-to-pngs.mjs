#!/usr/bin/env node
// html-to-pngs.mjs — Render an HTML deck (with .slide elements) to PNG screenshots.
//
// Usage:
//   node html-to-pngs.mjs <path-to-html> <output-dir>
//
// Each .slide div gets one PNG named slide-001.png, slide-002.png, ...
// Resolution: 1920x1080.
//
// Logic adapted from frontend-slides skill's export-pdf.sh — same proven approach
// (local server for fonts, slide-by-slide visibility toggle, force .reveal animations).

import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, mkdirSync } from "fs";
import { join, extname, dirname, basename } from "path";

const HTML_PATH = process.argv[2];
const OUT_DIR = process.argv[3];

if (!HTML_PATH || !OUT_DIR) {
  console.error("Usage: node html-to-pngs.mjs <html> <out-dir>");
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
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

const slideCount = await page.evaluate(() => document.querySelectorAll(".slide").length);
if (slideCount === 0) {
  console.error("ERROR: No .slide elements found in the HTML.");
  await browser.close();
  server.close();
  process.exit(1);
}

console.log(`Found ${slideCount} slides`);
mkdirSync(OUT_DIR, { recursive: true });

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
    });
    if (window.presentation && typeof window.presentation.goToSlide === "function") {
      window.presentation.goToSlide(idx);
    }
    slides[idx]?.scrollIntoView({ behavior: "instant" });
  }, i);

  await page.waitForTimeout(400);

  // Force any .reveal animations on the active slide to be visible
  await page.evaluate(idx => {
    const current = document.querySelectorAll(".slide")[idx];
    current?.querySelectorAll(".reveal").forEach(el => {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.visibility = "visible";
    });
  }, i);

  await page.waitForTimeout(200);

  const filename = `slide-${String(i + 1).padStart(3, "0")}.png`;
  await page.screenshot({ path: join(OUT_DIR, filename), fullPage: false });
  console.log(`Captured ${i + 1}/${slideCount}`);
}

await browser.close();
server.close();
console.log(`Done — PNGs in ${OUT_DIR}`);
