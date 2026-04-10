import { NextResponse } from "next/server";
import type { Review } from "@/lib/review-types";
import type { ReviewAnalysis } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Ты — аналитик отзывов. Получаешь массив отзывов о компании и делаешь глубокий анализ.

Анализируй:
1. Общий sentiment (позитив / негатив / нейтрал) — подсчёт по количеству
2. Тематический разбор — выделяй темы (обслуживание, цена, качество, скорость, локация, персонал и т.д.)
3. Для каждой темы: сколько позитивных/негативных/нейтральных упоминаний + ключевые цитаты
4. Сильные стороны — что хвалят чаще всего
5. Слабые стороны — на что жалуются
6. Рекомендации — конкретные действия для улучшения
7. Шаблоны ответов — 2-3 шаблона для ответов на позитивные, негативные и нейтральные отзывы
8. Краткое резюме — 2-3 предложения

Возвращай СТРОГО валидный JSON без markdown:
{
  "totalReviews": число,
  "avgRating": число (1 десятичный),
  "ratingDistribution": { "1": число, "2": число, "3": число, "4": число, "5": число },
  "sentimentSummary": { "positive": число, "negative": число, "neutral": число },
  "topics": [
    {
      "topic": "название темы",
      "positive": число,
      "negative": число,
      "neutral": число,
      "keyQuotes": ["цитата 1", "цитата 2"]
    }
  ],
  "strengths": ["сильная сторона 1", "..."],
  "weaknesses": ["слабая сторона 1", "..."],
  "recommendations": ["рекомендация 1", "..."],
  "responseTemplates": [
    { "type": "positive", "template": "Спасибо за ваш отзыв! ..." },
    { "type": "negative", "template": "Нам очень жаль, что ... Мы обязательно ..." },
    { "type": "neutral", "template": "Благодарим за обратную связь! ..." }
  ],
  "summary": "Общий вердикт по отзывам в 2-3 предложениях"
}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? "";
    const reviews: Review[] = body.reviews ?? [];

    if (reviews.length === 0) {
      return NextResponse.json({ ok: false, error: "Нет отзывов для анализа" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OpenAI API key не настроен" }, { status: 500 });
    }

    // Build compact text dump of reviews
    const reviewsDump = reviews
      .map((r, i) => `[${i + 1}] ★${r.rating} | ${r.author} | ${r.date}\n${r.text}${r.reply ? `\n→ Ответ: ${r.reply}` : ""}`)
      .join("\n\n");

    const userPrompt = `Компания: «${companyName}»
Всего отзывов: ${reviews.length}
Платформы: ${[...new Set(reviews.map(r => r.platform))].join(", ")}

ОТЗЫВЫ:
${reviewsDump}

Проведи полный анализ и верни JSON.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ ok: false, error: `OpenAI error ${res.status}: ${errBody.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}");

    const analysis: ReviewAnalysis = {
      id: `ra-${Date.now()}`,
      companyName,
      totalReviews: parsed.totalReviews ?? reviews.length,
      avgRating: parsed.avgRating ?? 0,
      ratingDistribution: parsed.ratingDistribution ?? {},
      sentimentSummary: parsed.sentimentSummary ?? { positive: 0, negative: 0, neutral: 0 },
      topics: parsed.topics ?? [],
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      recommendations: parsed.recommendations ?? [],
      responseTemplates: parsed.responseTemplates ?? [],
      summary: parsed.summary ?? "",
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data: analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
