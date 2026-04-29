/**
 * /api/keyso/site-insights — агрегированные расширенные данные о компании
 *
 * Параллельно тянет:
 *   - топовые страницы (с трафиком и ключами)
 *   - потерянные ключи (что упало в позициях)
 *   - распределение анкоров бэклинков
 *   - ссылающиеся домены (с DR)
 *   - топовые акцепторы (link magnets)
 *   - основные темы сайта
 *
 * Используется блоком "SEO детали" на главном дашборде.
 */
import { NextResponse } from "next/server";
import {
  fetchTopPages,
  fetchLostKeywords,
  fetchAnchors,
  fetchReferringDomains,
  fetchPopularPages,
  fetchMainTopics,
  type KeysoBase,
} from "@/lib/keyso-client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { domain, base = "msk" } = await req.json() as { domain: string; base?: KeysoBase };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }

    // Параллельно (не последовательно!) — все 6 запросов одновременно
    const [topPages, lostKeywords, anchors, referringDomains, popularPages, topics] = await Promise.all([
      fetchTopPages(domain, base, 12),
      fetchLostKeywords(domain, base, 15),
      fetchAnchors(domain, base, 12),
      fetchReferringDomains(domain, base, 20),
      fetchPopularPages(domain, base, 8),
      fetchMainTopics(domain, base),
    ]);

    return NextResponse.json({
      ok: true,
      domain,
      topPages,
      lostKeywords,
      anchors,
      referringDomains,
      popularPages,
      topics,
      stats: {
        topPagesCount: topPages.length,
        lostKeywordsCount: lostKeywords.length,
        anchorsCount: anchors.length,
        refDomainsCount: referringDomains.length,
        popularPagesCount: popularPages.length,
        topicsCount: topics.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
