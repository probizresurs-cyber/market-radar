/**
 * /api/ai-visibility/direct-mentions
 *
 * Прямой опрос всех 5 нейросетей: «Расскажи о компании X».
 * Без подсказок про бренд — пользователь хочет увидеть честный ответ.
 *
 * Реальные API: ChatGPT, Claude, Gemini (если ключи есть).
 * Симуляция: Yandex, Perplexity (нет ключей на сервере).
 */
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextResponse } from "next/server";
import type { LLMName } from "@/lib/ai-visibility-types";
import { GEMINI_API_KEY, generateGeminiText } from "@/lib/gemini";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";
import { checkAiAccess } from "@/lib/with-ai-security";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  // Сначала проверяем наличие бренда в тексте
  const nameOccurrences = (t.match(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  if (nameOccurrences === 0) {
    // Попробуем по значимым словам
    const words = b.split(/\s+/).filter(w => w.length >= 5);
    if (words.length === 0 || !words.every(w => t.includes(w))) return false;
  }

  // Бренд упомянут — но проверяем: не в контексте ли отказа/незнания?
  // Если модель говорит "я не знаю X" — это НЕ упоминание для наших целей.
  const denialPhrases = [
    "не знаю", "не знакомо", "не располагаю", "нет информации", "нет данных",
    "не нашёл", "не нашел", "не могу найти", "нет в базе", "не встречалось",
    "не имею информации", "у меня нет информации", "у меня нет данных",
    "no information", "i don't know", "i have no information", "not familiar",
    "cannot find", "не могу подтвердить", "недостаточно данных",
    "нет достоверных данных", "не могу предоставить информацию",
    "не располагаю достоверной", "недостаточно известна",
  ];
  const hasDenial = denialPhrases.some(p => t.includes(p));

  // Если отказ + бренд упомянут только 1-2 раза — скорее всего «я не знаю X»
  // Если упомянут 3+ раз — модель реально рассказывает о компании
  if (hasDenial && nameOccurrences < 3) return false;

  return true;
}

// ── Реальные вызовы ───────────────────────────────────────────────────────────
async function callChatGPT(query: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
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
  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: query }],
  });
  return text;
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
  const res = await fetchWithTimeout("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
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
  const res = await fetchWithTimeout("https://api.perplexity.ai/chat/completions", {
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

export async function POST(req: Request) {
  // Раньше открыт — теперь требуем auth.
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  try {
    const { brandName, websiteUrl } = await req.json() as {
      brandName: string;
      websiteUrl?: string;
    };

    if (!brandName) {
      return NextResponse.json({ ok: false, error: "brandName required" }, { status: 400 });
    }

    const query = `Расскажи мне о компании "${brandName}"${websiteUrl ? ` (сайт: ${websiteUrl})` : ""}. Что ты о ней знаешь? Если не знаешь — так и напиши, не придумывай.`;

    // Только модели с реальными API-ключами. Симуляция удалена полностью.
    // Yandex/Perplexity показываем ТОЛЬКО если ключи реально настроены —
    // иначе вообще не включаем в список (не показываем фейк-колонки).
    const llms: LLMName[] = ["claude", "chatgpt", "gemini"];
    if (process.env.YANDEX_GPT_IAM_TOKEN && process.env.YANDEX_GPT_FOLDER_ID) llms.push("yandex");
    if (process.env.PERPLEXITY_API_KEY) llms.push("perplexity");

    // Параллельно опрашиваем — только реальные вызовы, без симуляции.
    const tasks = llms.map<Promise<DirectMention>>(async (llm) => {
      let response = "";
      let isReal = false;
      let unavailable = false;

      try {
        if (llm === "chatgpt") {
          if (!process.env.OPENAI_API_KEY) { unavailable = true; }
          else { response = await callChatGPT(query); isReal = !!response; if (!response) unavailable = true; }
        } else if (llm === "claude") {
          response = await callClaudeDirect(query);
          isReal = !!response;
          if (!response) unavailable = true;
        } else if (llm === "gemini") {
          if (!GEMINI_API_KEY) { unavailable = true; }
          else { response = await callGemini(query); isReal = !!response; if (!response) unavailable = true; }
        } else if (llm === "yandex") {
          response = await callYandexGPT(query);
          isReal = !!response;
          if (!response) unavailable = true;
        } else if (llm === "perplexity") {
          response = await callPerplexity(query);
          isReal = !!response;
          if (!response) unavailable = true;
        }
      } catch (err) {
        unavailable = true;
        console.error(`[direct-mentions] ${llm} error:`, err instanceof Error ? err.message : err);
      }

      return {
        llm,
        query,
        response: unavailable ? "" : response,
        mentioned: unavailable ? false : detectMention(response, brandName),
        isReal,
        isSimulated: false, // симуляций больше нет
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
