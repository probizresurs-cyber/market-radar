import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY не настроен" }, { status: 500 });

    const client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    });

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

Напиши полную статью строго по структуре. Используй Markdown-заголовки (##, ###). Ключевые запросы вставляй органично, плотность 1-2.5%.`;
      maxTokens = 6000;
    }

    // Use streaming — Cloudflare Worker requires stream:true to avoid 30s timeout
    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let content = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        content += event.delta.text;
      }
    }
    content = content.trim();

    if (mode === "section" && sectionId) return NextResponse.json({ sectionId, content });
    return NextResponse.json({ fullText: content, wordCount: content.split(/\s+/).length });
  } catch (e) {
    console.error("seo-generate-article error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
