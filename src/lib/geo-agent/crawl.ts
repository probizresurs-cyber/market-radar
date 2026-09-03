/**
 * Обход сайта глазами краулера ассистента.
 *
 * Принципы:
 *   - Реальный UA браузера + отдельный заход под GPTBot: разница в статусе
 *     или размере — это клоакинг/бот-щит, и ассистент видит именно второе.
 *   - Никакого JS: краулеры ассистентов не исполняют скрипты. Что в сыром
 *     HTML — то и есть страница для модели.
 *   - «Нет данных» — не ответ. 403/429/500 — это находка, а не сбой.
 *   - Ссылки из llms.txt проверяются на 200: ассистент идёт ровно по ним.
 */
import type { FetchProbe, PageAudit, SiteCrawl } from "./types";
import { auditLlmsTxt, auditRobots, auditSitemap, extractLlmsLinks, parseSitemap, type SitemapEntry } from "./discovery";
import { hostOf, parsePage, unreadablePage } from "./html";
import { bingIndexCheck } from "./external";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
export const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|mp4|mp3|zip|docx?|xlsx?|pptx?|xml|json|txt|css|js)(\?|$)/i;

export interface FetchResult { probe: FetchProbe; body: string }

export async function probe(url: string, ua: string, timeoutMs = 20_000): Promise<FetchResult> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
    });
    const ttfbMs = Date.now() - t0;
    const body = await r.text();
    const botStub = r.status === 200 && body.length < 4000 && !/<(p|article|section|main)[\s>]/i.test(body);
    return { probe: { status: r.status, ok: r.ok && !botStub, bytes: body.length, ttfbMs, botStub, finalUrl: r.url }, body };
  } catch (e) {
    return {
      probe: { status: 0, ok: false, bytes: 0, ttfbMs: Date.now() - t0, botStub: false, finalUrl: url, error: e instanceof Error ? e.message : "fetch failed" },
      body: "",
    };
  }
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    const txt = await r.text();
    // Next/SPA часто отдают 200 + HTML-страницу вместо 404 для /llms.txt.
    if (/text\/html/i.test(ct) && /<html/i.test(txt)) return null;
    return txt;
  } catch { return null; }
}

async function statusOf(url: string): Promise<number> {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000), redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
    if (r.status === 405 || r.status === 403) {
      const g = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
      return g.status;
    }
    return r.status;
  } catch { return 0; }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

export function normalizeOrigin(input: string): { origin: string; domain: string } {
  const withProto = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  const u = new URL(withProto);
  return { origin: u.origin, domain: u.hostname.replace(/^www\./, "").toLowerCase() };
}

function cleanUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    // utm и прочий трекинг — не отдельные страницы.
    for (const k of Array.from(x.searchParams.keys())) if (/^(utm_|yclid|gclid|fbclid|_ga)/i.test(k)) x.searchParams.delete(k);
    return x.toString().replace(/\/$/, "") || x.origin;
  } catch { return u; }
}

/** Выбираем, какие страницы проверить: главная, sitemap по приоритету, ссылки llms.txt. */
function pickPages(origin: string, domain: string, sitemap: SitemapEntry[], llmsLinks: string[], maxPages: number): Array<{ url: string; source: PageAudit["source"] }> {
  const chosen = new Map<string, PageAudit["source"]>();
  const home = cleanUrl(origin + "/");
  chosen.set(home, "home");

  const own = (u: string) => { const h = hostOf(u); return h === domain || h.endsWith(`.${domain}`); };

  const fromLlms = llmsLinks.filter(own).map(cleanUrl).filter(u => !SKIP_EXT.test(u));
  const fromSitemap = sitemap
    .filter(e => own(e.loc) && !e.loc.includes("#") && !SKIP_EXT.test(e.loc))
    .sort((a, b) => (b.priority ?? 0.5) - (a.priority ?? 0.5) || a.loc.length - b.loc.length)
    .map(e => cleanUrl(e.loc));

  // Чередуем: сначала верх sitemap (услуги/продукты), потом то, что сайт сам рекламирует в llms.txt,
  // потом остальное — чтобы в выборку попали и посадочные, и статьи.
  const queue: Array<[string, PageAudit["source"]]> = [];
  const top = fromSitemap.slice(0, Math.ceil(maxPages / 2));
  for (const u of top) queue.push([u, "sitemap"]);
  for (const u of fromLlms) queue.push([u, "llms"]);
  for (const u of fromSitemap.slice(top.length)) queue.push([u, "sitemap"]);

  for (const [u, src] of queue) {
    if (chosen.size >= maxPages) break;
    if (!chosen.has(u)) chosen.set(u, src);
  }
  return Array.from(chosen, ([url, source]) => ({ url, source }));
}

