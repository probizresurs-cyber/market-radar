import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

const SYSTEM_PROMPT = "Ты — SEO-эксперт и редактор. Составляешь детальные брифы для SEO-статей. Отвечаешь ТОЛЬКО валидным JSON без markdown-обёрток. Твой ответ начинается с { и заканчивается }.";

function extractJson(text: string): unknown {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");
  const end = stripped.lastIndexOf("}");
  if (end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* fall through */ }
  }
  const partial = stripped.slice(start);
  for (let i = partial.length - 1; i > 0; i--) {
    if (partial[i] === "}") {
      try { return JSON.parse(partial.slice(0, i + 1)); } catch { /* continue */ }
    }
  }
  throw new Error(`Failed to parse AI response as JSON. Preview: ${stripped.slice(0, 200)}`);
}

export async function POST(req: Request) {
  try {
    const { topic, companyName, niche, platform, articleType, taContext, brandBook } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });
    }

    const today = new Date().toLocaleDateString("ru-RU");

    const userPrompt = `Составь детальный бриф для SEO-статьи.

ДАТА: ${today}
КОМПАНИЯ: ${companyName || "не указана"}
НИША: ${niche || "не указана"}
ТЕМА СТАТЬИ: ${topic}
ТИП СТАТЬИ: ${articleType}
ПЛАТФОРМА: ${platform}
${taContext ? `\nЦЕЛЕВАЯ АУДИТОРИЯ:\n${taContext}` : ""}
${brandBook?.toneOfVoice?.length ? `\nТОН ГОЛОСА БРЕНДА: ${brandBook.toneOfVoice.join(", ")}` : ""}

Верни строго этот JSON:
{"articleType":"${articleType}","platform":"${platform}","topic":"уточнённая тема","audience":"описание целевого читателя (1-2 предложения)","wordCountTarget":2500,"focusKeyword":"главный ключевой запрос","secondaryKeywords":["ключ 1","ключ 2","ключ 3","ключ 4","ключ 5"],"competitorUrls":[],"toneOfVoice":["экспертный","понятный","практичный"],"callToAction":"текст призыва к действию","internalLinks":[],"suggestedH1":"предлагаемый заголовок H1","suggestedMeta":{"title":"SEO-заголовок до 60 символов","metaDescription":"meta-описание до 160 символов","slug":"url-slug-transliterated"}}

Для wordCountTarget: informational=2000-3000, how-to=1500-2500, listicle=2000-4000, review=2500-4000, comparison=2000-3500, case-study=1500-2500, faq=1500-3000, landing-article=1200-2000.`;

    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    });

    let rawText = "";
    for await (const event of streamResponse) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        rawText += event.delta.text;
      }
    }

    if (!rawText) return NextResponse.json({ error: "Пустой ответ от Claude" }, { status: 500 });

    const brief = extractJson(rawText);
    return NextResponse.json({ brief });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("seo-generate-brief error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
