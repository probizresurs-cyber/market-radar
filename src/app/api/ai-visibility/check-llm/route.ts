/**
 * /api/ai-visibility/check-llm
 *
 * Честная проверка: упоминает ли нейросеть бренд в реальном ответе?
 *
 * ВАЖНО: здесь НЕТ подсказок модели «если знаешь бренд — упоминай».
 * Запросы идут чистыми, ровно так, как их задаёт реальный пользователь.
 * Только так можно честно измерить AI-видимость.
 *
 * Модели:
 *   chatgpt    — реальный OpenAI GPT-4o-mini (если OPENAI_API_KEY)
 *   claude     — реальный Anthropic claude-haiku-4-5 (если ANTHROPIC_API_KEY)
 *   gemini     — реальный Google Gemini (если GEMINI_API_KEY)
 *   yandex     — реальный YandexGPT (если YANDEX_GPT_IAM_TOKEN + YANDEX_GPT_FOLDER_ID)
 *   perplexity — реальный Perplexity sonar (если PERPLEXITY_API_KEY)
 *
 * Если реального ключа нет → Claude симулирует «как мог бы ответить» тот ассистент,
 * но БЕЗ биас-подсказок. Ответ помечается isSimulated: true.
 */
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextResponse } from "next/server";
import type { AIMention, LLMName } from "@/lib/ai-visibility-types";
import { GEMINI_API_KEY, generateGeminiText } from "@/lib/gemini";
import { safeAnthropicCreate } from "@/lib/anthropic-safe";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Парсинг ответа ─────────────────────────────────────────────────────────────
function parseResponse(response: string, brandName: string): {
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  competitors: string[];
} {
  const lower = response.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Проверяем наличие бренда
  const mentioned = lower.includes(brandLower);

  // Позиция в нумерованном списке
  let position: number | null = null;
  if (mentioned) {
    const lines = response.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(brandLower)) {
        const numMatch = lines[i].match(/^\s*(\d+)[.)]/);
        position = numMatch ? parseInt(numMatch[1]) : null;
        break;
      }
    }
  }

  // Тональность
  let sentiment: "positive" | "neutral" | "negative" | null = null;
  if (mentioned) {
    const nearBrandIdx = lower.indexOf(brandLower);
    const context = lower.slice(Math.max(0, nearBrandIdx - 150), nearBrandIdx + 300);
    const positive = ["лучш", "рекоменд", "топ", "отлично", "надёжн", "популярн", "качествен", "ведущ", "хорош"];
    const negative = ["плохо", "недостатк", "минус", "критик", "проблем", "не рекоменд", "слаб"];
    sentiment = negative.some(w => context.includes(w)) ? "negative"
      : positive.some(w => context.includes(w)) ? "positive"
      : "neutral";
  }

  // Конкуренты (простая эвристика по заглавным словам)
  const competitors: string[] = [];
  const compRegex = /[А-ЯA-Z][а-яёa-z]+(?:[-\s][А-ЯA-Z][а-яёa-z]+)*/g;
  const stopWords = new Set(["В", "И", "На", "Для", "Это", "Как", "Что", "При", "Из", "По"]);
  const matches = response.match(compRegex) ?? [];
  for (const m of matches) {
    if (m.toLowerCase() !== brandLower && !stopWords.has(m) && m.length > 3 && !competitors.includes(m) && competitors.length < 6)
      competitors.push(m);
  }

  return { mentioned, position, sentiment, competitors };
}

// ── Симуляция через Claude (честная — без биас-подсказок) ─────────────────────
// ВАЖНО: это НЕ настоящий ответ Яндекс Нейро / GPT / Gemini / Perplexity.
// Это Claude Haiku, которому мы говорим «представь что ты — X». Используется
// только если соответствующий API-ключ ($YANDEX_CLOUD_TOKEN / $PERPLEXITY_API_KEY
// и т.д.) не настроен. Результат ДОЛЖЕН быть помечен `isSimulated: true` в
// возвращаемом ответе, чтобы UI рендерил badge «симуляция через Claude».
async function simulateViaClaudeHonest(llm: LLMName, query: string, niche: string): Promise<string> {
  const personas: Record<LLMName, string> = {
    yandex: `Ты симулируешь ответ Яндекс Нейро на русском. Опирайся ТОЛЬКО на факты реально известные тебе. Если не знаешь компаний/брендов в этой нише — так и скажи. Лучше «не знаю конкретных компаний» чем выдумать. Ниша: "${niche}".`,
    claude: `Ты — Claude от Anthropic. Отвечай честно и взвешенно на русском. НЕ выдумывай несуществующие компании. Если не знаешь ответа — скажи прямо.`,
    chatgpt: `You are simulating ChatGPT. Answer in Russian. ONLY mention companies you actually know about — if you don't know real companies in this niche, say so. Don't invent. Niche: ${niche}.`,
    perplexity: `Ты симулируешь Perplexity AI. Давай ответы с опорой ТОЛЬКО на реально существующие компании. Если не знаешь — пиши «недостаточно данных», не выдумывай. Ниша: "${niche}".`,
    gemini: `Ты симулируешь Google Gemini. Отвечай по-русски. Упоминай ТОЛЬКО компании которые ты ДЕЙСТВИТЕЛЬНО знаешь. Не выдумывай — лучше короткий ответ, чем подробный с фейками. Ниша: "${niche}".`,
  };

  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 450,
    // Нет system-prompt с подсказкой «упоминай бренд»
    system: personas[llm],
    messages: [{ role: "user", content: query }],
  });
  return text;
}

