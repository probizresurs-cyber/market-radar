import { NextResponse } from "next/server";
import type { SiteReadinessItem } from "@/lib/ai-visibility-types";

export const runtime = "nodejs";

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers: { "User-Agent": "MarketRadar-Bot/1.0" } });
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

export async function POST(req: Request) {
  try {
    const { websiteUrl } = await req.json();
    if (!websiteUrl) {
      return NextResponse.json({ ok: false, error: "websiteUrl required" }, { status: 400 });
    }

    const origin = getOrigin(websiteUrl);
    const results: SiteReadinessItem[] = [];

    // Fetch main page HTML
    let html = "";
    try {
      const res = await fetchWithTimeout(origin || websiteUrl, 8000);
      html = await res.text();
    } catch {
      // If main page fails, most checks will be false
    }

    const htmlLow = html.toLowerCase();

    // 1. Schema.org markup
    const hasSchemaOrg = /<script[^>]+application\/ld\+json/i.test(html);
    results.push({
      key: "schemaOrg",
      label: "Schema.org разметка (application/ld+json)",
      passed: hasSchemaOrg,
      detail: hasSchemaOrg ? "Найдена structured data" : "Добавьте JSON-LD разметку для понимания AI",
    });

    // 2. Organization schema
    const hasOrgSchema = /\"@type\"\s*:\s*\"Organization\"/i.test(html);
    results.push({
      key: "orgSchema",
      label: "Organization schema",
      passed: hasOrgSchema,
      detail: hasOrgSchema ? "Organization schema найдена" : "Добавьте тип Organization в JSON-LD",
    });

    // 3. FAQPage schema
    const hasFAQSchema = /\"@type\"\s*:\s*\"FAQPage\"/i.test(html);
    results.push({
      key: "faqSchema",
      label: "FAQPage schema",
      passed: hasFAQSchema,
      detail: hasFAQSchema ? "FAQPage schema найдена" : "FAQ с разметкой повышает AI-цитируемость",
    });

    // 4. llms.txt file
    let hasLlmsTxt = false;
    if (origin) {
      try {
        const llmsRes = await fetchWithTimeout(`${origin}/llms.txt`, 5000);
        hasLlmsTxt = llmsRes.ok;
      } catch { /* ignore */ }
    }
    results.push({
      key: "llmsTxt",
      label: "Файл /llms.txt",
      passed: hasLlmsTxt,
      detail: hasLlmsTxt
        ? "/llms.txt найден — AI-краулеры знают о содержимом сайта"
        : "Создайте /llms.txt с описанием сайта для AI-ботов",
    });

    // 5. FAQ blocks in HTML
    const hasFAQBlocks = /class=["'][^"']*faq|id=["'][^"']*faq|\bFAQ\b|Часто задаваемые вопросы/i.test(html);
    results.push({
      key: "faqBlocks",
      label: "FAQ-блоки на странице",
      passed: hasFAQBlocks,
      detail: hasFAQBlocks ? "FAQ-блоки найдены" : "Добавьте раздел с вопросами и ответами",
    });

    // 6. H2 headings as questions
    const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) ?? [];
    const h2Questions = h2Matches.filter(h => /[?？]/.test(h) || /как|что|почему|зачем|когда|где|кто/i.test(h));
    const hasH2Questions = h2Questions.length >= 2;
    results.push({
      key: "h2Questions",
      label: "H2-заголовки в формате вопросов",
      passed: hasH2Questions,
      detail: hasH2Questions
        ? `Найдено ${h2Questions.length} вопросительных H2`
        : "Перепишите H2 в виде вопросов для лучшей AI-цитируемости",
    });

    // 7. Numbers / facts in first 200 words
    const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500);
    const first200Words = bodyText.split(/\s+/).slice(0, 200).join(" ");
    const hasNumbers = /\d+[\s%+]/.test(first200Words);
    results.push({
      key: "numbersFirst200",
      label: "Цифры/факты в первых 200 словах",
      passed: hasNumbers,
      detail: hasNumbers ? "Цифры в начале текста найдены" : "Добавьте конкретные цифры в начало главной страницы",
    });

    // 8. Author markup
    const hasAuthor =
      /itemprop=["']author["']|meta[^>]+name=["']author["']|rel=["']author["']/i.test(html);
    results.push({
      key: "author",
      label: "Автор указан (E-E-A-T)",
      passed: hasAuthor,
      detail: hasAuthor ? "Атрибуция автора найдена" : "Укажите авторов материалов для E-E-A-T сигналов",
    });

    // 9. robots.txt — AI crawlers allowed
    let robotsOk = false;
    let robotsDetail = "Не удалось проверить robots.txt";
    if (origin) {
      try {
        const robotsRes = await fetchWithTimeout(`${origin}/robots.txt`, 5000);
        if (robotsRes.ok) {
          const robotsTxt = await robotsRes.text();
          const blocked = /^User-agent:\s*(GPTBot|PerplexityBot|anthropic-ai|Claude-Web)\s*\nDisallow:\s*\//im.test(robotsTxt);
          robotsOk = !blocked;
          robotsDetail = robotsOk
            ? "AI-краулеры не заблокированы в robots.txt"
            : "GPTBot или PerplexityBot заблокированы — снимите ограничения";
        }
      } catch { /* ignore */ }
    }
    results.push({
      key: "robotsTxt",
      label: "robots.txt не блокирует AI-краулеры",
      passed: robotsOk,
      detail: robotsDetail,
    });

    return NextResponse.json({ ok: true, items: results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
