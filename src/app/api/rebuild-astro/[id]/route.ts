import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { MODEL, type RebuildAstroResult } from "../route";

// Публично отдаёт ранее сохранённый результат пересборки — по этому GET
// страница /astro-rebuild?id=<id> восстанавливает состояние после перезагрузки
// и по этой же ссылке можно поделиться готовым результатом + формой пересборки.
export const runtime = "nodejs";

interface Row {
  snapshot: {
    files: RebuildAstroResult["files"];
    fixes: string[];
    summary: string;
    // Старые снапшоты (до этих полей) не хранили модель/оптимизацию — фолбэки.
    modelUsed?: string;
    optimization?: RebuildAstroResult["optimization"];
    optimizedAt?: string | null;
    speedCompare?: RebuildAstroResult["speedCompare"];
    source: { url: string; title: string; issues: string[] };
  };
}

// Пустой отчёт для снапшотов, созданных до появления блока оптимизации.
const EMPTY_OPTIMIZATION: RebuildAstroResult["optimization"] = {
  stats: { htmlKb: 0, externalScripts: 0, externalCss: 0, images: 0, lazyImages: 0 },
  issues: [],
  applied: [],
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await initDb();
    const rows = await query<Row>("SELECT snapshot FROM astro_rebuilds WHERE id = $1", [id]);
    const snap = rows[0]?.snapshot;
    if (!snap) {
      return NextResponse.json({ ok: false, error: "Результат не найден или устарел" }, { status: 404 });
    }
    const result: RebuildAstroResult = {
      ok: true,
      id,
      previewUrl: `/api/site-preview/${id}`,
      source: snap.source,
      files: snap.files,
      fixes: snap.fixes,
      optimization: snap.optimization ?? EMPTY_OPTIMIZATION,
      // Легаси-снапшоты (оптимизация применялась прямо при переносе, поля
      // optimizedAt ещё не было): считаем оптимизированными, если applied
      // непустой — иначе кнопка «Оптимизировать» наслоит правки повторно.
      optimizedAt: snap.optimizedAt
        ?? ((snap.optimization?.applied?.length ?? 0) > 0 ? "legacy" : null),
      speedCompare: snap.speedCompare ?? null,
      summary: snap.summary,
      modelUsed: snap.modelUsed || MODEL,
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error("rebuild-astro/[id] error:", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