export interface CrawlOptions {
  maxPages?: number;
  brandName?: string;
  onProgress?: (stage: string, detail?: string) => void;
}

export async function crawlSite(websiteUrl: string, opts: CrawlOptions = {}): Promise<SiteCrawl> {
  const t0 = Date.now();
  const maxPages = Math.max(3, Math.min(opts.maxPages ?? 12, 40));
  const { origin, domain } = normalizeOrigin(websiteUrl);
  const log = opts.onProgress ?? (() => {});

  log("discovery", "robots.txt, llms.txt, sitemap.xml");
  const [robotsTxt, llmsTxt, llmsFull] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/llms.txt`),
    fetchText(`${origin}/llms-full.txt`, 8_000),
  ]);
  const robots = auditRobots(robotsTxt);
  const llms = auditLlmsTxt(llmsTxt, llmsFull != null);

  // Sitemap: из robots или по умолчанию; sitemapindex раскрываем на 3 уровня вглубь.
  const sitemapUrls = robots.sitemaps.length ? robots.sitemaps.slice(0, 3) : [`${origin}/sitemap.xml`];
  let entries: SitemapEntry[] | null = null;
  const seenMaps = new Set<string>();
  const stack = [...sitemapUrls];
  while (stack.length && seenMaps.size < 6) {
    const u = stack.shift()!;
    if (seenMaps.has(u)) continue;
    seenMaps.add(u);
    const xml = await fetchText(u);
    if (!xml) continue;
    const parsed = parseSitemap(xml);
    entries = [...(entries ?? []), ...parsed.entries];
    stack.push(...parsed.children.slice(0, 5));
  }
  const sitemap = auditSitemap(entries);

  // Ссылки из llms.txt должны открываться — проверяем до 20 штук.
  const llmsLinks = llmsTxt ? extractLlmsLinks(llmsTxt) : [];
  if (llmsLinks.length) {
    log("llms-links", `${Math.min(llmsLinks.length, 20)} ссылок`);
    const own = llmsLinks.filter(l => { const h = hostOf(l); return h === domain || h.endsWith(`.${domain}`); }).slice(0, 20);
    const statuses = await pool(own, 5, async l => ({ l, s: await statusOf(l) }));
    llms.brokenLinks = statuses.filter(x => x.s === 0 || x.s >= 400).map(x => `${x.l} → ${x.s || "нет ответа"}`);
  }

  // ── Страницы ────────────────────────────────────────────────
  const targets = pickPages(origin, domain, entries ?? [], llmsLinks, maxPages);
  log("pages", `${targets.length} страниц`);
  const bingPromise = bingIndexCheck(domain);

  const pages = await pool(targets, 4, async ({ url, source }) => {
    const { probe: browser, body } = await probe(url, BROWSER_UA);
    // Заход под GPTBot — для главной и первых 5 страниц (дальше картина не меняется).
    const idx = targets.findIndex(t => t.url === url);
    const aiBot = idx < 6 ? (await probe(url, GPTBOT_UA, 15_000)).probe : undefined;
    if (!browser.ok || !body) return unreadablePage(url, source, browser, aiBot);
    return parsePage({ url, source, browser, aiBot, html: body, domain });
  });

  const brokenPages = pages
    .filter(p => !p.browser.ok)
    .map(p => ({ url: p.url, status: p.browser.status, source: p.source }));

  const entityNames = Array.from(new Set(pages.map(p => p.jsonLd.organization?.name).filter((n): n is string => !!n)));

  const bing = await bingPromise;

  return {
    origin, domain,
    brandName: opts.brandName?.trim() || entityNames[0] || guessBrand(pages, domain),
    robots, llms, sitemap, pages,
    sitemapUrls: (entries ?? []).map(e => e.loc),
    bing,
    brokenPages, entityNames,
    durationMs: Date.now() - t0,
  };
}

function guessBrand(pages: PageAudit[], domain: string): string {
  const home = pages.find(p => p.source === "home");
  const t = home?.title ?? "";
  // «Название — слоган» / «Название | Слоган» / «Слоган · Название»
  const parts = t.split(/\s[—|·|:-]\s/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.reduce((a, b) => (a.length <= b.length ? a : b));
  return parts[0] || domain.split(".")[0];
}
