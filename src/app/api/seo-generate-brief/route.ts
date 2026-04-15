import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPENAI_URL = `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`;

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, platform, articleType, taContext, brandBook } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не настроен" }, { status: 500 });

    const today = new Date().toLocaleDateString("ru-RU");

    const prompt = `Ты — SEO-эксперт и редактор. Составь детальный бриф для SEO-статьи.

ДАТА: ${today}
КОМПАНИЯ: ${companyName || "не указана"}
НИША: ${niche || "не указана"}
ТЕМА СТАТЬИ: ${topic}
ТИП СТАТЬИ: ${articleType}
ПЛАТФОРМА: ${platform}
${taContext ? `\nЦЕЛЕВАЯ АУДИТОРИЯ:\n${taContext}` : ""}
${brandBook?.toneOfVoice?.length ? `\nТОН ГОЛОСА БРЕНДА: ${brandBook.toneOfVoice.join(", ")}` : ""}

Верни ТОЛЬКО валидный JSON (без markdown-блоков) со следующей структурой:
{
  "articleType": "${articleType}",
  "platform": "${platform}",
  "topic": "уточнённая тема",
  "audience": "описание целевого читателя (1-2 предложения)",
  "wordCountTarget": 2500,
  "focusKeyword": "главный ключевой запрос",
  "secondaryKeywords": ["ключ 1", "ключ 2", "ключ 3", "ключ 4", "ключ 5"],
  "competitorUrls": [],
  "toneOfVoice": ["экспертный", "понятный", "практичный"],
  "callToAction": "текст призыва к действию",
  "internalLinks": [],
  "suggestedH1": "предлагаемый заголовок H1",
  "suggestedMeta": {
    "title": "SEO-заголовок до 60 символов",
    "metaDescription": "meta-описание до 160 символов",
    "slug": "url-slug-transliterated"
  }
}

Для wordCountTarget ориентируйся на тип: informational=2000-3000, how-to=1500-2500, listicle=2000-4000, review=2500-4000, comparison=2000-3500, case-study=1500-2500, faq=1500-3000, landing-article=1200-2000.`;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI ${res.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }

    const json = await res.json();
    const data = JSON.parse(json.choices[0].message.content);

    return NextResponse.json({ brief: data });
  } catch (e) {
    console.error("seo-generate-brief error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
