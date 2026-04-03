import { NextRequest, NextResponse } from "next/server";
import { scrapeWebsite } from "@/lib/scraper";
import { analyzeWithClaude } from "@/lib/analyzer";
import { enrichWithRealData } from "@/lib/enricher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let url: string;

  try {
    const body = await request.json();
    url = (body.url ?? "").toString().trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ ok: false, error: "URL is required" }, { status: 400 });
  }

  // Basic URL sanity check
  try {
    const normalized = url.startsWith("http") ? url : "https://" + url;
    new URL(normalized);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid URL format" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  try {
    const scraped = await scrapeWebsite(url);

    // 1. AI analysis (Claude)
    const result = await analyzeWithClaude(scraped);

    // 2. Enrich with real data from open APIs (parallel, non-blocking)
    const real = await enrichWithRealData(result.company.name, result.company.url, scraped.socialLinks);

    // 3. Overwrite AI-guessed fields with real data where available
    if (real.domainAge) {
      result.seo.domainAge = real.domainAge;
    }
    if (real.hh) {
      result.hiring = {
        openVacancies: real.hh.openVacancies,
        avgSalary: real.hh.avgSalary,
        salaryRange: real.hh.salaryRange,
        topRoles: real.hh.topRoles.length > 0 ? real.hh.topRoles : result.hiring.topRoles,
        trend: real.hh.trend,
      };
    }
    if (real.telegram) {
      result.social.telegram = real.telegram;
    }
    if (real.vk) {
      result.social.vk = real.vk;
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[analyze] error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";

    if (
      message.includes("fetch") ||
      message.includes("ENOTFOUND") ||
      message.includes("ECONNREFUSED") ||
      message.includes("abort") ||
      message.includes("network")
    ) {
      return NextResponse.json(
        { ok: false, error: "Не удалось загрузить сайт. Проверьте URL и попробуйте снова." },
        { status: 422 }
      );
    }

    if (message.includes("API") || message.includes("anthropic") || message.includes("Claude")) {
      return NextResponse.json(
        { ok: false, error: "Ошибка AI-анализа. Попробуйте ещё раз." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Ошибка анализа: " + message },
      { status: 500 }
    );
  }
}
