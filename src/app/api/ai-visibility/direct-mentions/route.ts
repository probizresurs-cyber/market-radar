/**
 * /api/ai-visibility/direct-mentions
 *
 * Прямой опрос всех 5 нейросетей: «Расскажи о компании X».
 * Без подсказок про бренд — пользователь хочет увидеть честный ответ.
 *
 * Реальные API: ChatGPT, Claude, Gemini (если ключи есть).
 * Симуляция: Yandex, Perplexity (нет ключей на сервере).
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { LLMName } from "@/lib/ai-visibility-types";
import { GEMINI_API_KEY, generateGeminiText } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export interface DirectMention {
  llm: LLMName;
  query: string;
  response: string;
  mentioned: boolean;
  isReal: boolean;
  isSimulated: boolean;
  unavailable: boolean;
}

function detectMention(text: string, brand: string): boolean {
  if (!text || !brand) return false;
  const t = text.toLowerCase();
  const b = brand.toLowerCase();
  if (t.includes(b)) return true;
  // Если бренд многословный — считаем упомянутым только если все значимые слова (≥5 букв) есть
  const words = b.split(/\s+/).filter(w => w.length >= 5);
  return words.length > 0 && words.every(w => t.includes(w));
}

// ── Реальные вызовы ───────────────────────────────────────────────────────────
async function callChatGPT(query: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: "user", content: query }],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function callClaudeDirect(query: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: query }],
  });
  return (msg.content[0] as { type: string; text: string }).text;
}

async function callGemini(query: string): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  const result = await generateGeminiText({
    systemInstruction: "Отвечай по-русски честно. Если не знаешь компанию — так и скажи.",
    prompt: query,
    maxOutputTokens: 500,
    temperature: 0.6,
  });
  return result.ok ? result.text : "";
}

async function callYandexGPT(query: string): Promise<string> {
  const iamToken = process.env.YANDEX_GPT_IAM_TOKEN;
  const folderId = process.env.YANDEX_GPT_FOLDER_ID;
  if (!iamToken || !folderId) return "";
  const res = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: { Authorization: `Bearer ${iamToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt-lite`,
      completionOptions: { stream: false, temperature: 0.6, maxTokens: 500 },
      messages: [{ role: "user", text: query }],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.result?.alternatives?.[0]?.message?.text ?? "";
}

async function callPerplexity(query: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Симуляция через Claude — для Yandex/Perplexity, если у них нет ключа
async function simulateHonest(llm: LLMName, query: string): Promise<string> {
  const personas: Record<LLMName, string> = {
    yandex:     `Ты — Яндекс Нейро, поисковый ассистент. Если не знаешь — так и скажи. Не выдумывай факты.`,
    claude:     `Ты — Claude. Отвечай честно.`,
    chatgpt:    `Ты — ChatGPT. Отвечай честно, не выдумывай факты.`,
    perplexity: `Ты — Perplexity AI с опорой на источники из интернета. Если не находишь информации — так и пиши.`,
    gemini:     `Ты — Google Gemini. Отвечай честно. Если не знаешь компанию — так и скажи.`,
  };
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: personas[llm],
    messages: [{ role: "user", content: query }],
  });
  return (msg.content[0] as { type: string; text: string }).text;
}

export async function POST(req: Request) {
  try {
    const { brandName, websiteUrl } = await req.json() as {
      brandName: string;
      websiteUrl?: string;
    };

    if (!brandName) {
      return NextResponse.json({ ok: false, error: "brandName required" }, { status: 400 });
    }

    const query = `Расскажи мне о компании "${brandName}"${websiteUrl ? ` (сайт: ${websiteUrl})` : ""}. Что ты о ней знаешь? Если не знаешь — так и напиши, не придумывай.`;

    const llms: LLMName[] = ["yandex", "claude", "chatgpt", "perplexity", "gemini"];
    const realApiOnly = (l: LLMName) => l === "chatgpt" || l === "claude";

    // Параллельно опрашиваем все 5
    const tasks = llms.map<Promise<DirectMention>>(async (llm) => {
      let response = "";
      let isReal = false;
      let isSimulated = false;
      let unavailable = false;

      try {
        if (llm === "chatgpt") {
          if (!process.env.OPENAI_API_KEY) {
            unavailable = true;
          } else {
            response = await callChatGPT(query);
            isReal = !!response;
            if (!response) unavailable = true;
          }
        } else if (llm === "claude") {
          response = await callClaudeDirect(query);
          isReal = !!response;
          if (!response) unavailable = true;
        } else if (llm === "gemini") {
          response = await callGemini(query);
          if (response) {
            isReal = true;
          } else {
            response = await simulateHonest(llm, query);
            isSimulated = true;
          }
        } else if (llm === "yandex") {
          response = await callYandexGPT(query);
          if (response) {
            isReal = true;
          } else {
            response = await simulateHonest(llm, query);
            isSimulated = true;
          }
        } else if (llm === "perplexity") {
          response = await callPerplexity(query);
          if (response) {
            isReal = true;
          } else {
            response = await simulateHonest(llm, query);
            isSimulated = true;
          }
        }
      } catch (err) {
        if (realApiOnly(llm)) {
          unavailable = true;
          response = `Ошибка API: ${err instanceof Error ? err.message : "unknown"}`;
        } else {
          try {
            response = await simulateHonest(llm, query);
            isSimulated = true;
          } catch {
            response = "Не удалось получить ответ.";
            isSimulated = true;
          }
        }
      }

      return {
        llm,
        query,
        response: unavailable ? "" : response,
        mentioned: unavailable ? false : detectMention(response, brandName),
        isReal,
        isSimulated,
        unavailable,
      };
    });

    const mentions = await Promise.all(tasks);
    return NextResponse.json({ ok: true, mentions });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
