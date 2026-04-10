import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 30;

// 2GIS public API — no auth required
// User provides a 2GIS firm URL like https://2gis.ru/moscow/firm/70000001012345678
// We extract the firm ID and fetch reviews

function extractFirmId(url: string): string | null {
  // https://2gis.ru/city/firm/FIRM_ID or /firm/FIRM_ID/...
  const match = url.match(/firm\/(\d+)/);
  return match ? match[1] : null;
}

interface GisReviewItem {
  text?: string;
  rating?: number;
  date_created?: string;
  user?: { name?: string };
  official_answer?: { text?: string };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url: string = body.url ?? "";

    const firmId = extractFirmId(url);
    if (!firmId) {
      return NextResponse.json(
        { ok: false, error: "Не удалось определить ID организации. Вставьте ссылку формата: https://2gis.ru/город/firm/ID" },
        { status: 400 },
      );
    }

    const apiKey = process.env.TWOGIS_API_KEY;

    // 2GIS public reviews API
    const apiUrl = apiKey
      ? `https://public-api.reviews.2gis.com/2.0/branches/${firmId}/reviews?limit=50&is_advertiser=false&fields=reviews.text,reviews.rating,reviews.date_created,reviews.user,reviews.official_answer&key=${apiKey}`
      : `https://public-api.reviews.2gis.com/2.0/branches/${firmId}/reviews?limit=50&is_advertiser=false&fields=reviews.text,reviews.rating,reviews.date_created,reviews.user,reviews.official_answer`;

    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { ok: false, error: `2GIS API error ${res.status}: ${errText.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const data = await res.json() as {
      reviews?: GisReviewItem[];
      meta?: { total_count?: number };
    };

    const reviews: Review[] = (data.reviews ?? [])
      .filter((r: GisReviewItem) => r.text)
      .map((r: GisReviewItem, i: number) => ({
        id: `2gis-${firmId}-${i}`,
        platform: "2gis",
        author: r.user?.name ?? "Пользователь 2ГИС",
        rating: Math.min(5, Math.max(1, r.rating ?? 3)),
        text: r.text ?? "",
        date: r.date_created ?? "",
        reply: r.official_answer?.text,
      }));

    return NextResponse.json({
      ok: true,
      data: {
        platform: "2gis",
        reviews,
        totalOnPlatform: data.meta?.total_count ?? reviews.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
