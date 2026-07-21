import { NextResponse } from "next/server";
import type { GeneratedReel, BrandBook, ReelBreakdown } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";

/**
 * POST /api/content/reel-breakdown/adapt
 *
 * Второй шаг «Разбора ролика»: берёт уже готовый ReelBreakdown (структура
 * чужого успешного ролика) и переписывает его под компанию пользователя —
 * та же механика крюка/структуры/удержания, но своя тема, свои слова, свой
 * продукт. НЕ копирует чужой текст один в один — использует структуру как
 * скелет, наполняет содержанием под бриф.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

function buildBrandBookBlock(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.brandName) lines.push(`- Название бренда: ${bb.brandName}`);
  if (bb.tagline) lines.push(`- Слоган: ${bb.tagline}`);
  if (bb.toneOfVoice?.length) lines.push(`- Tone of voice: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`- НЕ использовать слова: ${bb.forbiddenWords.join(", ")}`);
  if (!lines.length) return "";
  return `\nБРЕНДБУК (строго соблюдать):\n${lines.join("\n")}\n`;
}

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — виральный режиссёр рилсов. Тебе дают РАЗБОР чужого успешного ролика
(его крюк, структуру по таймкодам, приёмы удержания, CTA и почему это
сработало) и бриф компании-заказчика.

Твоя задача — написать НОВЫЙ сценарий для этой компании, который использует
ТУ ЖЕ механику (тот же тип крюка, тот же ритм структуры, те же приёмы
удержания), но с полностью своим содержанием: своей темой, своим продуктом,
своими словами. Это не копирование, а разбор рабочего приёма и применение
его к другой теме.

Если механика оригинала не подходит для этой ниши/продукта — адаптируй
разумно, не притягивая за уши.

Возвращаешь СТРОГО валидный JSON без markdown:
{
  "title": "название ролика (4-7 слов)",
  "scenario": "раскадровка с таймкодами: [00:00-00:03] КРЮК — голос: «...» — в кадре: ... — текст на экране: «...» и т.д.",
  "voiceoverScript": "чистый текст для озвучки аватаром, одна строка, разговорный стиль",
  "hashtags": ["#tag1"]
}`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const breakdown: ReelBreakdown = body.breakdown;
    const companyName: string = body.companyName ?? "";
    const niche: string = body.niche ?? "";
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const durationSec: number = body.durationSec ?? 30;

    if (!breakdown) {
      return NextResponse.json({ ok: false, error: "Не передан разбор ролика (breakdown)" }, { status: 400 });
    }
    if (!companyName.trim()) {
      return NextResponse.json({ ok: false, error: "Не передано название компании" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const smmBlock = smm ? `\nБренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}\nТон: ${smm.brandIdentity.toneOfVoice.join(", ")}\n` : "";
    const structureBlock = breakdown.structure.map(b => `[${b.timeRange}] ${b.beat} — ${b.description}`).join("\n");

    const userPrompt = `РАЗБОР ОРИГИНАЛЬНОГО РОЛИКА «${breakdown.sourceTitle}»:
Крюк: «${breakdown.hookText}» — почему цепляет: ${breakdown.hookWhy}
Структура:
${structureBlock}
Приёмы удержания: ${breakdown.retentionTricks.join("; ")}
CTA оригинала: ${breakdown.cta || "нет"}
Почему сработало: ${breakdown.whyItWorks}

БРИФ ЗАКАЗЧИКА:
Компания: ${companyName}${niche ? ` (ниша: ${niche})` : ""}${smmBlock}${buildBrandBookBlock(brandBook)}
Целевая длительность нового ролика: ${durationSec} сек.

Напиши новый сценарий по инструкции.`;

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as {
      title: string; scenario: string; voiceoverScript: string; hashtags: string[];
    };

    const result: GeneratedReel = {
      id: `reel-${Date.now()}`,
      ideaId: `reel-breakdown-${Date.now()}`,
      pillar: "Разбор тренда",
      title: parsed.title ?? breakdown.sourceTitle,
      scenario: parsed.scenario ?? "",
      voiceoverScript: parsed.voiceoverScript ?? "",
      hashtags: parsed.hashtags ?? [],
      durationSec,
      videoStatus: "idle",
      generatedAt: new Date().toISOString(),
    };

    await access.log({ endpoint: "reel-breakdown-adapt", model: "gpt-4o-mini" });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
