import { NextRequest, NextResponse } from "next/server";
import { scrapeWebsite } from "@/lib/scraper";
import { analyzeWithClaude } from "@/lib/analyzer";
import { enrichDomainData, enrichCompanyData } from "@/lib/enricher";
import { checkAiAccess } from "@/lib/with-ai-security";
import { friendlyAiError } from "@/lib/ai-error";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import type { BusinessType } from "@/lib/business-types";

export const runtime = "nodejs";
// 90s — Claude analysis ~30s + scraping ~10s + SpyWords enrichment ~25s + others.
// При 60s упирались в timeout когда SpyWords ходил за конкурентами.
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  // Security: rate limit + logging setup
  const access = await checkAiAccess(request);
  if (!access.allowed) return access.response;

  let url: string;
  let businessType: BusinessType | undefined;

  try {
    const body = await request.json();
    url = (body.url ?? "").toString().trim();
    businessType = body.businessType as BusinessType | undefined;
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

    // 1. Запускаем сбор данных по домену параллельно с AI, так как они не зависят от названия компании
    const cleanDomain = scraped.url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
    const domainDataPromise = enrichDomainData(cleanDomain, scraped.socialLinks);

    // 2. AI analysis (Claude) — самая долгая операция, пока она идет, собираются данные по домену
    const rawResult = await analyzeWithClaude(scraped, businessType);
    const { _usage, ...result } = rawResult;
    const promptTokens = _usage?.inputTokens ?? 0;
    const completionTokens = _usage?.outputTokens ?? 0;

    // 3. Дожидаемся доменных данных и запускаем сбор данных по компании (используя полученное AI имя)
    const [domainData, companyData] = await Promise.all([
      domainDataPromise,
      enrichCompanyData(result.company.name, cleanDomain),
    ]);
    const real = { ...domainData, ...companyData };

    // 4. Overwrite AI-guessed fields with real data where available.
    // КРИТИЧНО: если реальный enricher вернул null — это значит источник
    // НЕ ОТРАБОТАЛ (нет токена / API down / соц не найдена). В этом случае
    // нужно СТЕРЕТЬ AI-выдумки, а не оставлять их как «факт». Юзер увидит
    // «—» / нули вместо правдоподобной лжи. Тот же паттерн что для DaData
    // ниже (L113-122).
    if (real.domainAge) {
      result.seo.domainAge = real.domainAge;
    } else {
      // AI мог выдумать «5 лет» — стираем
      result.seo.domainAge = "—";
    }
    if (real.hh) {
      result.hiring = {
        openVacancies: real.hh.openVacancies,
        avgSalary: real.hh.avgSalary,
        salaryRange: real.hh.salaryRange,
        topRoles: real.hh.topRoles.length > 0 ? real.hh.topRoles : [],
        trend: real.hh.trend,
      };
    } else {
      // HH.ru не отдал или нет API-ключа → стираем AI-цифры вакансий/зарплат
      result.hiring = {
        openVacancies: 0,
        avgSalary: "—",
        salaryRange: "—",
        topRoles: [],
        trend: "stable",
      };
    }
    if (real.telegram) {
      result.social.telegram = real.telegram;
    } else if (result.social.telegram) {
      // AI выдумал подписчиков → стираем число, оставляем только сам факт ссылки
      result.social.telegram = {
        ...result.social.telegram,
        subscribers: 0,
        posts30d: 0,
      };
    }
    if (real.vk) {
      result.social.vk = real.vk;
    } else if (result.social.vk) {
      result.social.vk = {
        ...result.social.vk,
        subscribers: 0,
        posts30d: 0,
      };
    }
    if (real.dadata) {
      // DaData есть → берём ТОЛЬКО её данные. AI-fallback больше не оставляем —
      // раньше при отсутствии конкретного поля в DaData показывали то что
      // выдумал Claude (employees, revenue, founded, legalForm). UI не помечал
      // это как «AI», пользователь думал что цифры из ФНС. Это анти-pattern,
      // выпиливаем — лучше «—» чем выдуманное.
      const d = real.dadata;
      result.business = {
        employees: d.employees !== "—" ? d.employees : "—",
        revenue: d.revenue !== "—" ? d.revenue : "—",
        founded: d.registrationDate !== "—" ? `${d.registrationDate} г.` : "—",
        legalForm: d.legalForm !== "—" ? d.legalForm : "—",
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
    } else {
      // DaData недоступна или не нашла компанию → стираем ВСЕ AI-цифры
      // которые Claude мог выдумать. Лучше «—» чем ложь.
      result.business = {
        employees: "—",
        revenue: "—",
        founded: "—",
        legalForm: "—",
      };
    }

    // PageSpeed Lighthouse scores — теперь и mobile, и desktop. Mobile —
    // на top-level (старая структура), desktop — в подобъекте.
    if (real.pageSpeed) {
      result.seo.lighthouseScores = {
        ...real.pageSpeed,
        ...(real.pageSpeedDesktop ? { desktop: real.pageSpeedDesktop } : {}),
      };
    } else if (real.pageSpeedDesktop) {
      // Mobile упал, desktop отработал — показываем хоть что-то.
      result.seo.lighthouseScores = {
        ...real.pageSpeedDesktop,
        desktop: real.pageSpeedDesktop,
      };
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

    // Yandex Maps rating (overwrite AI-guessed). Если реальный API не отдал
    // данных — стираем AI-цифры (AI любит выдумать «★4.2 (127 отзывов)»).
    if (real.yandexRating && real.yandexRating.rating > 0) {
      result.social.yandexRating = real.yandexRating.rating;
      result.social.yandexReviews = real.yandexRating.reviews;
    } else {
      result.social.yandexRating = 0;
      result.social.yandexReviews = 0;
    }

    // 2GIS rating — то же
    if (real.gisRating && real.gisRating.rating > 0) {
      result.social.gisRating = real.gisRating.rating;
      result.social.gisReviews = real.gisRating.reviews;
    } else {
      result.social.gisRating = 0;
      result.social.gisReviews = 0;
    }

    // Government contracts
    if (real.govContracts) {
      result.governmentContracts = real.govContracts;
    }

    // SpyWords — дополнительный слой SEO/PPC-аналитики поверх Keys.so.
    // Если ключей в env нет (или тариф упёрся в лимит) — просто не показываем блок.
    if (real.spywords) {
      result.spywordsDashboard = {
        overview:       real.spywords.overview,
        competitors:    real.spywords.competitors,
        advCompetitors: real.spywords.advCompetitors,
        ads:            real.spywords.ads,
        topPages:       real.spywords.topPages,
        smartKeywords:  real.spywords.smartKeywords,
        organic:        real.spywords.organic,
      };
    }

    // Keys.so — real keyword positions (Yandex + Google)
    if (real.keyso) {
      if (real.keyso.yandex.length > 0) {
        result.seo.positions = real.keyso.yandex;
        result.seo.keywordsSource = "keyso";
      }
      if (real.keyso.google.length > 0) {
        result.seo.googlePositions = real.keyso.google;
      }
      if (real.keyso.dashboard) {
        result.keysoDashboard = real.keyso.dashboard;
        // Optionally update estimated content traffic from Key.so Yandex traffic if available
        if (real.keyso.dashboard.yandex && real.keyso.dashboard.yandex.traffic > 0) {
          result.seo.estimatedTraffic = `~${real.keyso.dashboard.yandex.traffic.toLocaleString("ru-RU")} визитов/мес (согласно Key.so)`;
        }
      }
    }

    await access.log({ endpoint: "analyze", model: "claude-sonnet-4-6", promptTokens, completionTokens });

    // Зеркалим минимум о компании в users.last_analyzed_company для
    // серверных агентов (Yandex Reviews, Site Change Detector).
    // Это даёт «текущая активная компания юзера» которую агент видит
    // когда крутится по cron без доступа к localStorage.
    try {
      const session = await getSessionUser();
      if (session?.userId) {
        await initDb();
        await query(
          `UPDATE users SET last_analyzed_company = $1::jsonb WHERE id = $2`,
          [
            JSON.stringify({
              name: result.company.name,
              url: result.company.url,
              niche: result.company.niche ?? result.company.description?.slice(0, 200) ?? "",
              updatedAt: new Date().toISOString(),
            }),
            session.userId,
          ],
        );
      }
    } catch { /* best-effort: не валим anaslyze */ }

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[analyze] error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";

    await access.log({ endpoint: "analyze", model: "claude-sonnet-4-6", success: false, errorMessage: message.slice(0, 200) });

    // Особый случай — не дотянулись до сайта (Playwright / DNS). Это не AI-ошибка.
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

    // Все AI-ошибки (Cloudflare 403, Anthropic 401/429/HTML) — через общий хелпер.
    const { message: friendly, status } = friendlyAiError(err);
    return NextResponse.json({ ok: false, error: friendly }, { status });
  }
}