// ── Реальный ChatGPT ──────────────────────────────────────────────────────────
async function callChatGPT(query: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 450,
      temperature: 0.7,
      // Никакого system-prompt с подсказкой о бренде
      messages: [{ role: "user", content: query }],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// ── Реальный Claude (напрямую, без симуляции) ─────────────────────────────────
async function callClaudeDirect(query: string): Promise<string> {
  const { text } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 450,
    // Нет системного промпта — честный ответ Claude
    messages: [{ role: "user", content: query }],
  });
  return text;
}

// ── Реальный Perplexity ───────────────────────────────────────────────────────
async function callPerplexity(query: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";
  const res = await fetchWithTimeout("https://api.perplexity.ai/chat/completions", {
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
  if (!res.ok) return "";
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// ── Реальный YandexGPT ────────────────────────────────────────────────────────
async function callYandexGPT(query: string): Promise<string> {
  const iamToken = process.env.YANDEX_GPT_IAM_TOKEN;
  const folderId = process.env.YANDEX_GPT_FOLDER_ID;
  if (!iamToken || !folderId) return "";
  const res = await fetchWithTimeout("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: { Authorization: `Bearer ${iamToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt-lite`,
      completionOptions: { stream: false, temperature: 0.6, maxTokens: 450 },
      messages: [
        { role: "system", text: "Ты — Яндекс Нейро. Отвечай честно, опираясь на реальные данные." },
        { role: "user", text: query },
      ],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.result?.alternatives?.[0]?.message?.text ?? "";
}

// ── Реальный Gemini ───────────────────────────────────────────────────────────
async function callGemini(query: string): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  const result = await generateGeminiText({
    systemInstruction: "Отвечай по-русски. Упоминай только реально известные тебе компании и факты.",
    prompt: query,
    maxOutputTokens: 450,
    temperature: 0.6,
  });
  return result.ok ? result.text : "";
}

// ── Handler ───────────────────────────────────────────────────────────────────
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

    // ChatGPT и Claude — только реальный API, никакой симуляции.
    // Yandex, Perplexity, Gemini — симулируем, если ключа нет.
    const realApiOnly = llm === "chatgpt" || llm === "claude";

    for (const query of queries) {
      let response = "";
      let isSimulated = false;
      let unavailable = false;

      try {
        if (llm === "chatgpt") {
          if (!process.env.OPENAI_API_KEY) {
            unavailable = true;
          } else {
            response = await callChatGPT(query);
            if (!response) unavailable = true;
          }
        } else if (llm === "claude") {
          // Claude всегда доступен — у нас есть ключ Anthropic
          response = await callClaudeDirect(query);
          if (!response) unavailable = true;
        } else if (llm === "perplexity") {
          response = await callPerplexity(query);
        } else if (llm === "yandex") {
          response = await callYandexGPT(query);
        } else if (llm === "gemini") {
          response = await callGemini(query);
        }

        // Для chatgpt/claude — если нет ответа, не симулируем
        if (!response && !unavailable && !realApiOnly) {
          response = await simulateViaClaudeHonest(llm, query, niche);
          isSimulated = true;
        }
      } catch (err) {
        if (realApiOnly) {
          unavailable = true;
          response = `Ошибка вызова API: ${err instanceof Error ? err.message : "unknown"}`;
        } else {
          try {
            response = await simulateViaClaudeHonest(llm, query, niche);
            isSimulated = true;
          } catch {
            response = "Не удалось получить ответ.";
            isSimulated = true;
          }
        }
      }

      const parsed = unavailable ? { mentioned: false, position: null, sentiment: null, competitors: [] } : parseResponse(response, brandName);
      mentions.push({
        llm,
        query,
        mentioned: parsed.mentioned,
        position: parsed.position,
        sentiment: parsed.sentiment,
        fullResponse: unavailable ? "" : response,
        competitorsMentioned: parsed.competitors,
        isSimulated,
        unavailable,
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
