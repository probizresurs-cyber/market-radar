/**
 * /api/keyso/competitors — реальные конкуренты домена по Keys.so
 *
 * Возвращает объединённый список SEO + Я.Директ конкурентов
 * с указанием источника и метрик пересечения.
 */
import { NextResponse } from "next/server";
import { fetchOrganicCompetitors, fetchContextCompetitors, type KeysoBase } from "@/lib/keyso-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { domain, base = "msk", limit = 15 } = await req.json() as {
      domain: string;
      base?: KeysoBase;
      limit?: number;
    };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }

    const [organic, context] = await Promise.all([
      fetchOrganicCompetitors(domain, base, limit),
      fetchContextCompetitors(domain, base, limit),
    ]);

    // Слить и дедупнуть, помечая источник
    const merged = new Map<string, {
      domain: string;
      sources: ("organic" | "context")[];
      organicVisibility?: number;
      contextVisibility?: number;
      intersected?: number;
      similarity?: number;
    }>();

    for (const c of organic) {
      merged.set(c.domain, {
        domain: c.domain,
        sources: ["organic"],
        organicVisibility: c.visibility,
        intersected: c.intersected,
        similarity: c.similarity,
      });
    }
    for (const c of context) {
      const existing = merged.get(c.domain);
      if (existing) {
        existing.sources.push("context");
        existing.contextVisibility = c.visibility;
      } else {
        merged.set(c.domain, {
          domain: c.domain,
          sources: ["context"],
          contextVisibility: c.visibility,
          intersected: c.intersected,
        });
      }
    }

    const competitors = Array.from(merged.values()).sort((a, b) => {
      // Те что и в SEO и в Я.Директ — выше
      if (a.sources.length !== b.sources.length) return b.sources.length - a.sources.length;
      return (b.organicVisibility ?? 0) - (a.organicVisibility ?? 0);
    });

    return NextResponse.json({
      ok: true,
      competitors,
      stats: {
        organicCount: organic.length,
        contextCount: context.length,
        total: competitors.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
