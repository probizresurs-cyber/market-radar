/**
 * Опрос ассистентов: что они отвечают на вопросы клиентов и кого цитируют.
 *
 * Правила честности те же, что в /api/ai-visibility/check-llm: промпты идут
 * чистыми, без подсказок про бренд, ровно как их задаёт человек. Отличия:
 *   - для ChatGPT Search и Perplexity собираем источники (citations) —
 *     это даёт «кого цитируют вместо нас» = список площадок для размещений;
 *   - бренды в ответе вытаскиваем из пунктов списков, а не по заглавным
 *     буквам (старая эвристика ловила «Москва» и «Россия»);
 *   - каждая LLM, для которой нет ключа, попадает в limitations, а не
 *     в «0 % упоминаний».
 */
import type { GeoPrompt, ProbeAnswer, ProbeLLM, PromptIntent, VisibilityReport } from "./types";
import { hostOf } from "./html";
import { classifyDomain } from "./external";

const DENIAL = [
  "не знаю", "не знакомо", "не располагаю", "нет информации", "нет данных", "не нашёл", "не нашел",
  "не могу найти", "нет в базе", "не встречалось", "не имею информации", "у меня нет информации",
  "no information", "i don't know", "not familiar", "cannot find", "не могу подтвердить",
  "недостаточно данных", "нет достоверных данных",
];

const OPENAI_BASE = () => process.env.OPENAI_BASE_URL ?? "https://api.openai.com";

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 60_000): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch { return null; }
}

// ── Провайдеры ─────────────────────────────────────────────────────────────

export function availableLLMs(): ProbeLLM[] {
  const out: ProbeLLM[] = [];
  if (process.env.OPENAI_API_KEY) out.push("chatgpt", "chatgpt-search");
  if (process.env.PERPLEXITY_API_KEY) out.push("perplexity");
  if (process.env.GEMINI_API_KEY) out.push("gemini");
  if (process.env.ANTHROPIC_API_KEY) out.push("claude");
  if (process.env.YANDEX_GPT_IAM_TOKEN && process.env.YANDEX_GPT_FOLDER_ID) out.push("yandex");
  return out;
}

interface RawAnswer { text: string; citations: string[] }

async function askChatGPT(prompt: string, search: boolean): Promise<RawAnswer | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const body = search
    ? { model: "gpt-4o-mini-search-preview", web_search_options: { user_location: { type: "approximate", approximate: { country: "RU" } } }, messages: [{ role: "user", content: prompt }] }
    : { model: "gpt-4o-mini", temperature: 0.7, max_tokens: 600, messages: [{ role: "user", content: prompt }] };
  const j = await postJson(`${OPENAI_BASE()}/v1/chat/completions`, { Authorization: `Bearer ${key}` }, body);
  const msg = (j?.choices as Array<{ message?: { content?: string; annotations?: Array<{ type: string; url_citation?: { url: string } }> } }> | undefined)?.[0]?.message;
  if (!msg?.content) return null;
  const citations = (msg.annotations ?? []).filter(a => a.type === "url_citation" && a.url_citation?.url).map(a => a.url_citation!.url);
  return { text: msg.content, citations };
}

async function askPerplexity(prompt: string): Promise<RawAnswer | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  const j = await postJson("https://api.perplexity.ai/chat/completions", { Authorization: `Bearer ${key}` }, {
    model: "sonar",
    messages: [{ role: "user", content: prompt }],
  });
  const text = (j?.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content;
  if (!text) return null;
  const cites = Array.isArray(j?.citations) ? (j!.citations as string[]) : [];
  const sr = Array.isArray(j?.search_results) ? (j!.search_results as Array<{ url?: string }>).map(s => s.url).filter((u): u is string => !!u) : [];
  return { text, citations: Array.from(new Set([...cites, ...sr])) };
}

async function askGemini(prompt: string): Promise<RawAnswer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const base = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
  const j = await postJson(`${base}/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {}, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
  });
  const cand = (j?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> | undefined)?.[0];
  const text = cand?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
  if (!text) return null;
  // Gemini отдаёт uri как редирект vertexaisearch.cloud.google.com/grounding-api-redirect/...,
  // реальный домен-источник — только в title (например "dtf.ru"). Берём title, когда он
  // похож на домен; иначе используем uri как есть.
  const citations = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map(c => {
      const title = c.web?.title?.trim();
      if (title && /^[\w-]+(\.[\w-]+)+$/i.test(title)) return `https://${title}`;
      return c.web?.uri;
    })
    .filter((u): u is string => !!u);
  return { text, citations };
}

