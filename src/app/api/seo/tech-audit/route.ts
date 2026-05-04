/**
 * POST /api/seo/tech-audit
 *
 * Body: { url: string, deep?: boolean }
 *
 * Technical SEO audit for a single URL (page-level), inspired by
 * sethblack/python-seo-analyzer. Checks the on-page essentials that
 * traditional SEO + AI search both care about:
 *
 *   - Title (presence, length, keyword density)
 *   - Meta description (presence, length)
 *   - H1/H2/H3 hierarchy (count, keyword usage)
 *   - Image alt-text coverage
 *   - Internal vs external link ratio
 *   - Word count + readability heuristics
 *   - Top keywords (frequency, with stop-word filtering)
 *   - Canonical, robots meta, hreflang
 *   - Content/code ratio
 *   - Mobile viewport, charset
 *   - Open Graph / Twitter completeness (light)
 *
 * Returns a structured report ready for UI rendering. No external APIs.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketRadarTechAudit/1.0";

// Russian + English stop words for keyword extraction
const STOP_WORDS = new Set([
  // Russian
  "и", "в", "не", "на", "с", "что", "как", "к", "по", "из", "у", "за", "от", "для",
  "о", "это", "то", "так", "же", "ли", "бы", "но", "или", "если", "чтобы", "также",
  "только", "уже", "ещё", "был", "была", "были", "быть", "есть", "может", "должен",
  "должна", "вы", "ты", "он", "она", "оно", "они", "мы", "я", "его", "её", "их",
  "нам", "вам", "им", "со", "при", "до", "над", "под", "между", "через", "без",
  "около", "среди", "там", "тут", "вот", "ну", "да", "нет", "более", "менее",
  // English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "must", "can", "this", "that", "these", "those", "i", "you",
  "he", "she", "it", "we", "they", "what", "which", "who", "whom", "whose",
  "if", "then", "else", "so", "than", "too", "very", "just", "now", "also",
]);

function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    signal: controller.signal,
    headers: { "User-Agent": UA },
    redirect: "follow",
  }).finally(() => clearTimeout(id));
}

interface TechAuditReport {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  status: number;
  loadTimeMs: number;
  contentBytes: number;
  textBytes: number;
  // Content-to-code ratio (0-100, higher = more readable for AI)
  contentRatio: number;
  language?: string;
  charset?: string;

  title: { value: string; length: number; ok: boolean };
  metaDescription: { value: string; length: number; ok: boolean };

  headings: {
    h1: { count: number; values: string[]; ok: boolean };
    h2: { count: number; values: string[] };
    h3: { count: number; values: string[] };
    h4plus: number;
  };

  images: {
    total: number;
    withAlt: number;
    withoutAlt: number;
    altCoverage: number; // 0-100
  };

  links: {
    internal: number;
    external: number;
    nofollow: number;
    externalDomains: string[];
  };

  words: {
    total: number;
    unique: number;
    avgWordLength: number;
    /** Top 30 by frequency, excluding stop words */
    topKeywords: { word: string; count: number; density: number }[];
  };

  meta: {
    canonical?: string;
    robots?: string;
    viewport: boolean;
    hreflang: string[];
    ogTags: number;
    twitterTags: number;
  };

  warnings: { severity: "error" | "warning" | "info"; message: string }[];
}

