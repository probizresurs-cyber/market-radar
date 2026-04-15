import { NextResponse } from "next/server";
import type { GeneratedReel, ContentReelIdea, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";

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

const SYSTEM_PROMPT = `Ты — виральный режиссёр рилсов и эмоциональный копирайтер в одном лице.

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
): string {
  const smmBlock = smm ? `
Бренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}
Тон: ${smm.brandIdentity.toneOfVoice.join(", ")}
` : "";

  const brandBlock = buildBrandBookBlock(brandBook);

  const avatarBlock = (voiceDescription || avatarDescription) ? `
АВАТАР И ГОЛОС (адаптируй сценарий и стиль речи под этого ведущего):
${avatarDescription ? `- Внешний вид: ${avatarDescription}` : ""}
${voiceDescription ? `- Голос / манера речи: ${voiceDescription}` : ""}
` : "";

  return `Разверни идею рилса в готовый сценарий и текст для озвучки аватаром HeyGen.

Компания: ${companyName}
${smmBlock}${brandBlock}${avatarBlock}
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
3. voiceoverScript — ЧИСТЫЙ ТЕКСТ для озвучки аватаром HeyGen. Одна сплошная строка, без пометок, без скобок, без указаний "пауза". Только то, что аватар произносит вслух. Естественная речь, разговорный стиль, ${idea.durationSec === 15 ? "30-40 слов" : idea.durationSec === 30 ? "60-80 слов" : "120-160 слов"}.
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
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const idea: ContentReelIdea = body.idea;
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const voiceDescription: string = body.voiceDescription ?? "";
    const avatarDescription: string = body.avatarDescription ?? "";
    const userPrompt: string = body.userPrompt ?? "";

    if (!idea) {
      return NextResponse.json({ ok: false, error: "Не передана идея рилса" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt.trim()
              ? (buildBrandBookBlock(brandBook) ? `${userPrompt.trim()}\n${buildBrandBookBlock(brandBook)}` : userPrompt.trim())
              : buildPrompt(companyName, idea, smm, voiceDescription, avatarDescription, brandBook) },
        ],
        temperature: 0.9,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as {
      title: string; scenario: string; voiceoverScript: string; hashtags: string[];
    };

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

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
