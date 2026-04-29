/**
 * /api/keyso/site-insights — SEO детали о компании
 *
 * Топовые страницы по органике + потерянные ключи.
 * (Бэклинки/анкоры/темы — только через асинхронный report/site/... flow, не реализован)
 */
import { NextResponse } from "next/server";
import {
  fetchTopPages,
  fetchLostKeywords,
  type KeysoBase,
} from "@/lib/keyso-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { domain, base = "msk" } = await req.json() as { domain: string; base?: KeysoBase };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }

    const [topPages, lostKeywords] = await Promise.all([
      fetchTopPages(domain, base, 12),
      fetchLostKeywords(domain, base, 15),
    ]);

    return NextResponse.json({
      ok: true,
      domain,
      topPages,
      lostKeywords,
      stats: {
        topPagesCount: topPages.length,
        lostKeywordsCount: lostKeywords.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
