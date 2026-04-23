import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { AIMention, SiteReadinessItem, AIRecommendation } from "@/lib/ai-visibility-types";

export const runtime = "nodejs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export async function POST(req: Request) {
  try {
    const {
      brandName,
      niche,
      mentions,
      siteReadiness,
      totalScore,
    }: {
      brandName: string;
      niche: string;
      mentions: AIMention[];
      siteReadiness: SiteReadinessItem[];
      totalScore: number;
    } = await req.json();

    const mentionedCount = mentions.filter(m => m.mentioned).length;
    const totalQueries = mentions.length;
    const failedSite = siteReadiness.filter(i => !i.passed).map(i => i.label);

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Ты GEO-эксперт (Generative Engine Optimization). Подготовь приоритизированный список рекомендаций для улучшения AI-видимости бренда.

Данные аудита:
- Бренд: ${brandName}
- Ниша: ${niche}
- AI Visibility Score: ${totalScore}/100
- Упоминания AI-ассистентов: ${mentionedCount} из ${totalQueries} запросов
- Проблемы AI-готовности сайта: ${failedSite.length > 0 ? failedSite.join("; ") : "нет"}

Создай ровно 7 рекомендаций. Каждая строго в следующем JSON формате:
{
  "priority": "critical" | "important" | "recommended",
  "title": "краткий заголовок до 60 символов",
  "description": "объяснение почему это важно (2-3 предложения)",
  "howTo": "конкретные шаги как сделать (2-4 предложения)",
  "impactScore": число от 3 до 20 (насколько вырастет score),
  "category": "schema" | "content" | "external" | "technical"
}

Верни ТОЛЬКО JSON-массив из 7 объектов, без пояснений вне массива.`,
        },
      ],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");
    const recommendations: AIRecommendation[] = JSON.parse(match[0]);

    return NextResponse.json({ ok: true, recommendations: recommendations.slice(0, 7) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
