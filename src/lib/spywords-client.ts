/**
 * SpyWords API client.
 *
 * Docs: https://spywords.ru/api_docs.php
 * Base URL: https://api.spywords.ru/?method=<Method>&login=<email>&token=<token>&...
 * Response format: TSV (Tab-Separated Values) with headers in first line.
 *
 * Auth: `SPYWORDS_LOGIN` + `SPYWORDS_TOKEN` env vars.
 *
 * На тарифе API Start доступны методы по доменам и ключевым словам.
 * Все вызовы делаем с timeout + try/catch — если что-то не работает,
 * UI получит null и просто не покажет блок.
 */

const SPYWORDS_BASE = "https://api.spywords.ru/?";
const DEFAULT_TIMEOUT = 12000;

type SearchEngine = "yandex" | "google";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hasCreds(): boolean {
  return !!(process.env.SPYWORDS_LOGIN && process.env.SPYWORDS_TOKEN);
}

function buildUrl(method: string, params: Record<string, string | number | undefined> = {}): string {
  const usp = new URLSearchParams();
  usp.set("method", method);
  usp.set("login", process.env.SPYWORDS_LOGIN ?? "");
  usp.set("token", process.env.SPYWORDS_TOKEN ?? "");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  return SPYWORDS_BASE + usp.toString();
}

