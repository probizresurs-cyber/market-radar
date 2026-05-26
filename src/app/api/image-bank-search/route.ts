/**
 * GET /api/image-bank-search?q=<query>&provider=unsplash|pexels&count=10
 *
 * Поиск high-res фото для лендингов / презентаций / постов через бесплатные
 * stock-API. Юзер выбирает изображение → URL подставляется в hero / blog-post.
 *
 * Поддерживаем:
 *   - Unsplash (50 req/h free, нужен UNSPLASH_ACCESS_KEY)
 *   - Pexels (200 req/h free, нужен PEXELS_API_KEY)
 *
 * Если ни один ключ не настроен → возвращаем пустой массив + warning.
 * Auth обязателен (защита от анонимного abuse наших API-ключей).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchWithTimeout, FAST_TIMEOUT_MS } from "@/lib/fetch-timeout";

export const runtime = "nodejs";
export const maxDuration = 15;

interface ImageResult {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  author: string;
  authorUrl?: string;
  source: "unsplash" | "pexels";
  attribution: string; // юзер должен показать на лендинге согласно лицензии
}

async function searchUnsplash(query: string, count: number): Promise<ImageResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&content_filter=high`;
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Client-ID ${key}` },
  }, FAST_TIMEOUT_MS);
  if (!res.ok) return [];
  const json = await res.json() as {
    results?: Array<{
      id: string;
      urls: { thumb: string; regular: string; full: string };
      width: number;
      height: number;
      user: { name: string; links: { html: string } };
    }>;
  };
  return (json.results ?? []).map(p => ({
    id: `unsplash-${p.id}`,
    thumbUrl: p.urls.thumb,
    fullUrl: p.urls.regular,
    width: p.width,
    height: p.height,
    author: p.user.name,
    authorUrl: p.user.links.html,
    source: "unsplash",
    attribution: `Photo by ${p.user.name} on Unsplash`,
  }));
}

async function searchPexels(query: string, count: number): Promise<ImageResult[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`;
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: key },
  }, FAST_TIMEOUT_MS);
  if (!res.ok) return [];
  const json = await res.json() as {
    photos?: Array<{
      id: number;
      src: { small: string; large: string; original: string };
      width: number;
      height: number;
      photographer: string;
      photographer_url: string;
    }>;
  };
  return (json.photos ?? []).map(p => ({
    id: `pexels-${p.id}`,
    thumbUrl: p.src.small,
    fullUrl: p.src.large,
    width: p.width,
    height: p.height,
    author: p.photographer,
    authorUrl: p.photographer_url,
    source: "pexels",
    attribution: `Photo by ${p.photographer} on Pexels`,
  }));
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) {
    return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
  }
  const provider = searchParams.get("provider") ?? "both";
  const count = Math.min(20, Math.max(1, Number(searchParams.get("count") ?? 10)));

  const warnings: string[] = [];
  if (provider !== "pexels" && !process.env.UNSPLASH_ACCESS_KEY) {
    warnings.push("UNSPLASH_ACCESS_KEY не настроен");
  }
  if (provider !== "unsplash" && !process.env.PEXELS_API_KEY) {
    warnings.push("PEXELS_API_KEY не настроен");
  }

  const results: ImageResult[] = [];
  try {
    if (provider === "unsplash") {
      results.push(...(await searchUnsplash(q, count)));
    } else if (provider === "pexels") {
      results.push(...(await searchPexels(q, count)));
    } else {
      // Both: разделим count пополам.
      const half = Math.max(1, Math.floor(count / 2));
      const [u, p] = await Promise.all([
        searchUnsplash(q, half),
        searchPexels(q, count - half),
      ]);
      results.push(...u, ...p);
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Search failed",
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { results, warnings } });
}
