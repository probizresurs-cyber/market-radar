/**
 * Real data enrichment from free open APIs.
 * Called after Claude analysis to overwrite AI-guessed fields with actual data.
 */

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; MarketRadar/1.0; +https://company24.pro)",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
};

const HH_HEADERS = {
  ...FETCH_HEADERS,
  "HH-User-Agent": "MarketRadar/1.0 (radar@company24.pro)",
  "Accept": "application/json",
};

async function fetchJson(url: string, headers: Record<string, string> = FETCH_HEADERS, ms = 7000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchHtml(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { ...FETCH_HEADERS, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ─── WHOIS / RDAP — real domain registration date ────────────────────────────

export async function getRealDomainAge(domain: string): Promise<string | null> {
  try {
    // Strip subdomains, use 2nd-level domain
    const parts = domain.replace(/^www\./, "").split(".");
    const root = parts.slice(-2).join(".");

    // Try RDAP — universal free standard
    const data = await fetchJson(`https://rdap.org/domain/${root}`) as Record<string, unknown>;
    const events = data?.events as Array<{ eventAction: string; eventDate: string }> | undefined;
    const reg = events?.find(e => e.eventAction === "registration");
    if (reg?.eventDate) {
      const date = new Date(reg.eventDate);
      const now = new Date();
      const years = now.getFullYear() - date.getFullYear();
      const since = date.getFullYear();
      if (years === 0) return `менее года (с ${since})`;
      const label = years === 1 ? "год" : years < 5 ? "года" : "лет";
      return `${years} ${label} (с ${since})`;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── hh.ru — real vacancies and salaries ─────────────────────────────────────

interface HHResult {
  openVacancies: number;
  avgSalary: string;
  salaryRange: string;
  topRoles: string[];
  trend: "growing" | "stable" | "declining";
  employerUrl?: string;
}

export async function getRealHHData(companyName: string, domain: string): Promise<HHResult | null> {
  try {
    // Step 1: search employer by name
    const searchUrl = `https://api.hh.ru/employers?text=${encodeURIComponent(companyName)}&per_page=10&type=company`;
    const searchData = await fetchJson(searchUrl, HH_HEADERS) as { items?: Array<{ id: string; name: string; site_url?: string; alternate_url?: string }> };
    const employers = searchData?.items ?? [];
    if (employers.length === 0) return null;

    // Step 2: pick best matching employer (prefer domain match, else first)
    let employer = employers[0];
    for (const e of employers) {
      const siteUrl = (e.site_url ?? "").toLowerCase();
      if (siteUrl.includes(domain.replace(/^www\./, ""))) {
        employer = e;
        break;
      }
    }

    // Step 3: get their vacancies
    const vacUrl = `https://api.hh.ru/vacancies?employer_id=${employer.id}&per_page=50&currency=RUR&only_with_salary=false`;
    const vacData = await fetchJson(vacUrl, HH_HEADERS) as {
      found?: number;
      items?: Array<{
        name?: string;
        salary?: { from?: number; to?: number; currency?: string };
        published_at?: string;
      }>;
    };
    const vacancies = vacData?.items ?? [];
    const openVacancies = vacData?.found ?? vacancies.length;

    // Extract salary data
    const salaries: number[] = [];
    const roles: string[] = [];
    for (const v of vacancies.slice(0, 30)) {
      if (v.name && !roles.includes(v.name)) roles.push(v.name);
      if (v.salary?.currency === "RUR" || !v.salary?.currency) {
        if (v.salary?.from && v.salary.from > 10000) salaries.push(v.salary.from);
        if (v.salary?.to && v.salary.to > 10000) salaries.push(v.salary.to);
      }
    }

    let avgSalary = "—";
    let salaryRange = "—";
    if (salaries.length > 0) {
      const sorted = [...salaries].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const avg = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
      avgSalary = `${avg.toLocaleString("ru-RU")} ₽`;
      salaryRange = `${min.toLocaleString("ru-RU")} – ${max.toLocaleString("ru-RU")} ₽`;
    }

    const trend: HHResult["trend"] = openVacancies >= 10 ? "growing" : openVacancies >= 3 ? "stable" : "stable";

    return {
      openVacancies,
      avgSalary,
      salaryRange,
      topRoles: roles.slice(0, 5),
      trend,
      employerUrl: employer.alternate_url,
    };
  } catch {
    return null;
  }
}

// ─── Telegram — real subscriber count ────────────────────────────────────────

export async function getRealTelegramStats(tgUrl: string): Promise<{ subscribers: number; posts30d: number } | null> {
  try {
    const match = tgUrl.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,})/);
    if (!match) return null;
    const channel = match[1];

    // Skip invitation/share links
    if (["joinchat", "share", "addstickers", "addtheme", "boost"].includes(channel.toLowerCase())) return null;

    // Fetch public channel preview page
    const html = await fetchHtml(`https://t.me/${channel}`);

    // Pattern: "3 424 subscribers" or "3,424 members"
    const patterns = [
      /(\d[\d\s,]+)\s+(?:подписчик|subscriber|member|участник)/i,
      /members_count['":\s]+(\d+)/i,
      /"members":(\d+)/i,
    ];

    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m) {
        const raw = m[1].replace(/[\s,]/g, "");
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0 && n < 50_000_000) {
          // Estimate posts per month from page content
          const postCount = (html.match(/tgme_widget_message/g) ?? []).length;
          return { subscribers: n, posts30d: Math.min(postCount, 30) };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── VK — real subscriber count via open widget ───────────────────────────────

export async function getRealVKStats(vkUrl: string): Promise<{ subscribers: number; posts30d: number; engagement: string; trend: string } | null> {
  try {
    // Extract group screen name. Поддерживаем формы:
    //   https://vk.com/illumpro
    //   vk.com/illumpro
    //   @illumpro (если кто-то вставит так)
    const match = vkUrl.match(/(?:vk\.com\/|@)([a-zA-Z0-9_.]+)/);
    if (!match || ["share", "feed", "im", "search"].includes(match[1])) return null;
    const screenName = match[1];

    // КРИТИЧНО: VK блокирует не-браузерные UA и отдаёт stripped HTML
    // без members_count. Используем «обычный» Chrome UA только для VK.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    let html: string;
    try {
      const res = await fetch(`https://vk.com/${screenName}`, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
      });
      if (!res.ok) return null;
      html = await res.text();
    } finally {
      clearTimeout(t);
    }

    // Parse followers/members count. Самый надёжный — JSON-снапшот в HTML.
    const patterns = [
      /"members_count":(\d+)/i,
      /"followers_count":(\d+)/i,
      /(\d[\d\s]+)\s*(?:подписчик|участник|follower|member)/i,
    ];

    let subscribers = 0;
    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m) {
        const raw = m[1].replace(/\s/g, "");
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0 && n < 100_000_000) {
          subscribers = n;
          break;
        }
      }
    }
    if (subscribers === 0) return null;

    // Try to extract posts in last 30 days — VK на странице сообщества
    // показывает дату постов в формате «5 окт в 12:30» / «вчера». Считаем
    // упоминания «(N) ч назад» / «(N) мин назад» / последние 30 дней.
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const monthAgo = now - 30 * day;

    // Самый надёжный — JSON-снапшоты постов: "date":1730000000
    let posts30d = 0;
    const dateMatches = html.matchAll(/"date":(\d{10})/g);
    for (const dm of dateMatches) {
      const ts = Number(dm[1]) * 1000;
      if (ts > monthAgo && ts <= now) posts30d++;
    }
    // Капим макс ~30 (если в HTML больше — это служебные timestamp'ы вроде last_seen)
    posts30d = Math.min(posts30d, 30);

    return {
      subscribers,
      posts30d,
      engagement: posts30d > 0 ? `~${(posts30d * 100 / 30).toFixed(0)}% активности` : "—",
      trend: "stable",
    };
  } catch {
    return null;
  }
}

// ─── DaData — real company data (INN, OGRN, employees, revenue) ──────────────

export interface DaDataResult {
  inn: string;
  ogrn: string;
  legalForm: string;      // ООО / ИП / АО / ПАО
  fullName: string;       // полное юридическое название
  address: string;
  registrationDate: string; // дата регистрации юрлица
  employees: string;      // диапазон сотрудников
  revenue: string;        // выручка
  status: string;         // ACTIVE / LIQUIDATING / LIQUIDATED
}

async function fetchDaDataPost(url: string, body: unknown, token: string, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Token ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`DaData HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const EMPLOYEE_RANGES: Record<string, string> = {
  "1": "до 15",
  "2": "16–100",
  "3": "101–250",
  "4": "251–500",
  "5": "501–1 000",
  "6": "1 001–5 000",
  "7": "5 001–10 000",
  "8": "свыше 10 000",
};

export async function getRealDaData(companyName: string, domain: string): Promise<DaDataResult | null> {
  const token = process.env.DADATA_API_KEY;
  if (!token) return null;

  try {
    // Search by company name
    const data = await fetchDaDataPost(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party",
      { query: companyName, count: 10, status: ["ACTIVE"] },
      token
    ) as { suggestions?: Array<{ value: string; data: Record<string, unknown> }> };

    const suggestions = data?.suggestions ?? [];
    if (suggestions.length === 0) return null;

    // Try to find best match: prefer domain match in address or name
    let best = suggestions[0];
    for (const s of suggestions) {
      const name = String(s.value ?? "").toLowerCase();
      const addr = String((s.data?.address as Record<string, unknown>)?.value ?? "").toLowerCase();
      if (name.includes(companyName.toLowerCase().slice(0, 6)) ||
        addr.includes(domain.replace(/\.[a-z]+$/, ""))) {
        best = s;
        break;
      }
    }

    const d = best.data;

    // Legal form
    const opfShort = String((d?.opf as Record<string, unknown>)?.short ?? "");
    const type = String(d?.type ?? "");
    const legalForm = opfShort || (type === "INDIVIDUAL" ? "ИП" : type === "LEGAL" ? "ООО" : "—");

    // Registration date
    let registrationDate = "—";
    const regDateMs = Number((d?.state as Record<string, unknown>)?.registration_date);
    if (regDateMs) {
      const year = new Date(regDateMs).getFullYear();
      registrationDate = `${year}`;
    }

    // Employees (DaData employee_count is a range code)
    const empCode = String(d?.employee_count ?? "");
    const employees = empCode && EMPLOYEE_RANGES[empCode]
      ? `${EMPLOYEE_RANGES[empCode]} чел.`
      : "—";

    // Revenue from finance block
    let revenue = "—";
    const finance = d?.finance as Record<string, unknown> | undefined;
    if (finance?.revenue && Number(finance.revenue) > 0) {
      const rev = Number(finance.revenue);
      if (rev >= 1_000_000_000) {
        revenue = `${(rev / 1_000_000_000).toFixed(1)} млрд ₽/год`;
      } else if (rev >= 1_000_000) {
        revenue = `${Math.round(rev / 1_000_000)} млн ₽/год`;
      } else {
        revenue = `${Math.round(rev / 1_000)} тыс. ₽/год`;
      }
    }

    // Status
    const statusRaw = String((d?.state as Record<string, unknown>)?.status ?? "");
    const statusMap: Record<string, string> = {
      ACTIVE: "Действующая",
      LIQUIDATING: "В ликвидации",
      LIQUIDATED: "Ликвидирована",
      BANKRUPT: "Банкротство",
      REORGANIZING: "Реорганизация",
    };
    const status = statusMap[statusRaw] ?? statusRaw;

    return {
      inn: String(d?.inn ?? "—"),
      ogrn: String(d?.ogrn ?? "—"),
      legalForm,
      fullName: String(best.value ?? companyName),
      address: String((d?.address as Record<string, unknown>)?.value ?? "—"),
      registrationDate,
      employees,
      revenue,
      status,
    };
  } catch {
    return null;
  }
}

// ─── Google PageSpeed Insights — real Lighthouse scores + Core Web Vitals ───

export interface CWVMetric {
  value: number;
  display: string;
  score: number; // 0=poor, 0.5=needs improvement, 1=good
}

export interface PageSpeedResult {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices?: number;
  lcp?: CWVMetric;
  fcp?: CWVMetric;
  cls?: CWVMetric;
  tbt?: CWVMetric;
  si?:  CWVMetric;
  tti?: CWVMetric;
}

function extractAudit(audits: Record<string, unknown>, key: string): CWVMetric | undefined {
  const a = audits[key] as { numericValue?: number; displayValue?: string; score?: number } | undefined;
  if (!a || a.numericValue === undefined) return undefined;
  return {
    value: a.numericValue,
    display: a.displayValue ?? String(Math.round(a.numericValue)),
    score: a.score ?? 0,
  };
}

export async function getPageSpeedScores(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PageSpeedResult | null> {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  // Используем только PAGESPEED_API_KEY (без fallback на GOOGLE_PLACES_API_KEY,
  // у которого HTTP referrer-restriction → server-side даёт 403)
  const apiKey = process.env.PAGESPEED_API_KEY || "";
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(fullUrl)}&strategy=${strategy}&category=performance&category=seo&category=accessibility&category=best-practices${keyParam}`;

  // Lighthouse для production-сайтов часто занимает 30-90 секунд.
  // Для тяжёлых сайтов с большим объёмом JS — до 120s.
  // Делаем 1 ретрай на 5xx ошибки (Google API периодически возвращает 500).
  const TIMEOUT_MS = 120_000;
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await fetchJson(apiUrl, FETCH_HEADERS, TIMEOUT_MS) as Record<string, unknown>;
      const lr = data?.lighthouseResult as Record<string, unknown> | undefined;
      const cats = lr?.categories as Record<string, { score?: number }> | undefined;
      if (!cats) {
        const apiError = (data as Record<string, unknown>)?.error;
        console.warn(`[PageSpeed] No categories in response (attempt ${attempt}/${MAX_ATTEMPTS}). error:`, apiError);
        if (attempt < MAX_ATTEMPTS) continue;
        return null;
      }
      const audits = (lr?.audits ?? {}) as Record<string, unknown>;
      return {
        performance:   Math.round((cats.performance?.score   ?? 0) * 100),
        seo:           Math.round((cats.seo?.score           ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round(((cats["best-practices"] as { score?: number } | undefined)?.score ?? 0) * 100),
        lcp: extractAudit(audits, "largest-contentful-paint"),
        fcp: extractAudit(audits, "first-contentful-paint"),
        cls: extractAudit(audits, "cumulative-layout-shift"),
        tbt: extractAudit(audits, "total-blocking-time"),
        si:  extractAudit(audits, "speed-index"),
        tti: extractAudit(audits, "interactive"),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /HTTP 5\d\d/.test(msg) || msg.includes("aborted") || msg.includes("ECONNRESET");
      console.warn(`[PageSpeed] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${msg}`);
      if (attempt < MAX_ATTEMPTS && isTransient) {
        // Backoff before retry
        await new Promise(r => setTimeout(r, 2_000));
        continue;
      }
      return null;
    }
  }
  return null;
}

/** Тянем PageSpeed одновременно для mobile и desktop. PageSpeed API позволяет
 *  делать 2 параллельных запроса с одним ключом, общая нагрузка та же
 *  (это разные strategy-режимы Lighthouse). */
export async function getPageSpeedBoth(url: string): Promise<{
  mobile: PageSpeedResult | null;
  desktop: PageSpeedResult | null;
} | null> {
  const [mobile, desktop] = await Promise.all([
    getPageSpeedScores(url, "mobile"),
    getPageSpeedScores(url, "desktop"),
  ]);
  if (!mobile && !desktop) return null;
  return { mobile, desktop };
}

// ─── Wayback Machine — real first archive date ──────────────────────────────

export interface WaybackResult {
  firstArchiveDate: string;
  archiveAgeYears: number;
}

export async function getFirstArchiveDate(domain: string): Promise<WaybackResult | null> {
  try {
    const cleanDomain = domain.replace(/^www\./, "");
    const apiUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanDomain)}&fl=timestamp&output=json&limit=1&sort=asc`;
    const data = await fetchJson(apiUrl, FETCH_HEADERS, 10000) as string[][];
    if (!data || data.length < 2 || !data[1]?.[0]) return null;
    const ts = data[1][0]; // "20150312143022"
    const dateStr = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
    const date = new Date(dateStr);
    const now = new Date();
    const years = Math.max(0, now.getFullYear() - date.getFullYear());
    return { firstArchiveDate: dateStr, archiveAgeYears: years };
  } catch {
    return null;
  }
}

// ─── Rusprofile.ru — financial data and court cases ─────────────────────────

export interface RusprofileResult {
  revenue?: string;
  courtCases?: number;
  profileUrl: string;
}

export async function getRusprofileData(companyName: string): Promise<RusprofileResult | null> {
  try {
    const searchUrl = `https://www.rusprofile.ru/search?query=${encodeURIComponent(companyName)}&type=ul`;
    const html = await fetchHtml(searchUrl, 10000);
    if (html.length < 500 || html.includes("captcha") || html.includes("Captcha")) return null;

    // Extract first result profile URL
    const urlMatch = html.match(/href="(\/id\/\d+)"/);
    const profileUrl = urlMatch ? `https://www.rusprofile.ru${urlMatch[1]}` : "";
    if (!profileUrl) return null;

    // Try to extract revenue from search results
    let revenue: string | undefined;
    const revMatch = html.match(/Выручка[^<]*<[^>]*>([^<]+)/i);
    if (revMatch) revenue = revMatch[1].trim();

    // Try to extract court cases count
    let courtCases: number | undefined;
    const courtMatch = html.match(/(?:Арбитраж|дел[ао])[^<]*?(\d+)/i);
    if (courtMatch) { const n = parseInt(courtMatch[1], 10); if (!isNaN(n)) courtCases = n; }

    return { revenue, courtCases, profileUrl };
  } catch {
    return null;
  }
}

// ─── Yandex Maps — rating from search snippets ─────────────────────────────

export interface YandexRatingResult {
  rating: number;
  reviews: number;
}

export async function getYandexRating(companyName: string, domain: string): Promise<YandexRatingResult | null> {
  try {
    // Try Yandex search for structured rating snippet
    const query = `${companyName} ${domain} отзывы`;
    const html = await fetchHtml(`https://yandex.ru/search/?text=${encodeURIComponent(query)}&lr=213`, 6000);

    // Look for schema.org rating in snippets
    const patterns = [
      /"ratingValue"[:\s]*"?([\d.]+)"?.*?"reviewCount"[:\s]*"?(\d+)"?/,
      /"aggregateRating"[^}]*"ratingValue"[:\s]*"?([\d.]+)"?[^}]*"ratingCount"[:\s]*"?(\d+)"?/,
      /rating.*?(\d\.\d).*?(\d+)\s*отзыв/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        const rating = parseFloat(m[1]);
        const reviews = parseInt(m[2], 10);
        if (rating > 0 && rating <= 5 && reviews > 0) return { rating, reviews };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── 2GIS — rating from catalog API ────────────────────────────────────────

export interface GisRatingResult {
  rating: number;
  reviews: number;
}

export async function get2GisRating(companyName: string): Promise<GisRatingResult | null> {
  try {
    // Try the public catalog API with the web key
    const apiUrl = `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(companyName)}&key=rubnkm&fields=items.reviews&page_size=5`;
    const data = await fetchJson(apiUrl, FETCH_HEADERS, 8000) as {
      result?: { items?: Array<{ reviews?: { rating?: number; review_count?: number } }> };
    };
    const items = data?.result?.items ?? [];
    for (const item of items) {
      if (item.reviews?.rating && item.reviews.rating > 0) {
        return { rating: item.reviews.rating, reviews: item.reviews.review_count ?? 0 };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── zakupki.gov.ru — government contracts ──────────────────────────────────

export interface GovContractsResult {
  totalContracts: number;
  totalAmount: string;
  recentContracts: Array<{
    date: string;
    amount: string;
    customer: string;
    subject: string;
  }>;
}

export async function getGovContracts(companyName: string, inn?: string): Promise<GovContractsResult | null> {
  try {
    const query = inn && inn !== "—" ? inn : companyName;
    const searchUrl = `https://zakupki.gov.ru/epz/contract/search/results.html?searchString=${encodeURIComponent(query)}&morphology=on&pageNumber=1&sortDirection=false&recordsPerPage=5`;
    const html = await fetchHtml(searchUrl, 12000);
    if (html.length < 500 || html.includes("captcha")) return null;

    // Parse total count
    const totalMatch = html.match(/Найдено.*?(\d[\d\s]*)/i);
    const totalRaw = totalMatch ? parseInt(totalMatch[1].replace(/\s/g, ""), 10) : NaN;
    const totalContracts = !isNaN(totalRaw) ? totalRaw : 0;
    if (totalContracts === 0) return null;

    // Parse contract rows
    const recentContracts: GovContractsResult["recentContracts"] = [];
    const contractBlocks = html.split(/registry-entry__header/i).slice(1, 6);
    let totalSum = 0;

    for (const block of contractBlocks) {
      const dateMatch = block.match(/(\d{2}\.\d{2}\.\d{4})/);
      const amountMatch = block.match(/([\d\s,]+[.,]\d{2})\s*₽?/);
      const subjectMatch = block.match(/registry-entry__body-value[^>]*>([^<]{5,80})/);
      const customerMatch = block.match(/(?:Заказчик|customer)[^>]*>([^<]+)/i);

      const amount = amountMatch ? amountMatch[1].replace(/\s/g, "") : "0";
      const numAmount = parseFloat(amount.replace(",", "."));
      if (numAmount > 0) totalSum += numAmount;

      recentContracts.push({
        date: dateMatch?.[1] ?? "—",
        amount: amountMatch ? `${amountMatch[1].trim()} ₽` : "—",
        customer: customerMatch?.[1]?.trim().slice(0, 60) ?? "—",
        subject: subjectMatch?.[1]?.trim().slice(0, 80) ?? "—",
      });
    }

    let totalAmount: string;
    if (totalSum >= 1_000_000_000) totalAmount = `${(totalSum / 1_000_000_000).toFixed(1)} млрд ₽`;
    else if (totalSum >= 1_000_000) totalAmount = `${Math.round(totalSum / 1_000_000)} млн ₽`;
    else if (totalSum >= 1_000) totalAmount = `${Math.round(totalSum / 1_000)} тыс. ₽`;
    else totalAmount = `${Math.round(totalSum)} ₽`;

    return { totalContracts, totalAmount, recentContracts };
  } catch {
    return null;
  }
}

// ─── Keys.so — real keyword positions for Yandex and Google ─────────────────

export interface KeysoPosition {
  keyword: string;
  position: number;
  volume: number;
}

export interface KeysoKeywords {
  yandex: KeysoPosition[];
  google: KeysoPosition[];
  dashboard?: {
    yandex?: { traffic: number; visibility: number; pagesInOrganic: number; adKeys: number; competitors: string[] };
    google?: { traffic: number; visibility: number; pagesInOrganic: number; adKeys: number; competitors: string[] };
  };
}

export async function getKeysoKeywords(domain: string): Promise<KeysoKeywords | null> {
  const token = process.env.KEYSO_API_TOKEN;
  if (!token) return null;

  try {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
    const headers = {
      "X-Keyso-TOKEN": token,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    // Fetch Yandex и Google dashboards. Для маленьких/региональных доменов
    // (вроде cormilec.ru) Keys.so может не иметь данных в msk-базе, но иметь
    // в ru (Россия-агрегат) или spb. Поэтому пробуем регионы по очереди и
    // берём первый с непустыми метриками.
    const YANDEX_FALLBACK_BASES = ["msk", "ru", "spb"] as const;
    const GOOGLE_FALLBACK_BASES = ["gru", "goo_ru"] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isMeaningful = (dash: any): boolean => {
      if (!dash || typeof dash !== "object") return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = dash.data && typeof dash.data === "object" && !Array.isArray(dash.data) ? dash.data : dash;
      const traffic = Number(d.vis ?? d.traffic ?? 0);
      const top10 = Number(d.it10 ?? d.top10 ?? 0);
      const top50 = Number(d.it50 ?? d.top50 ?? 0);
      const keysCnt = Array.isArray(d.keys) ? d.keys.length : 0;
      return traffic > 0 || top10 > 0 || top50 > 0 || keysCnt > 0;
    };

    const fetchWithFallback = async (
      bases: readonly string[],
      label: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ dash: any; base: string } | null> => {
      for (const base of bases) {
        const url = `https://api.keys.so/report/simple/domain_dashboard?base=${base}&domain=${encodeURIComponent(cleanDomain)}`;
        const dash = await fetchJson(url, headers, 25000).catch(() => null);
        if (isMeaningful(dash)) {
          if (base !== bases[0]) {
            console.info(`[Key.so ${label}] ${domain} — данные найдены в fallback-регионе "${base}" (основной "${bases[0]}" был пуст)`);
          }
          return { dash, base };
        }
      }
      return null;
    };

    const [yResult, gResult] = await Promise.all([
      fetchWithFallback(YANDEX_FALLBACK_BASES, "Yandex"),
      fetchWithFallback(GOOGLE_FALLBACK_BASES, "Google"),
    ]);

    const yDash = yResult?.dash ?? null;
    const gDash = gResult?.dash ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseDashboard = (dash: any, label: string) => {
      if (!dash || typeof dash !== "object") return undefined;

      // Keys.so иногда заворачивает ответ в { data: {...} } — раскрываем.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = dash.data && typeof dash.data === "object" && !Array.isArray(dash.data)
        ? dash.data
        : dash;

      // Helper: пробует несколько имён полей по очереди (Keys.so меняет
      // схему, иногда `it10` иногда `top10`, иногда snake_case).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pick = (...keys: string[]): number => {
        for (const k of keys) {
          const v = d[k];
          if (v !== undefined && v !== null && v !== "") {
            const n = Number(v);
            if (!Number.isNaN(n)) return n;
          }
        }
        return 0;
      };

      // Competitors from concs[] — может называться competitors / concurents
      const compArr = Array.isArray(d.concs) ? d.concs
        : Array.isArray(d.competitors) ? d.competitors
        : Array.isArray(d.concurents) ? d.concurents
        : [];
      const competitors = compArr.slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => String(c?.name ?? c?.domain ?? c ?? "")).filter(Boolean);

      // Links from linksHistory — latest month entry: [backlinks, outlinks, ref_domains, out_domains, ip_links]
      let backlinks = 0, outboundLinks = 0, referringDomains = 0, outboundDomains = 0, ipLinks = 0;
      const linksHistory = d.linksHistory ?? d.links_history;
      if (linksHistory && typeof linksHistory === "object") {
        const months = Object.keys(linksHistory).sort().reverse();
        if (months.length > 0) {
          const latest = linksHistory[months[0]];
          if (Array.isArray(latest) && latest.length >= 5) {
            backlinks        = Number(latest[0]) || 0;
            outboundLinks    = Number(latest[1]) || 0;
            referringDomains = Number(latest[2]) || 0;
            outboundDomains  = Number(latest[3]) || 0;
            ipLinks          = Number(latest[4]) || 0;
          }
        }
      }

      const result = {
        traffic:         pick("vis", "traffic", "search_traffic", "searchTraffic"),
        visibility:      pick("topvis", "visibility", "topVisibility"),
        pagesInOrganic:  pick("pagesinindex", "pages_in_index", "pagesInIndex", "pages"),
        adKeys:          pick("adkeyscnt", "ad_keys", "adKeys"),
        competitors,
        top1:  pick("it1",  "top1",  "t1"),
        top3:  pick("it3",  "top3",  "t3"),
        top5:  pick("it5",  "top5",  "t5"),
        top10: pick("it10", "top10", "t10"),
        top50: pick("it50", "top50", "t50"),
        dr:    pick("dr", "domain_rating", "domainRating"),
        backlinks, outboundLinks, referringDomains, outboundDomains, ipLinks,
        aiMentions: pick("aiAnswersCnt", "ai_answers_cnt", "aiMentions", "ai_mentions"),
      };

      // Diagnostic — если ВСЕ метрики 0, логируем что прислал Keys.so
      // чтобы понять что за схему он вернул для этого домена.
      const allZero = result.traffic === 0 && result.pagesInOrganic === 0 &&
        result.top10 === 0 && result.top50 === 0 && result.backlinks === 0 && result.dr === 0;
      if (allZero) {
        const sampleKeys = Object.keys(d).slice(0, 25);
        console.warn(
          `[Key.so ${label}] all metrics zero for ${domain}. ` +
          `Got fields: [${sampleKeys.join(", ")}]. ` +
          `Sample values: ${JSON.stringify(Object.fromEntries(sampleKeys.slice(0, 6).map(k => [k, d[k]])))}`,
        );
      }

      return result;
    };

    // Keywords are directly in keys[] — each: { word, pos, ws (base freq), wsk (exact freq) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseKeywords = (dash: any): KeysoPosition[] => {
      if (!dash?.keys || !Array.isArray(dash.keys)) return [];
      return (dash.keys as Record<string, unknown>[])
        .map(item => ({
          keyword: String(item.word ?? ""),
          position: parseInt(String(item.pos ?? "0"), 10),
          volume: parseInt(String(item.wsk ?? item.ws ?? "0"), 10),
        }))
        .filter(p => p.keyword.length > 0 && p.position > 0 && p.position <= 100)
        .sort((a, b) => a.position - b.position);
    };

    const yDashParsed = parseDashboard(yDash, yResult?.base ?? "msk");
    const gDashParsed = parseDashboard(gDash, gResult?.base ?? "gru");

    if (!yDashParsed && !gDashParsed) {
      console.warn(`[Key.so] No data for ${domain} — Keys.so не нашёл домен ни в одном из регионов (Yandex msk/ru/spb, Google gru/goo_ru)`);
      return null;
    }

    return {
      yandex: parseKeywords(yDash),
      google:  parseKeywords(gDash),
      dashboard: {
        yandex: yDashParsed,
        google:  gDashParsed,
      },
    };
  } catch (err) {
    console.error(`[Key.so] Error for ${domain}:`, err);
    return null;
  }
}

// ─── Main enrichment function ─────────────────────────────────────────────────

export interface RealDomainData {
  domainAge: string | null;
  telegram: { subscribers: number; posts30d: number } | null;
  vk: { subscribers: number; posts30d: number; engagement: string; trend: string } | null;
  // pageSpeed теперь хранит mobile + desktop одновременно. UI решает что показать.
  pageSpeed: PageSpeedResult | null;
  pageSpeedDesktop: PageSpeedResult | null;
  wayback: WaybackResult | null;
  keyso: KeysoKeywords | null;
  /** SpyWords — дополнительная SEO-аналитика (overview, ads, competitors).
   *  Подтягивается только если SPYWORDS_LOGIN + SPYWORDS_TOKEN заданы в env. */
  spywords: import("./spywords-client").SpywordsData | null;
}

export interface RealCompanyData {
  hh: HHResult | null;
  dadata: DaDataResult | null;
  rusprofile: RusprofileResult | null;
  yandexRating: YandexRatingResult | null;
  gisRating: GisRatingResult | null;
  govContracts: GovContractsResult | null;
}

export async function enrichDomainData(
  domain: string,
  socialLinks: Record<string, string>
): Promise<RealDomainData> {
  const tgUrl = socialLinks.telegram ?? socialLinks.tg ?? null;
  const vkUrl = socialLinks.vk ?? null;
  const fullUrl = `https://${domain}`;

  // Динамический импорт, чтобы цикла зависимостей не было если client потащит чего-то странного
  const { getSpywordsData } = await import("./spywords-client");

  const [domainAge, telegram, vk, pageSpeedBoth, wayback, keyso, spywords] = await Promise.all([
    getRealDomainAge(domain).catch(() => null),
    tgUrl ? getRealTelegramStats(tgUrl).catch(() => null) : Promise.resolve(null),
    vkUrl ? getRealVKStats(vkUrl).catch(() => null) : Promise.resolve(null),
    getPageSpeedBoth(fullUrl).catch(() => null),
    getFirstArchiveDate(domain).catch(() => null),
    getKeysoKeywords(domain).catch(() => null),
    getSpywordsData(domain).catch(() => null),
  ]);

  return {
    domainAge,
    telegram,
    vk,
    pageSpeed: pageSpeedBoth?.mobile ?? null,
    pageSpeedDesktop: pageSpeedBoth?.desktop ?? null,
    wayback,
    keyso,
    spywords,
  };
}

export async function enrichCompanyData(
  companyName: string,
  domain: string
): Promise<RealCompanyData> {
  const [hh, dadata, rusprofile, yandexRating, gisRating] = await Promise.all([
    getRealHHData(companyName, domain).catch(() => null),
    getRealDaData(companyName, domain).catch(() => null),
    getRusprofileData(companyName).catch(() => null),
    getYandexRating(companyName, domain).catch(() => null),
    get2GisRating(companyName).catch(() => null),
  ]);

  const inn = dadata?.inn !== "—" ? dadata?.inn : undefined;
  const govContracts = await getGovContracts(companyName, inn).catch(() => null);

  return { hh, dadata, rusprofile, yandexRating, gisRating, govContracts };
}
