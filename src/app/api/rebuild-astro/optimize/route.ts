import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { query, initDb } from "@/lib/db";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { localizeAssets } from "@/lib/asset-localizer";
import { assembleAstroProject, MODEL, type AstroFile, type OptimizationReport, type RebuildAstroResult, type SpeedCompare } from "../route";

// POST /api/rebuild-astro/optimize { id } — ВТОРАЯ услуга (после переноса):
// оптимизация скорости. Стартует от baseHtml («чистый перенос»), поэтому
// повторные запуски не наслаивают правки. Что делает:
//   1. <img>: lazy ниже первого экрана + decoding=async.
//   2. Фоновые блоки конструктора: вместо «все фоны разом» — ленивая
//      подгрузка по прокрутке (IntersectionObserver, первые 4 — сразу).
//      Именно из-за «всё разом» LCP пересборки был хуже оригинала.
//   3. Убирает data-original/data-src — скрипт конструктора качал те же
//      картинки второй раз со своего CDN (двойная загрузка).
//   4. Перенос ассетов к себе (картинки/CSS/шрифты) + сжатие JPEG/PNG в WebP.
//   5. preconnect к оставшимся внешним доменам + preload hero.
// Дизайн не меняется. speedCompare сбрасывается — старый замер описывал
// неоптимизированную версию, честно замерить заново.
export const runtime = "nodejs";
export const maxDuration = 180;

// Крошечный загрузчик фонов: ставит background-image когда блок подъезжает
// к экрану (запас 400px). Без зависимостей; без IO — ставит всё сразу.
const BG_LOADER = `<script>(function(){var e=[].slice.call(document.querySelectorAll("[data-mrbg]"));function s(t){t.style.backgroundImage='url("'+t.getAttribute("data-mrbg")+'")'}if(!("IntersectionObserver"in window)){e.forEach(s);return}var o=new IntersectionObserver(function(n){n.forEach(function(t){t.isIntersecting&&(s(t.target),o.unobserve(t.target))})},{rootMargin:"400px"});e.forEach(function(t){o.observe(t)})})();</script>`;

interface Snapshot {
  previewHtml: string;
  baseHtml?: string;
  files: AstroFile[];
  fixes: string[];
  optimization?: OptimizationReport;
  optimizedAt?: string | null;
  speedCompare?: SpeedCompare | null;
  summary: string;
  modelUsed?: string;
  source: { url: string; title: string; issues: string[] };
  createdAt?: string;
}

