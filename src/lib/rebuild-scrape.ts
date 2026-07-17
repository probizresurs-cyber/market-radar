import * as cheerio from "cheerio";

/**
 * Обогащённый скрейп специально для пересборки сайта в Astro (/api/rebuild-astro).
 * В отличие от общего scrapeWebsite (который считает только флаги для аудита),
 * здесь собираем ССЫЛКИ на реальные картинки, hero-изображение, навигацию и
 * больше текста — чтобы модель воссоздала сайт с настоящими изображениями и
 * структурой, а не голый текст.
 *
 * Общий scraper.ts намеренно не трогаем — он используется по всему проекту.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export interface RebuildScrape {
  url: string;
  origin: string;
  /** Сырой HTML исходной страницы — для сохранения дизайна 1:1. */
  html: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  h3: string[];
  navLinks: Array<{ text: string; href: string }>;
  images: Array<{ src: string; alt: string }>;
  heroImage: string | null;
  ogImage: string | null;
  themeColor: string | null;
  socialLinks: Record<string, string>;
  techStack: string[];
  textContent: string;
  // Флаги дыр — те же, что в аудите, считаем прямо тут
  imageCount: number;
  imagesWithAlt: number;
  hasSchemaMarkup: boolean;
  hasCanonical: boolean;
  hasViewport: boolean;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  isHttps: boolean;
  jsHeavy: boolean;
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, 3500);
    return res.ok;
  } catch {
    return false;
  }
}

// Приводим относительный src к абсолютному; отсекаем data:, пустые, svg-спрайты
function absolutize(src: string | undefined, base: string): string | null {
  if (!src) return null;
  const s = src.trim();
  if (!s || s.startsWith("data:") || s.startsWith("#")) return null;
  try {
    return new URL(s, base).href;
  } catch {
    return null;
  }
}

export async function scrapeForRebuild(rawUrl: string): Promise<RebuildScrape> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let html = "";
  let finalUrl = url;
  try {
    const res = await fetchWithTimeout(url);
    finalUrl = res.url || url;
    const text = await res.text();
    html = text.length > 3_000_000 ? text.slice(0, 3_000_000) : text;
  } catch (err) {
    if (url.startsWith("https://")) {
      const res = await fetchWithTimeout(url.replace("https://", "http://"));
      finalUrl = res.url || url;
      const text = await res.text();
      html = text.length > 3_000_000 ? text.slice(0, 3_000_000) : text;
    } else {
      throw err;
    }
  }

  const origin = new URL(finalUrl).origin;
  const isHttps = finalUrl.startsWith("https://");
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const ogImage = absolutize($('meta[property="og:image"]').attr("content"), origin);
  const themeColor = $('meta[name="theme-color"]').attr("content")?.trim() || null;

  const hasCanonical = !!$('link[rel="canonical"]').attr("href");
  const hasViewport = !!$('meta[name="viewport"]').attr("content");
  const hasSchemaMarkup = $('script[type="application/ld+json"]').length > 0;

  const takeHeadings = (sel: string, limit: number) =>
    $(sel).map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean).slice(0, limit);
  const h1 = takeHeadings("h1", 5);
  const h2 = takeHeadings("h2", 20);
  const h3 = takeHeadings("h3", 30);

  // Навигация — ссылки из header/nav (или первые осмысленные из шапки)
  const navLinks: Array<{ text: string; href: string }> = [];
  const seenNav = new Set<string>();
  $("header a[href], nav a[href]").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href") ?? "";
    if (text && text.length <= 40 && !seenNav.has(text)) {
      seenNav.add(text);
      navLinks.push({ text, href });
    }
  });

  // Картинки — абсолютные URL + alt. Собираем и <img src>, и <img data-src> (lazy).
  const imgEls = $("img");
  const imageCount = imgEls.length;
  let imagesWithAlt = 0;
  const images: Array<{ src: string; alt: string }> = [];
  const seenImg = new Set<string>();
  imgEls.each((_, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    if (alt) imagesWithAlt++;
    const raw = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    const abs = absolutize(raw, finalUrl);
    if (abs && !seenImg.has(abs) && !/\.svg($|\?)/i.test(abs)) {
      seenImg.add(abs);
      if (images.length < 24) images.push({ src: abs, alt });
    }
  });

  // Hero-картинка: og:image → первое крупное фоновое изображение → первая img.
  // Фоновые ищем в inline style="background(-image): url(...)".
  let heroImage: string | null = ogImage;
  if (!heroImage) {
    $("[style]").each((_, el) => {
      if (heroImage) return;
      const style = $(el).attr("style") ?? "";
      const m = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
      if (m) heroImage = absolutize(m[1], finalUrl);
    });
  }
  if (!heroImage && images.length) heroImage = images[0].src;

  // Соцсети
  const socialLinks: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!socialLinks.vk && href.includes("vk.com")) socialLinks.vk = href;
    if (!socialLinks.telegram && (href.includes("t.me/") || href.includes("telegram.me/"))) socialLinks.telegram = href;
    if (!socialLinks.instagram && href.includes("instagram.com")) socialLinks.instagram = href;
    if (!socialLinks.youtube && href.includes("youtube.com")) socialLinks.youtube = href;
    if (!socialLinks.whatsapp && href.includes("wa.me")) socialLinks.whatsapp = href;
  });

  // Стек
  const htmlLower = html.toLowerCase();
  const techStack: string[] = [];
  const patterns: Array<[string, string]> = [
    ["Next.js", "__next"], ["React", "react"], ["Vue.js", "__vue"], ["jQuery", "jquery"],
    ["WordPress", "wp-content"], ["Bitrix", "1c-bitrix"], ["Tilda", "tildacdn"],
    ["Bootstrap", "bootstrap.min"],
  ];
  for (const [name, p] of patterns) if (htmlLower.includes(p)) techStack.push(name);

  // Текст
  $("script, style, noscript, svg").remove();
  const textContent = $("body").text().replace(/\s+/g, " ").trim().slice(0, 9000);
  const jsHeavy = textContent.length < 300;

  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    urlExists(`${origin}/robots.txt`),
    urlExists(`${origin}/sitemap.xml`),
  ]);

  return {
    url: finalUrl, origin, html, title, metaDescription,
    h1, h2, h3, navLinks, images, heroImage, ogImage, themeColor, socialLinks, techStack, textContent,
    imageCount, imagesWithAlt, hasSchemaMarkup, hasCanonical, hasViewport, hasSitemap, hasRobotsTxt, isHttps, jsHeavy,
  };
}
