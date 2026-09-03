/**
 * Внешние проверки без ключей.
 *
 * Bing — retrieval-слой ChatGPT Search и Copilot: по данным Seer Interactive
 * 87 % источников ChatGPT совпадают с топом Bing. Поэтому «есть ли сайт в
 * Bing» — первая внешняя проверка, и она бесплатная: страница результатов
 * `site:домен` отдаётся без ключа. Разметка Bing меняется — при любом
 * сбое возвращаем ok:false, и проверка в отчёте помечается «не удалось»,
 * а не «сайта нет в Bing».
 */
import type { BingIndex } from "./types";
import { BROWSER_UA } from "./crawl";

export async function bingIndexCheck(domain: string): Promise<BingIndex> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(`site:${domain}`)}&setlang=ru&count=30`;
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "ru-RU,ru;q=0.9" },
    });
    if (!r.ok) return { ok: false, approxCount: 0, sampleUrls: [] };
    const html = await r.text();

    const countM = html.match(/class="sb_count"[^>]*>([^<]*)/);
    const digits = countM ? countM[1].replace(/[^\d]/g, "") : "";
    const approxCount = digits ? parseInt(digits, 10) : 0;

    const sample: string[] = [];
    const re = /<li class="b_algo"[\s\S]*?<h2>\s*<a[^>]+href="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && sample.length < 30) {
      const u = m[1].replace(/&amp;/g, "&");
      if (u.includes(domain)) sample.push(u);
    }
    // Ни счётчика, ни результатов и при этом нет фразы «ничего не найдено» — вёрстка изменилась.
    const nothing = /Нет результатов|No results|не найдено/i.test(html);
    if (!countM && sample.length === 0 && !nothing) return { ok: false, approxCount: 0, sampleUrls: [] };
    return { ok: true, approxCount: approxCount || sample.length, sampleUrls: Array.from(new Set(sample)) };
  } catch {
    return { ok: false, approxCount: 0, sampleUrls: [] };
  }
}

/** Домены, где упоминание = «мнение о бренде» для модели. Нужно для классификации площадок. */
export function classifyDomain(domain: string): "media" | "review" | "ugc" | "directory" | "video" | "wiki" | "social" | "other" {
  const d = domain.toLowerCase();
  if (/wikipedia|wikidata|ruwiki/.test(d)) return "wiki";
  if (/youtube|youtu\.be|rutube|vk\.com\/video|dzen\.ru\/video/.test(d)) return "video";
  if (/otzovik|irecommend|otzyv|trustpilot|g2\.com|capterra|yell\.ru|zoon|flamp|spr\.ru|reviews|otzyvy|prodoctorov|banki\.ru|sravni/.test(d)) return "review";
  if (/vc\.ru|habr|pikabu|reddit|quora|yandex\.ru\/q|dzen\.ru|tenchat|teletype|medium\.com|spark\.ru/.test(d)) return "ugc";
  if (/2gis|yandex\.ru\/maps|google\.com\/maps|yandex\.ru\/business|avito|profi\.ru|yandex\.ru\/uslugi|cataloxy|rusprofile|list-org|zachestnyibiznes|companies|firmy/.test(d)) return "directory";
  if (/^(t\.me|vk\.com|ok\.ru|instagram|facebook|x\.com|twitter|linkedin|tiktok)/.test(d)) return "social";
  if (/rbc|kommersant|vedomosti|forbes|cnews|tadviser|sostav|cossa|adindex|rb\.ru|seonews|searchengines|lenta|tass|ria|interfax|\.media|journal|news|блог|blog|seo|marketing/.test(d)) return "media";
  return "other";
}
