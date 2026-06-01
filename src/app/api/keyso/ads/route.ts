/**
 * /api/keyso/ads — реальные объявления Я.Директ конкурента
 */
import { NextResponse } from "next/server";
import { fetchContextAds, type KeysoBase } from "@/lib/keyso-client";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  // Раньше открыт — Keys.so платная квота на запрос.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const { domain, base = "msk", limit = 20 } = await req.json() as {
      domain: string;
      base?: KeysoBase;
      limit?: number;
    };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }

    const ads = await fetchContextAds(domain, base, limit);
    return NextResponse.json({ ok: true, ads, count: ads.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
