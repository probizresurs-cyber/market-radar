import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Google Places API — search by name, get up to 5 most recent reviews
// Free tier: up to 5 reviews per place

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";

    if (!companyName.trim()) {
      return NextResponse.json({ ok: false, error: "Название компании не передано" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GOOGLE_PLACES_API_KEY не настроен" }, { status: 500 });
    }

    // Step 1: Find place_id
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(companyName)}&key=${apiKey}&language=ru`,
    );
    const searchData = await searchRes.json() as {
      results?: Array<{ place_id: string; name?: string; rating?: number; user_ratings_total?: number }>;
      status?: string;
      error_message?: string;
    };

    if (searchData.status === "REQUEST_DENIED" || searchData.status === "INVALID_REQUEST") {
      return NextResponse.json({ ok: false, error: `Google Places: ${searchData.error_message ?? searchData.status}` }, { status: 500 });
    }

    const place = searchData.results?.[0];
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
      id: `google-${place.place_id}-${i}`,
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
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
