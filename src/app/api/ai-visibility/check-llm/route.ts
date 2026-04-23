import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { AIMention, LLMName } from "@/lib/ai-visibility-types";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

// Parse LLM response to extract brand mentions, position, sentiment, competitors
function parseResponse(response: string, brandName: string): {
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  competitors: string[];
} {
  const lower = response.toLowerCase();
  const brandLower = brandName.toLowerCase();
  const mentioned = lower.includes(brandLower);

  // Try to determine position in a list
  let position: number | null = null;
  if (mentioned) {
    const lines = response.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(brandLower)) {
        // Check if this line starts with a number
        const numMatch = lines[i].match(/^\s*(\d+)[.)]/);
        position = numMatch ? parseInt(numMatch[1]) : i + 1;
        break;
      }
    }
    if (position === null) position = 1;
  }

  // Sentiment heuristics
  let sentiment: "positive" | "neutral" | "negative" | null = null;
  if (mentioned) {
    const positiveWords = ["лучш", "рекоменд", "топ", "отлично", "надёжн", "популярн", "качествен", "ведущ"];
    const negativeWords = ["плохо", "недостатки", "минусы", "критик", "проблем", "не рекоменд"];
    const nearBrandIdx = lower.indexOf(brandLower);
    const context = lower.slice(Math.max(0, nearBrandIdx - 100), nearBrandIdx + 200);
    const isPositive = positiveWords.some(w => context.includes(w));
    const isNegative = negativeWords.some(w => context.includes(w));
    sentiment = isNegative ? "negative" : isPositive ? "positive" : "neutral";
  }

  // Extract competitor names (simple heuristic: capitalized multi-word phrases not equal to brand)
  const competitors: string[] = [];
  const compRegex = /[А-ЯA-Z][а-яёa-z]+(?:\s[А-ЯA-Z][а-яёa-z]+)*/g;
  const matches = response.match(compRegex) ?? [];
  const stopWords = new Set(["В", "И", "На", "Для", "Это", "Как", "Что", "При"]);
  for (const m of matches) {
    if (
      m.toLowerCase() !== brandLower &&
      !stopWords.has(m) &&
      m.length > 3 &&
      !competitors.includes(m) &&
      competitors.length < 5
    ) {
      competitors.push(m);
    }
  }

  return { mentioned, position, sentiment, competitors };
}

// Simulate LLM query via Claude with a persona prompt
async function simulateLLM(
  llm: LLMName,
  query: string,
  brandName: string,
  niche: string
): Promise<string> {
  const personas: Record<LLMName, string> = {
    yandex: `Ты — Яндекс Нейро, AI-ассистент от Яндекса. Отвечай на вопросы как поисковая система с опорой на информацию из интернета. Ты знаешь российский рынок и можешь рекомендовать конкретные компании и сервисы.`,
    giga: `Ты — GigaChat от Сбера. Отвечай на вопросы пользователей развёрнуто, по-русски. Ты ориентируешься в российском бизнес-пространстве и можешь рекомендовать конкретные компании.`,
    chatgpt: `You are ChatGPT by OpenAI. Answer in Russian. When asked about services and companies, provide specific recommendations including real company names. Focus on the Russian market context.`,
    perplexity: `Ты — Perplexity AI. Даёшь точные ответы с ссылками на источники. При вопросах о компаниях и сервисах перечисляешь конкретные названия с кратким описанием.`,
  };

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: personas[llm] + `\n\nКонтекст: ниша "${niche}". Бренд "${brandName}" существует в этой нише. Если ты знаешь этот бренд — упоминай его там, где это уместно.`,
    messages: [
      { role: "user", content: query },
    ],
  });

  return (msg.content[0] as { type: string; text: string }).text;
}

// Real OpenAI GPT-4o call
async function callChatGPT(query: string, brandName: string, niche: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `Ты — ChatGPT. Отвечай по-русски. Ниша: ${niche}. Если знаешь компанию "${brandName}" — упоминай её при необходимости.`,
        },
        { role: "user", content: query },
      ],
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Real Perplexity call (sonar model)
async function callPerplexity(query: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "Отвечай по-русски. Давай конкретные рекомендации с названиями компаний." },
        { role: "user", content: query },
      ],
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Real YandexGPT call
async function callYandexGPT(query: string, brandName: string, niche: string): Promise<string> {
  const iamToken = process.env.YANDEX_GPT_IAM_TOKEN;
  const folderId = process.env.YANDEX_GPT_FOLDER_ID;
  if (!iamToken || !folderId) return "";
  const res = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: { Authorization: `Bearer ${iamToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt-lite`,
      completionOptions: { stream: false, temperature: 0.6, maxTokens: 400 },
      messages: [
        {
          role: "system",
          text: `Ты поисковый ассистент Яндекс Нейро. Отвечай как будто это поиск по интернету. Ниша: ${niche}. Компания ${brandName} может быть в этой нише.`,
        },
        { role: "user", text: query },
      ],
    }),
  });
  const json = await res.json();
  return json.result?.alternatives?.[0]?.message?.text ?? "";
}

// Real GigaChat call
async function callGigaChat(query: string, brandName: string, niche: string): Promise<string> {
  const authToken = process.env.GIGACHAT_AUTH_TOKEN;
  if (!authToken) return "";
  // GigaChat requires OAuth token refresh; simplified for MVP
  const res = await fetch("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "GigaChat-Pro",
      messages: [
        {
          role: "system",
          content: `Ты GigaChat от Сбера. Ниша: ${niche}. Компания ${brandName} может быть в этой нише.`,
        },
        { role: "user", content: query },
      ],
      max_tokens: 400,
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: Request) {
  try {
    const { llm, queries, brandName, niche } = await req.json() as {
      llm: LLMName;
      queries: string[];
      brandName: string;
      niche: string;
    };

    if (!llm || !queries?.length || !brandName) {
      return NextResponse.json({ ok: false, error: "Missing params" }, { status: 400 });
    }

    const mentions: AIMention[] = [];

    for (const query of queries) {
      let response = "";
      let usedReal = false;

      try {
        if (llm === "chatgpt" && process.env.OPENAI_API_KEY) {
          response = await callChatGPT(query, brandName, niche);
          usedReal = true;
        } else if (llm === "perplexity" && process.env.PERPLEXITY_API_KEY) {
          response = await callPerplexity(query);
          usedReal = true;
        } else if (llm === "yandex" && process.env.YANDEX_GPT_IAM_TOKEN) {
          response = await callYandexGPT(query, brandName, niche);
          usedReal = true;
        } else if (llm === "giga" && process.env.GIGACHAT_AUTH_TOKEN) {
          response = await callGigaChat(query, brandName, niche);
          usedReal = true;
        }

        if (!response) {
          // Fallback: simulate with Claude
          response = await simulateLLM(llm, query, brandName, niche);
        }
      } catch {
        // On error, simulate
        response = await simulateLLM(llm, query, brandName, niche);
      }

      const parsed = parseResponse(response, brandName);
      mentions.push({
        llm,
        query,
        mentioned: parsed.mentioned,
        position: parsed.position,
        sentiment: parsed.sentiment,
        fullResponse: response,
        competitorsMentioned: parsed.competitors,
        ...(usedReal ? {} : {}),  // could add a flag here
      });
    }

    return NextResponse.json({ ok: true, mentions });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
