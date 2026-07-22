import * as cheerio from "cheerio";
import { createHash } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { checkSafeUrl } from "@/lib/url-guard";

/**
 * Локализация ассетов пересобранного сайта (/api/rebuild-astro, пункты 1–2
 * плана оптимизации):
 *   1. Скачиваем к себе картинки, CSS и шрифты (включая шрифты, на которые
 *      ссылаются CSS-файлы) — сайт перестаёт зависеть от CDN конструктора,
 *      заодно чинится 403 на шрифтах Tilda (реферер-защита не бьёт по серверу).
 *   2. Растровые картинки (JPEG/PNG) сжимаем: EXIF-поворот, ресайз до 1920px
 *      по ширине, конвертация в WebP q80. Если WebP вышел БОЛЬШЕ оригинала —
 *      честно оставляем оригинал.
 *
 * Файлы кладутся в <root>/<id>/ плоско; в HTML ссылки становятся
 * `${publicPrefix}/<имя>` (превью), внутри CSS — просто `<имя>` (относительная
 * ссылка в тот же каталог — работает и в превью, и в скачанном проекте, где
 * всё лежит в public/assets/). Zip-роут заменяет publicPrefix на /assets.
 *
 * Скрипты и видео НЕ скачиваем: JS конструкторов подтягивает свои ресурсы
 * относительно собственного origin'а, а видео слишком тяжёлые — остаются
 * на оригинальном домене.
 */

const PER_FILE_LIMIT = 25 * 1024 * 1024;   // 25 МБ на файл
const TOTAL_LIMIT = 100 * 1024 * 1024;     // 100 МБ на пересборку
const MAX_ASSETS = 150;
const FETCH_TIMEOUT_MS = 15_000;
const SOFT_BUDGET_MS = 90_000;             // мягкий бюджет на всю локализацию
const CONCURRENCY = 5;

const VIDEO_EXT = /\.(mp4|webm|ogv|mov|m4v)(\?|$)/i;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)(\?|$)/i;

export interface LocalizeReport {
  localized: number;        // всего файлов перенесено к нам
  failed: number;           // не удалось скачать — остались на оригинале
  cssLocalized: number;
  fontsLocalized: number;
  imagesOptimized: number;  // сконвертировано в WebP
  imageBytesBefore: number;
  imageBytesAfter: number;
  notes: string[];          // человекочитаемые пояснения для отчёта
  /** Локальные имена перенесённых шрифтов (для preload первых woff2 на этапе оптимизации). */
  fontFiles: string[];
  /** Финальные размеры картинок по локальному имени — для width/height (анти-CLS). */
  imageDims: Record<string, { w: number; h: number }>;
  /** Сколько @font-face в CSS получили font-display:swap. */
  fontSwapAdded: number;
}

/** Корневой каталог хранения ассетов пересборок. */
export function rebuildAssetsRoot(): string {
  return process.env.ASTRO_REBUILD_ASSETS_DIR
    || (process.platform === "win32"
      ? path.join(os.tmpdir(), "astro-rebuild-assets")
      : "/var/lib/marketradar/astro-rebuild-assets");
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function localName(url: string, ext?: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  let base = "asset";
  try {
    base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "asset");
  } catch { /* ignore */ }
  base = base.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "asset";
  if (ext) base = base.replace(/\.[A-Za-z0-9]+$/, "") + ext;
  if (!/\.[A-Za-z0-9]{1,5}$/.test(base)) base += ext ?? ".bin";
  return `${hash}-${base}`;
}

