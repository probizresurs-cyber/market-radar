import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "@/lib/types";
import { checkAiAccess, estimateTokens } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
});

function extractJson(text: string): any {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found");
  const end = stripped.lastIndexOf("}");
  if (end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch {}
  }
  const partial = stripped.slice(start);
  for (let i = partial.length - 1; i > 0; i--) {
    if (partial[i] === "}") {
      try { return JSON.parse(partial.slice(0, i + 1)); } catch {}
    }
  }
  throw new Error("Failed to parse JSON");
}

function buildPrompt(myCompany: AnalysisResult, competitors: AnalysisResult[]): string {
  const fmt = (c: AnalysisResult) => `
  Компания: ${c.company.name} (${c.company.url})
  Балл: ${c.company.score}/100, категории: ${c.company.categories.map(cat => `${cat.name}:${cat.score}`).join(", ")}
  SEO-трафик: ${c.seo.estimatedTraffic || "?"}, возраст домена: ${c.seo.archiveAgeYears ? c.seo.archiveAgeYears + " лет" : c.seo.domainAge || "?"}
  PageSpeed: ${c.seo.lighthouseScores?.performance ?? "—"}/100
  Вакансии: ${c.hiring.openVacancies}, тренд найма: ${c.hiring.trend}
  VK: ${c.social.vk ? c.social.vk.subscribers + " подп." : "нет"}
  Карты: Яндекс ${c.social.yandexRating || "—"}★, 2GIS ${c.social.gisRating || "—"}★
  Топ-ключи: ${c.seo.positions.slice(0, 5).map(p => `«${p.keyword}»(${p.position})`).join(", ") || "нет"}
  Ниша: ${c.nicheForecast.trend}, E-E-A-T expertise: ${c.aiPerception.eeat.expertise}`;

  return `Ты — стратег по конкурентной разведке для российского рынка. Проведи анализ.

МОЯ КОМПАНИЯ:${fmt(myCompany)}

КОНКУРЕНТЫ:${competitors.map((comp, i) => `\n=== Конкурент ${i + 1} ===${fmt(comp)}`).join("")}

Верни ТОЛЬКО JSON без markdown:
{
  "positioning": "2-3 предложения честной оценки конкурентной позиции",
  "keyInsight": "главный инсайт одной фразой до 100 символов",
  "battleCards": [
    {
      "competitorName": "название точно как в данных",
      "youWin": ["причина 1 почему вы лучше", "причина 2"],
      "theyWin": ["причина 1 почему они лучше", "причина 2"],
      "mainThreat": "главная угроза от этого конкурента (1-2 предложения)",
      "mainOpportunity": "главная возможность против него (1-2 предложения)",
      "verdict": "Вы выигрываете | Паритет | Они выигрывают",
      "verdictColor": "green | yellow | red"
    }
  ],
  "strategicRecs": ["рекомендация 1 конкретно что делать", "рекомендация 2", "рекомендация 3"],
  "marketGaps": ["незанятая возможность 1", "возможность 2", "возможность 3"],
  "seoGaps": ["ключ/тема не закрытая конкурентами 1", "тема 2"]
}`;
}

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;
  try {
    const body = await req.json();
    const myCompany: AnalysisResult = body.myCompany;
    const competitors: AnalysisResult[] = body.competitors ?? [];

    if (!myCompany) return NextResponse.json({ ok: false, error: "Нет данных о компании" }, { status: 400 });
    if (competitors.length === 0) return NextResponse.json({ ok: false, error: "Нет конкурентов" }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "API key не настроен" }, { status: 500 });

    const prompt = buildPrompt(myCompany, competitors);
    const streamResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "Ты — эксперт по конкурентной разведке. Отвечаешь ТОЛЬКО валидным JSON без markdown. Ответ начинается с { и заканчивается }.",
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let text = "";
    for await (const event of streamResponse) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
      }
    }

    const parsed = extractJson(text);
    await access.log({
      endpoint: "generate-competitor-insights",
      model: "claude-sonnet-4-6",
      promptTokens: estimateTokens(prompt),
      completionTokens: estimateTokens(text),
    });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await access.log({ endpoint: "generate-competitor-insights", model: "claude-sonnet-4-6", success: false, errorMessage: msg.slice(0, 200) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
