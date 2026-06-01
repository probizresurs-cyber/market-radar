/**
 * /api/keyso/competitors — конкуренты домена из Keys.so + SpyWords.
 *
 * Возвращает объединённый список:
 *   • Keys.so organic + context (как было)
 *   • SpyWords organic + adv competitors (если SPYWORDS_LOGIN/TOKEN заданы)
 *
 * Эндпоинт оставлен под старым именем чтобы не ломать вызовы из UI,
 * но фактически он мульти-источник.
 */
import { NextResponse } from "next/server";
import { fetchOrganicCompetitors, fetchContextCompetitors, type KeysoBase } from "@/lib/keyso-client";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type Source = "organic" | "context" | "spywords-organic" | "spywords-adv";

interface MergedCompetitor {
  domain: string;
  sources: Source[];
  organicVisibility?: number;
  contextVisibility?: number;
  intersected?: number;
  similarity?: number;
  /** Общих ключей по SpyWords (если из этого источника). */
  spywordsCommonKeys?: number;
  /** Уровень конкуренции по SpyWords 0-100 (если есть). */
  spywordsCompetitionLevel?: number;
}

function normalizeDomain(d: string): string {
  return d.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].toLowerCase();
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const { domain, base = "msk", limit = 15 } = await req.json() as {
      domain: string;
      base?: KeysoBase;
      limit?: number;
    };

    if (!domain) {
      return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    }
    const myDomainNorm = normalizeDomain(domain);

    // Подключаем SpyWords-конкурентов параллельно с Keys.so если есть креды.
    // У SpyWords есть DomainOrganicCompetitors и DomainAdvCompetitors —
    // оба доступны на API Start.
    const spywordsAvailable = !!(process.env.SPYWORDS_LOGIN && process.env.SPYWORDS_TOKEN);
    let getOrgCompFn: ((d: string, se: "yandex" | "google", l?: number) => Promise<unknown[]>) | null = null;
    let getAdvCompFn: ((d: string, se: "yandex" | "google", l?: number) => Promise<unknown[]>) | null = null;
    if (spywordsAvailable) {
      try {
        // Динамический импорт чтобы при отсутствии env-vars не тянуть модуль.
        const sw = await import("@/lib/spywords-client") as unknown as {
          // Экспортированных функций нет — нам нужно через getSpywordsData
          // вытащить список. Используем напрямую методы через приватный re-import.
        };
        void sw; // suppress unused
      } catch { /* skip */ }
    }

    const [organic, context, spywordsResults] = await Promise.all([
      fetchOrganicCompetitors(domain, base, limit),
      fetchContextCompetitors(domain, base, limit),
      // Тащим SpyWords-конкурентов параллельно. Воспользуемся getSpywordsData
      // частично — но дешевле сделать прямой запрос через client-lib helpers.
      (async () => {
        if (!spywordsAvailable) return null;
        try {
          const { getSpywordsData } = await import("@/lib/spywords-client");
          // getSpywordsData делает полный пакет вызовов — для просто списка
          // конкурентов это перебор. Но т.к. результат кешируется на стороне
          // analyze (uses real.spywords), здесь это второй вызов в любом
          // случае — overhead умеренный, ENRICH_TOP лимит уже внутри.
          const data = await getSpywordsData(domain);
          if (!data) return null;
          return {
            organic: [...(data.competitors?.yandex ?? []), ...(data.competitors?.google ?? [])],
            adv: [...(data.advCompetitors?.yandex ?? []), ...(data.advCompetitors?.google ?? [])],
          };
        } catch { return null; }
      })(),
    ]);

    const merged = new Map<string, MergedCompetitor>();

    const addOrMerge = (rawDomain: string, source: Source, extras: Partial<MergedCompetitor>) => {
      const d = normalizeDomain(rawDomain);
      if (!d || d === myDomainNorm) return;
      const existing = merged.get(d);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        // Мержим extras не перезаписывая то что уже есть
        const e = existing as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(extras)) {
          if (v != null && e[k] == null) e[k] = v;
        }
      } else {
        merged.set(d, { domain: d, sources: [source], ...extras });
      }
    };

    for (const c of organic) {
      addOrMerge(c.domain, "organic", {
        organicVisibility: c.visibility,
        intersected: c.intersected,
        similarity: c.similarity,
      });
    }
    for (const c of context) {
      addOrMerge(c.domain, "context", { contextVisibility: c.visibility, intersected: c.intersected });
    }

    if (spywordsResults) {
      // Дедупним SpyWords по доменам т.к. одного и того же конкурента мог
      // дать и yandex, и google (одно и то же доменное имя).
      const seenSwOrg = new Set<string>();
      for (const c of spywordsResults.organic) {
        const comp = c as { domain: string; commonKeywords?: number; competitionLevel?: number };
        const d = normalizeDomain(comp.domain);
        if (!d || seenSwOrg.has(d)) continue;
        seenSwOrg.add(d);
        addOrMerge(comp.domain, "spywords-organic", {
          spywordsCommonKeys: comp.commonKeywords,
          spywordsCompetitionLevel: comp.competitionLevel,
        });
      }
      const seenSwAdv = new Set<string>();
      for (const c of spywordsResults.adv) {
        const comp = c as { domain: string; commonKeywords?: number; competitionLevel?: number };
        const d = normalizeDomain(comp.domain);
        if (!d || seenSwAdv.has(d)) continue;
        seenSwAdv.add(d);
        addOrMerge(comp.domain, "spywords-adv", {
          spywordsCommonKeys: comp.commonKeywords,
          spywordsCompetitionLevel: comp.competitionLevel,
        });
      }
    }

    const competitors = Array.from(merged.values()).sort((a, b) => {
      // Те у кого больше источников (= более релевантный конкурент) — выше
      if (a.sources.length !== b.sources.length) return b.sources.length - a.sources.length;
      // Дальше — по видимости organic из Keys.so либо по общим ключам SpyWords
      const aScore = (a.organicVisibility ?? 0) + (a.spywordsCommonKeys ?? 0);
      const bScore = (b.organicVisibility ?? 0) + (b.spywordsCommonKeys ?? 0);
      return bScore - aScore;
    });

    return NextResponse.json({
      ok: true,
      competitors,
      stats: {
        organicCount: organic.length,
        contextCount: context.length,
        spywordsOrganicCount: spywordsResults?.organic.length ?? 0,
        spywordsAdvCount: spywordsResults?.adv.length ?? 0,
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
