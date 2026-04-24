import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { CompanyStyleProfile } from "@/lib/company-style-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

// Cap each doc excerpt so total prompt stays reasonable; sample from start/middle/end.
function sampleText(text: string, cap = 4500): string {
  if (text.length <= cap) return text;
  const part = Math.floor(cap / 3);
  const start = text.slice(0, part);
  const mid = text.slice(Math.floor(text.length / 2) - part / 2, Math.floor(text.length / 2) + part / 2);
  const end = text.slice(-part);
  return `${start}\n\n[...]\n\n${mid}\n\n[...]\n\n${end}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      docs: Array<{ id: string; name: string; fullText: string }>;
      companyName?: string;
    };

    if (!body.docs?.length) {
      return NextResponse.json({ ok: false, error: "Нужен хотя бы один документ" }, { status: 400 });
    }

    const excerpts = body.docs
      .slice(0, 8) // cap docs to avoid giant prompts
      .map((d, i) => `=== ДОКУМЕНТ ${i + 1}: ${d.name} ===\n${sampleText(d.fullText)}`)
      .join("\n\n");

    const prompt = `Ты — редактор и лингвист. Перед тобой реальные тексты компании ${body.companyName ?? ""}.
Твоя задача — извлечь из них стилистический профиль так, чтобы другая модель могла писать НОВЫЕ тексты в точно такой же манере.

Проанализируй:
- общий тон и настроение
- длину предложений
- любимые и запретные слова/обороты
- профессиональную терминологию
- структурные приёмы (вопросы, списки, подзаголовки, вступления)
- риторические приёмы (метафоры, контрасты, повторы)
- особенности пунктуации
- 5-10 реальных цитат-образцов (копируй дословно из текстов)

Верни СТРОГО JSON без пояснений:
{
  "summary": "3-5 предложений про стиль компании",
  "toneDescriptors": ["..."],
  "sentenceLength": "short" | "medium" | "long" | "mixed",
  "vocabulary": {
    "favoriteWords": ["..."],
    "avoidWords": ["..."],
    "terminology": ["..."]
  },
  "structurePatterns": ["..."],
  "rhetoricalDevices": ["..."],
  "punctuationQuirks": ["..."],
  "examplePhrases": ["..."],
  "dosAndDonts": {
    "dos": ["..."],
    "donts": ["..."]
  },
  "styleGuideText": "Готовый блок-гайдлайн (10-15 строк) который можно вставить в системный промпт, чтобы другая модель писала в этом стиле"
}

ТЕКСТЫ КОМПАНИИ:
${excerpts}`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude не вернул JSON");

    const parsed = JSON.parse(match[0]) as Omit<CompanyStyleProfile, "generatedAt" | "basedOnDocIds">;

    const profile: CompanyStyleProfile = {
      ...parsed,
      generatedAt: new Date().toISOString(),
      basedOnDocIds: body.docs.map(d => d.id),
    };

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
