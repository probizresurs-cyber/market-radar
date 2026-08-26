/**
 * GET /api/bukvarix — семантика из Букварикса.
 *
 * mode=keywords&q=фраза            — расширение семантики по фразе
 * mode=domain&q=site.ru            — по каким запросам виден домен
 * mode=compare&q=мы&q2=конкурент   — пересечение и уникальные запросы
 *   &type=intersect|domain1_uniq|domain2_uniq
 * Общие: limit (1–1000), region (msk по умолчанию)
 *
 * Гейт checkAiAccess с countUsage:false — Букварикс бесплатный и не тратит
 * ни токенов Claude, ни денег, поэтому списывать за него триал нечестно.
 * Но авторизация нужна: без неё роут становится открытым прокси к чужому
 * API с нашего IP, и 429 от Букварикса прилетит всей платформе.
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import {
  bukvarixKeywords, bukvarixDomainKeywords, bukvarixCompareDomains,
  BukvarixError, type BukvarixRegion,
} from "@/lib/bukvarix";

export const runtime = "nodejs";
export const maxDuration = 60;

const COMPARE_TYPES = ["intersect", "domain1_uniq", "domain2_uniq"] as const;

export async function GET(req: Request) {
  const access = await checkAiAccess(req, { countUsage: false });
  if (!access.allowed) return access.response;

  const p = new URL(req.url).searchParams;
  const mode = p.get("mode") ?? "keywords";
  const q = (p.get("q") ?? "").trim();
  const q2 = (p.get("q2") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "Параметр q обязателен" }, { status: 400 });

  // Верхнюю границу держим на 1000: отчёт в 1 млн строк формально разрешён,
  // но такой ответ незачем тащить через наш сервер в браузер.
  const limit = Math.min(Math.max(Number(p.get("limit")) || 250, 1), 1000);
  const region = (p.get("region") || "msk") as BukvarixRegion;

  try {
    if (mode === "domain") {
      const items = await bukvarixDomainKeywords(q, { limit, region });
      return NextResponse.json({ ok: true, mode, count: items.length, items });
    }

    if (mode === "compare") {
      if (!q2) return NextResponse.json({ ok: false, error: "Для сравнения нужен q2" }, { status: 400 });
      const raw = p.get("type") ?? "intersect";
      const type = (COMPARE_TYPES as readonly string[]).includes(raw)
        ? raw as typeof COMPARE_TYPES[number]
        : "intersect";
      const items = await bukvarixCompareDomains(q, q2, { type, limit, region });
      return NextResponse.json({ ok: true, mode, type, count: items.length, items });
    }

    const items = await bukvarixKeywords(q, { limit });
    return NextResponse.json({ ok: true, mode: "keywords", count: items.length, items });
  } catch (e) {
    if (e instanceof BukvarixError) {
      // 402/429 отдаём как есть: вызывающему коду важно отличать «кончились
      // лимиты» от «сервис лёг», чтобы решить — подождать или не показывать блок.
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ошибка запроса к Букварикс" },
      { status: 502 },
    );
  }
}
