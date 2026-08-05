import { NextResponse } from "next/server";
import type { GeneratedReel, BrandBook, ReelBreakdown } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";

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

    const aiResult = await chatJson<{ title: string; scenario: string; voiceoverScript: string; hashtags: string[] }>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      model: CHAT_MODEL_SMART,
      temperature: 0.85,
      maxTokens: 4096,
    });
    if (!aiResult.data) {
      return NextResponse.json({ ok: false, error: `Не удалось адаптировать сценарий: ${aiResult.error ?? "нет ответа модели"}` }, { status: 500 });
    }
    const parsed = aiResult.data;

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

    await access.log({ endpoint: "reel-breakdown-adapt", model: aiResult.modelUsed });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
