import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ANTI_HALLUCINATION_SHORT } from "@/lib/ai-rules";
import type { GeneratedPost, BrandBook } from "@/lib/content-types";
import type { SMMResult } from "@/lib/smm-types";
import type { TASegment } from "@/lib/ta-types";
import { buildSegmentBlock } from "@/lib/ta-segment-prompt";
import { chatJson, CHAT_MODEL_SMART } from "@/lib/ai-chat";

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

    const aiResult = await chatJson<{ hook?: string; body?: string; hashtags?: string[]; mechanicsNote?: string }>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      model: CHAT_MODEL_SMART,
      temperature: 0.85,
      maxTokens: 3000,
    });
    const parsed = aiResult.data;
    if (!parsed?.body) {
      return NextResponse.json({ ok: false, error: aiResult.error ?? "Пустой ответ модели — попробуйте ещё раз" }, { status: 502 });
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

    await access.log({ endpoint: "content-rewrite", model: aiResult.modelUsed });
    return NextResponse.json({ ok: true, data: post, mechanicsNote: parsed.mechanicsNote ?? "" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
