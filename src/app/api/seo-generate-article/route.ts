import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SEOArticleBrief, SEOSection } from "@/lib/seo-types";

export const runtime = "nodejs";
export const maxDuration = 180;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export async function POST(req: NextRequest) {
  try {
    const { brief, h1, intro, sections, conclusion, mode, sectionId, brandBook }
      : {
          brief: SEOArticleBrief;
          h1: string;
          intro: string;
          sections: SEOSection[];
          conclusion: string;
          mode: "full" | "section";
          sectionId?: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          brandBook?: any;
        }
      = await req.json();

    const tov = brandBook?.toneOfVoice?.length
      ? `Тон голоса: ${brandBook.toneOfVoice.join(", ")}.`
      : "";
    const forbidden = brandBook?.forbiddenWords?.length
      ? `Запрещённые слова: ${brandBook.forbiddenWords.join(", ")}.`
      : "";

    if (mode === "section" && sectionId) {
      // Generate a single section
      const sec = sections.find(s => s.id === sectionId);
      if (!sec) return NextResponse.json({ error: "Section not found" }, { status: 400 });

      const prevContent = sections
        .filter(s => s.order < sec.order && s.generatedContent)
        .map(s => `## ${s.heading}\n${s.generatedContent}`)
        .join("\n\n");

      const prompt = `Ты — SEO-копирайтер. Напиши раздел статьи.

СТАТЬЯ: ${brief.topic}
ПЛАТФОРМА: ${brief.platform}
${tov} ${forbidden}
ФОКУС-КЛЮЧ: ${brief.focusKeyword}
КЛЮЧИ ДЛЯ ЭТОГО РАЗДЕЛА: ${sec.keywords.join(", ")}

${prevContent ? `УЖЕ НАПИСАНО (для контекста):\n${prevContent}\n---` : ""}

ЗАДАЧА: Напиши раздел "${sec.heading}" (H${sec.level}).
Бриф раздела: ${sec.contentBrief}
Целевой объём: ~${sec.wordTarget} слов.

Требования:
- Начни сразу с текста (без заголовка — он уже есть в структуре)
- Используй ключевые слова раздела органично
- Пиши для живого читателя, не для робота
- Абзацы 3-5 предложений
- Добавь конкретику: цифры, примеры, факты где уместно
- Не повторяй уже написанный контент`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const content = (response.content[0] as { type: string; text: string }).text.trim();
      return NextResponse.json({ sectionId, content });
    }

    // Full article mode (for short articles ≤ 2000 words)
    const outlineText = sections.map(s => `${"#".repeat(s.level)} ${s.heading}\n(${s.contentBrief}, ~${s.wordTarget} слов)`).join("\n\n");

    const prompt = `Ты — SEO-копирайтер. Напиши полную статью по брифу.

ТЕМА: ${brief.topic}
ПЛАТФОРМА: ${brief.platform}
ТИП: ${brief.articleType}
ФОКУС-КЛЮЧ: ${brief.focusKeyword}
ВТОРИЧНЫЕ КЛЮЧИ: ${brief.secondaryKeywords.join(", ")}
ЦА: ${brief.audience}
CTA: ${brief.callToAction}
${tov} ${forbidden}

СТРУКТУРА:
H1: ${h1}

Лид: ${intro}

${outlineText}

Заключение: ${conclusion}

Напиши полную статью строго по структуре. Требования:
- Используй заголовки H1/H2/H3 из структуры
- Органично вставляй ключевые запросы (плотность 1-2.5%)
- Пиши живо и экспертно
- Добавь конкретику: примеры, цифры, факты
- Завершись чётким призывом к действию
- Формат: Markdown (## для H2, ### для H3)`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const fullText = (response.content[0] as { type: string; text: string }).text.trim();
    const wordCount = fullText.split(/\s+/).length;

    return NextResponse.json({ fullText, wordCount });
  } catch (e) {
    console.error("seo-generate-article error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
