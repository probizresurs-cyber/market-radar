/**
 * /api/keyso/market-share — доли рынка в нише
 *
 * Принимает список доменов (наша компания + конкуренты),
 * возвращает доли видимости в процентах.
 */
import { NextResponse } from "next/server";
import { fetchMarketShare, type KeysoBase } from "@/lib/keyso-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { domains, base = "msk" } = await req.json() as {
      domains: string[];
      base?: KeysoBase;
    };

    if (!Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json({ ok: false, error: "domains array required" }, { status: 400 });
    }

    if (domains.length > 20) {
      return NextResponse.json({ ok: false, error: "max 20 domains" }, { status: 400 });
    }

    const shares = await fetchMarketShare(domains, base);
    return NextResponse.json({ ok: true, shares });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