async function fetchTsv(url: string, ms = DEFAULT_TIMEOUT): Promise<string[][] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "Accept": "text/plain,*/*", "User-Agent": "MarketRadar/1.0" },
    });
    if (!res.ok) {
      console.warn(`[spywords] HTTP ${res.status} for ${url.replace(/token=[^&]+/, "token=***")}`);
      return null;
    }
    const text = await res.text();

    // API часто возвращает JSON-ошибку при пустых тарифах / неверном токене / лимитах:
    // например: {"error":"low balance"}  или  {"error":"invalid token"}
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const j = JSON.parse(trimmed) as { error?: string };
        if (j.error) {
          console.warn(`[spywords] API error: ${j.error}`);
          return null;
        }
      } catch {
        /* not JSON */
      }
    }

    // Parse TSV: split lines, split each by tab. Skip empty lines.
    const rows = trimmed.split(/\r?\n/).filter(l => l.length > 0).map(l => l.split("\t"));
    if (rows.length === 0) return null;
    return rows;
  } catch (err) {
    console.warn(`[spywords] fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Зашить headers→indexed map для удобного доступа к колонкам по имени. */
function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
}

function num(v: string | undefined): number {
  if (!v) return 0;
  // SpyWords иногда возвращает "1 234" или "1,234.56" — снимаем пробелы и запятые
  const n = Number(v.replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

// ─── Public types ───────────────────────────────────────────────────────────

export interface SpywordsDomainOverview {
  /** Контекстная реклама в Яндексе. */
  yandex?: {
    visibility: number;       // Видимость по позициям в выдаче (если есть)
    organicKeywords: number;  // Ключи в органике
    organicTraffic: number;   // Трафик из органики
    adKeywords: number;       // Ключи в контексте
    adTraffic: number;        // Трафик из контекста
    adBudget: number;         // Бюджет на контекст ₽/мес
  };
  google?: {
    visibility: number;
    organicKeywords: number;
    organicTraffic: number;
    adKeywords: number;
    adTraffic: number;
    adBudget: number;
  };
}

export interface SpywordsCompetitor {
  domain: string;
  /** Пересечение ключей с нашим доменом. */
  commonKeywords: number;
  /** Всего ключей у конкурента (если приходит). */
  totalKeywords: number;
}

export interface SpywordsAd {
  keyword: string;
  /** Заголовок объявления. */
  title?: string;
  /** Текст объявления. */
  description?: string;
  /** Видимая ссылка. */
  visibleUrl?: string;
  /** Позиция (если есть). */
  position?: number;
}

export interface SpywordsOrganicPosition {
  keyword: string;
  position: number;
  /** Частотность запроса в месяц. */
  volume: number;
  /** URL страницы, ранжирующейся по этому запросу. */
  url?: string;
}

export interface SpywordsBalance {
  /** Остаток на счёте в рублях (или сколько запросов осталось — зависит от тарифа). */
  balance: number;
  /** Сырой текст ответа — для диагностики на случай если формат изменится. */
  raw: string;
}

export interface SpywordsData {
  overview: SpywordsDomainOverview;
  competitors: {
    yandex: SpywordsCompetitor[];
    google: SpywordsCompetitor[];
  };
  ads: {
    yandex: SpywordsAd[];
    google: SpywordsAd[];
  };
  /** Топ органических позиций (для дополнения Keys.so данных). */
  organic: {
    yandex: SpywordsOrganicPosition[];
    google: SpywordsOrganicPosition[];
  };
}

// ─── Individual methods ─────────────────────────────────────────────────────

/**
 * DomainOverview — общая статистика по домену в обоих поисковиках.
 * На API Start этот метод доступен.
 */
async function getDomainOverview(domain: string): Promise<SpywordsDomainOverview> {
  const url = buildUrl("DomainOverview", { site: domain });
  const rows = await fetchTsv(url);
  if (!rows) return {};

  const objs = rowsToObjects(rows);

  // Формат ответа DomainOverview бывает разный — иногда одна строка с парой колонок
  // (yandex_*, google_*), иногда две строки se=yandex / se=google. Поддерживаем оба.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grab = (o: any, ...keys: string[]): number => {
    for (const k of keys) {
      if (o[k] !== undefined && o[k] !== "") return num(o[k]);
    }
    return 0;
  };

  // Case A: одна строка с префиксами yandex_/google_
  if (objs.length === 1) {
    const o = objs[0];
    const yandex = {
      visibility:       grab(o, "yandex_visibility", "visibility_yandex"),
      organicKeywords:  grab(o, "yandex_organic_keywords", "organic_keywords_yandex", "organic_keys_yandex"),
      organicTraffic:   grab(o, "yandex_organic_traffic", "organic_traffic_yandex"),
      adKeywords:       grab(o, "yandex_adv_keywords", "adv_keywords_yandex", "adv_keys_yandex"),
      adTraffic:        grab(o, "yandex_adv_traffic", "adv_traffic_yandex"),
      adBudget:         grab(o, "yandex_adv_budget", "adv_budget_yandex"),
    };
    const google = {
      visibility:       grab(o, "google_visibility", "visibility_google"),
      organicKeywords:  grab(o, "google_organic_keywords", "organic_keywords_google", "organic_keys_google"),
      organicTraffic:   grab(o, "google_organic_traffic", "organic_traffic_google"),
      adKeywords:       grab(o, "google_adv_keywords", "adv_keywords_google", "adv_keys_google"),
      adTraffic:        grab(o, "google_adv_traffic", "adv_traffic_google"),
      adBudget:         grab(o, "google_adv_budget", "adv_budget_google"),
    };
    const out: SpywordsDomainOverview = {};
    if (yandex.organicKeywords + yandex.adKeywords > 0) out.yandex = yandex;
    if (google.organicKeywords + google.adKeywords > 0) out.google = google;
    return out;
  }

  // Case B: строки помечены `se`
  const out: SpywordsDomainOverview = {};
  for (const o of objs) {
    const se = (o.se ?? o.search_engine ?? "").toLowerCase();
    const block = {
      visibility:      grab(o, "visibility"),
      organicKeywords: grab(o, "organic_keywords", "organic_keys", "keywords_organic"),
      organicTraffic:  grab(o, "organic_traffic", "traffic_organic"),
      adKeywords:      grab(o, "adv_keywords", "adv_keys", "keywords_adv"),
      adTraffic:       grab(o, "adv_traffic", "traffic_adv"),
      adBudget:        grab(o, "adv_budget", "budget_adv", "budget"),
    };
    if (se === "yandex") out.yandex = block;
    else if (se === "google") out.google = block;
  }
  return out;
}

/**
 * DomainOrganicCompetitors — список доменов-конкурентов в органике.
 */
async function getOrganicCompetitors(domain: string, se: SearchEngine, limit = 10): Promise<SpywordsCompetitor[]> {
  const url = buildUrl("DomainOrganicCompetitors", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    domain: o.domain ?? o.site ?? o.competitor ?? "",
    commonKeywords: num(o.common_keywords ?? o.intersect ?? o.common ?? ""),
    totalKeywords:  num(o.total_keywords ?? o.keywords ?? o.organic_keywords ?? ""),
  })).filter(c => c.domain.length > 0).slice(0, limit);
}

/**
 * DomainAdv — объявления домена в контекстной рекламе.
 */
async function getDomainAds(domain: string, se: SearchEngine, limit = 10): Promise<SpywordsAd[]> {
  const url = buildUrl("DomainAdv", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    keyword:     o.keyword ?? o.phrase ?? o.query ?? "",
    title:       o.title ?? o.ad_title ?? undefined,
    description: o.text ?? o.description ?? o.ad_text ?? undefined,
    visibleUrl:  o.visible_url ?? o.url ?? undefined,
    position:    o.position ? num(o.position) : undefined,
  })).filter(a => a.keyword.length > 0).slice(0, limit);
}

/**
 * DomainOrganic — топ-позиции домена в органике.
 */
async function getDomainOrganic(domain: string, se: SearchEngine, limit = 20): Promise<SpywordsOrganicPosition[]> {
  const url = buildUrl("DomainOrganic", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    keyword:  o.keyword ?? o.phrase ?? o.query ?? "",
    position: num(o.position ?? o.pos ?? "0"),
    volume:   num(o.frequency ?? o.volume ?? o.ws ?? "0"),
    url:      o.url ?? undefined,
  })).filter(p => p.keyword.length > 0 && p.position > 0 && p.position <= 100).slice(0, limit);
}

/**
 * Balance — остаток на счёте. Удобно для health-check в логе.
 */
export async function getSpywordsBalance(): Promise<SpywordsBalance | null> {
  if (!hasCreds()) return null;
  const url = buildUrl("Balance");
  const rows = await fetchTsv(url);
  if (!rows || rows.length === 0) return null;
  // Часто это просто одна строка с числом
  const raw = rows.flat().join("\t");
  const m = raw.match(/-?\d+(\.\d+)?/);
  const balance = m ? Number(m[0]) : 0;
  return { balance, raw };
}

// ─── High-level: одна функция, дёргающая всё нужное параллельно ────────────

/**
 * Тянем всю Spywords-аналитику по домену одним вызовом.
 * Каждый внутренний метод обёрнут — если что-то не сработало, в выдаче
 * будет пустой массив/объект, остальное при этом отдастся пользователю.
 */
export async function getSpywordsData(domain: string): Promise<SpywordsData | null> {
  if (!hasCreds()) return null;

  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  if (!cleanDomain) return null;

  try {
    const [overview, yCompetitors, gCompetitors, yAds, gAds, yOrganic, gOrganic] = await Promise.all([
      getDomainOverview(cleanDomain).catch(() => ({} as SpywordsDomainOverview)),
      getOrganicCompetitors(cleanDomain, "yandex").catch(() => [] as SpywordsCompetitor[]),
      getOrganicCompetitors(cleanDomain, "google").catch(() => [] as SpywordsCompetitor[]),
      getDomainAds(cleanDomain, "yandex").catch(() => [] as SpywordsAd[]),
      getDomainAds(cleanDomain, "google").catch(() => [] as SpywordsAd[]),
      getDomainOrganic(cleanDomain, "yandex").catch(() => [] as SpywordsOrganicPosition[]),
      getDomainOrganic(cleanDomain, "google").catch(() => [] as SpywordsOrganicPosition[]),
    ]);

    // Если вообще ничего нет — возвращаем null, чтобы UI не показывал пустой блок.
    const hasAnything =
      !!overview.yandex || !!overview.google ||
      yCompetitors.length > 0 || gCompetitors.length > 0 ||
      yAds.length > 0 || gAds.length > 0 ||
      yOrganic.length > 0 || gOrganic.length > 0;

    if (!hasAnything) {
      console.warn(`[spywords] No data for ${cleanDomain}`);
      return null;
    }

    return {
      overview,
      competitors: { yandex: yCompetitors, google: gCompetitors },
      ads:         { yandex: yAds, google: gAds },
      organic:     { yandex: yOrganic, google: gOrganic },
    };
  } catch (err) {
    console.error(`[spywords] getSpywordsData failed for ${cleanDomain}:`, err);
    return null;
  }
}
