import { NextResponse } from "next/server";
import type { GeneratedReel, ContentReelIdea, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { TASegment } from "@/lib/ta-types";
import { buildSegmentBlock } from "@/lib/ta-segment-prompt";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";

function buildBrandBookBlock(bb: BrandBook | null): string {
  if (!bb) return "";
  const lines: string[] = [];
  if (bb.brandName) lines.push(`- Название бренда: ${bb.brandName}`);
  if (bb.tagline) lines.push(`- Слоган: ${bb.tagline}`);
  if (bb.mission) lines.push(`- Миссия: ${bb.mission}`);
  if (bb.toneOfVoice?.length) lines.push(`- Tone of voice: ${bb.toneOfVoice.join(", ")}`);
  if (bb.forbiddenWords?.length) lines.push(`- НЕ использовать слова: ${bb.forbiddenWords.join(", ")}`);
  if (bb.goodPhrases?.length) lines.push(`- Примеры фирменных фраз:\n  ${bb.goodPhrases.map(p => `«${p}»`).join("\n  ")}`);
  if (bb.visualStyle) lines.push(`- Визуальный стиль в кадре: ${bb.visualStyle}`);
  if (!lines.length) return "";
  return `\nБРЕНДБУК (строго соблюдать в тексте озвучки и описании кадра):\n${lines.join("\n")}\n`;
}

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — виральный режиссёр рилсов и эмоциональный копирайтер в одном лице.

Ты строишь видео по железной структуре:
1. КРЮК (0-3 сек) — шок / парадокс / вопрос / обещание
2. ИНТРИГА (3-7 сек) — удержание внимания
3. ПРОБЛЕМА — боль зрителя
4. РЕШЕНИЕ — что предлагаешь
5. РЕЗУЛЬТАТ — трансформация
6. CTA — конкретное действие

Каждое слово работает. Никакой воды. Никаких "сегодня я расскажу вам". Сразу в бой.

ВАЖНО: отвечаешь ТОЛЬКО валидным JSON, без markdown.`;

function buildPrompt(
  companyName: string,
  idea: ContentReelIdea,
  smm: SMMResult | null,
  voiceDescription: string,
  avatarDescription: string,
  brandBook: BrandBook | null,
  taSegment: TASegment | null = null,
): string {
  const smmBlock = smm ? `
Бренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}
Тон: ${smm.brandIdentity.toneOfVoice.join(", ")}
` : "";

  const brandBlock = buildBrandBookBlock(brandBook);
  // «Аватар» ниже — это ведущий HeyGen (внешность/голос); сегмент ЦА — отдельно.
  const segmentBlock = buildSegmentBlock(taSegment);

  const avatarBlock = (voiceDescription || avatarDescription) ? `
АВАТАР И ГОЛОС (адаптируй сценарий и стиль речи под этого ведущего):
${avatarDescription ? `- Внешний вид: ${avatarDescription}` : ""}
${voiceDescription ? `- Голос / манера речи: ${voiceDescription}` : ""}
` : "";

  return `Разверни идею рилса в готовый сценарий и текст для озвучки аватаром HeyGen.

Компания: ${companyName}
${smmBlock}${segmentBlock}${brandBlock}${avatarBlock}
ИДЕЯ:
- Контент-столп: ${idea.pillar}
- Крюк: ${idea.hook}
- Интрига: ${idea.intrigue}
- Проблема: ${idea.problem}
- Решение: ${idea.solution}
- Результат: ${idea.result}
- CTA: ${idea.cta}
- Длительность: ${idea.durationSec} сек
- Визуал: ${idea.visualStyle}

Напиши:
1. title — название ролика (4-7 слов)
2. scenario — РАСКАДРОВКА. Формат:
   [00:00-00:03] КРЮК — голос: «...» — в кадре: ... — текст на экране: «...»
   [00:03-00:07] ИНТРИГА — ...
   и т.д. до конца ${idea.durationSec} секунд.
3. voiceoverScript — ЧИСТЫЙ ТЕКСТ для озвучки. Одна сплошная строка, без пометок, без скобок, без указаний "пауза". Только то, что произносится вслух. Естественная речь, разговорный стиль, ${idea.durationSec === 15 ? "30-40 слов" : idea.durationSec === 30 ? "60-80 слов" : "120-160 слов"}.
   ПОД СИНТЕЗ РЕЧИ (иначе голос звучит роботом):
   - Все числа, даты, проценты, цены — СЛОВАМИ: не "40%", а "сорок процентов"; не "с 2019 г.", а "с две тысячи девятнадцатого года"; не "1500 ₽", а "полторы тысячи рублей".
   - Никаких сокращений и латиницы: не "т.к.", "и т.д.", "SMM", "ROI" — пиши словами по-русски или разворачивай.
   - Короткие предложения (до 12-14 слов) с настоящими знаками препинания: точки и запятые задают паузы и интонацию, сплошной поток без них читается на одном дыхании.
   - Не ставь подряд символы вроде "—", "...", кавычек внутри слов: синтез спотыкается.
4. hashtags — 5-8 хэштегов

Верни СТРОГО JSON:
{
  "title": "...",
  "scenario": "полная раскадровка с таймкодами",
  "voiceoverScript": "чистый текст для аватара одной строкой",
  "hashtags": ["#tag1"]
}`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const idea: ContentReelIdea = body.idea;
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const taSegment: TASegment | null = body.taSegment ?? null;
    const voiceDescription: string = body.voiceDescription ?? "";
    const avatarDescription: string = body.avatarDescription ?? "";
    const userPrompt: string = body.userPrompt ?? "";

    if (!idea) {
      return NextResponse.json({ ok: false, error: "Не передана идея рилса" }, { status: 400 });
    }

    const userMessage = userPrompt.trim()
      ? (buildBrandBookBlock(brandBook) ? `${userPrompt.trim()}\n${buildBrandBookBlock(brandBook)}` : userPrompt.trim())
      : buildPrompt(companyName, idea, smm, voiceDescription, avatarDescription, brandBook, taSegment);

    const aiResult = await chatJson<{ title: string; scenario: string; voiceoverScript: string; hashtags: string[] }>({
      system: SYSTEM_PROMPT,
      user: userMessage,
      model: CHAT_MODEL_SMART,
      temperature: 0.9,
      maxTokens: 4096,
    });
    if (!aiResult.data) {
      return NextResponse.json(
        { ok: false, error: `Не удалось получить сценарий: ${aiResult.error ?? "нет ответа модели"}` },
        { status: 500 },
      );
    }
    const parsed = aiResult.data;

    const result: GeneratedReel = {
      id: `reel-${Date.now()}`,
      ideaId: idea.id,
      pillar: idea.pillar,
      title: parsed.title ?? idea.hook,
      scenario: parsed.scenario ?? "",
      voiceoverScript: parsed.voiceoverScript ?? "",
      hashtags: parsed.hashtags ?? idea.hashtags ?? [],
      durationSec: idea.durationSec,
      videoStatus: "idle",
      generatedAt: new Date().toISOString(),
    };

    await access.log({ endpoint: "generate-reel-scenario", model: aiResult.modelUsed });
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
