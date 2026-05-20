/**
 * HTML-шаблон SWOT-отчёта для печати/PDF.
 * Строгий A4-рендер: cover page, table of contents, разделы, заключение.
 * Используется и для in-browser preview, и для server-side PDF (puppeteer).
 */

import type { SwotReport, SwotSection } from "./swot";

const escape = (s: string | null | undefined): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderParagraphs(text: string): string {
  if (!text) return "";
  return text
    .split(/\n{2,}|\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escape(p)}</p>`)
    .join("");
}

/** Defensive нормализация — старые отчёты сохранены с разной схемой
 *  (могут быть без subsections / intro / synthesis). Не падаем — рендерим
 *  что есть, недостающее проставляем дефолтами. */
function normalizeSection(s: Partial<SwotSection> | undefined, fallbackTitle: string): SwotSection {
  return {
    title: s?.title || fallbackTitle,
    intro: s?.intro || "",
    subsections: Array.isArray(s?.subsections) ? s.subsections.map(sub => ({
      title: sub?.title || "",
      paragraphs: Array.isArray(sub?.paragraphs) ? sub.paragraphs.filter(Boolean) : [],
    })) : [],
    synthesis: s?.synthesis || "",
  };
}

function renderSection(s: SwotSection, color: string): string {
  return `
    <section class="swot-section" style="--accent: ${color};">
      <h2 class="section-title">${escape(s.title)}</h2>
      ${s.intro ? renderParagraphs(s.intro) : ""}
      ${s.subsections.map(sub => `
        <h3 class="sub-title">${escape(sub.title)}</h3>
        ${sub.paragraphs.map(p => `<p>${escape(p)}</p>`).join("")}
      `).join("")}
      ${s.synthesis ? `<p class="synthesis">${escape(s.synthesis)}</p>` : ""}
    </section>
  `;
}

/** Fallback для совсем старых отчётов где сохранены ТОЛЬКО rawItems
 *  (список фраз S/W/O/T) без полной структуры. Рендерим минимальный
 *  список вместо ошибки. */
function renderRawItemsSection(title: string, items: string[] | undefined, color: string): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `
    <section class="swot-section" style="--accent: ${color};">
      <h2 class="section-title">${escape(title)}</h2>
      <ul style="margin: 16px 0; padding-left: 22px;">
        ${items.map(it => `<li style="margin: 4px 0;">${escape(it)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderTOC(report: SwotReport): string {
  const items = [
    { title: "Введение", subs: [] as string[] },
    { title: report.strengths.title, subs: (report.strengths.subsections ?? []).map(s => s.title) },
    { title: report.weaknesses.title, subs: (report.weaknesses.subsections ?? []).map(s => s.title) },
    { title: report.opportunities.title, subs: (report.opportunities.subsections ?? []).map(s => s.title) },
    { title: report.threats.title, subs: (report.threats.subsections ?? []).map(s => s.title) },
    { title: "Заключение", subs: [] as string[] },
  ];
  return `
    <ol class="toc">
      ${items.map(it => `
        <li>
          <span class="toc-chapter">${escape(it.title)}</span>
          ${it.subs.length > 0 ? `<ol class="toc-sub">${it.subs.map(s => `<li>${escape(s)}</li>`).join("")}</ol>` : ""}
        </li>
      `).join("")}
    </ol>
  `;
}

export function buildSwotReportHTML(rawReport: SwotReport): string {
  // Нормализуем разделы — старые отчёты могут не иметь полной структуры.
  // Берём из rawItems если в section.subsections пусто.
  const raw = rawReport.rawItems ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] };

  const fillFromRaw = (s: SwotSection, items: string[], defaultTitle: string): SwotSection => {
    const normalized = normalizeSection(s, defaultTitle);
    // Если subsections пусто, но в rawItems есть — создаём один блок «Основные пункты» с items как paragraphs
    if (normalized.subsections.length === 0 && Array.isArray(items) && items.length > 0) {
      normalized.subsections = [{ title: "Основные пункты", paragraphs: items }];
    }
    return normalized;
  };

  const report: SwotReport = {
    ...rawReport,
    introduction: rawReport.introduction || "",
    conclusion: rawReport.conclusion || "",
    strengths:     fillFromRaw(rawReport.strengths,     raw.strengths,     "Сильные стороны"),
    weaknesses:    fillFromRaw(rawReport.weaknesses,    raw.weaknesses,    "Слабые стороны"),
    opportunities: fillFromRaw(rawReport.opportunities, raw.opportunities, "Возможности"),
    threats:       fillFromRaw(rawReport.threats,       raw.threats,       "Угрозы"),
    rawItems: raw,
  };

  const date = new Date(report.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>SWOT — ${escape(report.companyName)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
    font-size: 12pt;
    color: #1a1a2e;
    line-height: 1.55;
    margin: 0;
    padding: 0;
  }
  /* ─── Cover ─── */
  .cover {
    page-break-after: always;
    height: calc(100vh - 44mm);
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
    padding: 60px;
    margin: -22mm -18mm;
  }
  .cover .label {
    font-size: 11pt;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #6366f1;
    font-weight: 700;
    margin-bottom: 32px;
  }
  .cover h1 {
    font-size: 56pt;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -2px;
    margin: 0 0 24px;
  }
  .cover .company {
    font-size: 24pt;
    font-weight: 600;
    color: #C4B8F5;
    margin-bottom: auto;
  }
  .cover .meta {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid rgba(255,255,255,0.18);
    padding-top: 24px;
    font-size: 11pt;
    color: rgba(255,255,255,0.75);
  }

  /* ─── TOC ─── */
  .page-toc {
    page-break-after: always;
  }
  .page-toc h2 {
    font-size: 28pt;
    font-weight: 800;
    margin: 0 0 32px;
    letter-spacing: -1px;
  }
  .toc {
    counter-reset: chapter;
    padding: 0;
    list-style: none;
  }
  .toc > li {
    counter-increment: chapter;
    padding: 14px 0;
    border-bottom: 1px solid #E5E7EB;
  }
  .toc > li::before {
    content: counter(chapter, decimal-leading-zero) ".";
    color: #6366f1;
    font-weight: 800;
    margin-right: 14px;
  }
  .toc-chapter {
    font-size: 16pt;
    font-weight: 700;
  }
  .toc-sub {
    margin: 10px 0 0 38px;
    padding: 0;
    list-style: none;
  }
  .toc-sub li {
    font-size: 11pt;
    color: #55576B;
    padding: 4px 0;
  }
  .toc-sub li::before {
    content: "›";
    color: #6366f1;
    margin-right: 8px;
  }

  /* ─── Body ─── */
  h1.report-h1 {
    font-size: 26pt;
    font-weight: 800;
    margin: 0 0 16px;
    letter-spacing: -1px;
  }
  .intro-block, .conclusion-block {
    page-break-after: always;
  }
  .intro-block p, .conclusion-block p {
    font-size: 12pt;
    margin: 0 0 14px;
    text-align: justify;
  }

  /* SWOT sections */
  .swot-section {
    page-break-inside: avoid;
    margin-bottom: 36px;
  }
  .swot-section + .swot-section {
    page-break-before: always;
    padding-top: 0;
  }
  .section-title {
    font-size: 32pt;
    font-weight: 800;
    color: var(--accent);
    margin: 0 0 8px;
    letter-spacing: -1.5px;
    text-transform: uppercase;
  }
  .swot-section::before {
    content: "";
    display: block;
    width: 64px;
    height: 6px;
    background: var(--accent);
    border-radius: 4px;
    margin-bottom: 18px;
  }
  .sub-title {
    font-size: 16pt;
    font-weight: 700;
    color: #1a1a2e;
    margin: 26px 0 10px;
  }
  .swot-section p {
    font-size: 12pt;
    margin: 0 0 12px;
    text-align: justify;
  }
  .synthesis {
    font-style: italic;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, #fff), #fff);
    border-left: 4px solid var(--accent);
    padding: 18px 22px !important;
    border-radius: 0 12px 12px 0;
    margin-top: 24px !important;
    text-align: left !important;
  }

  /* Footer (печатается на каждой странице через @page) */
  .footer {
    position: running(footer);
    font-size: 9pt;
    color: #8A8C9E;
    text-align: center;
  }
  @page {
    @bottom-center {
      content: element(footer);
    }
  }

  @media screen {
    body {
      max-width: 900px;
      margin: 24px auto;
      padding: 0 24px;
    }
    .cover {
      margin: 0 0 24px;
      border-radius: 16px;
      height: auto;
      min-height: 480px;
    }
  }
</style>
</head>
<body>

<!-- Cover -->
<section class="cover">
  <div class="label">SWOT-анализ</div>
  <h1>Стратегическая<br>оценка бизнеса</h1>
  <div class="company">${escape(report.companyName)}</div>
  <div class="meta">
    <div>Подготовлено: MarketRadar</div>
    <div>${date}</div>
  </div>
</section>

<!-- TOC -->
<section class="page-toc">
  <h2>Содержание</h2>
  ${renderTOC(report)}
</section>

<!-- Introduction -->
<section class="intro-block">
  <h1 class="report-h1">Введение</h1>
  ${renderParagraphs(report.introduction)}
</section>

<!-- 4 SWOT sections -->
${renderSection(report.strengths, "#16a34a")}
${renderSection(report.weaknesses, "#dc2626")}
${renderSection(report.opportunities, "#6366f1")}
${renderSection(report.threats, "#f59e0b")}

<!-- Conclusion -->
<section class="conclusion-block">
  <h1 class="report-h1">Заключение</h1>
  ${renderParagraphs(report.conclusion)}
</section>

<div class="footer">MarketRadar · SWOT-анализ · ${escape(report.companyName)} · ${date}</div>

</body>
</html>`;
}
