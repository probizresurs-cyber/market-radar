import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

function robustJsonParse(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* continue */ }
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const start = stripped.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(stripped.slice(start, i + 1)); } catch { break; } } }
  }
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export async function POST(req: NextRequest) {
  try {
    const { topic, companyName, niche, platform, articleType, taContext, brandBook } = await req.json();

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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "{" },
      ],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text.trim();
    const data = robustJsonParse("{" + rawText);
    if (!data) throw new Error("Не удалось разобрать JSON из ответа модели");

    return NextResponse.json({ brief: data });
  } catch (e) {
    console.error("seo-generate-brief error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
