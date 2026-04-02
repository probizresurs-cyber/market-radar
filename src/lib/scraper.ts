import * as cheerio from "cheerio";
import type { ScrapedData } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
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

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, 3000);
    return res.ok;
  } catch {
    return false;
  }
}

export async function scrapeWebsite(rawUrl: string): Promise<ScrapedData> {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  let html: string;
  let finalUrl = url;

  try {
    const res = await fetchWithTimeout(url);
    finalUrl = res.url || url;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
    const text = await res.text();
    // Cap at 500KB to avoid OOM
    html = text.length > 500_000 ? text.slice(0, 500_000) : text;
  } catch (err) {
    // Fallback: try http:// if https:// failed
    if (url.startsWith("https://")) {
      const httpUrl = url.replace("https://", "http://");
      const res = await fetchWithTimeout(httpUrl);
      finalUrl = res.url || httpUrl;
      const text = await res.text();
      html = text.length > 500_000 ? text.slice(0, 500_000) : text;
    } else {
      throw err;
    }
  }

  const isHttps = finalUrl.startsWith("https://");
  const origin = new URL(finalUrl).origin;

  const $ = cheerio.load(html);

  // SEO basics
  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const metaKeywords = $('meta[name="keywords"]').attr("content")?.trim() ?? "";
  const hasCanonical = !!$('link[rel="canonical"]').attr("href");
  const hasViewport = !!$('meta[name="viewport"]').attr("content");
  const hasSchemaMarkup = $('script[type="application/ld+json"]').length > 0;

  // Headings
  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 8);

  // Images
  const images = $("img");
  const imageCount = images.length;
  const imagesWithAlt = images
    .filter((_, el) => {
      const alt = $(el).attr("alt");
      return !!alt && alt.trim().length > 0;
    })
    .length;

  // Social links
  const socialLinks: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!socialLinks.vk && href.includes("vk.com")) socialLinks.vk = href;
    if (!socialLinks.telegram && (href.includes("t.me/") || href.includes("telegram.me/")))
      socialLinks.telegram = href;
    if (!socialLinks.instagram && href.includes("instagram.com")) socialLinks.instagram = href;
    if (!socialLinks.youtube && href.includes("youtube.com")) socialLinks.youtube = href;
    if (!socialLinks.ok && href.includes("ok.ru")) socialLinks.ok = href;
    if (!socialLinks.facebook && (href.includes("facebook.com") || href.includes("fb.com")))
      socialLinks.facebook = href;
    if (!socialLinks.twitter && (href.includes("twitter.com") || href.includes("x.com")))
      socialLinks.twitter = href;
  });

  // Vacancies / blog / cases
  const linkTextsAndHrefs = $("a[href]")
    .map((_, el) => ({ href: $(el).attr("href") ?? "", text: $(el).text().toLowerCase() }))
    .get();

  const hasVacanciesLink = linkTextsAndHrefs.some(
    ({ href, text }) =>
      href.includes("vakans") ||
      href.includes("career") ||
      href.includes("/job") ||
      text.includes("вакансии") ||
      text.includes("работа у нас") ||
      text.includes("карьера")
  );

  const hasBlogOrCases = linkTextsAndHrefs.some(
    ({ href, text }) =>
      href.includes("blog") ||
      href.includes("case") ||
      href.includes("portfolio") ||
      text.includes("блог") ||
      text.includes("кейсы") ||
      text.includes("портфолио") ||
      text.includes("статьи")
  );

  // Tech stack detection
  const htmlLower = html.toLowerCase();
  const techStack: string[] = [];
  const techPatterns: [string, string][] = [
    ["Next.js", "__next"],
    ["React", "__react"],
    ["Vue.js", "__vue"],
    ["Angular", "ng-version"],
    ["jQuery", "jquery"],
    ["WordPress", "wp-content"],
    ["Bitrix", "1c-bitrix"],
    ["Tilda", "tildacdn"],
    ["Bootstrap", "bootstrap.min"],
    ["Яндекс.Метрика", "mc.yandex.ru/metrika"],
    ["Google Tag Manager", "googletagmanager.com"],
    ["Google Analytics", "google-analytics.com"],
  ];
  for (const [name, pattern] of techPatterns) {
    if (htmlLower.includes(pattern)) techStack.push(name);
  }

  // Raw text for Claude context
  $("script, style, noscript, svg").remove();
  const rawText = $("body").text().replace(/\s+/g, " ").trim();
  const rawTextSample = rawText.slice(0, 3000);
  const jsHeavy = rawText.length < 300;

  // Robots.txt and sitemap (parallel, short timeout)
  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    checkUrl(`${origin}/robots.txt`),
    checkUrl(`${origin}/sitemap.xml`),
  ]);

  return {
    url: finalUrl,
    title,
    metaDescription,
    metaKeywords,
    h1,
    h2,
    imageCount,
    imagesWithAlt,
    socialLinks,
    techStack,
    hasRobotsTxt,
    hasSitemap,
    hasCanonical,
    hasViewport,
    hasSchemaMarkup,
    hasVacanciesLink,
    hasBlogOrCases,
    isHttps,
    jsHeavy,
    rawTextSample,
  };
}
