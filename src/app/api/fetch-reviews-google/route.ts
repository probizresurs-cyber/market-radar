import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Google Places API — search by name, get up to 5 most recent reviews
// Free tier: up to 5 reviews per place

type PlaceResult = { place_id: string; name?: string; rating?: number; user_ratings_total?: number };

/** Extract city from an address string (takes part that looks like a city/region) */
function extractCity(address: string): string {
  if (!address) return "";
  // Look for common city names in the address
  const cityMatch = address.match(/\b(Москва|Санкт-Петербург|Moscow|Saint Petersburg|Novosibirsk|Yekaterinburg|Kazan|Нижний Новгород|Екатеринбург|Казань|Новосибирск|Самара|Уфа|Ростов|Челябинск|Омск|Краснодар|Воронеж|Пермь|Волгоград)\b/i);
  if (cityMatch) return cityMatch[1];
  // Otherwise take second-to-last comma-separated chunk (often city in "street, city, country" format)
  const parts = address.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3] ?? "";
  if (parts.length === 2) return parts[0] ?? "";
  return "";
}

/** Extract Latin/English portion from a name that may mix Cyrillic and Latin */
function extractLatinName(name: string): string {
  // Find text in parentheses — often the transliterated name
  const inParens = name.match(/\(([A-Za-z0-9\-\s]+)\)/);
  if (inParens) return inParens[1].trim();
  // Take any Latin run of 3+ chars
  const latinRun = name.match(/[A-Za-z][A-Za-z0-9\-]{2,}/g);
  if (latinRun) return latinRun.join(" ").trim();
  return "";
}

/** Run a Places text search and return first result, or null */
async function searchPlace(query: string, apiKey: string): Promise<PlaceResult | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=ru`,
  );
  if (!res.ok) return null;
  const data = await res.json() as {
    results?: PlaceResult[];
    status?: string;
  };
  if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") return null;
  return data.results?.[0] ?? null;
}

/** Use findplacefromtext for a single precise match */
async function findPlace(query: string, apiKey: string): Promise<PlaceResult | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total&key=${apiKey}&language=ru`,
  );
  if (!res.ok) return null;
  const data = await res.json() as {
    candidates?: PlaceResult[];
    status?: string;
  };
  if (data.status === "REQUEST_DENIED") return null;
  return data.candidates?.[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const address: string = body.address ?? "";

    if (!companyName.trim()) {
      return NextResponse.json({ ok: false, error: "Название компании не передано" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GOOGLE_PLACES_API_KEY не настроен" }, { status: 500 });
    }

    const city = extractCity(address);
    const latinName = extractLatinName(companyName);

    // Build ordered list of queries to try (most specific → least specific)
    const queries: string[] = [];

    if (address.trim()) {
      // 1. findplacefromtext with name + city (most reliable for known company)
      if (city) queries.push(`${companyName} ${city}`);
      if (latinName && city) queries.push(`${latinName} ${city}`);
      // 2. textsearch with name + first line of address
      const firstLine = address.split(",")[0]?.trim();
      if (firstLine) queries.push(`${companyName} ${firstLine}`);
      // 3. name + full address (original approach, may work for some)
      queries.push(`${companyName} ${address}`);
    }
    // Always add fallback: name only
    queries.push(companyName);
    if (latinName && latinName !== companyName) queries.push(latinName);

    // Deduplicate
    const uniqueQueries = [...new Set(queries)];

    // Try findplacefromtext first for each query (more precise), then textsearch
    let place: PlaceResult | null = null;

    for (const q of uniqueQueries) {
      // Try findplacefromtext
      place = await findPlace(q, apiKey);
      if (place?.place_id) break;
      // Try textsearch
      place = await searchPlace(q, apiKey);
      if (place?.place_id) break;
    }

    if (!place) {
      return NextResponse.json({ ok: true, data: { reviews: [], rating: 0, reviewCount: 0 } });
    }

    // Step 2: Get reviews via Place Details
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}&language=ru&reviews_sort=newest`,
    );
    const detailsData = await detailsRes.json() as {
      result?: {
        name?: string;
        rating?: number;
        user_ratings_total?: number;
        reviews?: Array<{
          author_name: string;
          rating: number;
          text: string;
          time: number;
          relative_time_description?: string;
        }>;
      };
      status?: string;
    };

    const details = detailsData.result;
    if (!details) {
      return NextResponse.json({ ok: true, data: { reviews: [], rating: place.rating ?? 0, reviewCount: place.user_ratings_total ?? 0 } });
    }

    const reviews: Review[] = (details.reviews ?? []).map((r, i) => ({
      id: `google-${place!.place_id}-${i}`,
      platform: "google",
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      date: r.relative_time_description ?? new Date(r.time * 1000).toLocaleDateString("ru"),
    }));

    return NextResponse.json({
      ok: true,
      data: {
        reviews,
        rating: details.rating ?? 0,
        reviewCount: details.user_ratings_total ?? 0,
        placeId: place.place_id,
        placeName: details.name,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
