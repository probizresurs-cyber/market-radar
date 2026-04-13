import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 30;

function extractFirmId(url: string): string | null {
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

interface GisCatalogItem {
  id?: string;
  reviews?: { general_rating?: number; general_review_count?: number };
  stat?: { review_count?: number };
}

async function fetchReviewsByFirmId(firmId: string, apiKey?: string): Promise<{ reviews: Review[]; total: number }> {
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  const apiUrl = `https://public-api.reviews.2gis.com/2.0/branches/${firmId}/reviews?limit=50&is_advertiser=false&fields=reviews.text,reviews.rating,reviews.date_created,reviews.user,reviews.official_answer${keyParam}`;

  const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`2GIS reviews API error ${res.status}`);

  const data = await res.json() as { reviews?: GisReviewItem[]; meta?: { total_count?: number } };

  const reviews: Review[] = (data.reviews ?? [])
    .filter((r) => r.text)
    .map((r, i) => ({
      id: `2gis-${firmId}-${i}`,
      platform: "2gis",
      author: r.user?.name ?? "Пользователь 2ГИС",
      rating: Math.min(5, Math.max(1, r.rating ?? 3)),
      text: r.text ?? "",
      date: r.date_created ?? "",
      reply: r.official_answer?.text,
    }));

  return { reviews, total: data.meta?.total_count ?? reviews.length };
}

async function searchFirmByName(name: string, address?: string, apiKey?: string): Promise<string | null> {
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  // Combine name + address for a more precise search query
  const query = address?.trim() ? `${name} ${address.trim()}` : name;
  const res = await fetch(
    `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(query)}&type=branch&fields=items.reviews,items.stat${keyParam}&page_size=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json() as { result?: { items?: GisCatalogItem[] } };
  return data.result?.items?.[0]?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url: string = body.url ?? "";
    const companyName: string = body.companyName ?? "";
    const address: string = body.address ?? "";

    const apiKey = process.env.TWOGIS_API_KEY;

    let firmId: string | null = null;

    // Prefer URL-based lookup (exact), fall back to name+address search
    if (url.trim()) {
      firmId = extractFirmId(url);
      if (!firmId) {
        return NextResponse.json(
          { ok: false, error: "Не удалось определить ID организации. Формат ссылки: https://2gis.ru/город/firm/ID" },
          { status: 400 },
        );
      }
    } else if (companyName.trim()) {
      firmId = await searchFirmByName(companyName, address || undefined, apiKey);
      if (!firmId) {
        return NextResponse.json({ ok: true, data: { platform: "2gis", reviews: [], totalOnPlatform: 0 } });
      }
    } else {
      return NextResponse.json({ ok: false, error: "Укажите ссылку или название компании" }, { status: 400 });
    }

    const { reviews, total } = await fetchReviewsByFirmId(firmId, apiKey);

    return NextResponse.json({ ok: true, data: { platform: "2gis", reviews, totalOnPlatform: total } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
