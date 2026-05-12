/**
 * POST /api/niche-benchmark
 *
 * Принимает niche-описание и возвращает «expected ranges» для типичной
 * компании в этой нише по нескольким метрикам — чтобы пользователь
 * понимал, его 68 баллов это «хорошо» или «плохо для отрасли».
 *
 * Метрики:
 *   - overallScore: { p25, p50, p75, top10 }
 *   - er: { p25, p50, p75 } — engagement rate в соцсетях, %
 *   - avgRating: { p25, p50, p75 } — средний рейтинг отзывов 1-5
 *   - seoTop10: { p25, p50, p75 } — доля запросов в ТОП-10, %
 *
 * Кэшируется по niche-ключу в простой in-memory Map. AI-вызов раз в
 * полчаса на каждую уникальную нишу.
 *
 * Body: { niche: string }
 * Returns: { ok, benchmark: NicheBenchmark, cached: boolean }
 */
import { NextResponse } from "next/server";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import { safeAnthropicCreate, extractJson, proxyErrorMessage } from "@/lib/anthropic-safe";

export const runtime = "nodejs";
export const maxDuration = 45;

interface RangeStats {
  p25: number;
  p50: number;
  p75: number;
  top10?: number;
}

export interface NicheBenchmark {
  niche: string;
  overallScore: RangeStats;
  er: RangeStats;
  avgRating: RangeStats;
  seoTop10: RangeStats;
  /** Краткий комментарий: что отличает топ от среднего в этой нише. */
  topInsight: string;
  generatedAt: string;
}

// In-memory cache: niche-key (lowercased, trimmed) → benchmark + timestamp.
// Process restarts inval кэш — это ок, бенчмарки не критичны к freshness.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { data: NicheBenchmark; ts: number }>();

const SYSTEM_PROMPT = `Ты — отраслевой аналитик с доступом к публичным данным по российскому рынку (Keys.so, Similarweb отчёты, кейсы агентств).

Тебе дают нишу. Твоя задача — оценить РЕАЛИСТИЧНЫЕ диапазоны типичных метрик для компании в этой нише:

1. **overallScore** (0-100) — общий health score компании по MarketRadar
   (берёт в расчёт SEO, соцсети, репутацию, контент, бизнес-фундамент)
2. **er** (0-15) — engagement rate в соцсетях (%), реакции / охват
3. **avgRating** (1-5) — средний рейтинг отзывов на картах
4. **seoTop10** (0-100) — доля seo-запросов в ТОП-10 выдачи (%)

Для каждой метрики выдай:
— p25 (нижняя четверть — слабые игроки)
— p50 (медиана — типичная компания)
— p75 (верхняя четверть — сильные)
— top10 (для overallScore — что есть у лидеров рынка)

И один короткий topInsight — что отличает лидеров от среднего в этой нише.

Числа должны быть РЕАЛИСТИЧНЫМИ. Например:
— Локальный ресторан: p50 score 50-55, avgRating 4.2, ER в Insta 2-3%
— B2B SaaS: p50 score 60-65, ER 0.5-1%, avgRating не критичен
— E-commerce: p50 score 55-60, ER 1-2%, avgRating 4.0

Не идеализируй. Большинство компаний в любой нише — средние.

Ответ — СТРОГО валидный JSON.`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const nicheRaw: string = (body.niche ?? "").trim();
    if (!nicheRaw) {
      return NextResponse.json({ ok: false, error: "niche обязателен" }, { status: 400 });
    }

    const key = nicheRaw.toLowerCase().slice(0, 200);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, benchmark: cached.data, cached: true });
    }

    const userMessage = `Ниша: ${nicheRaw}

Дай реалистичные диапазоны типичных метрик. Верни СТРОГО JSON:
{
  "niche": "${nicheRaw}",
  "overallScore": { "p25": число, "p50": число, "p75": число, "top10": число },
  "er": { "p25": число, "p50": число, "p75": число },
  "avgRating": { "p25": число, "p50": число, "p75": число },
  "seoTop10": { "p25": число, "p50": число, "p75": число },
  "topInsight": "одно предложение — что отличает лидеров"
}`;

    const { text, modelUsed, proxyDegraded, error } = await safeAnthropicCreate({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    if (!text) {
      return NextResponse.json(
        { ok: false, error: proxyDegraded ? proxyErrorMessage() : (error ?? "AI не ответил") },
        { status: proxyDegraded ? 502 : 500 },
      );
    }

    const parsed = extractJson<Omit<NicheBenchmark, "generatedAt">>(text);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "AI вернул не-JSON" }, { status: 500 });
    }

    const benchmark: NicheBenchmark = {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };

    cache.set(key, { data: benchmark, ts: Date.now() });

    await access.log({
      endpoint: "niche-benchmark",
      model: modelUsed,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(text),
    });

    return NextResponse.json({ ok: true, benchmark, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
