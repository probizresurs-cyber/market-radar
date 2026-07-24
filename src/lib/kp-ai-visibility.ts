/**
 * РЕАЛЬНАЯ проверка AI-видимости бренда для КП-генератора.
 *
 * Проблема, которую это чинит: aiPerception в analyzeWithClaude — это
 * СИМУЛЯЦИЯ («что ответил бы ChatGPT» глазами Claude), и она регулярно
 * врёт в обе стороны. Живой кейс: настоящий ChatGPT знает и рекомендует
 * компанию, а КП уверенно пишет «в ответах ассистентов вас нет» — клиент
 * открывает GPT, видит себя и перестаёт верить всему остальному в КП.
 *
 * Здесь — те же честные принципы, что в /api/ai-visibility/check-llm
 * (никаких подсказок модели про бренд, чистые пользовательские запросы),
 * но как библиотечная функция для вызова прямо из generateKp. Только
 * ChatGPT (gpt-4o-mini): это ассистент №1 по аудитории и именно на него
 * ссылаются клиенты, когда проверяют КП руками.
 */
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export interface KpAiCheckResult {
  /** false — ключа нет/все вызовы упали; данные проверки отсутствуют. */
  checked: boolean;
  /** В скольких ответах из total бренд реально упомянут (не в контексте «не знаю»). */
  mentionedIn: number;
  total: number;
  /** Реальный ответ ChatGPT, где бренд упомянут (или первый ответ, если нигде). */
  sampleAnswer: string;
  /** Запрос, которым получен sampleAnswer. */
  sampleQuery: string;
}

const DENIAL_PHRASES = [
  "не знаю", "не знакомо", "не располагаю", "нет информации", "нет данных",
  "не нашёл", "не нашел", "не могу найти", "нет в базе", "не встречалось",
  "не имею информации", "у меня нет информации", "у меня нет данных",
  "no information", "i don't know", "i have no information", "not familiar",
  "cannot find", "not in my knowledge", "don't have information",
  "не могу подтвердить", "недостаточно данных", "нет достоверных данных",
  "keine informationen", "ich kenne", "nicht bekannt", "liegen mir keine",
];

function isMentioned(response: string, brandName: string): boolean {
  const lower = response.toLowerCase();
  const brandLower = brandName.toLowerCase();
  if (!lower.includes(brandLower)) return false;
  const hasDenial = DENIAL_PHRASES.some((p) => lower.includes(p));
  const occurrences = (lower.match(new RegExp(brandLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  return !hasDenial || occurrences >= 3;
}

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
      // Никакого system-prompt с подсказкой о бренде — как честный юзерский запрос
      messages: [{ role: "user", content: query }],
    }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * 3 честных запроса: прямой про бренд, рекомендация по нише, бренд+ниша.
 * Язык запросов = язык рынка КП.
 */
function buildQueries(brandName: string, domain: string, niche: string, locale: "ru" | "de"): string[] {
  if (locale === "de") {
    return [
      `Was weißt du über das Unternehmen ${brandName} (${domain})?`,
      niche ? `Welche Anbieter für ${niche} in Deutschland kannst du empfehlen?` : `Welche Unternehmen hinter der Website ${domain} kennst du?`,
      niche ? `Ist ${brandName} ein guter Anbieter für ${niche}?` : `Ist ${brandName} ein vertrauenswürdiges Unternehmen?`,
    ];
  }
  return [
    `Что ты знаешь о компании ${brandName} (${domain})?`,
    niche ? `Какие компании в нише «${niche}» в России ты можешь порекомендовать?` : `Что за компания стоит за сайтом ${domain}?`,
    niche ? `${brandName} — хорошая компания в нише «${niche}»?` : `${brandName} — надёжная компания?`,
  ];
}

export async function checkKpAiVisibility(
  brandName: string, domain: string, niche: string, locale: "ru" | "de",
): Promise<KpAiCheckResult> {
  const empty: KpAiCheckResult = { checked: false, mentionedIn: 0, total: 0, sampleAnswer: "", sampleQuery: "" };
  if (!process.env.OPENAI_API_KEY || !brandName.trim()) return empty;

  const queries = buildQueries(brandName, domain, niche, locale);
  const responses = await Promise.all(
    queries.map(async (q) => {
      try { return { query: q, response: await callChatGPT(q) }; }
      catch { return { query: q, response: "" }; }
    }),
  );
  const valid = responses.filter((r) => r.response.trim().length > 0);
  if (valid.length === 0) return empty;

  const withMention = valid.filter((r) => isMentioned(r.response, brandName));
  const sample = withMention[0] ?? valid[0];
  return {
    checked: true,
    mentionedIn: withMention.length,
    total: valid.length,
    sampleAnswer: sample.response.slice(0, 1200),
    sampleQuery: sample.query,
  };
}
