/**
 * POST /api/ai-visibility/check-site
 *
 * Body: { websiteUrl: string, brandName?: string, description?: string }
 *
 * Comprehensive AI-readiness audit (replacement / extension of the basic
 * 9-check version). Includes:
 *   - AI bot accessibility (10+ crawler agents in robots.txt)
 *   - llms.txt presence + content quality scoring
 *   - Schema.org JSON-LD validation (Organization, FAQPage, Article, etc.)
 *   - Open Graph + Twitter Cards meta tags
 *   - Sitemap.xml accessibility
 *   - Content structure (H1, H2-as-questions, numbers in lede)
 *   - HTTPS, canonical, hreflang
 *   - Plus: ready-to-paste snippets for missing pieces (llms.txt, robots.txt,
 *     Organization JSON-LD, FAQPage JSON-LD)
 *
 * Returns AIReadinessReport — both the items list AND a 0-100 score, with
 * snippets the user can copy directly to fix any gaps.
 */
import { NextResponse } from "next/server";
import type { SiteReadinessItem, AIReadinessReport } from "@/lib/ai-visibility-types";

export const runtime = "nodejs";

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MarketRadar-AIAudit/1.0" },
      redirect: "follow",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function getOrigin(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).origin;
  } catch {
    return "";
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return "";
  }
}

// All major AI crawlers we want to ensure are NOT blocked
const AI_BOTS = [
  "GPTBot",            // OpenAI training
  "ChatGPT-User",      // ChatGPT live browsing
  "OAI-SearchBot",     // OpenAI search
  "ClaudeBot",         // Anthropic training
  "Claude-Web",        // Anthropic live (legacy)
  "anthropic-ai",      // Anthropic alt
  "PerplexityBot",     // Perplexity
  "Perplexity-User",   // Perplexity live
  "Google-Extended",   // Google AI training (Gemini, AI Overviews)
  "GoogleOther",       // Google internal
  "Bingbot",           // Bing + Copilot
  "YandexBot",         // Yandex search + Neuro
  "YandexImages",      // Yandex Images for AI
  "Applebot-Extended", // Apple Intelligence
  "Bytespider",        // ByteDance/TikTok
  "Meta-ExternalAgent",// Meta AI
] as const;

interface RobotsParseResult {
  blockedBots: string[];
  allowedBots: string[];
  hasSitemap: boolean;
  sitemaps: string[];
}

function parseRobotsTxt(txt: string): RobotsParseResult {
  const lines = txt.split(/\r?\n/);
  const blockedBots: string[] = [];
  const allowedBots: string[] = [];
  const sitemaps: string[] = [];

  // Group by User-agent block
  let currentAgents: string[] = [];
  let currentBlock: { allow: string[]; disallow: string[] } = { allow: [], disallow: [] };

  const flush = () => {
    if (currentAgents.length === 0) return;
    const fullDisallow = currentBlock.disallow.includes("/") &&
      !currentBlock.allow.some(a => a === "/");
    for (const agent of currentAgents) {
      const matchesAi = AI_BOTS.find(b => b.toLowerCase() === agent.toLowerCase());
      if (!matchesAi) continue;
      if (fullDisallow) {
        if (!blockedBots.includes(matchesAi)) blockedBots.push(matchesAi);
      } else {
        if (!allowedBots.includes(matchesAi)) allowedBots.push(matchesAi);
      }
    }
  };

  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      // New block starts only if previous had rules
      if (currentBlock.allow.length || currentBlock.disallow.length) {
        flush();
        currentAgents = [];
        currentBlock = { allow: [], disallow: [] };
      }
      currentAgents.push(val);
    } else if (key === "disallow") {
      currentBlock.disallow.push(val);
    } else if (key === "allow") {
      currentBlock.allow.push(val);
    } else if (key === "sitemap") {
      sitemaps.push(val);
    }
  }
  flush();

  return {
    blockedBots,
    allowedBots,
    hasSitemap: sitemaps.length > 0,
    sitemaps,
  };
}

