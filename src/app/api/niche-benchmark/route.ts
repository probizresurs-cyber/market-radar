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
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

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

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

ВАЖНО: ты НЕ имеешь доступа к Keys.so / Similarweb / отчётам агентств в реальном
времени. Раньше промпт обманно говорил «у тебя есть доступ» — это убрано. Твои
оценки — это ОБОБЩЁННЫЕ типовые диапазоны на основе общих знаний об отрасли,
не точные статистические данные.

Тебе дают нишу. Дай ОЦЕНОЧНЫЕ диапазоны типичных метрик для компании в этой нише.
Это диапазон-гипотеза, не точная статистика — клиент увидит badge «оценка».

Метрики:
1. **overallScore** (0-100) — общий health score (SEO + соцсети + репутация + контент + бизнес)
2. **er** (0-15) — engagement rate в соцсетях (%)
3. **avgRating** (1-5) — средний рейтинг отзывов
4. **seoTop10** (0-100) — доля seo-запросов в ТОП-10 (%)

Для каждой метрики выдай:
— p25 (нижняя четверть — слабые игроки, ОРИЕНТИР)
— p50 (медиана — типичная компания, ОРИЕНТИР)
— p75 (верхняя четверть — сильные, ОРИЕНТИР)
— top10 (для overallScore — лидеры рынка, ОРИЕНТИР)

И короткий topInsight — что обычно отличает лидеров от среднего в нише.

ВАЖНО:
- Если ниша слишком экзотичная и ты не уверен в диапазонах — верни p25=p50=p75=null
  и явный topInsight «недостаточно данных для оценки бенчмарков этой ниши».
- НЕ выдумывай точные числа («медиана ER 2.37%»). Округляй: «2-3%», "score 50-60".
- Лучше шире диапазон + честно, чем узко + выдумка.

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
