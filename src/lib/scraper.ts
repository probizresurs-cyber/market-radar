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

/**
 * Лимит на размер HTML.
 *
 * Был 500 КБ — и это ровно тот случай, когда экономия памяти ломала данные:
 * блок с соцсетями почти всегда лежит в подвале, то есть в самом конце
 * документа. Конструкторы (Tilda, Bitrix) легко отдают 0.5–1.5 МБ разметки,
 * обрезка по 500 КБ отрезала именно подвал — и КП честно писал «соцсетей нет»,
 * хотя ссылки на Telegram и VK на странице были.
 */
const HTML_LIMIT = 2_000_000;

/**
 * Правила распознавания соцсетей — по ХОСТУ, а не по подстроке в ссылке.
 *
 * Подстрочная проверка давала ложные срабатывания: href.includes("x.com")
 * ловил любой linux.com / matrix.com / phoenix.com и записывал их в Twitter.
 * skipPath отсекает служебные ссылки — кнопки «поделиться», виджеты, oauth:
 * vk.com/share.php и t.me/share/url — это не аккаунт компании, и подставлять
 * их в socialLinks значит отправить энричер считать подписчиков у несуществующего
 * профиля.
 */
const SOCIAL_RULES: Array<{ key: string; host: RegExp; skipPath?: RegExp }> = [
  // rtrg/api/connect/js — пиксель ретаргетинга и SDK ВКонтакте: они стоят почти
  // на каждом сайте и к аккаунту компании отношения не имеют.
  { key: "vk",        host: /^(?:[\w-]+\.)*(?:vk\.com|vk\.ru|vkontakte\.ru|vk\.link|vkvideo\.ru)$/, skipPath: /^\/(?:share|widget|away|js|im|images|video_ext|rtrg|api|connect|login|feed)\b/i },
  { key: "telegram",  host: /^(?:[\w-]+\.)*(?:t\.me|telegram\.me|telegram\.dog|tlgg\.ru)$/,          skipPath: /^\/(?:share|iv)\b/i },
  { key: "instagram", host: /^(?:[\w-]+\.)*instagram\.com$/ },
  { key: "youtube",   host: /^(?:[\w-]+\.)*(?:youtube\.com|youtu\.be)$/,                             skipPath: /^\/(?:embed|iframe_api)\b/i },
  { key: "ok",        host: /^(?:[\w-]+\.)*ok\.ru$/,                                                 skipPath: /^\/(?:dk|offer)\b/i },
  { key: "facebook",  host: /^(?:[\w-]+\.)*(?:facebook\.com|fb\.com|fb\.me)$/,                       skipPath: /^\/(?:sharer|share|plugins|tr)\b/i },
  { key: "twitter",   host: /^(?:[\w-]+\.)*(?:twitter\.com|x\.com)$/,                                skipPath: /^\/(?:intent|share|i)\b/i },
  { key: "tiktok",    host: /^(?:[\w-]+\.)*tiktok\.com$/ },
  { key: "dzen",      host: /^(?:[\w-]+\.)*(?:dzen\.ru|zen\.yandex\.ru)$/ },
  { key: "rutube",    host: /^(?:[\w-]+\.)*rutube\.ru$/ },
];

// Мессенджеры (WhatsApp, Viber) сознательно НЕ считаем соцсетью: кнопка
// «написать в WhatsApp» есть почти везде, а СММ-аудит по ней строить нечего —
// иначе «соцсети найдены» станет правдой для любого сайта с кнопкой чата.

/** Ссылка на профиль должна иметь непустой путь: голый vk.com или t.me — это не аккаунт. */
function hasProfilePath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "").length > 1;
}

/**
 * Сводит найденный кусок ссылки к абсолютному URL и определяет соцсеть.
 * Возвращает null, если это не соцсеть или это служебная ссылка.
 */
