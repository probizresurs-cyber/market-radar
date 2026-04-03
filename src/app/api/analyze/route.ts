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
    if (real.dadata) {
      const d = real.dadata;
      result.business = {
        employees: d.employees !== "—" ? d.employees : result.business.employees,
        revenue: d.revenue !== "—" ? d.revenue : result.business.revenue,
        founded: d.registrationDate !== "—" ? `${d.registrationDate} г.` : result.business.founded,
        legalForm: d.legalForm !== "—" ? d.legalForm : result.business.legalForm,
      };
      // Append INN/OGRN to company description
      const extraInfo = [
        d.inn !== "—" ? `ИНН: ${d.inn}` : "",
        d.ogrn !== "—" ? `ОГРН: ${d.ogrn}` : "",
        d.status && d.status !== "—" ? `Статус: ${d.status}` : "",
        d.address && d.address !== "—" ? `Адрес: ${d.address}` : "",
      ].filter(Boolean).join(" · ");
      if (extraInfo) {
        result.company.description = (result.company.description ? result.company.description + "\n" : "") + extraInfo;
      }
    }

    // PageSpeed Lighthouse scores
    if (real.pageSpeed) {
      result.seo.lighthouseScores = real.pageSpeed;
    }

    // Wayback Machine archive age
    if (real.wayback) {
      result.seo.firstArchiveDate = real.wayback.firstArchiveDate;
      result.seo.archiveAgeYears = real.wayback.archiveAgeYears;
    }

    // Rusprofile financial data
    if (real.rusprofile) {
      if (real.rusprofile.revenue && result.business.revenue === "—") {
        result.business.revenue = real.rusprofile.revenue;
      }
      if (real.rusprofile.courtCases !== undefined) {
        result.business.courtCases = real.rusprofile.courtCases;
      }
      if (real.rusprofile.profileUrl) {
        result.business.rusprofileUrl = real.rusprofile.profileUrl;
      }
    }

    // Yandex Maps rating (overwrite AI-guessed)
    if (real.yandexRating && real.yandexRating.rating > 0) {
      result.social.yandexRating = real.yandexRating.rating;
      result.social.yandexReviews = real.yandexRating.reviews;
    }

    // 2GIS rating
    if (real.gisRating && real.gisRating.rating > 0) {
      result.social.gisRating = real.gisRating.rating;
      result.social.gisReviews = real.gisRating.reviews;
    }

    // Government contracts
    if (real.govContracts) {
      result.governmentContracts = real.govContracts;
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

    if (message.includes("anthropic") || message.includes("authentication") || message.includes("api_key")) {
      return NextResponse.json(
        { ok: false, error: "Ошибка AI-анализа: проблема с API ключом." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Ошибка анализа: " + message },
      { status: 500 }
    );
  }
}