interface Row { snapshot: Snapshot }

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const limit = checkRateLimit(ip, { keyPrefix: "rebuild-optimize", maxRequests: 15, windowMs: 24 * 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Лимит оптимизаций на сегодня исчерпан. Попробуйте завтра." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  try {
    await initDb();
    const body = await req.json().catch(() => ({}));
    const id: string = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: "Не передан id результата" }, { status: 400 });
    }

    const rows = await query<Row>("SELECT snapshot FROM astro_rebuilds WHERE id = $1", [id]);
    const snap = rows[0]?.snapshot;
    if (!snap?.previewHtml) {
      return NextResponse.json({ ok: false, error: "Результат не найден или устарел" }, { status: 404 });
    }
    // Старые снапшоты без baseHtml: берём previewHtml (правки идемпотентны).
    const baseHtml = snap.baseHtml || snap.previewHtml;
    let origin = "";
    try { origin = new URL(snap.source.url).origin; } catch { /* ignore */ }

    const applied: string[] = [];
    const $ = cheerio.load(baseHtml);

    // ── 1. <img>: ленивая загрузка ниже первого экрана + приоритет hero ───
    let lazied = 0;
    $("img").each((i, el) => {
      const $el = $(el);
      if (i === 0 && !$el.attr("fetchpriority")) {
        // Первая картинка — почти всегда LCP-элемент: качаем её раньше остального.
        $el.attr("fetchpriority", "high");
      }
      if (i < 2) return;
      if (!$el.attr("loading")) { $el.attr("loading", "lazy"); lazied++; }
      if (!$el.attr("decoding")) $el.attr("decoding", "async");
    });
    if (lazied > 0) applied.push(`Ленивая загрузка ${lazied} изображений (loading="lazy" + decoding="async")`);
    if ($("img").length > 0) applied.push(`Первое изображение получило приоритет загрузки (fetchpriority="high") — быстрее LCP`);

    // font-display:swap в инлайновых <style> — текст виден сразу системным
    // шрифтом, без «пустого» ожидания веб-шрифта (в CSS-файлах то же самое
    // делает localizeAssets).
    let inlineFontSwap = 0;
    $("style").each((_, el) => {
      const css = $(el).html() ?? "";
      if (!/@font-face/i.test(css)) return;
      const out = css.replace(/@font-face\s*\{[^}]*\}/gi, (block) => {
        if (/font-display\s*:/i.test(block)) return block;
        inlineFontSwap++;
        return block.replace(/\}\s*$/, ";font-display:swap}");
      });
      if (out !== css) $(el).html(out);
    });

    // ── 2. Фоновые блоки: подгрузка по прокрутке вместо «всё разом» ───────
    // Берём только блоки с data-original — у оригинала они и так были
    // ленивыми (JS конструктора), мы лишь возвращаем это поведение без JS
    // конструктора. Первые 4 (первый экран) остаются мгновенными.
    let bgLazied = 0;
    $("[data-original]").not("img").each((i, el) => {
      const $el = $(el);
      if (i < 4) return;
      const style = $el.attr("style") ?? "";
      const m = style.match(/background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)\s*;?/i);
      if (!m) return;
      $el.attr("data-mrbg", m[1]);
      $el.attr("style", style.replace(m[0], ""));
      bgLazied++;
    });
    if (bgLazied > 0) {
      applied.push(`Фоновые изображения: ${bgLazied} переведены на подгрузку по прокрутке (первый экран — мгновенно)`);
    }

    // ── 3. Убираем lazy-атрибуты конструктора → нет двойной загрузки ──────
    const doubleLoaders = $("[data-original], [data-lazy-src]").length;
    $("[data-original]").removeAttr("data-original");
    $("[data-lazy-src]").removeAttr("data-lazy-src");
    if (doubleLoaders > 0) {
      applied.push(`Убрана двойная загрузка: скрипт конструктора больше не качает ${doubleLoaders} картинок повторно со своего CDN`);
    }

    // ── 4. iframe — лениво ────────────────────────────────────────────────
    let iframesLazied = 0;
    $("iframe").each((_, el) => {
      if (!$(el).attr("loading")) { $(el).attr("loading", "lazy"); iframesLazied++; }
    });
    if (iframesLazied > 0) applied.push(`loading="lazy" у ${iframesLazied} iframe (карты/встройки)`);

    if (bgLazied > 0) $("body").append(BG_LOADER);

    // ── 5. Перенос ассетов к себе + WebP ──────────────────────────────────
    let html = $.html();
    let localizedNote = "";
    let fontFiles: string[] = [];
    let imageDims: Record<string, { w: number; h: number }> = {};
    let fontSwapTotal = inlineFontSwap;
    try {
      const { html: localized, report } = await localizeAssets(html, {
        id, publicPrefix: `/api/rebuild-asset/${id}`,
      });
      html = localized;
      fontFiles = report.fontFiles;
      imageDims = report.imageDims;
      fontSwapTotal += report.fontSwapAdded;
      if (report.localized > 0) {
        applied.push(`Перенесено к себе ${report.localized} ассетов (${report.cssLocalized} CSS, ${report.fontsLocalized} шрифтов) — без зависимости от CDN конструктора`);
      }
      if (report.imagesOptimized > 0) {
        const beforeKb = Math.round(report.imageBytesBefore / 1024);
        const afterKb = Math.round(report.imageBytesAfter / 1024);
        const savedPct = beforeKb > 0 ? Math.round((1 - afterKb / beforeKb) * 100) : 0;
        applied.push(`Сжато ${report.imagesOptimized} изображений в WebP: ${beforeKb} КБ → ${afterKb} КБ (−${savedPct}%)`);
      }
      if (report.failed > 0) localizedNote = `${report.failed} ассетов не удалось скачать — остались на оригинальном домене`;
      for (const note of report.notes) applied.push(note);
    } catch (e) {
      console.warn("[rebuild-optimize] localization failed:", e);
      localizedNote = "Хранилище ассетов недоступно — перенос картинок/шрифтов не выполнен";
    }
    if (fontSwapTotal > 0) {
      applied.push(`font-display: swap у ${fontSwapTotal} шрифтов — текст виден сразу, без ожидания загрузки веб-шрифта`);
    }

    // ── 6. preconnect/dns-prefetch к внешним доменам + preload hero/шрифтов ──
    const $2 = cheerio.load(html);
    const hostCount = new Map<string, number>();
    $2('script[src], link[href], img[src]').each((_, el) => {
      const u = $2(el).attr("src") || $2(el).attr("href") || "";
      try {
        const { origin: o } = new URL(u);
        if (o !== origin && o.startsWith("http")) hostCount.set(o, (hostCount.get(o) ?? 0) + 1);
      } catch { /* относительный URL */ }
    });
    const sortedHosts = [...hostCount.entries()].sort((a, b) => b[1] - a[1]);
    const topHosts = sortedHosts.filter(([, n]) => n >= 3).slice(0, 3);
    for (const [host] of topHosts) {
      if (!$2(`link[rel="preconnect"][href="${host}"]`).length) {
        $2("head").prepend(`<link rel="preconnect" href="${host}" crossorigin>`);
      }
    }
    if (topHosts.length > 0) applied.push(`Preconnect к ${topHosts.length} внешним доменам (скрипты конструктора)`);
    // Остальным внешним доменам — дешёвый dns-prefetch (одна DNS-резолюция заранее).
    const prefetchHosts = sortedHosts.filter(([h, n]) => n < 3 || topHosts.every(([t]) => t !== h)).slice(0, 5);
    for (const [host] of prefetchHosts) {
      if (!$2(`link[rel="dns-prefetch"][href="${host}"]`).length && !$2(`link[rel="preconnect"][href="${host}"]`).length) {
        $2("head").prepend(`<link rel="dns-prefetch" href="${host}">`);
      }
    }
    if (prefetchHosts.length > 0) applied.push(`DNS-prefetch к ${prefetchHosts.length} второстепенным внешним доменам`);

    const firstLocalImg = $2(`img[src^="/api/rebuild-asset/"]`).first().attr("src");
    if (firstLocalImg && !$2(`link[rel="preload"][href="${firstLocalImg}"]`).length) {
      $2("head").append(`<link rel="preload" as="image" href="${firstLocalImg}">`);
      applied.push("Первое изображение предзагружается (rel=\"preload\") — быстрее LCP");
    }

    // Preload первых двух woff2-шрифтов — убирает каскад «HTML → CSS → шрифт».
    const woff2 = fontFiles.filter((f) => /\.woff2$/i.test(f)).slice(0, 2);
    for (const f of woff2) {
      const href = `/api/rebuild-asset/${id}/${f}`;
      if (!$2(`link[rel="preload"][href="${href}"]`).length) {
        $2("head").append(`<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`);
      }
    }
    if (woff2.length > 0) applied.push(`Предзагрузка ${woff2.length} основных шрифтов (preload woff2)`);

    // width/height картинкам (анти-CLS): размеры знаем из sharp при переносе.
    // Только тем, у кого нет НИ width, НИ height — заданные не трогаем.
    let dimsSet = 0;
    $2(`img[src^="/api/rebuild-asset/${id}/"]`).each((_, el) => {
      const $el = $2(el);
      if ($el.attr("width") || $el.attr("height")) return;
      const name = ($el.attr("src") ?? "").split("/").pop() ?? "";
      const d = imageDims[name];
      if (!d) return;
      $el.attr("width", String(d.w));
      $el.attr("height", String(d.h));
      dimsSet++;
    });
    if (dimsSet > 0) applied.push(`Заданы размеры ${dimsSet} изображениям (width/height) — страница не «прыгает» при загрузке (CLS)`);
    html = $2.html();

    // ── 7. Обновляем отчёт: флипаем исправленные проблемы ─────────────────
    const optimization: OptimizationReport = snap.optimization ?? { stats: { htmlKb: 0, externalScripts: 0, externalCss: 0, images: 0, lazyImages: 0 }, issues: [], applied: [] };
    const fixedKeys = new Set(["img-lazy", "bg-lazy", "double-load", "cdn", "webp", "preconnect", "img-dims"]);
    for (const issue of optimization.issues) {
      if (issue.key && fixedKeys.has(issue.key)) issue.fixed = true;
    }
    if (localizedNote) {
      optimization.issues.push({ severity: "info", title: localizedNote, detail: "Ссылки на эти файлы сохранены как были — сайт работает.", fixed: false });
    }
    optimization.applied = applied;
    optimization.stats.lazyImages = lazied;

    // ── 8. Пересобираем проект и сохраняем ────────────────────────────────
    const files = assembleAstroProject(html, origin || "https://example.com", snap.source.title || "Сайт");
    const optimizedAt = new Date().toISOString();
    const updated: Snapshot = {
      ...snap,
      previewHtml: html,
      baseHtml,
      files,
      optimization,
      optimizedAt,
      speedCompare: null, // старый замер описывал неоптимизированную версию
    };
    await query("UPDATE astro_rebuilds SET snapshot = $2 WHERE id = $1", [id, JSON.stringify(updated)]);

    const result: RebuildAstroResult = {
      ok: true, id, previewUrl: `/api/site-preview/${id}`,
      source: snap.source, files, fixes: snap.fixes,
      optimization, optimizedAt, speedCompare: null,
      summary: snap.summary, modelUsed: snap.modelUsed || MODEL,
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error("rebuild-astro/optimize error:", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
