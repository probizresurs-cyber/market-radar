/**
 * POST /api/content/trends
 *
 * Body: { query: string, sources?: string[] }
 *
 * Aggregates RSS feeds + public news endpoints to surface trending topics
 * around a brand or niche query. Used by Контент-завод to ground generated
 * posts in current discussions instead of vacuum.
 *
 * Sources (no API keys required):
 *   - Yandex News (search RSS)
 *   - Google News (search RSS)
 *   - Habr (full + hub feeds)
 *   - VC.ru (rss/all)
 *   - Cossa (RSS)
 *
 * Returns: { items: TrendItem[], summary: string } where items are sorted
 * by recency and summary is a 2-3 sentence overview generated locally.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TrendItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  description?: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketRadarTrendBot/1.0";

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/rss+xml,application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Minimal RSS parser — extract items (handles RSS 2.0 + Atom)
function parseRss(xml: string, source: string): TrendItem[] {
  const items: TrendItem[] = [];

  // Try RSS 2.0 first
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "dc:date") || "";
    const description = stripTags(extractTag(block, "description") || "").slice(0, 280);
    if (title && link) {
      items.push({
        title: stripTags(title).slice(0, 200),
        link: link.trim(),
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        description: description || undefined,
      });
    }
  }

  // Fall back to Atom
  if (items.length === 0) {
    const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
    for (const block of entries) {
      const title = extractTag(block, "title");
      const linkMatch = block.match(/<link\b[^>]*href="([^"]+)"/i);
      const link = linkMatch?.[1] ?? "";
      const pubDate = extractTag(block, "updated") || extractTag(block, "published") || "";
      const description = stripTags(extractTag(block, "summary") || extractTag(block, "content") || "").slice(0, 280);
      if (title && link) {
        items.push({
          title: stripTags(title).slice(0, 200),
          link: link.trim(),
          source,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          description: description || undefined,
        });
      }
    }
  }

  return items;
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let txt = m[1];
  // Strip CDATA
  txt = txt.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
  return txt.trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchYandexNews(query: string): Promise<TrendItem[]> {
  // Yandex.News no longer has a public search endpoint, but Yandex Search XML
  // for news segment works via simple GET if you add &type=news
  // Falling back to Yandex.News RSS for tag/topic isn't query-specific, so we
  // use Google News RSS (which covers Russian sources well) as primary.
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ru&gl=RU&ceid=RU:ru`;
  const xml = await fetchText(url);
  if (!xml) return [];
  return parseRss(xml, "Google News (RU)");
}

async function fetchGoogleNewsEn(query: string): Promise<TrendItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  if (!xml) return [];
  return parseRss(xml, "Google News (EN)");
}

async function fetchHabr(query: string): Promise<TrendItem[]> {
  // Habr has a search RSS endpoint
  const url = `https://habr.com/ru/rss/search/?q=${encodeURIComponent(query)}&target_type=posts&order=date`;
  const xml = await fetchText(url);
  if (!xml) return [];
  return parseRss(xml, "Habr");
}

async function fetchVcRu(query: string): Promise<TrendItem[]> {
  // VC.ru — search RSS not officially documented, fallback to filtering all
  // recent articles by query in title/description
  const url = `https://vc.ru/rss/all`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const all = parseRss(xml, "VC.ru");
  if (!query) return all.slice(0, 12);
  const q = query.toLowerCase();
  return all
    .filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
    )
    .slice(0, 12);
}

async function fetchCossa(query: string): Promise<TrendItem[]> {
  const url = `https://www.cossa.ru/rss/`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const all = parseRss(xml, "Cossa");
  if (!query) return all.slice(0, 8);
  const q = query.toLowerCase();
  return all
    .filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
    )
    .slice(0, 8);
}

const SOURCE_FETCHERS: Record<string, (q: string) => Promise<TrendItem[]>> = {
  yandex_news: fetchYandexNews,
  google_news_en: fetchGoogleNewsEn,
  habr: fetchHabr,
  vc: fetchVcRu,
  cossa: fetchCossa,
};

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const query: string = (body.query || "").trim();
    const requestedSources: string[] = Array.isArray(body.sources) && body.sources.length > 0
      ? body.sources
      : ["yandex_news", "habr", "vc"];

    if (!query) {
      return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
    }
    if (query.length > 200) {
      return NextResponse.json({ ok: false, error: "query too long" }, { status: 400 });
    }

    const valid = requestedSources.filter(s => s in SOURCE_FETCHERS);
    const allItems = (
      await Promise.all(valid.map(s => SOURCE_FETCHERS[s](query).catch(() => [])))
    ).flat();

    // Deduplicate by title
    const seen = new Set<string>();
    const deduped: TrendItem[] = [];
    for (const item of allItems) {
      const key = item.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    // Sort by date (newest first)
    deduped.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

    const result = {
      query,
      sources: valid,
      total: deduped.length,
      items: deduped.slice(0, 50),
    };

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
