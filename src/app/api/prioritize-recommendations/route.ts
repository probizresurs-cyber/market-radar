/**
 * POST /api/prioritize-recommendations
 *
 * Принимает массив рекомендаций и контекст компании, возвращает тот же
 * массив, но каждая рекомендация получает:
 *   - impact: 1-5  (насколько сильно повлияет на бизнес)
 *   - effort: 1-5  (сколько усилий требуется)
 *   - effortImpactBucket: "quick-win" / "big-bet" / "fill-in" / "avoid"
 *
 * Закрывает P1-пробел из аудита: «нет приоритизации по Impact × Effort».
 * Юзер видит, с чего реально начинать, а не плоский список.
 *
 * Body: { recommendations: Recommendation[], companyName?, niche? }
 * Returns: { ok, prioritized: Recommendation[] }
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";
import type { Recommendation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — операционный директор с опытом запуска 50+ digital-проектов.

Тебе дают список рекомендаций по бизнесу. Твоя работа — оценить каждую по двум осям:

**IMPACT (влияние на бизнес 1-5):**
1 — косметика, влияния почти нет
2 — улучшение, но кардинально ничего не изменит
3 — заметный эффект на ключевых метриках
4 — серьёзный сдвиг (рост ER 30%+, конверсия +20%+)
5 — game-changer (новый канал, удвоение метрики)

**EFFORT (сколько усилий нужно 1-5):**
1 — 1-2 часа работы одного человека
2 — 1-2 дня
3 — неделя
4 — месяц
5 — квартал и больше / нужна команда

**BUCKET по матрице 2x2:**
- "quick-win"  — impact ≥4 И effort ≤2 (начинать ОТСЮДА)
- "big-bet"    — impact ≥4 И effort ≥3 (планировать, инвестировать)
- "fill-in"    — impact ≤3 И effort ≤2 (делать в свободное время)
- "avoid"      — impact ≤3 И effort ≥3 (не делать)

Будь жёстким в оценках — большинство рекомендаций реалистично попадают в impact 2-3, а не 4-5.

Ответ — СТРОГО валидный JSON.`;

interface AiScoredRec {
  index: number;
  impact: number;
  effort: number;
  reason?: string;
}

function classifyBucket(impact: number, effort: number): Recommendation["effortImpactBucket"] {
  if (impact >= 4 && effort <= 2) return "quick-win";
  if (impact >= 4 && effort >= 3) return "big-bet";
  if (impact <= 3 && effort <= 2) return "fill-in";
  return "avoid";
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const recommendations = body.recommendations as Recommendation[] | undefined;
    const companyName: string = body.companyName ?? "";
    const niche: string = body.niche ?? "";

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return NextResponse.json({ ok: false, error: "Не передан массив recommendations" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }
    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });

    const userMessage = `Компания: ${companyName || "не указано"}
Ниша: ${niche || "не указано"}

Список рекомендаций:
${recommendations.map((r, i) => `${i}. [${r.category}] ${r.text}\n   Ожидаемый эффект: ${r.effect}`).join("\n\n")}

Оцени каждую по impact (1-5) и effort (1-5). Верни СТРОГО JSON:
{
  "scored": [
    { "index": 0, "impact": 4, "effort": 2 },
    { "index": 1, "impact": 3, "effort": 5 },
    ...
  ]
}`;

    const model = "claude-haiku-4-5";
    const message = await client.messages.create({
      model,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();

    let parsed: { scored: AiScoredRec[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ ok: false, error: "AI вернул не-JSON" }, { status: 500 });
      }
      parsed = JSON.parse(m[0]);
    }

    const scoredMap = new Map<number, AiScoredRec>();
    for (const s of parsed.scored ?? []) {
      if (typeof s.index === "number" && typeof s.impact === "number" && typeof s.effort === "number") {
        scoredMap.set(s.index, s);
      }
    }

    const prioritized: Recommendation[] = recommendations.map((rec, i) => {
      const s = scoredMap.get(i);
      if (!s) return rec;
      const impact = Math.max(1, Math.min(5, Math.round(s.impact)));
      const effort = Math.max(1, Math.min(5, Math.round(s.effort)));
      return {
        ...rec,
        impact,
        effort,
        effortImpactBucket: classifyBucket(impact, effort),
      };
    });

    // Sort: quick-wins first, then big-bets, then fill-in, then avoid.
    // Inside each bucket — higher impact first.
    const bucketRank: Record<NonNullable<Recommendation["effortImpactBucket"]>, number> = {
      "quick-win": 0,
      "big-bet": 1,
      "fill-in": 2,
      "avoid": 3,
    };
    prioritized.sort((a, b) => {
      const ar = a.effortImpactBucket ? bucketRank[a.effortImpactBucket] : 4;
      const br = b.effortImpactBucket ? bucketRank[b.effortImpactBucket] : 4;
      if (ar !== br) return ar - br;
      return (b.impact ?? 0) - (a.impact ?? 0);
    });

    await access.log({
      endpoint: "prioritize-recommendations",
      model,
      promptTokens: estimateTokens(SYSTEM_PROMPT + userMessage),
      completionTokens: estimateTokens(raw),
    });

    return NextResponse.json({ ok: true, prioritized });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
