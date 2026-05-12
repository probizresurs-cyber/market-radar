/**
 * Trend Hunter агент.
 *
 * Раз в день обходит RSS-источники + Reddit, AI «editor-in-chief»
 * скорит тренды на virality + relevance к нише юзера, топ-3 трендов
 * кладёт в inbox с draft post-идеями.
 *
 * Источники:
 *   - VC.ru RSS — главная страница (бизнес/маркетинг РФ)
 *   - Habr RSS — IT-фокус
 *   - Reddit: /r/marketing, /r/business, /r/ru (универсал)
 *
 * AI scoring (Claude Haiku) выставляет каждой теме 0-100 по:
 *   - relevance: насколько подходит нише юзера (40%)
 *   - virality: hook potential, эмоциональность (30%)
 *   - freshness: насколько свежо в инфо-поле (15%)
 *   - actionability: можно ли сделать контент за 1 день (15%)
 *
 * Топ-3 → inbox card с готовой post-идеей (hook + 3 идеи буллетов).
 *
 * Params:
 *   - niche?: string — ниша юзера; берётся из users.company_name + AI делает
 *     niche-vector сам. Если задано — приоритет ему.
 *   - sources?: string[] — список feed-URL'ов для перекрытия дефолта.
 */
import { registerAgent, type AgentContext, type AgentRunResult } from "./registry";
import { query } from "@/lib/db";
import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";
import { randomUUID } from "crypto";

interface RawTrend {
  title: string;
  source: string;
  link: string;
  excerpt?: string;
  publishedAt?: string;
}

interface ScoredTrend extends RawTrend {
  score: number;          // 0-100
  rationale: string;      // 1-2 предложения почему
  postIdea: {
    hook: string;
    bulletPoints: string[];
    cta: string;
  };
}

// ─── RSS fetch (lightweight, no external lib) ────────────────────────

const DEFAULT_FEEDS = [
  // VC.ru — главные новости (Atom)
  "https://vc.ru/rss",
  // Habr — общая лента (RSS)
  "https://habr.com/ru/rss/all/all/?fl=ru",
  // SeoNews — РФ-фокус на SEO/маркетинг
  "https://www.seonews.ru/feed/",
];

/**
 * Очень примитивный RSS-parser: вытаскиваем <item> + title/link/description.
 * Не покрывает 100% спецификации, но для нашего набора фидов работает.
 */
function parseRss(xml: string, source: string): RawTrend[] {
  const out: RawTrend[] = [];
  // Поддерживаем как <item>, так и <entry> (Atom)
  const itemRe = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/g;
  let m;
  const between = (block: string, tag: string): string => {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const mm = block.match(re);
    if (!mm) return "";
    return mm[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };
  const linkAttr = (block: string): string => {
    // Atom: <link href="..."/>; RSS: <link>...</link>
    const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (atom) return atom[1];
    const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
    if (rss) return rss[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    return "";
  };

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = between(block, "title");
    if (!title) continue;
    const link = linkAttr(block);
    const excerpt =
      between(block, "description") ||
      between(block, "summary") ||
      between(block, "content");
    const pubDate = between(block, "pubDate") || between(block, "published");
    out.push({
      title: title.slice(0, 200),
      source,
      link,
      excerpt: excerpt.slice(0, 500),
      publishedAt: pubDate,
    });
    if (out.length >= 10) break; // не более 10 свежих из каждого источника
  }
  return out;
}

async function fetchFeed(url: string): Promise<RawTrend[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketRadar TrendHunter/1.0)",
        "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
      },
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    const source = new URL(url).hostname.replace(/^www\./, "");
    return parseRss(xml, source);
  } catch {
    return [];
  }
}

/** Reddit search для тематических саб-реддитов. */
async function fetchReddit(niche: string): Promise<RawTrend[]> {
  const subs = ["ru", "russia", "marketing", "business"];
  const out: RawTrend[] = [];
  await Promise.all(
    subs.map(async sub => {
      try {
        const url = `https://www.reddit.com/r/${sub}/hot.json?limit=10&t=day`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10_000);
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "User-Agent": "MarketRadar-TrendHunter/1.0" },
        });
        clearTimeout(t);
        if (!res.ok) return;
        const json = await res.json() as {
          data?: {
            children?: Array<{
              data: {
                title: string;
                permalink: string;
                selftext?: string;
                score: number;
                num_comments: number;
              };
            }>;
          };
        };
        const items = json?.data?.children ?? [];
        for (const it of items.slice(0, 5)) {
          const d = it.data;
          // Реддит-фильтр: только горячие посты (score > 50)
          if (d.score < 50) continue;
          out.push({
            title: d.title.slice(0, 200),
            source: `r/${sub}`,
            link: `https://reddit.com${d.permalink}`,
            excerpt: (d.selftext ?? "").slice(0, 300),
          });
        }
      } catch { /* ignore one sub failure */ }
    }),
  );
  void niche; // niche-фильтрация делается на этапе AI scoring, не на RSS
  return out;
}

// ─── AI scoring + post-idea ──────────────────────────────────────────

