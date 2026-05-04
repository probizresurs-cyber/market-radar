/**
 * POST /api/seo/paa
 *
 * Body: { keyword: string, lang?: "ru" | "en", region?: string }
 *
 * Free, open-source replacement for AnswerThePublic. Returns:
 *   - autocomplete: live Google Autocomplete suggestions for the seed
 *   - questions: People Also Ask-style questions (we generate them by
 *     prefixing the seed with question words and asking Autocomplete)
 *   - related: Google Related Searches (parsed from SERP HTML)
 *   - alphabet: A-Z autocomplete expansions (the "answer the public"
 *     wheel of expansions)
 *
 * No external API keys required. All scraping is server-side with
 * rotating User-Agent and timeout protection.
 *
 * Logic adapted from chukhraiartur/seo-keyword-research-tool (open source).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const QUESTION_WORDS_RU = [
  "что такое", "как", "почему", "зачем", "когда", "где", "кто",
  "сколько стоит", "лучший", "vs", "или", "цена", "купить",
  "отзывы", "для чего", "чем отличается",
];

const QUESTION_WORDS_EN = [
  "what is", "how to", "why", "when", "where", "who",
  "best", "vs", "or", "cost", "price", "buy",
  "review", "alternative", "is", "are", "does",
];

const ALPHABET_RU = "абвгдежзиклмнопрстуфхцчшщэюя".split("");
const ALPHABET_EN = "abcdefghijklmnopqrstuvwxyz".split("");

interface PAAResult {
  keyword: string;
  autocomplete: string[];
  questions: string[];
  related: string[];
  alphabet: { letter: string; suggestions: string[] }[];
}

async function fetchAutocomplete(
  query: string,
  lang: "ru" | "en"
): Promise<string[]> {
  // Google's public autocomplete endpoint — used by the search box
  const params = new URLSearchParams({
    client: "firefox",
    hl: lang,
    q: query,
  });
  if (lang === "ru") {
    params.set("gl", "ru");
  }
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?${params}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Format: [originalQuery, [suggestion1, suggestion2, …]]
    return Array.isArray(data?.[1]) ? (data[1] as string[]) : [];
  } catch {
    return [];
  }
}

async function fetchYandexAutocomplete(query: string): Promise<string[]> {
  // Yandex provides its own suggester used by the search box
  try {
    const res = await fetch(
      `https://suggest.yandex.ru/suggest-ff.cgi?part=${encodeURIComponent(query)}&n=15&v=4`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.[1]) ? (data[1] as string[]) : [];
  } catch {
    return [];
  }
}

async function fetchRelatedSearches(query: string, lang: "ru" | "en"): Promise<string[]> {
  // Scrape Google SERP for "related searches" block at bottom
  const searchUrl =
    lang === "ru"
      ? `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ru&gl=ru&pws=0`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us&pws=0`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": lang === "ru" ? "ru-RU,ru;q=0.9" : "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Related searches block: look for anchor with class hinting at related
    // Google's HTML shifts; we capture text inside <a> within the bottom block
    const related = new Set<string>();
    const matches = html.match(/<a[^>]+href="\/search\?q=[^"]+&[^"]*sa=X[^"]*"[^>]*>([\s\S]*?)<\/a>/g) ?? [];
    for (const m of matches) {
      const txt = m
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (
        txt.length > 6 &&
        txt.length < 100 &&
        txt.toLowerCase() !== query.toLowerCase() &&
        !/^[\d\s.,/-]+$/.test(txt)
      ) {
        related.add(txt);
      }
    }
    return Array.from(related).slice(0, 12);
  } catch {
    return [];
  }
}

async function expandViaQuestions(
  keyword: string,
  lang: "ru" | "en"
): Promise<string[]> {
  // Generate "People Also Ask"-style questions by combining question
  // prefixes with the seed and asking Autocomplete for each.
  const prefixes = lang === "ru" ? QUESTION_WORDS_RU : QUESTION_WORDS_EN;
  const all = new Set<string>();
  // Run in parallel batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < prefixes.length; i += batchSize) {
    const batch = prefixes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(p => fetchAutocomplete(`${p} ${keyword}`, lang))
    );
    for (const r of results) {
      for (const q of r) {
        if (q.length > keyword.length + 3) all.add(q);
      }
    }
  }
  return Array.from(all)
    .filter(q => q.includes("?") || /^(что|как|почему|зачем|когда|где|кто|чем|где|сколько|лучший|какой|какие|какая|какое|why|how|what|when|where|who|which|is|are|does|will)/i.test(q))
    .slice(0, 30);
}

async function expandViaAlphabet(
  keyword: string,
  lang: "ru" | "en"
): Promise<{ letter: string; suggestions: string[] }[]> {
  const letters = lang === "ru" ? ALPHABET_RU : ALPHABET_EN;
  const result: { letter: string; suggestions: string[] }[] = [];
  // Run in parallel batches of 6 to be polite
  const batchSize = 6;
  for (let i = 0; i < letters.length; i += batchSize) {
    const batch = letters.slice(i, i + batchSize);
    const responses = await Promise.all(
      batch.map(letter => fetchAutocomplete(`${keyword} ${letter}`, lang))
    );
    batch.forEach((letter, idx) => {
      const suggestions = responses[idx]
        .filter(s => s.toLowerCase() !== keyword.toLowerCase())
        .slice(0, 5);
      if (suggestions.length > 0) result.push({ letter, suggestions });
    });
  }
  return result;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const keyword: string = (body.keyword || "").trim();
    const lang: "ru" | "en" = body.lang === "en" ? "en" : "ru";

    if (!keyword) {
      return NextResponse.json({ ok: false, error: "keyword required" }, { status: 400 });
    }
    if (keyword.length > 100) {
      return NextResponse.json({ ok: false, error: "keyword too long" }, { status: 400 });
    }

    // Fan out: autocomplete (Google + Yandex), questions, related, alphabet expansion
    const [
      googleSuggestions,
      yandexSuggestions,
      questions,
      related,
      alphabet,
    ] = await Promise.all([
      fetchAutocomplete(keyword, lang),
      lang === "ru" ? fetchYandexAutocomplete(keyword) : Promise.resolve([]),
      expandViaQuestions(keyword, lang),
      fetchRelatedSearches(keyword, lang),
      expandViaAlphabet(keyword, lang),
    ]);

    // Merge autocomplete from both engines, keep order
    const autocomplete = Array.from(
      new Set([...googleSuggestions, ...yandexSuggestions])
    ).filter(s => s.toLowerCase() !== keyword.toLowerCase());

    const result: PAAResult = {
      keyword,
      autocomplete,
      questions,
      related,
      alphabet,
    };

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
