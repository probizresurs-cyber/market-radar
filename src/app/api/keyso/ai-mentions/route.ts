/**
 * /api/keyso/ai-mentions — реальные данные о упоминаниях в Яндекс Алисе и Нейро
 *
 * Дополняет блок «AI Видимость» реальными данными от Keys.so
 * (вместо/в дополнение к симуляциям через Claude).
 */
import { NextResponse } from "next/server";
import { fetchAiAnswers, fetchAiCompetitors, type KeysoBase } from "@/lib/keyso-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { domain, base = "msk", limit = 25 } = await req.json() as {
      domain: string;
      base?: KeysoBase;
      limit?: number;
    };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }

    const [mentions, competitors] = await Promise.all([
      fetchAiAnswers(domain, base, limit),
      fetchAiCompetitors(domain, base, 10),
    ]);

    const mentionedCount = mentions.filter(m => m.mentioned).length;
    const totalQueries = mentions.length;

    return NextResponse.json({
      ok: true,
      domain,
      stats: {
        totalQueries,
        mentionedCount,
        mentionRate: totalQueries > 0 ? Math.round((mentionedCount / totalQueries) * 100) : 0,
      },
      mentions,
      competitors,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