const SCORING_SYSTEM = `Ты — главред контент-агентства. Тебе показывают пачку свежих новостей/тем. Твоя задача — оценить каждую по 4 критериям для конкретной компании в нише и предложить идею поста.

КРИТЕРИИ (0-100 общий score):
- Relevance (40%): подходит ли тема нише компании
- Virality (30%): может ли пост на эту тему вызвать обсуждение/репост
- Freshness (15%): свежо ли в инфо-поле (если уже все обсудили — низко)
- Actionability (15%): можно ли сделать пост за 1 день

Для каждой темы score >= 70 → выдай idea:
- hook: цепляющий заголовок 50-100 символов
- bulletPoints: 3 пункта плана для текста
- cta: призыв к действию (одно предложение)

Темы со score < 70 — не выдавай idea (только score + rationale).

Ответ — СТРОГО валидный JSON.`;

async function scoreTrends(
  niche: string,
  companyName: string,
  trends: RawTrend[],
): Promise<ScoredTrend[]> {
  if (trends.length === 0) return [];

  const userMessage = `Компания: ${companyName}
Ниша: ${niche}

Темы:
${trends.map((t, i) => `${i + 1}. [${t.source}] ${t.title}\n   ${(t.excerpt ?? "").slice(0, 200)}`).join("\n\n")}

Оцени каждую и для score>=70 предложи post-идею. Верни СТРОГО JSON:
{
  "trends": [
    {
      "index": 0,
      "score": 85,
      "rationale": "1-2 предложения",
      "postIdea": {
        "hook": "...",
        "bulletPoints": ["...", "...", "..."],
        "cta": "..."
      }
    }
  ]
}

Для score < 70 — postIdea можно опустить.`;

  const { text } = await safeAnthropicCreate({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    system: SCORING_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const parsed = extractJson<{
    trends: Array<{
      index: number;
      score: number;
      rationale: string;
      postIdea?: { hook: string; bulletPoints: string[]; cta: string };
    }>;
  }>(text);

  if (!parsed?.trends) return [];

  return parsed.trends
    .filter(t => typeof t.index === "number" && trends[t.index])
    .map(t => ({
      ...trends[t.index],
      score: t.score,
      rationale: t.rationale,
      postIdea: t.postIdea ?? {
        hook: trends[t.index].title,
        bulletPoints: [],
        cta: "Узнать подробнее в комментариях",
      },
    }))
    .sort((a, b) => b.score - a.score);
}

// ─── Регистрация ────────────────────────────────────────────────────

registerAgent({
  name: "trend-hunter",
  label: "Trend Hunter",
  description: "Каждый день обходит VC.ru, Habr, Reddit. AI оценивает виральность каждой темы под вашу нишу, топ-3 кладёт в Inbox с готовой post-идеей.",
  icon: "TrendingUp",
  defaultSchedule: "daily",
  category: "content",

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const params = ctx.params as {
      niche?: string;
      sources?: string[];
      minScore?: number;
    };

    // Берём niche / company_name
    const userRows = await query<{ company_name: string | null }>(
      `SELECT company_name FROM users WHERE id = $1`,
      [ctx.userId],
    );
    const companyName = userRows[0]?.company_name ?? "компания";
    const niche = params.niche?.trim() || companyName || "B2B услуги";
    const minScore = params.minScore ?? 70;

    // Fetch источников
    const feeds = params.sources?.length ? params.sources : DEFAULT_FEEDS;
    const [rssResults, redditResults] = await Promise.all([
      Promise.all(feeds.map(f => fetchFeed(f))),
      fetchReddit(niche),
    ]);

    const allTrends = [...rssResults.flat(), ...redditResults];
    if (allTrends.length === 0) {
      return {
        summary: "Источники не отдали трендов (возможно blocked). Повторите завтра.",
        skipped: true,
      };
    }

    // Дедуп по title-fp (некоторые сюжеты дублируются в нескольких источниках)
    const seen = new Set<string>();
    const unique = allTrends.filter(t => {
      const key = t.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Только 20 свежих чтобы не выгребать токены AI на 100 тем
    const topRaw = unique.slice(0, 20);
    const scored = await scoreTrends(niche, companyName, topRaw);

    const passing = scored.filter(s => s.score >= minScore);
    if (passing.length === 0) {
      return {
        summary: `Из ${topRaw.length} тем ни одна не набрала ${minScore}+. Возможно слабый день — повторим завтра.`,
        result: { all: scored, passing: 0 },
      };
    }

    // Inbox-cards: top-3 трендов с готовыми post-идеями
    const top3 = passing.slice(0, 3);
    for (const t of top3) {
      const runId = randomUUID();
      const summary = `🔥 [${t.score}/100] ${t.title.slice(0, 120)}`;
      await query(
        `INSERT INTO agent_runs (id, user_id, agent_name, started_at, finished_at, status,
                                 summary, result, needs_approval)
           VALUES ($1, $2, 'trend-hunter', NOW(), NOW(), 'ok', $3, $4::jsonb, true)`,
        [runId, ctx.userId, summary.slice(0, 500), JSON.stringify(t)],
      );
    }

    return {
      summary:
        `Найдено ${scored.length} трендов, ${passing.length} прошли порог ${minScore}+. ` +
        `Топ-3 в Inbox с готовой post-идеей.`,
      result: { top3, passing: passing.length, totalScanned: topRaw.length },
      needsApproval: true,
    };
  },
});