async function askClaude(prompt: string): Promise<RawAnswer | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const j = await postJson(`${base}/v1/messages`, { "x-api-key": key, "anthropic-version": "2023-06-01" }, {
    model: "claude-haiku-4-5",
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
  });
  const content = j?.content as Array<{ type: string; text?: string; citations?: Array<{ url?: string }> }> | undefined;
  if (!content) return null;
  const text = content.filter(c => c.type === "text").map(c => c.text ?? "").join("");
  const citations = content.flatMap(c => (c.citations ?? []).map(x => x.url).filter((u): u is string => !!u));
  return text ? { text, citations } : null;
}

async function askYandex(prompt: string): Promise<RawAnswer | null> {
  const iam = process.env.YANDEX_GPT_IAM_TOKEN;
  const folder = process.env.YANDEX_GPT_FOLDER_ID;
  if (!iam || !folder) return null;
  const j = await postJson("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", { Authorization: `Bearer ${iam}` }, {
    modelUri: `gpt://${folder}/yandexgpt-lite`,
    completionOptions: { stream: false, temperature: 0.6, maxTokens: 600 },
    messages: [{ role: "user", text: prompt }],
  });
  const text = (j?.result as { alternatives?: Array<{ message?: { text?: string } }> } | undefined)?.alternatives?.[0]?.message?.text;
  return text ? { text, citations: [] } : null;
}

async function ask(llm: ProbeLLM, prompt: string): Promise<RawAnswer | null> {
  switch (llm) {
    case "chatgpt": return askChatGPT(prompt, false);
    case "chatgpt-search": return askChatGPT(prompt, true);
    case "perplexity": return askPerplexity(prompt);
    case "gemini": return askGemini(prompt);
    case "claude": return askClaude(prompt);
    case "yandex": return askYandex(prompt);
  }
}

// ── Разбор ответа ──────────────────────────────────────────────────────────

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function isMentioned(text: string, brand: string, domain: string): boolean {
  const t = text.toLowerCase();
  const b = brand.toLowerCase();
  const variants = new Set([b, domain.toLowerCase(), b.replace(/\s+/g, ""), b.replace(/\s+/g, "-")]);
  let occurrences = 0;
  for (const v of variants) if (v.length >= 3) occurrences += (t.match(new RegExp(escapeRe(v), "g")) ?? []).length;
  if (occurrences === 0) return false;
  const denial = DENIAL.some(p => t.includes(p));
  return !denial || occurrences >= 3;
}

