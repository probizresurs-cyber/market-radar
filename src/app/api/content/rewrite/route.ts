import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import type { GeneratedPost, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { TASegment } from "@/lib/ta-types";
import { buildSegmentBlock } from "@/lib/ta-segment-prompt";

/**
 * POST /api/content/rewrite — рерайт ЧУЖОГО текста (пост/сценарий/статья
 * конкурента) под свою компанию: та же механика (тип крючка, структура,
 * ритм), но своё содержание, свой бренд, свой ToV.
 *
 * Закрывает пробел обещания «адаптировать и переписывать сценарии под вашу
 * компанию»: до этого так умел только видео-разбор (reel-breakdown/adapt),
 * а adapt-post лишь переформатировал СВОЙ пост под платформы без
 * бренд-контекста.
 *
 * Body: { sourceText, companyName, niche?, platform?, smmAnalysis?, brandBook?, taSegment? }
 * Returns: { ok, data: GeneratedPost } — сразу в формате библиотеки постов.
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_SHORT}

Ты — копирайтер-аналитик. Тебе дают ЧУЖОЙ работающий текст (пост, сценарий,
статью) и бриф компании-заказчика.

Задача — написать НОВЫЙ текст для этой компании, который использует ТУ ЖЕ
механику оригинала: тот же тип крючка, ту же структуру и ритм, те же приёмы
удержания. Но содержание — полностью своё: своя тема, свой продукт, свои
формулировки. Это разбор рабочего приёма, а не копирование: не переноси
уникальные факты, цифры и имена из оригинала.

Если механика оригинала не ложится на нишу заказчика — адаптируй разумно,
не притягивая за уши.

Возвращаешь СТРОГО валидный JSON без markdown:
{
  "hook": "крючок нового текста",
  "body": "полный новый текст",
  "hashtags": ["#tag1"],
  "mechanicsNote": "1-2 предложения: какая механика взята из оригинала"
}`;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const body = await req.json();
    const sourceText: string = (body.sourceText ?? "").trim();
    const companyName: string = (body.companyName ?? "").trim();
    const niche: string = body.niche ?? "";
    const platform: string = body.platform ?? "instagram";
    const smm: SMMResult | null = body.smmAnalysis ?? null;
    const brandBook: BrandBook | null = body.brandBook ?? null;
    const taSegment: TASegment | null = body.taSegment ?? null;

    if (!sourceText || sourceText.length < 50) {
      return NextResponse.json({ ok: false, error: "Вставьте текст оригинала (минимум 50 символов)" }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ ok: false, error: "Не передано название компании" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    const smmBlock = smm ? `\nБренд: ${smm.brandIdentity.archetype} · ${smm.brandIdentity.positioning}\nТон: ${smm.brandIdentity.toneOfVoice.join(", ")}\n` : "";
    const brandLines: string[] = [];
    if (brandBook?.brandName) brandLines.push(`Бренд: ${brandBook.brandName}`);
    if (brandBook?.toneOfVoice?.length) brandLines.push(`ToV: ${brandBook.toneOfVoice.join(", ")}`);
    if (brandBook?.forbiddenWords?.length) brandLines.push(`НЕ использовать: ${brandBook.forbiddenWords.join(", ")}`);
    const brandBlock = brandLines.length ? `\nБРЕНДБУК:\n${brandLines.join("\n")}\n` : "";

    const userPrompt = `ОРИГИНАЛ (чужой текст, механику взять — содержание НЕ копировать):
"""
${sourceText.slice(0, 6000)}
"""

БРИФ ЗАКАЗЧИКА:
Компания: ${companyName}${niche ? ` (ниша: ${niche})` : ""}
Платформа нового текста: ${platform}
${smmBlock}${brandBlock}${buildSegmentBlock(taSegment)}
Напиши новый текст по инструкции.`;

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
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(80000),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as {
      hook?: string; body?: string; hashtags?: string[]; mechanicsNote?: string;
    };
    if (!parsed.body) {
      return NextResponse.json({ ok: false, error: "Пустой ответ модели — попробуйте ещё раз" }, { status: 502 });
    }

    const post: GeneratedPost = {
      id: `rewrite-${Date.now()}`,
      ideaId: `rewrite-${Date.now()}`,
      pillar: "Рерайт",
      platform,
      hook: parsed.hook ?? "",
      body: parsed.body,
      hashtags: parsed.hashtags ?? [],
      imagePrompt: "",
      generatedAt: new Date().toISOString(),
    };

    await access.log({ endpoint: "content-rewrite", model: "gpt-4o-mini" });
    return NextResponse.json({ ok: true, data: post, mechanicsNote: parsed.mechanicsNote ?? "" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