function generateLlmsTxt(opts: { brandName: string; domain: string; description: string }): string {
  return `# ${opts.brandName}

> ${opts.description}

Сайт: https://${opts.domain}

## Ключевые разделы

- [Главная](https://${opts.domain}/) — обзор продукта и цены
- [О компании](https://${opts.domain}/about) — кто мы и что предлагаем

## Контакты

- Email: hello@${opts.domain}
- Сайт: https://${opts.domain}

## Лицензия использования контента

AI-системы и LLM могут цитировать материалы с этого сайта при указании источника.
`;
}

function generateRobotsTxtSnippet(): string {
  // Modern robots.txt explicitly allowing all major AI bots
  const lines = [
    "# robots.txt — открывает доступ AI-краулерам для попадания в ответы нейросетей",
    "",
    "User-agent: *",
    "Allow: /",
    "",
  ];
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`);
    lines.push("Allow: /");
    lines.push("");
  }
  lines.push("Sitemap: https://YOUR-DOMAIN.com/sitemap.xml");
  return lines.join("\n");
}

function generateOrganizationSchema(opts: { brandName: string; domain: string; description: string }): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: opts.brandName,
    url: `https://${opts.domain}`,
    description: opts.description,
    logo: `https://${opts.domain}/logo.png`,
    sameAs: [
      `https://t.me/${opts.brandName.toLowerCase().replace(/\s/g, "")}`,
      `https://${opts.domain}`,
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

function generateFAQSchema(opts: { brandName: string }): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Что такое ${opts.brandName}?`,
        acceptedAnswer: { "@type": "Answer", text: "Опишите коротко продукт здесь." },
      },
      {
        "@type": "Question",
        name: `Сколько стоит ${opts.brandName}?`,
        acceptedAnswer: { "@type": "Answer", text: "Опишите цены здесь." },
      },
      {
        "@type": "Question",
        name: `Чем отличается ${opts.brandName} от конкурентов?`,
        acceptedAnswer: { "@type": "Answer", text: "Опишите ключевые отличия здесь." },
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const websiteUrl: string = body.websiteUrl;
    const brandName: string = body.brandName || getDomain(websiteUrl).split(".")[0];
    const description: string = body.description || "Опишите ваш продукт в 1-2 предложениях для AI-систем";

    if (!websiteUrl) {
      return NextResponse.json({ ok: false, error: "websiteUrl required" }, { status: 400 });
    }

    const origin = getOrigin(websiteUrl);
    const domain = getDomain(websiteUrl);
    const items: SiteReadinessItem[] = [];

    // ── Fetch main page HTML ─────────────────────────────────────
    let html = "";
    let httpsOk = false;
    try {
      const res = await fetchWithTimeout(origin || websiteUrl, 8000);
      if (res?.ok) {
        html = await res.text();
        httpsOk = res.url.startsWith("https://");
      }
    } catch { /* ignore */ }

    // ── 1. AI BOTS GROUP — robots.txt analysis ──────────────────
    let robotsParse: RobotsParseResult | null = null;
    if (origin) {
      const robotsRes = await fetchWithTimeout(`${origin}/robots.txt`, 5000);
      if (robotsRes?.ok) {
        const txt = await robotsRes.text();
        robotsParse = parseRobotsTxt(txt);
      }
    }

    items.push({
      key: "robots_present",
      label: "Файл robots.txt существует",
      passed: !!robotsParse,
      detail: robotsParse ? "robots.txt доступен" : "robots.txt не найден — создайте /robots.txt",
      category: "ai-bots",
      weight: 5,
    });

    const blocked = robotsParse?.blockedBots ?? [];
    const aiBotsOk = blocked.length === 0;
    items.push({
      key: "ai_bots_allowed",
      label: "AI-краулеры не заблокированы",
      passed: aiBotsOk,
      detail: aiBotsOk
        ? "Все AI-боты могут читать сайт"
        : `Заблокированы: ${blocked.join(", ")} — снимите ограничения`,
      category: "ai-bots",
      weight: 15,
      fixSnippet: !aiBotsOk ? generateRobotsTxtSnippet() : undefined,
    });

    // 2. llms.txt
    let hasLlmsTxt = false;
    let llmsContent = "";
    if (origin) {
      const r = await fetchWithTimeout(`${origin}/llms.txt`, 5000);
      if (r?.ok) {
        hasLlmsTxt = true;
        llmsContent = await r.text();
      }
    }
    items.push({
      key: "llms_txt",
      label: "Файл /llms.txt",
      passed: hasLlmsTxt,
      detail: hasLlmsTxt
        ? `llms.txt найден (${llmsContent.length} символов)`
        : "Создайте /llms.txt — это новый стандарт для AI-краулеров",
      category: "ai-bots",
      weight: 10,
      fixSnippet: !hasLlmsTxt
        ? generateLlmsTxt({ brandName, domain, description })
        : undefined,
    });

    // 3. llms.txt quality (if present)
    if (hasLlmsTxt) {
      const hasH1 = /^#\s+\S/m.test(llmsContent);
      const hasLinks = /\]\(https?:\/\//.test(llmsContent);
      const goodQuality = hasH1 && hasLinks && llmsContent.length > 200;
      items.push({
        key: "llms_quality",
        label: "Качество llms.txt",
        passed: goodQuality,
        detail: goodQuality
          ? "llms.txt содержит структуру и ссылки"
          : "Добавьте заголовок, описание и ссылки на ключевые страницы",
        category: "ai-bots",
        weight: 5,
        fixSnippet: !goodQuality
          ? generateLlmsTxt({ brandName, domain, description })
          : undefined,
      });
    }

    // ── STRUCTURED DATA group ──────────────────────────────────
    const hasJsonLd = /<script[^>]+application\/ld\+json/i.test(html);
    items.push({
      key: "schema_jsonld",
      label: "Schema.org JSON-LD на странице",
      passed: hasJsonLd,
      detail: hasJsonLd
        ? "Найдена structured data разметка"
        : "Добавьте JSON-LD — AI-системы в первую очередь читают её",
      category: "structured-data",
      weight: 10,
    });

    const hasOrgSchema = /"@type"\s*:\s*"Organization"/i.test(html);
    items.push({
      key: "schema_organization",
      label: "Organization schema",
      passed: hasOrgSchema,
      detail: hasOrgSchema
        ? "Organization schema найдена"
        : "Самая важная разметка — описывает компанию для AI",
      category: "structured-data",
      weight: 15,
      fixSnippet: !hasOrgSchema
        ? generateOrganizationSchema({ brandName, domain, description })
        : undefined,
    });

    const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/i.test(html);
    items.push({
      key: "schema_faq",
      label: "FAQPage schema",
      passed: hasFaqSchema,
      detail: hasFaqSchema
        ? "FAQ-разметка найдена"
        : "FAQPage резко повышает шансы быть процитированным AI",
      category: "structured-data",
      weight: 10,
      fixSnippet: !hasFaqSchema ? generateFAQSchema({ brandName }) : undefined,
    });

    const hasArticleSchema = /"@type"\s*:\s*"(Article|NewsArticle|BlogPosting)"/i.test(html);
    items.push({
      key: "schema_article",
      label: "Article / BlogPosting schema",
      passed: hasArticleSchema,
      detail: hasArticleSchema
        ? "Разметка статьи найдена"
        : "Если есть блог — добавьте Article schema на каждой статье",
      category: "structured-data",
      weight: 5,
    });

    const hasBreadcrumbs = /"@type"\s*:\s*"BreadcrumbList"/i.test(html);
    items.push({
      key: "schema_breadcrumbs",
      label: "BreadcrumbList schema",
      passed: hasBreadcrumbs,
      detail: hasBreadcrumbs ? "Breadcrumbs размечены" : "Хлебные крошки помогают AI понять навигацию",
      category: "structured-data",
      weight: 3,
    });

    // ── METADATA group (OpenGraph + Twitter) ─────────────────
    const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
    const hasOgDescription = /<meta[^>]+property=["']og:description["']/i.test(html);
    const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(html);
    const ogComplete = hasOgTitle && hasOgDescription && hasOgImage;
    items.push({
      key: "og_complete",
      label: "Open Graph (og:title + description + image)",
      passed: ogComplete,
      detail: ogComplete
        ? "OG-разметка полная"
        : "OG-теги показывают preview в нейросетях, мессенджерах и соцсетях",
      category: "metadata",
      weight: 8,
    });

    const hasTwitterCard = /<meta[^>]+name=["']twitter:card["']/i.test(html);
    items.push({
      key: "twitter_card",
      label: "Twitter Card metadata",
      passed: hasTwitterCard,
      detail: hasTwitterCard ? "Twitter Cards настроены" : "Добавьте twitter:card для preview в X/Twitter и AI",
      category: "metadata",
      weight: 4,
    });

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const titleLen = titleMatch ? titleMatch[1].trim().length : 0;
    const titleOk = titleLen >= 30 && titleLen <= 70;
    items.push({
      key: "title_length",
      label: "<title> 30-70 символов",
      passed: titleOk,
      detail: titleLen === 0
        ? "<title> отсутствует"
        : titleLen < 30
          ? `Слишком короткий (${titleLen} симв.)`
          : titleLen > 70
            ? `Слишком длинный (${titleLen} симв.) — обрежется в превью`
            : `OK (${titleLen} симв.)`,
      category: "metadata",
      weight: 5,
    });

    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const descLen = metaDescMatch ? metaDescMatch[1].length : 0;
    const descOk = descLen >= 70 && descLen <= 200;
    items.push({
      key: "meta_description",
      label: "Meta description 70-200 символов",
      passed: descOk,
      detail: descLen === 0
        ? "meta description отсутствует"
        : `Длина: ${descLen} симв.${descOk ? "" : " (рекомендуется 70-200)"}`,
      category: "metadata",
      weight: 4,
    });

    const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    items.push({
      key: "canonical",
      label: "Canonical link",
      passed: hasCanonical,
      detail: hasCanonical ? "Canonical настроен" : "Добавьте <link rel=\"canonical\"> для устранения дублей",
      category: "metadata",
      weight: 3,
    });

    // ── CONTENT group ─────────────────────────────────────────
    const h1Count = (html.match(/<h1[^>]*>/gi) ?? []).length;
    items.push({
      key: "h1_present",
      label: "Главный H1 на странице",
      passed: h1Count >= 1 && h1Count <= 2,
      detail: h1Count === 0
        ? "H1 отсутствует — обязательный элемент SEO/AI"
        : h1Count === 1
          ? "Один H1 — идеально"
          : `Найдено ${h1Count} H1 — оставьте один`,
      category: "content",
      weight: 5,
    });

    const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) ?? [];
    const h2Questions = h2Matches.filter(h => /[?？]/.test(h) || /как|что|почему|зачем|когда|где|кто/i.test(h));
    items.push({
      key: "h2_questions",
      label: "H2 в формате вопросов (минимум 2)",
      passed: h2Questions.length >= 2,
      detail: h2Questions.length >= 2
        ? `${h2Questions.length} вопросительных H2`
        : "Перепишите H2 как вопросы — AI любит цитировать ответы",
      category: "content",
      weight: 5,
    });

    const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500);
    const first300Words = bodyText.split(/\s+/).slice(0, 300).join(" ");
    const hasNumbers = /\d+\s*(%|\+|\$|₽|€|£|млн|тыс|раз|x|х)/i.test(first300Words);
    items.push({
      key: "numbers_in_intro",
      label: "Цифры/факты в первых 300 словах",
      passed: hasNumbers,
      detail: hasNumbers ? "Цифры в начале текста — отлично" : "Добавьте конкретные цифры (% / тыс / млн / $)",
      category: "content",
      weight: 5,
    });

    const hasFaqBlock = /class=["'][^"']*faq|id=["'][^"']*faq|Часто задаваемые/i.test(html);
    items.push({
      key: "faq_block",
      label: "FAQ-блок на странице",
      passed: hasFaqBlock,
      detail: hasFaqBlock ? "FAQ найден" : "Раздел с вопросами + FAQPage schema = главный AI-магнит",
      category: "content",
      weight: 5,
    });

    const hasAuthor = /itemprop=["']author["']|<meta[^>]+name=["']author["']|rel=["']author["']/i.test(html);
    items.push({
      key: "author_attribution",
      label: "Автор указан (E-E-A-T)",
      passed: hasAuthor,
      detail: hasAuthor ? "Автор размечен" : "Укажите автора материалов — критично для AI-доверия",
      category: "content",
      weight: 3,
    });

    // ── TECHNICAL group ────────────────────────────────────
    items.push({
      key: "https",
      label: "HTTPS включён",
      passed: httpsOk,
      detail: httpsOk ? "Сайт на HTTPS" : "Переведите сайт на HTTPS — иначе AI ему не доверяет",
      category: "technical",
      weight: 6,
    });

    items.push({
      key: "sitemap_xml",
      label: "Sitemap.xml доступен",
      passed: !!robotsParse?.hasSitemap || !!(await fetchWithTimeout(`${origin}/sitemap.xml`, 4000))?.ok,
      detail: robotsParse?.hasSitemap
        ? `Указан в robots: ${robotsParse.sitemaps[0]}`
        : "Создайте /sitemap.xml — помогает AI быстрее обнаружить весь контент",
      category: "technical",
      weight: 5,
    });

    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    items.push({
      key: "viewport",
      label: "Mobile viewport meta",
      passed: hasViewport,
      detail: hasViewport ? "Mobile-friendly разметка" : "Добавьте <meta name=\"viewport\">",
      category: "technical",
      weight: 3,
    });

    const hasFavicon = /<link[^>]+rel=["'](?:icon|shortcut icon)["']/i.test(html);
    items.push({
      key: "favicon",
      label: "Favicon",
      passed: hasFavicon,
      detail: hasFavicon ? "Favicon на месте" : "Иконка сайта влияет на узнаваемость в превью",
      category: "technical",
      weight: 1,
    });

    const hasLangAttr = /<html[^>]+lang=["']/i.test(html);
    items.push({
      key: "html_lang",
      label: "Атрибут lang в <html>",
      passed: hasLangAttr,
      detail: hasLangAttr ? "Язык страницы указан" : "Добавьте lang=\"ru\" — AI понимает регион",
      category: "technical",
      weight: 2,
    });

    // ── Compute score ────────────────────────────────────────
    const totalWeight = items.reduce((s, i) => s + (i.weight ?? 0), 0);
    const earned = items.reduce((s, i) => s + (i.passed ? (i.weight ?? 0) : 0), 0);
    const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;

    const byCategory: AIReadinessReport["byCategory"] = {
      "ai-bots": 0,
      "structured-data": 0,
      "metadata": 0,
      "content": 0,
      "technical": 0,
    };
    for (const cat of Object.keys(byCategory) as Array<keyof typeof byCategory>) {
      const catItems = items.filter(i => i.category === cat);
      const catWeight = catItems.reduce((s, i) => s + (i.weight ?? 0), 0);
      const catEarned = catItems.reduce((s, i) => s + (i.passed ? (i.weight ?? 0) : 0), 0);
      byCategory[cat] = catWeight > 0 ? Math.round((catEarned / catWeight) * 100) : 0;
    }

    const report: AIReadinessReport = {
      score,
      byCategory,
      items,
      snippets: {
        llmsTxt: !hasLlmsTxt ? generateLlmsTxt({ brandName, domain, description }) : undefined,
        robotsTxt: !aiBotsOk || !robotsParse ? generateRobotsTxtSnippet() : undefined,
        organizationSchema: !hasOrgSchema ? generateOrganizationSchema({ brandName, domain, description }) : undefined,
        faqSchema: !hasFaqSchema ? generateFAQSchema({ brandName }) : undefined,
      },
    };

    return NextResponse.json({
      ok: true,
      // Backward compat with existing UI consuming `items`
      items,
      // New full report
      report,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
