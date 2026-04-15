import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, platform, articleType, taContext, brandBook } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

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

Верни ТОЛЬКО валидный JSON без markdown-блоков, начинающийся с { и заканчивающийся }:
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

Для wordCountTarget: informational=2000-3000, how-to=1500-2500, listicle=2000-4000, review=2500-4000, comparison=2000-3500, case-study=1500-2500, faq=1500-3000, landing-article=1200-2000.`;

    const res = await fetch(
      `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Anthropic ${res.status}: ${err.slice(0, 300)}` }, { status: 500 });
    }

    const json = await res.json();
    const text: string = json.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Не удалось распарсить JSON из ответа");
    const brief = JSON.parse(match[0]);
    return NextResponse.json({ brief });
  } catch (e) {
    console.error("seo-generate-brief error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
