import { NextRequest, NextResponse } from "next/server";
import type { SEOArticleBrief, SEOSection } from "@/lib/seo-types";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const { brief, h1, intro, sections, conclusion, mode, sectionId, brandBook }
      : {
          brief: SEOArticleBrief; h1: string; intro: string;
          sections: SEOSection[]; conclusion: string;
          mode: "full" | "section"; sectionId?: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          brandBook?: any;
        }
      = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не настроен" }, { status: 500 });

    const tov = brandBook?.toneOfVoice?.length ? `Тон голоса: ${brandBook.toneOfVoice.join(", ")}.` : "";
    const forbidden = brandBook?.forbiddenWords?.length ? `Запрещённые слова: ${brandBook.forbiddenWords.join(", ")}.` : "";

    let prompt: string;
    let maxTokens: number;

    if (mode === "section" && sectionId) {
      const sec = sections.find(s => s.id === sectionId);
      if (!sec) return NextResponse.json({ error: "Section not found" }, { status: 400 });

      const prevContent = sections
        .filter(s => s.order < sec.order && s.generatedContent)
        .map(s => `## ${s.heading}\n${s.generatedContent}`)
        .join("\n\n");

      prompt = `Ты — SEO-копирайтер. Напиши раздел статьи.

СТАТЬЯ: ${brief.topic} | ПЛАТФОРМА: ${brief.platform}
${tov} ${forbidden}
ФОКУС-КЛЮЧ: ${brief.focusKeyword}
КЛЮЧИ РАЗДЕЛА: ${sec.keywords.join(", ")}
${prevContent ? `\nУЖЕ НАПИСАНО:\n${prevContent}\n---` : ""}

Напиши раздел "${sec.heading}" (H${sec.level}).
Бриф: ${sec.contentBrief}. Объём: ~${sec.wordTarget} слов.
Начни сразу с текста (без заголовка). Пиши экспертно, добавляй факты.`;
      maxTokens = 2000;
    } else {
      const outlineText = sections
        .map(s => `${"#".repeat(s.level)} ${s.heading}\n(${s.contentBrief}, ~${s.wordTarget} слов)`)
        .join("\n\n");

      prompt = `Ты — SEO-копирайтер. Напиши полную статью по брифу.

ТЕМА: ${brief.topic} | ПЛАТФОРМА: ${brief.platform} | ТИП: ${brief.articleType}
ФОКУС-КЛЮЧ: ${brief.focusKeyword} | ВТОРИЧНЫЕ: ${brief.secondaryKeywords.join(", ")}
ЦА: ${brief.audience} | CTA: ${brief.callToAction}
${tov} ${forbidden}

СТРУКТУРА:
# ${h1}
Лид: ${intro}

${outlineText}

Заключение: ${conclusion}

Напиши полную статью строго по структуре. Markdown-заголовки (##, ###). Ключевые запросы органично, плотность 1-2.5%.`;
      maxTokens = 6000;
    }

    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI ${res.status}: ${err.slice(0, 300)}` }, { status: 500 });
    }

    const json = await res.json();
    const content = json.choices[0].message.content?.trim() || "";

    if (mode === "section" && sectionId) return NextResponse.json({ sectionId, content });
    return NextResponse.json({ fullText: content, wordCount: content.split(/\s+/).length });
  } catch (e) {
    console.error("seo-generate-article error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
