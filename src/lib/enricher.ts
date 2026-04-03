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
    // Extract group screen name
    const match = vkUrl.match(/vk\.com\/([a-zA-Z0-9_.]+)/);
    if (!match || match[1] === "share") return null;
    const screenName = match[1];

    // Use public VK widget stats endpoint (no auth needed)
    const html = await fetchHtml(`https://vk.com/${screenName}`);

    // Parse followers/members count
    const patterns = [
      /(\d[\d\s]+)\s*(?:подписчик|участник|follower|member)/i,
      /"members_count":(\d+)/i,
      /followers_count['":\s]+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m) {
        const raw = m[1].replace(/\s/g, "");
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0 && n < 100_000_000) {
          return {
            subscribers: n,
            posts30d: 0, // hard to extract without API
            engagement: "—",
            trend: "stable",
          };
        }
      }
    }

    return null;
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
      const addr = String((s.data?.address as Record<string,unknown>)?.value ?? "").toLowerCase();
      if (name.includes(companyName.toLowerCase().slice(0, 6)) ||
          addr.includes(domain.replace(/\.[a-z]+$/, ""))) {
        best = s;
        break;
      }
    }

    const d = best.data;

    // Legal form
    const opfShort = String((d?.opf as Record<string,unknown>)?.short ?? "");
    const type = String(d?.type ?? "");
    const legalForm = opfShort || (type === "INDIVIDUAL" ? "ИП" : type === "LEGAL" ? "ООО" : "—");

    // Registration date
    let registrationDate = "—";
    const regDateMs = Number((d?.state as Record<string,unknown>)?.registration_date);
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
    const finance = d?.finance as Record<string,unknown> | undefined;
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
    const statusRaw = String((d?.state as Record<string,unknown>)?.status ?? "");
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
      address: String((d?.address as Record<string,unknown>)?.value ?? "—"),
      registrationDate,
      employees,
      revenue,
      status,
    };
  } catch {
    return null;
  }
}

// ─── Main enrichment function ─────────────────────────────────────────────────

export interface RealData {
  domainAge: string | null;
  hh: HHResult | null;
  telegram: { subscribers: number; posts30d: number } | null;
  vk: { subscribers: number; posts30d: number; engagement: string; trend: string } | null;
  dadata: DaDataResult | null;
}

export async function enrichWithRealData(
  companyName: string,
  domain: string,
  socialLinks: Record<string, string>
): Promise<RealData> {
  const tgUrl = socialLinks.telegram ?? socialLinks.tg ?? null;
  const vkUrl = socialLinks.vk ?? null;

  // All API calls in parallel, graceful fallbacks on any failure
  const [domainAge, hh, telegram, vk, dadata] = await Promise.all([
    getRealDomainAge(domain).catch(() => null),
    getRealHHData(companyName, domain).catch(() => null),
    tgUrl ? getRealTelegramStats(tgUrl).catch(() => null) : Promise.resolve(null),
    vkUrl ? getRealVKStats(vkUrl).catch(() => null) : Promise.resolve(null),
    getRealDaData(companyName, domain).catch(() => null),
  ]);

  return { domainAge, hh, telegram, vk, dadata };
}