/** Названия компаний/продуктов из пунктов списков ответа. */
export function extractBrands(text: string, ownBrand: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const own = ownBrand.toLowerCase();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const m = line.match(/^(?:[-*•]|\d+[.)])\s*(?:\*\*)?([^*:—–\-(\n]{2,60}?)(?:\*\*)?\s*(?:[:—–(]|$)/);
    if (!m) continue;
    const name = m[1].trim().replace(/[«»"]/g, "");
    if (!name || name.length < 2 || name.length > 60) continue;
    // Отбрасываем общие слова: «Преимущества», «Цена», «Шаг 1».
    if (/^(преимуществ|недостатк|цена|стоимост|шаг|этап|совет|вывод|итог|важно|плюс|минус|пример|note|tip|step|pros|cons)/i.test(name)) continue;
    if (!/[A-ZА-ЯЁ0-9]/.test(name[0])) continue;
    const key = name.toLowerCase();
    if (key.includes(own) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 8) break;
  }
  return out;
}

// ── Промпты ────────────────────────────────────────────────────────────────

export function templatePrompts(brand: string, niche: string, region: string): GeoPrompt[] {
  const n = niche || "услуги компании";
  const r = region || "России";
  return [
    { text: `Какие компании по направлению «${n}» в ${r} ты можешь порекомендовать? Назови конкретные названия.`, intent: "recommend" },
    { text: `Посоветуй лучшие сервисы или компании: ${n}. Нужны названия и чем они отличаются.`, intent: "recommend" },
    { text: `Как выбрать подрядчика по направлению «${n}»? На что смотреть и кого рассматривать?`, intent: "howto" },
    { text: `Сколько стоит ${n} в ${r} в ${new Date().getFullYear()} году? Приведи примеры компаний и цен.`, intent: "price" },
    { text: `Сравни несколько компаний, которые занимаются: ${n}. Кто лучше и почему?`, intent: "compare" },
    { text: `Что ты знаешь о компании ${brand}? Чем занимается, кому подходит, какие отзывы?`, intent: "brand" },
    { text: `${brand} — стоит ли обращаться? Какие есть альтернативы?`, intent: "compare" },
    { text: `Что такое ${n} простыми словами и кто этим занимается в ${r}?`, intent: "define" },
  ];
}

// ── Основной прогон ────────────────────────────────────────────────────────

export interface ProbeOptions {
  brand: string;
  domain: string;
  llms?: ProbeLLM[];
  onProgress?: (stage: string, detail?: string) => void;
}

export async function probeVisibility(prompts: GeoPrompt[], opts: ProbeOptions): Promise<VisibilityReport> {
  const wanted = opts.llms?.length ? opts.llms : availableLLMs();
  const avail = availableLLMs();
  const llmsChecked = wanted.filter(l => avail.includes(l));
  const llmsUnavailable = wanted.filter(l => !avail.includes(l));
  const log = opts.onProgress ?? (() => {});

  const answers: ProbeAnswer[] = [];
  // Каждый ассистент — последовательно по промптам (лимиты), ассистенты — параллельно.
  await Promise.all(llmsChecked.map(async llm => {
    for (const p of prompts) {
      const raw = await ask(llm, p.text);
      if (!raw) {
        answers.push({ llm, prompt: p.text, intent: p.intent, answer: "", mentioned: false, citedUs: false, citations: [], brandsNamed: [], unavailable: true, error: "нет ответа" });
        continue;
      }
      const citations = Array.from(new Set(raw.citations.map(hostOf).filter(Boolean)));
      const citedUs = citations.some(h => h === opts.domain || h.endsWith(`.${opts.domain}`));
      answers.push({
        llm, prompt: p.text, intent: p.intent,
        answer: raw.text.slice(0, 4000),
        mentioned: isMentioned(raw.text, opts.brand, opts.domain) || citedUs,
        citedUs, citations,
        brandsNamed: extractBrands(raw.text, opts.brand),
      });
    }
    log("probe", `${llm}: готово`);
  }));

  const valid = answers.filter(a => !a.unavailable);
  const byLlm: VisibilityReport["byLlm"] = {};
  for (const llm of llmsChecked) {
    const xs = valid.filter(a => a.llm === llm);
    byLlm[llm] = { checked: xs.length, mentioned: xs.filter(a => a.mentioned).length, cited: xs.filter(a => a.citedUs).length };
  }
  const withCites = valid.filter(a => a.citations.length > 0);
  const mentionRate = valid.length ? Math.round((valid.filter(a => a.mentioned).length / valid.length) * 100) : 0;
  const citationRate = withCites.length ? Math.round((withCites.filter(a => a.citedUs).length / withCites.length) * 100) : 0;

  const domainCounts = new Map<string, number>();
  for (const a of valid) for (const h of a.citations) domainCounts.set(h, (domainCounts.get(h) ?? 0) + 1);
  const citedDomains = Array.from(domainCounts, ([domain, count]) => ({ domain, count, isUs: domain === opts.domain || domain.endsWith(`.${opts.domain}`) }))
    .sort((a, b) => b.count - a.count);

  const brandCounts = new Map<string, number>();
  for (const a of valid) for (const b of a.brandsNamed) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
  const competitorsNamed = Array.from(brandCounts, ([name, count]) => ({ name, count })).filter(c => c.count >= 2 || valid.length <= 4).sort((a, b) => b.count - a.count).slice(0, 12);

  const unansweredPrompts = prompts.filter(p => !valid.some(a => a.prompt === p.text && a.mentioned));

  return { prompts, answers, llmsChecked, llmsUnavailable, mentionRate, citationRate, byLlm, citedDomains, competitorsNamed, unansweredPrompts };
}

export function placementKind(domain: string): "media" | "review" | "ugc" | "directory" | "other" {
  const k = classifyDomain(domain);
  if (k === "media" || k === "wiki") return "media";
  if (k === "review") return "review";
  if (k === "ugc" || k === "video" || k === "social") return "ugc";
  if (k === "directory") return "directory";
  return "other";
}