function decode(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractTopKeywords(
  text: string,
  topN = 30
): { word: string; count: number; density: number }[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length < 30 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const totalWords = words.length;
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);

  return Array.from(counts.entries())
    .map(([word, count]) => ({
      word,
      count,
      density: totalWords > 0 ? +(count / totalWords * 100).toFixed(2) : 0,
    }))
    .filter(k => k.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inputUrl: string = (body.url || "").trim();
    if (!inputUrl) {
      return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
    }

    const url = inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`;
    const startedAt = Date.now();
    const res = await fetchWithTimeout(url, 12000);
    const loadTimeMs = Date.now() - startedAt;
    const html = await res.text();
    const finalUrl = res.url || url;
    const contentBytes = new Blob([html]).size;
    const targetDomain = getDomain(finalUrl);
    const targetOrigin = getOrigin(finalUrl);

    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const cleanText = decode(textOnly).replace(/\s+/g, " ").trim();
    const textBytes = new Blob([cleanText]).size;
    const contentRatio = contentBytes > 0 ? Math.round((textBytes / contentBytes) * 100) : 0;

    // ── Title ─────
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decode(titleMatch[1]).trim() : "";
    const titleLen = title.length;
    const titleOk = titleLen >= 30 && titleLen <= 70;

    // ── Meta description ─────
    const metaDescMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i
    );
    const metaDescription = metaDescMatch ? decode(metaDescMatch[1]).trim() : "";
    const descLen = metaDescription.length;
    const descOk = descLen >= 70 && descLen <= 200;

    // ── Headings ─────
    const collectHeadings = (level: number): string[] => {
      const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)</h${level}>`, "gi");
      const result: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const txt = decode(m[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (txt) result.push(txt);
      }
      return result;
    };
    const h1 = collectHeadings(1);
    const h2 = collectHeadings(2);
    const h3 = collectHeadings(3);
    const h4plus = collectHeadings(4).length + collectHeadings(5).length + collectHeadings(6).length;

    // ── Images & alt text ─────
    const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
    let withAlt = 0;
    let withoutAlt = 0;
    for (const img of imgs) {
      if (/\balt\s*=\s*["'][^"']+["']/i.test(img)) withAlt++;
      else withoutAlt++;
    }
    const totalImgs = imgs.length;
    const altCoverage = totalImgs > 0 ? Math.round((withAlt / totalImgs) * 100) : 100;

    // ── Links ─────
    const anchorRe = /<a\b([^>]*)>/gi;
    let internalCount = 0;
    let externalCount = 0;
    let nofollowCount = 0;
    const externalDomains = new Set<string>();
    let am: RegExpExecArray | null;
    while ((am = anchorRe.exec(html)) !== null) {
      const attrs = am[1];
      const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
      const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
      try {
        const linkUrl = href.startsWith("http") ? new URL(href) : new URL(href, finalUrl);
        const linkHost = linkUrl.hostname.replace(/^www\./, "");
        if (linkHost === targetDomain || linkHost.endsWith(`.${targetDomain}`)) {
          internalCount++;
        } else {
          externalCount++;
          externalDomains.add(linkHost);
        }
        if (rel.toLowerCase().includes("nofollow")) nofollowCount++;
      } catch {
        // Probably relative — count as internal
        internalCount++;
      }
    }

    // ── Words ─────
    const wordTokens = cleanText.split(/\s+/).filter(w => w.length > 0);
    const totalWords = wordTokens.length;
    const uniqueWords = new Set(wordTokens.map(w => w.toLowerCase())).size;
    const avgWordLength = totalWords > 0
      ? +(wordTokens.reduce((s, w) => s + w.length, 0) / totalWords).toFixed(1)
      : 0;
    const topKeywords = extractTopKeywords(cleanText);

    // ── Meta ─────
    const canonical = html.match(
      /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
    )?.[1];
    const robots = html.match(
      /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i
    )?.[1];
    const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hreflangMatches = html.match(
      /<link[^>]+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["']/gi
    ) ?? [];
    const hreflang = hreflangMatches
      .map(m => m.match(/hreflang=["']([^"']+)["']/i)?.[1] ?? "")
      .filter(Boolean);
    const ogTags = (html.match(/<meta[^>]+property=["']og:/gi) ?? []).length;
    const twitterTags = (html.match(/<meta[^>]+name=["']twitter:/gi) ?? []).length;
    const language = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1];
    const charset = html.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];

    // ── Warnings ─────
    const warnings: TechAuditReport["warnings"] = [];
    if (!title) warnings.push({ severity: "error", message: "Тег <title> отсутствует" });
    else if (!titleOk) warnings.push({
      severity: "warning",
      message: `Длина title ${titleLen} симв. (рекомендуется 30-70)`
    });
    if (!metaDescription) warnings.push({ severity: "error", message: "Meta description отсутствует" });
    else if (!descOk) warnings.push({
      severity: "warning",
      message: `Длина meta description ${descLen} симв. (рекомендуется 70-200)`
    });
    if (h1.length === 0) warnings.push({ severity: "error", message: "На странице нет H1" });
    else if (h1.length > 1) warnings.push({
      severity: "warning",
      message: `Найдено ${h1.length} H1 — оставьте один`
    });
    if (h2.length < 2) warnings.push({
      severity: "info",
      message: "Мало H2 (рекомендуется 3+) — добавьте подзаголовки"
    });
    if (totalImgs > 0 && altCoverage < 80) warnings.push({
      severity: "warning",
      message: `Только ${altCoverage}% картинок имеют alt — добавьте описания`
    });
    if (totalWords < 300) warnings.push({
      severity: "warning",
      message: `Слишком мало текста (${totalWords} слов) — рекомендуется минимум 500 для SEO`
    });
    if (contentRatio < 10) warnings.push({
      severity: "info",
      message: `Низкое соотношение контент/код (${contentRatio}%) — много HTML-обвязки`
    });
    if (!viewport) warnings.push({
      severity: "warning",
      message: "Отсутствует <meta name=\"viewport\"> — сайт не оптимизирован под мобильные"
    });
    if (!canonical) warnings.push({
      severity: "info",
      message: "Не указан canonical link — возможны проблемы с дублями"
    });
    if (loadTimeMs > 3000) warnings.push({
      severity: "warning",
      message: `Долгая загрузка: ${(loadTimeMs / 1000).toFixed(1)} сек`
    });
    if (externalCount > internalCount * 3 && totalImgs > 0) warnings.push({
      severity: "info",
      message: `Много внешних ссылок (${externalCount} vs ${internalCount} внутренних)`
    });

    const report: TechAuditReport = {
      url,
      finalUrl,
      fetchedAt: new Date().toISOString(),
      status: res.status,
      loadTimeMs,
      contentBytes,
      textBytes,
      contentRatio,
      language,
      charset,
      title: { value: title, length: titleLen, ok: titleOk },
      metaDescription: { value: metaDescription, length: descLen, ok: descOk },
      headings: {
        h1: { count: h1.length, values: h1.slice(0, 5), ok: h1.length === 1 },
        h2: { count: h2.length, values: h2.slice(0, 12) },
        h3: { count: h3.length, values: h3.slice(0, 10) },
        h4plus,
      },
      images: {
        total: totalImgs,
        withAlt,
        withoutAlt,
        altCoverage,
      },
      links: {
        internal: internalCount,
        external: externalCount,
        nofollow: nofollowCount,
        externalDomains: Array.from(externalDomains).slice(0, 20),
      },
      words: {
        total: totalWords,
        unique: uniqueWords,
        avgWordLength,
        topKeywords,
      },
      meta: {
        canonical,
        robots,
        viewport,
        hreflang,
        ogTags,
        twitterTags,
      },
      warnings,
    };

    void targetOrigin;
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