async function fetchAsset(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36",
        Accept: "*/*",
      },
    });
    if (!res.ok) return null;
    const lenHeader = Number(res.headers.get("content-length") || 0);
    if (lenHeader > PER_FILE_LIMIT) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > PER_FILE_LIMIT) return null;
    return { buf, contentType: res.headers.get("content-type") || "" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/** Кэш SSRF-проверок по хосту, чтобы не резолвить DNS на каждый файл. */
function makeHostGuard() {
  const cache = new Map<string, boolean>();
  return async (url: string): Promise<boolean> => {
    let host: string;
    try { host = new URL(url).host; } catch { return false; }
    const hit = cache.get(host);
    if (hit !== undefined) return hit;
    const ok = (await checkSafeUrl(url, { allowedProtocols: ["https:", "http:"], resolveDns: true })).ok;
    cache.set(host, ok);
    return ok;
  };
}

type AssetKind = "image" | "css" | "font" | "icon";

interface AssetTask { url: string; kind: AssetKind }

// ─── main ────────────────────────────────────────────────────────────────────

export async function localizeAssets(html: string, opts: {
  id: string;
  publicPrefix: string; // например /api/rebuild-asset/<id>
}): Promise<{ html: string; report: LocalizeReport }> {
  const report: LocalizeReport = {
    localized: 0, failed: 0, cssLocalized: 0, fontsLocalized: 0,
    imagesOptimized: 0, imageBytesBefore: 0, imageBytesAfter: 0, notes: [],
    fontFiles: [], imageDims: {}, fontSwapAdded: 0,
  };

  const dir = path.join(rebuildAssetsRoot(), opts.id);
  await fs.mkdir(dir, { recursive: true }); // упадёт — вызывающий обработает

  const $ = cheerio.load(html);
  const started = Date.now();
  const hostAllowed = makeHostGuard();

  // ── 1. Сбор ссылок ────────────────────────────────────────────────────────
  const tasks = new Map<string, AssetTask>();
  const add = (raw: string | undefined, kind: AssetKind) => {
    if (!raw) return;
    const u = raw.trim();
    if (!/^https?:\/\//i.test(u) || VIDEO_EXT.test(u)) return;
    if (tasks.size >= MAX_ASSETS) return;
    if (!tasks.has(u)) tasks.set(u, { url: u, kind });
  };
  const addSrcset = (val: string | undefined) => {
    if (!val) return;
    for (const part of val.split(",")) {
      add(part.trim().split(/\s+/)[0], "image");
    }
  };

  $("img[src]").each((_, el) => add($(el).attr("src"), "image"));
  $("img[srcset]").each((_, el) => addSrcset($(el).attr("srcset")));
  $("picture source[srcset]").each((_, el) => addSrcset($(el).attr("srcset")));
  $("video[poster]").each((_, el) => add($(el).attr("poster"), "image"));
  $('link[rel="stylesheet"]').each((_, el) => add($(el).attr("href"), "css"));
  $('link[rel~="icon"], link[rel="apple-touch-icon"]').each((_, el) => add($(el).attr("href"), "icon"));
  $('link[rel="preload"][as="image"]').each((_, el) => add($(el).attr("href"), "image"));
  $('link[rel="preload"][as="font"]').each((_, el) => add($(el).attr("href"), "font"));
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    for (const m of style.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) add(m[2], "image");
  });
  // Ленивые фоны этапа оптимизации (см. /api/rebuild-astro/optimize)
  $("[data-mrbg]").each((_, el) => add($(el).attr("data-mrbg"), "image"));

  // ── 2. Скачивание ─────────────────────────────────────────────────────────
  const urlToLocal = new Map<string, string>(); // абсолютный URL → локальное имя
  let totalBytes = 0;

  // Ленивая загрузка sharp: нативный модуль, тянем только когда есть картинки.
  let sharpMod: (typeof import("sharp"))["default"] | null | undefined;
  const getSharp = async () => {
    if (sharpMod !== undefined) return sharpMod;
    try { sharpMod = (await import("sharp")).default; }
    catch { sharpMod = null; report.notes.push("Модуль sharp недоступен — картинки перенесены без сжатия"); }
    return sharpMod;
  };

  const processImage = async (url: string, buf: Buffer, contentType: string): Promise<{ buf: Buffer; name: string }> => {
    const isRaster = /jpe?g|png/i.test(contentType) || /\.(jpe?g|png)(\?|$)/i.test(url);
    if (!isRaster) return { buf, name: localName(url) };
    const sharp = await getSharp();
    if (!sharp) return { buf, name: localName(url) };
    try {
      const img = sharp(buf, { failOn: "none" }).rotate();
      const meta = await img.metadata();
      // Финальные размеры (после возможного ресайза) — для width/height в HTML (анти-CLS).
      const dims = meta.width && meta.height
        ? (meta.width > 1920
          ? { w: 1920, h: Math.round(meta.height * 1920 / meta.width) }
          : { w: meta.width, h: meta.height })
        : null;
      const pipeline = (meta.width ?? 0) > 1920 ? img.resize({ width: 1920 }) : img;
      const webp = await pipeline.webp({ quality: 80 }).toBuffer();
      if (webp.length < buf.length) {
        report.imagesOptimized++;
        report.imageBytesBefore += buf.length;
        report.imageBytesAfter += webp.length;
        const name = localName(url, ".webp");
        if (dims) report.imageDims[name] = dims;
        return { buf: webp, name };
      }
      const name = localName(url);
      if (dims) report.imageDims[name] = dims;
      return { buf, name };
    } catch { /* битая картинка — оставляем как есть */ }
    return { buf, name: localName(url) };
  };

  // CSS: скачиваем файл, внутри находим url(...) на шрифты/картинки, скачиваем
  // их тоже и переписываем ссылки на ОТНОСИТЕЛЬНЫЕ имена (тот же каталог).
  const processCss = async (cssUrl: string, cssText: string): Promise<string> => {
    // font-display:swap в каждый @font-face без него — текст показывается
    // системным шрифтом сразу, вместо невидимого текста до загрузки шрифта
    // (FOIT). Вид не меняется, только исчезает «мигание пустоты».
    cssText = cssText.replace(/@font-face\s*\{[^}]*\}/gi, (block) => {
      if (/font-display\s*:/i.test(block)) return block;
      report.fontSwapAdded++;
      return block.replace(/\}\s*$/, ";font-display:swap}");
    });
    const refs = new Map<string, string>(); // исходная подстрока → абсолютный URL
    for (const m of cssText.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
      const raw = m[2].trim();
      if (!raw || raw.startsWith("data:") || raw.startsWith("#")) continue;
      try {
        const abs = new URL(raw, cssUrl).href;
        if (/\.css(\?|$)/i.test(abs) || VIDEO_EXT.test(abs)) continue; // @import и видео не трогаем
        refs.set(raw, abs);
      } catch { /* ignore */ }
    }
    let out = cssText;
    for (const [raw, abs] of refs) {
      if (Date.now() - started > SOFT_BUDGET_MS || totalBytes > TOTAL_LIMIT) break;
      let name = urlToLocal.get(abs);
      if (!name) {
        if (!(await hostAllowed(abs))) continue;
        const got = await fetchAsset(abs);
        if (!got) { report.failed++; continue; }
        const isFont = FONT_EXT.test(abs) || /font/i.test(got.contentType);
        if (isFont) {
          name = localName(abs);
          report.fontsLocalized++;
          report.fontFiles.push(name);
        } else {
          const processed = await processImage(abs, got.buf, got.contentType);
          got.buf = processed.buf;
          name = processed.name;
        }
        await fs.writeFile(path.join(dir, name), got.buf);
        totalBytes += got.buf.length;
        urlToLocal.set(abs, name);
        report.localized++;
      }
      // Относительная ссылка: CSS и ассет лежат в одном каталоге.
      out = out.split(`url(${raw})`).join(`url(${name})`)
        .split(`url('${raw}')`).join(`url('${name}')`)
        .split(`url("${raw}")`).join(`url("${name}")`);
    }
    return out;
  };

  await pool([...tasks.values()], CONCURRENCY, async (task) => {
    if (Date.now() - started > SOFT_BUDGET_MS || totalBytes > TOTAL_LIMIT) return;
    if (urlToLocal.has(task.url)) return;
    if (!(await hostAllowed(task.url))) return;
    const got = await fetchAsset(task.url);
    if (!got) { report.failed++; return; }

    let name: string;
    let buf = got.buf;
    if (task.kind === "css" || /text\/css/i.test(got.contentType)) {
      const rewritten = await processCss(task.url, buf.toString("utf8"));
      buf = Buffer.from(rewritten, "utf8");
      name = localName(task.url, ".css");
      report.cssLocalized++;
    } else if (task.kind === "font") {
      name = localName(task.url);
      report.fontsLocalized++;
      report.fontFiles.push(name);
    } else {
      const processed = await processImage(task.url, buf, got.contentType);
      buf = processed.buf;
      name = processed.name;
    }
    await fs.writeFile(path.join(dir, name), buf);
    totalBytes += buf.length;
    urlToLocal.set(task.url, name);
    report.localized++;
  });

  if (Date.now() - started > SOFT_BUDGET_MS) {
    report.notes.push("Часть ассетов осталась на оригинальном домене — не уложились в бюджет времени");
  }
  if (totalBytes > TOTAL_LIMIT) {
    report.notes.push("Часть ассетов осталась на оригинальном домене — превышен лимит объёма 100 МБ");
  }

  // ── 3. Переписывание ссылок в HTML ───────────────────────────────────────
  const toLocal = (u: string | undefined): string | null => {
    if (!u) return null;
    const name = urlToLocal.get(u.trim());
    return name ? `${opts.publicPrefix}/${name}` : null;
  };

  const rewriteAttr = (sel: string, attr: string) => {
    $(sel).each((_, el) => {
      const loc = toLocal($(el).attr(attr));
      if (loc) $(el).attr(attr, loc);
    });
  };
  rewriteAttr("img[src]", "src");
  rewriteAttr("video[poster]", "poster");
  rewriteAttr("[data-mrbg]", "data-mrbg");
  rewriteAttr('link[rel="stylesheet"]', "href");
  rewriteAttr('link[rel~="icon"], link[rel="apple-touch-icon"]', "href");
  rewriteAttr('link[rel="preload"][as="image"]', "href");
  rewriteAttr('link[rel="preload"][as="font"]', "href");

  $("img[srcset], picture source[srcset]").each((_, el) => {
    const val = $(el).attr("srcset");
    if (!val) return;
    const next = val.split(",").map((part) => {
      const seg = part.trim();
      const sp = seg.indexOf(" ");
      const u = sp === -1 ? seg : seg.slice(0, sp);
      const rest = sp === -1 ? "" : seg.slice(sp);
      return (toLocal(u) ?? u) + rest;
    }).join(", ");
    $(el).attr("srcset", next);
  });

  $("[style]").each((_, el) => {
    let style = $(el).attr("style") ?? "";
    if (!/url\(/i.test(style)) return;
    style = style.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
      const loc = toLocal(u);
      return loc ? `url(${q}${loc}${q})` : m;
    });
    $(el).attr("style", style);
  });

  return { html: $.html(), report };
}
