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

async function fetchReddit(query: string): Promise<TrendItem[]> {
  // Reddit's public JSON API — no auth required, just a User-Agent
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=20&type=link&t=month`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data?.data?.children ?? [];
    return posts
      .filter((p: { data: { score: number } }) => p.data.score > 0)
      .map((p: { data: { title: string; url: string; subreddit_name_prefixed: string; created_utc: number; selftext: string; permalink: string } }) => ({
        title: p.data.title,
        link: p.data.url.startsWith("http") ? p.data.url : `https://reddit.com${p.data.permalink}`,
        source: `Reddit / ${p.data.subreddit_name_prefixed}`,
        publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
        description: p.data.selftext?.slice(0, 280) || undefined,
      }))
      .slice(0, 15);
  } catch {
    return [];
  }
}

async function fetchRedditRu(query: string): Promise<TrendItem[]> {
  // Russian subreddits — better coverage for RU topics
  const subreddits = ["ru", "russia", "russianbusiness", "marketing"];
  const allResults: TrendItem[] = [];
  await Promise.all(
    subreddits.map(async (sub) => {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=new&restrict_sr=1&limit=8&t=month`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA, "Accept": "application/json" },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const data = await res.json();
        const posts = data?.data?.children ?? [];
        for (const p of posts) {
          if (p.data.score > 0) {
            allResults.push({
              title: p.data.title,
              link: `https://reddit.com${p.data.permalink}`,
              source: `Reddit / r/${sub}`,
              publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
              description: p.data.selftext?.slice(0, 280) || undefined,
            });
          }
        }
      } catch { /* ignore */ }
    })
  );
  return allResults.slice(0, 15);
}

async function fetchPikabu(query: string): Promise<TrendItem[]> {
  // Pikabu — Russian Reddit alternative, has full RSS feed
  const url = `https://pikabu.ru/rss.php`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const all = parseRss(xml, "Pikabu");
  if (!query) return all.slice(0, 10);
  const q = query.toLowerCase();
  const filtered = all.filter(
    i => i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)
  );
  // If no direct match, return top recent posts (general audience content)
  return (filtered.length > 0 ? filtered : all).slice(0, 10);
}

async function fetchYouTubeTrends(query: string): Promise<TrendItem[]> {
  // YouTube search page — parse video titles from initial data JSON blob
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAISAhAB`; // sp = upload date filter
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract ytInitialData JSON
    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!match) return [];

    let ytData: Record<string, unknown>;
    try { ytData = JSON.parse(match[1]); } catch { return []; }

    // Navigate to video results
    const contents =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytData as any)?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

    const items: TrendItem[] = [];
    for (const item of contents) {
      const vr = item?.videoRenderer;
      if (!vr) continue;
      const title = vr.title?.runs?.[0]?.text ?? "";
      const videoId = vr.videoId ?? "";
      if (!title || !videoId) continue;
      const published = vr.publishedTimeText?.simpleText ?? "";
      items.push({
        title,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        source: "YouTube",
        publishedAt: new Date().toISOString(), // exact date not in initial data
        description: published ? `Опубликовано: ${published}` : undefined,
      });
      if (items.length >= 10) break;
    }
    return items;
  } catch {
    return [];
  }
}

// ── SocialCrawl (TikTok + Instagram) ─────────────────────────────────────────
// Free 100 credits, no CC — sign up at https://www.socialcrawl.dev/
// Set SOCIALCRAWL_API_KEY in .env to enable these sources.

async function fetchSocialCrawl(
  platform: "tiktok" | "instagram",
  query: string,
  limit = 12
): Promise<TrendItem[]> {
  const key = process.env.SOCIALCRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.socialcrawl.dev/search", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({ platform, query, limit }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: Array<{
      title?: string;
      caption?: string;
      description?: string;
      url?: string;
      link?: string;
      created_at?: string;
      published_at?: string;
      author?: string;
      username?: string;
    }> = Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];

    return results.map(item => ({
      title: item.title || item.caption || item.description || "(без заголовка)",
      link: item.url || item.link || "#",
      source: platform === "tiktok" ? "TikTok" : "Instagram",
      publishedAt: item.created_at || item.published_at || new Date().toISOString(),
      description: item.description?.slice(0, 280) || undefined,
    })).filter(i => i.title && i.link !== "#").slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchTikTok(query: string): Promise<TrendItem[]> {
  return fetchSocialCrawl("tiktok", query);
}

async function fetchInstagram(query: string): Promise<TrendItem[]> {
  return fetchSocialCrawl("instagram", query);
}

const SOURCE_FETCHERS: Record<string, (q: string) => Promise<TrendItem[]>> = {
  yandex_news: fetchYandexNews,
  google_news_en: fetchGoogleNewsEn,
  habr: fetchHabr,
  vc: fetchVcRu,
  cossa: fetchCossa,
  reddit: fetchReddit,
  reddit_ru: fetchRedditRu,
  pikabu: fetchPikabu,
  youtube: fetchYouTubeTrends,
  tiktok: fetchTikTok,
  instagram: fetchInstagram,
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
