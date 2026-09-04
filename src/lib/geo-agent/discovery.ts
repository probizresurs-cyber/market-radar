/**
 * robots.txt, llms.txt, sitemap.xml — три файла, по которым ассистент
 * решает, читать ли сайт и что именно. Здесь только разбор; сеть — в crawl.ts.
 */
import type { BotRule, LlmsTxtAudit, RobotsAudit, SitemapAudit } from "./types";

/** Краулеры, от которых зависит попадание в ответы. Порядок = порядок в отчёте. */
export const AI_BOTS: Array<{ name: string; label: string; purpose: "answer" | "training" | "search" }> = [
  { name: "OAI-SearchBot",    label: "ChatGPT Search — источники в ответах", purpose: "answer" },
  { name: "ChatGPT-User",     label: "ChatGPT — переход по ссылке в момент ответа", purpose: "answer" },
  { name: "GPTBot",           label: "OpenAI — обучение моделей", purpose: "training" },
  { name: "PerplexityBot",    label: "Perplexity — индекс", purpose: "answer" },
  { name: "Perplexity-User",  label: "Perplexity — переход в момент ответа", purpose: "answer" },
  { name: "ClaudeBot",        label: "Anthropic — индекс/обучение", purpose: "training" },
  { name: "Claude-SearchBot", label: "Claude — поиск для ответов", purpose: "answer" },
  { name: "Claude-User",      label: "Claude — переход в момент ответа", purpose: "answer" },
  { name: "Google-Extended",  label: "Gemini / AI Overviews (обучение)", purpose: "training" },
  { name: "Googlebot",        label: "Google Search + AI Overviews/AI Mode", purpose: "search" },
  { name: "Bingbot",          label: "Bing → Copilot и ChatGPT Search", purpose: "search" },
  { name: "YandexBot",        label: "Яндекс → Алиса, Нейро", purpose: "search" },
  { name: "Applebot-Extended",label: "Apple Intelligence", purpose: "training" },
  { name: "CCBot",            label: "Common Crawl (датасеты многих моделей)", purpose: "training" },
  { name: "Amazonbot",        label: "Amazon Alexa / Rufus", purpose: "answer" },
  { name: "Meta-ExternalAgent", label: "Meta AI", purpose: "training" },
];

/**
 * Разбор robots.txt по группам User-agent. «no-rule» ≠ «запрещено»:
 * отсутствие правила означает разрешение, и это надо говорить честно.
 */
export function parseRobots(txt: string): { ruleFor: (bot: string) => BotRule; sitemaps: string[] } {
  const groups: { agents: string[]; disallowAll: boolean }[] = [];
  const sitemaps: string[] = [];
  let cur: { agents: string[]; disallowAll: boolean } | null = null;
  let prevWasAgent = false;

  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();

    if (field === "sitemap") { if (value) sitemaps.push(value); continue; }
    if (field === "user-agent") {
      if (!cur || !prevWasAgent) { cur = { agents: [], disallowAll: false }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      prevWasAgent = true;
      continue;
    }
    prevWasAgent = false;
    if (!cur) continue;
    if (field === "disallow" && (value === "/" || value === "/*")) cur.disallowAll = true;
    if (field === "allow" && value === "/") cur.disallowAll = false;
  }

  const ruleFor = (bot: string): BotRule => {
    const b = bot.toLowerCase();
    const own = groups.find(g => g.agents.includes(b));
    if (own) return own.disallowAll ? "blocked" : "allowed";
    const star = groups.find(g => g.agents.includes("*"));
    if (star?.disallowAll) return "blocked";
    return "no-rule";
  };
  return { ruleFor, sitemaps };
}

export function auditRobots(txt: string | null): RobotsAudit {
  if (txt == null) return { present: false, bots: AI_BOTS.map(b => ({ name: b.name, label: b.label, rule: "no-rule" as BotRule })), sitemaps: [] };
  const { ruleFor, sitemaps } = parseRobots(txt);
  return {
    present: true,
    raw: txt.slice(0, 6000),
    bots: AI_BOTS.map(b => ({ name: b.name, label: b.label, rule: ruleFor(b.name) })),
    sitemaps,
  };
}

export function extractLlmsLinks(txt: string): string[] {
  const out: string[] = [];
  const re = /\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) out.push(m[1]);
  return Array.from(new Set(out));
}

export function auditLlmsTxt(txt: string | null, hasFull: boolean): LlmsTxtAudit {
  if (txt == null) return { present: false, chars: 0, hasTitle: false, hasSummary: false, links: 0, brokenLinks: [], hasFull, notes: [] };
  const notes: string[] = [];
  const hasTitle = /^#\s+\S/m.test(txt);
  const hasSummary = /^>\s+\S/m.test(txt);
  const links = extractLlmsLinks(txt);
  if (!hasTitle) notes.push("нет заголовка «# Название» в первой строке");
  if (!hasSummary) notes.push("нет блока «> краткое описание» — это единственная часть, которую точно читает модель");
  if (txt.length > 12000) notes.push(`файл большой (${txt.length} симв.) — краткую версию оставьте в llms.txt, полную вынесите в llms-full.txt`);
  if (/\d\s?(₽|руб)/.test(txt)) notes.push("в файле есть цены — при каждом изменении тарифов их надо обновлять и здесь, иначе ассистент назовёт старую цену");
  if (links.some(l => l.includes("#"))) notes.push("ссылки с якорями (/#faq) — краулер получит ту же главную; давайте отдельные страницы");
  return { present: true, chars: txt.length, hasTitle, hasSummary, links: links.length, brokenLinks: [], hasFull, notes };
}

export interface SitemapEntry { loc: string; lastmod?: string; priority?: number }

export function parseSitemap(xml: string): { entries: SitemapEntry[]; children: string[] } {
  const entries: SitemapEntry[] = [];
  const children: string[] = [];
  if (/<sitemapindex/i.test(xml)) {
    const re = /<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) children.push(m[1]);
    return { entries, children };
  }
  const re = /<url>([\s\S]*?)<\/url>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(block)?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(block)?.[1];
    const pr = /<priority>\s*([\d.]+)\s*<\/priority>/i.exec(block)?.[1];
    entries.push({ loc: loc.replace(/&amp;/g, "&"), lastmod, priority: pr ? parseFloat(pr) : undefined });
  }
  return { entries, children };
}

export function auditSitemap(entries: SitemapEntry[] | null): SitemapAudit {
  if (!entries) return { present: false, urls: 0, lastmodShare: 0, lastmodUniform: false, anchorUrls: 0 };
  const withMod = entries.filter(e => e.lastmod);
  const mods = Array.from(new Set(withMod.map(e => e.lastmod!)));
  const newest = mods.sort().at(-1);
  const anchorUrls = entries.filter(e => e.loc.includes("#")).length;
  // Одинаковые lastmod на всех страницах = ставятся «сейчас» при генерации.
  const lastmodUniform = withMod.length >= 5 && mods.length === 1;
  return {
    present: true,
    urls: entries.length,
    lastmodShare: entries.length ? withMod.length / entries.length : 0,
    newestLastmod: newest,
    lastmodUniform,
    anchorUrls,
  };
}
