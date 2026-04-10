import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Fetches ratings from Google Places, Yandex Maps, and 2GIS by company name
// Used by dashboards to show live platform ratings

interface MapRatings {
  google: { rating: number; reviewCount: number; placeId?: string } | null;
  yandex: { rating: number; reviewCount: number } | null;
  gis: { rating: number; reviewCount: number; firmId?: string } | null;
}

async function fetchGoogleRating(name: string, apiKey: string): Promise<MapRatings["google"]> {
  try {
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${apiKey}&language=ru`,
    );
    const searchData = await searchRes.json() as {
      results?: Array<{ place_id: string; rating?: number; user_ratings_total?: number }>;
      status?: string;
    };
    const place = searchData.results?.[0];
    if (!place) return null;
    return {
      rating: place.rating ?? 0,
      reviewCount: place.user_ratings_total ?? 0,
      placeId: place.place_id,
    };
  } catch {
    return null;
  }
}

async function fetchYandexRating(name: string, apiKey: string): Promise<MapRatings["yandex"]> {
  try {
    const res = await fetch(
      `https://search-maps.yandex.ru/v1/?text=${encodeURIComponent(name)}&type=biz&lang=ru_RU&apikey=${apiKey}&results=1`,
    );
    const data = await res.json() as {
      features?: Array<{
        properties?: {
          CompanyMetaData?: {
            rating?: { average?: number; count?: number };
          };
        };
      }>;
    };
    const feature = data.features?.[0];
    const ratingData = feature?.properties?.CompanyMetaData?.rating;
    if (!ratingData) return null;
    return {
      rating: ratingData.average ?? 0,
      reviewCount: ratingData.count ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetch2GISRating(name: string, apiKey?: string): Promise<MapRatings["gis"]> {
  try {
    const keyParam = apiKey ? `&key=${apiKey}` : "";
    const res = await fetch(
      `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(name)}&type=branch&fields=items.reviews,items.stat${keyParam}&page_size=1`,
    );
    const data = await res.json() as {
      result?: {
        items?: Array<{
          id?: string;
          reviews?: { general_rating?: number; general_review_count?: number };
          stat?: { review_count?: number };
        }>;
      };
    };
    const item = data.result?.items?.[0];
    if (!item) return null;
    return {
      rating: item.reviews?.general_rating ?? 0,
      reviewCount: item.reviews?.general_review_count ?? item.stat?.review_count ?? 0,
      firmId: item.id,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";

    if (!companyName.trim()) {
      return NextResponse.json({ ok: false, error: "Название компании не передано" }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    const yandexApiKey = process.env.YANDEX_MAPS_API_KEY;
    const gisApiKey = process.env.TWOGIS_API_KEY;

    // Fetch all in parallel
    const [google, yandex, gis] = await Promise.all([
      googleApiKey ? fetchGoogleRating(companyName, googleApiKey) : Promise.resolve(null),
      yandexApiKey ? fetchYandexRating(companyName, yandexApiKey) : Promise.resolve(null),
      fetch2GISRating(companyName, gisApiKey),
    ]);

    const ratings: MapRatings = { google, yandex, gis };

    return NextResponse.json({ ok: true, data: ratings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