function classifySocial(rawHref: string, base: string): { key: string; url: string } | null {
  let href = rawHref.trim();
  if (!href) return null;

  // В инлайновом JS (Tilda, Bitrix, JSON-LD) ссылки лежат экранированными:
  // "https:\/\/t.me\/company" и/или с HTML-сущностями.
  href = href
    .replace(/\\\//g, "/")
    .replace(/\\u002[fF]/g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2[fF];|&#47;/g, "/");

  // tg://resolve?domain=name — рабочая ссылка на канал, но не http-URL.
  const tg = href.match(/^tg:\/\/resolve\?domain=([\w.]+)/i);
  if (tg) return { key: "telegram", url: `https://t.me/${tg[1]}` };

  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.toLowerCase();
  for (const rule of SOCIAL_RULES) {
    if (!rule.host.test(host)) continue;
    if (rule.skipPath?.test(u.pathname)) return null;
    if (!hasProfilePath(u.pathname)) return null;
    return { key: rule.key, url: u.toString() };
  }
  return null;
}

export async function scrapeWebsite(rawUrl: string): Promise<ScrapedData> {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  let html: string;
  let finalUrl = url;
  let htmlTruncated = false;

  try {
    const res = await fetchWithTimeout(url);
    finalUrl = res.url || url;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
    const text = await res.text();
    htmlTruncated = text.length > HTML_LIMIT;
    html = htmlTruncated ? text.slice(0, HTML_LIMIT) : text;
  } catch (err) {
    // Fallback: try http:// if https:// failed
    if (url.startsWith("https://")) {
      const httpUrl = url.replace("https://", "http://");
      const res = await fetchWithTimeout(httpUrl);
      finalUrl = res.url || httpUrl;
      const text = await res.text();
      htmlTruncated = text.length > HTML_LIMIT;
      html = htmlTruncated ? text.slice(0, HTML_LIMIT) : text;
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

  // ─── Соцсети ──────────────────────────────────────────────────────────────
  // Три источника, по убыванию доверия. Раньше был только первый — и ссылки,
  // которые сайт отдаёт иконкой без текста, через data-атрибут или из
  // инлайнового JS конструктора, терялись целиком.
  const socialLinks: Record<string, string> = {};
  const addSocial = (raw: string | undefined) => {
    if (!raw) return;
    const hit = classifySocial(raw, finalUrl);
    if (hit && !socialLinks[hit.key]) socialLinks[hit.key] = hit.url;
  };

  // 1. Обычные ссылки и типовые «ссылка в атрибуте» (иконки-дивы с data-href).
  $("a[href], area[href], [data-href], [data-url], [data-link]").each((_, el) => {
    const $el = $(el);
    addSocial($el.attr("href"));
    addSocial($el.attr("data-href"));
    addSocial($el.attr("data-url"));
    addSocial($el.attr("data-link"));
  });

  // 2. Schema.org sameAs — там аккаунты перечислены явно и без мусора.
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).text();
    if (!txt.includes("sameAs")) return;
    for (const m of txt.matchAll(/"(https?:[^"]+)"/g)) addSocial(m[1]);
  });

  // 3. Подметание по сырому HTML — последний рубеж: ловит ссылки, зашитые в
  //    JS-конфиги конструкторов и в onclick, где DOM-парсер их не видит.
  //    Работает только на ключи, которых ещё нет, чтобы «настоящая» ссылка из
  //    разметки всегда была приоритетнее случайного упоминания в скрипте.
  //    Экранирование снимаем заранее: в JS-строках путь приходит как
  //    "https:\/\/t.me\/company", и без этого регулярка обрывалась на хосте.
  const sweepSource = html.replace(/\\\//g, "/").replace(/\\u002[fF]/g, "/");
  const socialSweep =
    /(?:https?:)?\/\/(?:[\w-]+\.)*(?:vk\.com|vk\.ru|vkontakte\.ru|vk\.link|vkvideo\.ru|t\.me|telegram\.me|telegram\.dog|tlgg\.ru|instagram\.com|youtube\.com|youtu\.be|ok\.ru|facebook\.com|fb\.com|fb\.me|twitter\.com|x\.com|tiktok\.com|dzen\.ru|zen\.yandex\.ru|rutube\.ru)[^\s"'<>()\\]*/gi;
  for (const m of sweepSource.matchAll(socialSweep)) addSocial(m[0]);
  for (const m of sweepSource.matchAll(/tg:\/\/resolve\?domain=[\w.]+/gi)) addSocial(m[0]);

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
    htmlTruncated,
  };
}
