import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as cheerio from "cheerio";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";
import { scrapeForRebuild, type RebuildScrape } from "@/lib/rebuild-scrape";
import { rebuildAssetsRoot } from "@/lib/asset-localizer";
import fs from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { query, initDb } from "@/lib/db";

// Пересборка сайта в Astro С СОХРАНЕНИЕМ ДИЗАЙНА 1:1.
// НЕ пересоздаём дизайн через AI — берём оригинальную вёрстку (весь HTML/CSS,
// картинки, видео) как есть и хирургически правим только «внутряк»: absolutize
// ссылок на ассеты (чтобы всё грузилось), meta description, H1, alt, Schema.org,
// canonical, viewport. AI нужен по минимуму — только текст meta и Schema.
//
// Публичный инструмент (без логина — сама страница /astro-rebuild и эта
// пересборка отдаются по прямой ссылке), поэтому вместо checkAiAccess здесь
// свой IP-лимит: раньше публичный доступ к AI-роутам без rate-limit'а уже
// разорял бюджет через ротирующиеся прокси (см. историю checkAiAccess) —
// здесь цена вызова минимальна (только SEO-текст, не весь сайт), но лимит
// всё равно нужен как страховка от спама.
export const runtime = "nodejs";
export const maxDuration = 180;

function logAi(opts: { endpoint: string; model: string; userId: string | null; success: boolean; durationMs?: number; errorMessage?: string }) {
  query(
    `INSERT INTO ai_logs (id, user_id, endpoint, model, duration_ms, success, error_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [randomUUID(), opts.userId, opts.endpoint, opts.model, opts.durationMs ?? null, opts.success, opts.errorMessage?.slice(0, 200) ?? null],
  ).catch(() => { /* никогда не роняем основной поток из-за лога */ });
}

export const MODEL = "claude-sonnet-4-6";

export interface AstroFile {
  path: string;
  content: string;
}

export interface OptIssue {
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
  /** true — исправлено оптимизацией; false — найдено/рекомендация. */
  fixed: boolean;
  /** Машинный ключ проблемы — по нему этап оптимизации помечает fixed. */
  key?: string;
}

export interface OptimizationReport {
  stats: {
    htmlKb: number;
    externalScripts: number;
    externalCss: number;
    images: number;
    lazyImages: number;
  };
  issues: OptIssue[];
  applied: string[];
}

// Метрики Lighthouse (Google PageSpeed API) — для замера «было → стало».
export interface SpeedMetrics {
  performance: number | null; // 0-100
  fcpMs: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  bytes: number | null;
  error?: string;
}

export interface SpeedCompare {
  original: SpeedMetrics;
  rebuilt: SpeedMetrics;
  measuredAt: string;
  strategy: "mobile";
}

export interface RebuildAstroResult {
  ok: true;
  id: string;
  previewUrl: string;
  source: { url: string; title: string; issues: string[] };
  files: AstroFile[];
  fixes: string[];
  optimization: OptimizationReport;
  /** null — оптимизация (отдельная услуга) ещё не применялась. */
  optimizedAt: string | null;
  /** Замер скорости обеих версий — появляется после кнопки «Замерить». */
  speedCompare?: SpeedCompare | null;
  summary: string;
  modelUsed: string;
}

function detectIssues(s: RebuildScrape): string[] {
  const issues: string[] = [];
  if (!s.metaDescription?.trim()) issues.push("Отсутствует meta description");
  if (s.h1.length === 0) issues.push("Нет ни одного H1 на странице");
  else if (s.h1.length > 1) issues.push(`H1 несколько (${s.h1.length}) — должен быть один смысловой`);
  if (s.imageCount > 0 && s.imagesWithAlt < s.imageCount)
    issues.push(`alt заполнен у ${s.imagesWithAlt} из ${s.imageCount} изображений`);
  if (!s.hasSchemaMarkup) issues.push("Нет разметки Schema.org (structured data)");
  if (!s.hasCanonical) issues.push("Нет canonical-ссылки");
  if (!s.hasViewport) issues.push("Нет viewport meta (не адаптивен под мобильные)");
  if (!s.hasSitemap) issues.push("Нет sitemap.xml");
  if (!s.hasRobotsTxt) issues.push("Нет robots.txt");
  if (!s.isHttps) issues.push("Сайт не на HTTPS");
  return issues;
}

// ─── AI: только SEO-текст (meta description + Schema.org), не дизайн ──────────
async function generateSeoMeta(s: RebuildScrape): Promise<{
  metaDescription: string; schema: unknown; modelUsed: string;
}> {
  const system = `${ANTI_HALLUCINATION_SHORT}

Ты — SEO-специалист. По данным страницы верни JSON:
{
  "metaDescription": "160-символьное описание на русском, из реального контента, без выдумок",
  "schema": { … валидный объект Schema.org JSON-LD (@context/@type), тип по смыслу: Organization/LocalBusiness/Article — только реальные данные, без выдуманных телефонов/адресов/цен … }
}
Только JSON, без обёрток.`;
  const user = [
    `Сайт: ${s.url}`,
    `Title: ${s.title}`,
    s.h1.length ? `H1: ${s.h1.join(" | ")}` : "",
    s.h2.length ? `H2: ${s.h2.slice(0, 10).join(" | ")}` : "",
    Object.keys(s.socialLinks).length ? `Соцсети: ${Object.values(s.socialLinks).join(", ")}` : "",
    `Текст: ${s.textContent.slice(0, 2500)}`,
  ].filter(Boolean).join("\n");

  const { text, modelUsed } = await safeAnthropicCreate({
    model: MODEL, max_tokens: 1500, system,
    messages: [{ role: "user", content: user }], temperature: 0.3,
  });
  const parsed = extractJson<{ metaDescription?: string; schema?: unknown }>(text) ?? {};
  return {
    metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription : "",
    schema: parsed.schema ?? null,
    modelUsed,
  };
}

// ─── DOM-хирургия: сохраняем дизайн, правим только внутряк ────────────────────
function absUrl(raw: string | undefined, base: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s.startsWith("data:") || s.startsWith("#") || s.startsWith("mailto:") ||
      s.startsWith("tel:") || s.startsWith("javascript:")) return null;
  try { return new URL(s, base).href; } catch { return null; }
}

function absolutizeSrcset(val: string, base: string): string {
  return val.split(",").map((part) => {
    const seg = part.trim();
    const sp = seg.indexOf(" ");
    const u = sp === -1 ? seg : seg.slice(0, sp);
    const rest = sp === -1 ? "" : seg.slice(sp);
    const abs = absUrl(u, base);
    return (abs ?? u) + rest;
  }).join(", ");
}

function humanizeAlt(src: string, fallback: string): string {
  try {
    const file = decodeURIComponent(new URL(src).pathname.split("/").pop() || "");
    const name = file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    return name.length >= 3 ? name : fallback;
  } catch { return fallback; }
}

// ─── Диагностика производительности (БЕЗ правок) ─────────────────────────────
// Запускается на этапе переноса и честно перечисляет, что тормозит страницу.
// Сами правки — отдельная услуга «Оптимизация» (/api/rebuild-astro/optimize):
// она флипает fixed=true по ключам key и дополняет отчёт реальными цифрами.
export function detectPerf(html: string, origin: string, techStack: string[]): OptimizationReport {
  const $ = cheerio.load(html);
  const issues: OptIssue[] = [];

  const htmlKb = Math.round(html.length / 1024);
  const extScripts = $("script[src]").length;
  const extCss = $('link[rel="stylesheet"]').length;
  const imgs = $("img").length;
  const lazyImgs = $('img[loading="lazy"]').length;
  // Фоновые блоки конструктора (материализованы при переносе → грузятся разом)
  const bgBlocks = $("[data-original]").not("img").length;

  // Сколько ассетов уезжает на чужие домены
  let foreign = 0;
  $('img[src], link[rel="stylesheet"][href]').each((_, el) => {
    const u = $(el).attr("src") || $(el).attr("href") || "";
    try { if (u.startsWith("http") && new URL(u).origin !== origin) foreign++; } catch { /* ignore */ }
  });

  // — Исправимо оптимизацией (key → флипается в fixed) —
  if (imgs - lazyImgs > 2) {
    issues.push({
      key: "img-lazy", severity: "warn",
      title: `${imgs - lazyImgs} изображений грузятся сразу, без ленивой загрузки`,
      detail: "Браузер качает все фото при открытии страницы, замедляя первую отрисовку. Оптимизация переведёт картинки ниже первого экрана на загрузку по прокрутке.",
      fixed: false,
    });
  }
  if (bgBlocks > 4) {
    issues.push({
      key: "bg-lazy", severity: "critical",
      title: `${bgBlocks} фоновых изображений загружаются все разом`,
      detail: "После переноса фоны прописаны в вёрстке напрямую — браузер скачивает их все при открытии, это главный тормоз первой загрузки. Оптимизация вернёт ленивую подгрузку по прокрутке (без изменения вида).",
      fixed: false,
    });
  }
  if (bgBlocks > 0 || $("img[data-original]").length > 0) {
    issues.push({
      key: "double-load", severity: "warn",
      title: "Двойная загрузка картинок скриптом конструктора",
      detail: "Скрипт конструктора видит свои lazy-атрибуты (data-original) и качает те же картинки второй раз со своего CDN. Оптимизация уберёт атрибуты — каждая картинка скачается один раз.",
      fixed: false,
    });
  }
  if (foreign > 0) {
    issues.push({
      key: "cdn", severity: "warn",
      title: `Ассеты грузятся с домена конструктора (${foreign}+ файлов)`,
      detail: "Картинки, стили и шрифты приходят с чужого CDN — без контроля кэша и с реферер-блокировками (403 на шрифтах). Оптимизация перенесёт их в проект.",
      fixed: false,
    });
  }
  if (imgs + bgBlocks > 0) {
    issues.push({
      key: "webp", severity: "warn",
      title: "Изображения без современного сжатия",
      detail: "JPEG/PNG лежат как есть — обычно в 2-4 раза тяжелее необходимого. Оптимизация сожмёт их в WebP с ресайзом до 1920px.",
      fixed: false,
    });
  }
  if (!$('link[rel="preconnect"]').length) {
    issues.push({
      key: "preconnect", severity: "info",
      title: "Нет preconnect к внешним доменам",
      detail: "Браузер поздно узнаёт о доменах, откуда пойдут скрипты и стили. Оптимизация добавит preconnect к самым нагруженным.",
      fixed: false,
    });
  }

  // — Не чиним автоматически: честные рекомендации —
  if (htmlKb > 500) {
    issues.push({
      severity: "critical",
      title: `HTML-документ весит ${htmlKb} КБ`,
      detail: "Это очень много для одной страницы (норма — до 100-200 КБ). Причина — конструктор кладёт всю вёрстку и стили инлайн. Радикально лечится только чистой пересборкой вёрстки (ручная доработка).",
      fixed: false,
    });
  } else if (htmlKb > 200) {
    issues.push({
      severity: "warn",
      title: `HTML-документ весит ${htmlKb} КБ`,
      detail: "Больше рекомендованных 200 КБ — сказывается на скорости первой загрузки, особенно на мобильных.",
      fixed: false,
    });
  }
  if (extScripts > 20) {
    issues.push({
      severity: "warn",
      title: `${extScripts} внешних скриптов`,
      detail: "Каждый скрипт — отдельное соединение и время исполнения; это главный потолок Lighthouse-балла. Автоматически удалять их небезопасно (сломаются слайдеры/формы конструктора) — сокращение возможно при ручной доработке.",
      fixed: false,
    });
  }
  if (techStack.includes("jQuery")) {
    issues.push({
      severity: "info",
      title: "Используется jQuery",
      detail: "Устаревшая библиотека (~90 КБ). Оставлена, потому что на ней держатся скрипты исходного сайта; при чистой пересборке от неё можно отказаться.",
      fixed: false,
    });
  }
  if (extCss > 8) {
    issues.push({
      severity: "info",
      title: `${extCss} внешних CSS-файлов`,
      detail: "Много отдельных файлов стилей — каждый блокирует отрисовку. При ручной доработке их можно объединить.",
      fixed: false,
    });
  }

  return {
    stats: { htmlKb, externalScripts: extScripts, externalCss: extCss, images: imgs, lazyImages: lazyImgs },
    issues,
    applied: [],
  };
}

// Возвращает исправленный полный HTML + список реально применённых правок.
function surgicalFix(rawHtml: string, s: RebuildScrape, seo: { metaDescription: string; schema: unknown }): {
  html: string; fixes: string[];
} {
  const $ = cheerio.load(rawHtml);
  const base = s.url;
  const fixes: string[] = [];

  // 1) Absolutize всех ссылок на ассеты — чтобы CSS/картинки/видео грузились
  //    из оригинального домена и дизайн отображался 1:1.
  const attrMap: Array<[string, string]> = [
    ["link[href]", "href"], ["script[src]", "src"], ["img[src]", "src"],
    ["img[data-src]", "data-src"], ["source[src]", "src"], ["video[src]", "src"],
    ["video[poster]", "poster"], ["audio[src]", "src"], ["object[data]", "data"],
    ["use[href]", "href"], ["embed[src]", "src"], ["iframe[src]", "src"],
  ];
  for (const [sel, attr] of attrMap) {
    $(sel).each((_, el) => {
      const abs = absUrl($(el).attr(attr), base);
      if (abs) $(el).attr(attr, abs);
    });
  }
  // srcset (img, source)
  $("img[srcset], source[srcset]").each((_, el) => {
    const v = $(el).attr("srcset");
    if (v) $(el).attr("srcset", absolutizeSrcset(v, base));
  });
  // relative <a href> → absolute (чтобы ссылки вели на оригинал, а не в никуда)
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const abs = absUrl(href, base);
    if (abs) $(el).attr("href", abs);
  });
  // background-image: url(...) в inline style
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    if (/url\(/i.test(style)) {
      const fixed = style.replace(/url\((['"]?)([^'")]+)\1\)/gi, (m, q, u) => {
        const abs = absUrl(u, base);
        return abs ? `url(${q}${abs}${q})` : m;
      });
      $(el).attr("style", fixed);
    }
  });
  fixes.push("Все ссылки на CSS, картинки и видео сделаны абсолютными — дизайн грузится 1:1");

  // 1b) Материализуем ленивую загрузку (Tilda и др.): реальные картинки лежат
  //     в data-original/data-src и подставляются JS при скролле. В статике JS
  //     не срабатывает → пусто. Проставляем их сразу: <img> → src, блоки-фоны
  //     (t-bgimg и пр.) → inline background-image. Так картинки видны без JS.
  let lazyMaterialized = 0;
  $("[data-original], [data-src], [data-lazy-src]").each((_, el) => {
    const $el = $(el);
    const rawSrc = $el.attr("data-original") || $el.attr("data-src") || $el.attr("data-lazy-src");
    const abs = absUrl(rawSrc, base);
    if (!abs) return;
    const tag = (el as unknown as { tagName?: string; name?: string }).tagName
      || (el as unknown as { name?: string }).name || "";
    if (tag.toLowerCase() === "img") {
      $el.attr("src", abs);
    } else {
      // Блок-фон (Tilda t-bgimg и аналоги): ставим ТОЛЬКО background-image
      // инлайн. Раньше сюда же дописывались background-size/position/repeat —
      // но внутри одного style-атрибута позже объявленное свойство побеждает,
      // а Tilda нередко задаёт свой inline background-position (фокус кропа
      // конкретного фото, например для мобильной версии) ДО data-original —
      // наш cover/center его перетирал и портил кадрирование. size/position
      // и так приходят из внешней Tilda-вёрстки (класс t-bgimg), которую мы
      // не трогаем — доверяем ей.
      const prev = $el.attr("style") ?? "";
      const bg = `background-image:url('${abs}');`;
      $el.attr("style", prev ? `${prev.replace(/;?\s*$/, ";")}${bg}` : bg);
    }
    lazyMaterialized++;
  });
  if (lazyMaterialized > 0) fixes.push(`Материализована ленивая загрузка ${lazyMaterialized} изображений/фонов (видны без JS)`);

  const head = $("head");

  // 2) charset + viewport
  if (!head.find('meta[charset]').length) head.prepend('<meta charset="utf-8">');
  if (!$('meta[name="viewport"]').length) {
    head.append('<meta name="viewport" content="width=device-width, initial-scale=1">');
    fixes.push("Добавлен viewport — корректная адаптация под мобильные");
  }

  // 3) meta description
  if (!$('meta[name="description"]').attr("content")?.trim() && seo.metaDescription) {
    head.append(`<meta name="description" content="${seo.metaDescription.replace(/"/g, "&quot;")}">`);
    fixes.push("Добавлена meta description");
  }

  // 4) canonical
  if (!$('link[rel="canonical"]').length) {
    head.append(`<link rel="canonical" href="${s.url}">`);
    fixes.push("Добавлен canonical");
  }

  // 5) Open Graph (если нет)
  if (!$('meta[property="og:title"]').length) {
    const ogDesc = seo.metaDescription || s.metaDescription || "";
    head.append(`<meta property="og:title" content="${(s.title || "").replace(/"/g, "&quot;")}">`);
    if (ogDesc) head.append(`<meta property="og:description" content="${ogDesc.replace(/"/g, "&quot;")}">`);
    head.append(`<meta property="og:url" content="${s.url}">`);
    head.append(`<meta property="og:type" content="website">`);
    if (s.heroImage) head.append(`<meta property="og:image" content="${s.heroImage}">`);
    fixes.push("Добавлены Open Graph теги (превью в соцсетях/мессенджерах)");
  }

  // 6) Schema.org JSON-LD
  if (!$('script[type="application/ld+json"]').length && seo.schema) {
    head.append(`<script type="application/ld+json">${JSON.stringify(seo.schema)}</script>`);
    fixes.push("Добавлена разметка Schema.org (structured data)");
  }

  // 7) H1: если нет ни одного — повышаем заметный заголовок до H1, сохраняя
  //    все классы/атрибуты (дизайн не меняется, меняется только тег).
  //    Раньше брали ПЕРВЫЙ h2 в документе — им мог оказаться случайный
  //    заголовок из футера/сайдбара, а не смысловой заголовок страницы.
  //    Теперь: сперва ищем внутри main/article, иначе — вне footer/nav/aside,
  //    и при отсутствии h2 пробуем h3.
  if ($("h1").length === 0) {
    // Без reassignment между веткам — разные виды селекторов у cheerio
    // инстанциируют разные generic-типы Cheerio<...>, присвоение одной
    // переменной их конфликтует. Три независимых return вместо этого.
    const pickCandidate = (tag: string) => {
      const inScope = $(`main ${tag}, article ${tag}`);
      if (inScope.length) return inScope.first();
      const outside = $(tag).not(`footer ${tag}, nav ${tag}, aside ${tag}`);
      if (outside.length) return outside.first();
      return $(tag).first();
    };
    const h2cand = pickCandidate("h2");
    const cand = h2cand.length ? h2cand : pickCandidate("h3");
    if (cand.length) {
      const attrs = (cand[0] as unknown as { attribs: Record<string, string> }).attribs || {};
      const inner = cand.html() ?? "";
      const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`).join(" ");
      cand.replaceWith(`<h1 ${attrStr}>${inner}</h1>`);
      fixes.push("Заметный заголовок повышен до единственного H1 (без изменения вида)");
    }
  }

  // 8) alt у изображений без alt
  let altAdded = 0;
  $("img").each((_, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    if (!alt) {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      $(el).attr("alt", src ? humanizeAlt(src, s.title || "изображение") : (s.title || "изображение"));
      altAdded++;
    }
  });
  if (altAdded > 0) fixes.push(`Проставлен alt у ${altAdded} изображений без описания`);

  return { html: $.html(), fixes };
}

// Экранируем строку для вставки в шаблонный литерал Astro (`...`).
function escapeForTemplate(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

// Собираем Astro-проект из исправленного HTML: Layout несёт <head>, index —
// <body> (оба через set:html, чтобы Astro не парсил чужой HTML как шаблон).
// Экспорт: используется и этапом оптимизации (/api/rebuild-astro/optimize).
export function assembleAstroProject(html: string, origin: string, title: string): AstroFile[] {
  const $ = cheerio.load(html);
  const headInner = $("head").html() ?? `<meta charset="utf-8"><title>${title}</title>`;
  const bodyInner = $("body").html() ?? html;

  // Раньше <html> всегда хардкодился как lang="ru" — терялись lang/dir/class
  // оригинала (dir="rtl", data-theme на <html> и т.п.). Переносим их через
  // пропсы Layout вместо set:html — они всего 2-3 коротких атрибута.
  const htmlEl = $("html");
  const lang = (htmlEl.attr("lang") || "ru").replace(/"/g, "");
  const dir = (htmlEl.attr("dir") || "").replace(/"/g, "");
  const htmlClass = (htmlEl.attr("class") || "").replace(/"/g, "");

  const layout = `---
const { head = "", lang = "ru", dir, htmlClass } = Astro.props;
---
<!doctype html>
<html lang={lang} dir={dir} class={htmlClass}>
  <head set:html={head}></head>
  <body>
    <slot />
  </body>
</html>
`;
  const index = `---
import Layout from '../layouts/Layout.astro';
const head = \`${escapeForTemplate(headInner)}\`;
const body = \`${escapeForTemplate(bodyInner)}\`;
---
<Layout head={head} lang="${lang}"${dir ? ` dir="${dir}"` : ""}${htmlClass ? ` htmlClass="${htmlClass}"` : ""}>
  <Fragment set:html={body} />
</Layout>
`;
  const astroConfig = `import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// site обязателен для @astrojs/sitemap — без него сборка падает.
export default defineConfig({
  site: '${origin}',
  integrations: [sitemap()],
});
`;
  const pkg = JSON.stringify({
    name: "rebuilt-site", type: "module", version: "1.0.0",
    scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
    dependencies: { astro: "^5.0.0", "@astrojs/sitemap": "^3.2.0" },
  }, null, 2) + "\n";
  const tsconfig = JSON.stringify({ extends: "astro/tsconfigs/strict" }, null, 2) + "\n";
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap-index.xml\n`;
  const readme = `# Пересобранный сайт (Astro)\n\nДизайн сохранён 1:1, исправлен технический внутряк (SEO) и оптимизирована загрузка.\n\n\`\`\`\nnpm install\nnpm run build\n\`\`\`\n\nПросмотр: \`npm run preview\`.\n\nКартинки, стили и шрифты перенесены в public/assets/ (JPEG/PNG сжаты в WebP).\nВидео и скрипты конструктора подгружаются с оригинального домена.\n`;

  return [
    { path: "package.json", content: pkg },
    { path: "astro.config.mjs", content: astroConfig },
    { path: "tsconfig.json", content: tsconfig },
    { path: "src/layouts/Layout.astro", content: layout },
    { path: "src/pages/index.astro", content: index },
    { path: "public/robots.txt", content: robots },
    { path: "README.md", content: readme },
  ];
}

export async function POST(req: Request) {
  // Публичный инструмент — без логина. Взамен checkAiAccess: IP-лимит.
  // 15/день на IP — с запасом на реальное использование (показать клиенту,
  // пересобрать пару раз), но не даёт залить бюджет спамом с одного адреса.
  // Не защищает от ротирующегося прокси — если увидим злоупотребление,
  // здесь первое место, куда добавлять более жёсткую защиту (капча/токен).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const limit = checkRateLimit(ip, { keyPrefix: "rebuild-astro-public", maxRequests: 15, windowMs: 24 * 60 * 60 * 1000 });
  if (!limit.allowed) {
    const minutesLeft = limit.retryAfterMs ? Math.ceil(limit.retryAfterMs / 60000) : 60;
    return NextResponse.json(
      { ok: false, error: `Слишком много запросов с этого адреса. Попробуйте через ${minutesLeft} мин.` },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }
  const session = await getSessionUser().catch(() => null);

  try {
    await initDb();
    const body = await req.json().catch(() => ({}));
    const rawUrl: string = typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ ok: false, error: "Укажите URL сайта" }, { status: 400 });

    // 1) Скрейпим сайт (сырой HTML + метаданные)
    let scraped: RebuildScrape;
    try {
      scraped = await scrapeForRebuild(rawUrl);
    } catch (e) {
      logAi({ endpoint: "rebuild-astro", model: "-", userId: session?.userId ?? null, success: false, errorMessage: "scrape failed" });
      return NextResponse.json(
        { ok: false, error: `Не удалось загрузить сайт: ${e instanceof Error ? e.message : "ошибка"}. Проверьте URL.` },
        { status: 502 },
      );
    }
    const issues = detectIssues(scraped);

    // 2) AI генерирует ТОЛЬКО SEO-текст (meta + schema), не дизайн
    const started = Date.now();
    let seo = { metaDescription: "", schema: null as unknown, modelUsed: MODEL };
    try {
      seo = await generateSeoMeta(scraped);
    } catch (e) {
      console.warn("[rebuild-astro] SEO meta gen failed, continue without:", e);
    }

    // 3) DOM-хирургия: сохраняем дизайн, правим SEO-внутряк.
    //    Оптимизация (lazy/перенос ассетов/WebP) — ОТДЕЛЬНАЯ услуга, здесь
    //    только диагностика: что тормозит и что исправит этап оптимизации.
    const { html: fixedHtml, fixes } = surgicalFix(scraped.html, scraped, seo);
    const optimization = detectPerf(fixedHtml, scraped.origin, scraped.techStack);
    const id = randomUUID();

    // Фоновая уборка: каталоги ассетов старше 14 дней удаляем, чтобы не
    // забить диск (по ссылкам такой давности превью уже вряд ли смотрят).
    void (async () => {
      try {
        const root = rebuildAssetsRoot();
        const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        for (const name of await fs.readdir(root)) {
          const p = path.join(root, name);
          const st = await fs.stat(p).catch(() => null);
          if (st?.isDirectory() && st.mtimeMs < cutoff) {
            await fs.rm(p, { recursive: true, force: true }).catch(() => { /* ignore */ });
          }
        }
      } catch { /* каталога ещё нет — нечего убирать */ }
    })();

    // 4) Собираем Astro-проект
    const files = assembleAstroProject(fixedHtml, scraped.origin, scraped.title || "Сайт");

    // 5) Сохраняем для живого превью
    const summary = `Сайт «${scraped.title || scraped.url}» перенесён на Astro с сохранением дизайна 1:1. Исправлен технический внутряк: ${fixes.length} правок.`;
    const snapshot = {
      // baseHtml — «чистый перенос» до оптимизации: этап /optimize стартует
      // от него, чтобы правки не наслаивались при повторных запусках.
      previewHtml: fixedHtml, baseHtml: fixedHtml, files, fixes, optimization,
      optimizedAt: null as string | null,
      summary, modelUsed: seo.modelUsed,
      source: { url: scraped.url, title: scraped.title, issues },
      createdAt: new Date().toISOString(),
    };
    try {
      await query(
        `INSERT INTO astro_rebuilds (id, user_id, source_url, title, snapshot, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, session?.userId ?? null, scraped.url, scraped.title || "", JSON.stringify(snapshot)],
      );
    } catch (e) {
      console.error("[rebuild-astro] persist failed:", e);
    }

    logAi({ endpoint: "rebuild-astro", model: seo.modelUsed, userId: session?.userId ?? null, success: true, durationMs: Date.now() - started });

    const result: RebuildAstroResult = {
      ok: true, id, previewUrl: `/api/site-preview/${id}`,
      source: { url: scraped.url, title: scraped.title, issues },
      files, fixes, optimization, optimizedAt: null, summary, modelUsed: seo.modelUsed,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("rebuild-astro error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Ошибка сервера" }, { status: 500 });
  }
}
