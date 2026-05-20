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

/** SpyWords отдаёт TSV в Windows-1251 (cp1251). Декодируем вручную. */
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

    // Декодируем как cp1251. У SpyWords latin-only методы тоже cp1251-совместимы,
    // поэтому это безопасно для всех ответов.
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("windows-1251").decode(buf);
    const trimmed = text.trim();

    // API сигналит ошибки plain-текстом по-русски:
    //   «Для запрашиваемой выборки доступен платный тариф :(»  — метод не входит в API Start
    //   «Неверный токен» / «Недостаточно средств» — auth / balance
    // Распознаём по отсутствию табов в первой строке + русскому тексту.
    const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
    if (!firstLine.includes("\t") && /[А-Яа-я]/.test(firstLine)) {
      console.warn(`[spywords] API msg: ${firstLine.slice(0, 120)}`);
      return null;
    }

    // На всякий случай — JSON-ошибки (если формат поменяется).
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
    organicKeysTop10: number; // Top10KeysOrgTot — ключей в топ-10 органики
    organicKeysTop50: number; // Top50KeysOrgTot — ключей в топ-50 органики
    organicTraffic: number;   // OrgTraf — оценочный месячный трафик из органики
    adKeywords: number;       // KeysAdTot — ключей в контексте
    uniqueAds: number;        // TotUniqAds — уникальных объявлений
    avgAdPos: number;         // AvgAdPos — средняя позиция объявлений
    adTraffic: number;        // AdTraf — трафик из контекста
    adBudget: number;         // AdSpend — бюджет на контекст ₽/мес
  };
  google?: {
    organicKeysTop10: number;
    organicKeysTop50: number;
    organicTraffic: number;
    adKeywords: number;
    uniqueAds: number;
    avgAdPos: number;
    adTraffic: number;
    adBudget: number;
  };
}

export interface SpywordsCompetitor {
  domain: string;
  /** Пересечение ключей с нашим доменом (в органике или контексте — зависит от
   *  типа конкурента: organic vs adv). */
  commonKeywords: number;
  /** Сколько у конкурента всего ключей в выдаче (топ-50 органики или ключей в контексте). */
  totalKeywords: number;
  /** Сколько у конкурента уникальных ключей (которые есть у него, но нет у нас). */
  uniqueKeywords?: number;
  /** Уровень конкуренции с нами в процентах (по SpyWords). 0-100. */
  competitionLevel?: number;
  /** Обогащённые данные — overview этого конкурента (organic + adv метрики).
   *  Заполняется только для топ-N конкурентов чтобы не палить лимит на API. */
  overview?: {
    organicKeysTop10: number;
    organicKeysTop50: number;
    organicTraffic: number;
    adKeywords: number;
    uniqueAds: number;
    adTraffic: number;
    adBudget: number;
  };
  /** Топ-3 объявлений этого конкурента в платной выдаче. */
  topAds?: SpywordsAd[];
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

/** Страница домена с метриками — DomainUrl. */
export interface SpywordsDomainUrl {
  /** Полный URL страницы. */
  url: string;
  /** Title страницы (как видит SpyWords при индексации). */
  title: string;
  /** Сколько ключей с этой страницы в топ-10 органики. */
  top10Keys: number;
  /** Сколько ключей в топ-50 органики. */
  top50Keys: number;
  /** Сколько ключей страница ПОТЕРЯЛА с предыдущего обновления базы. */
  lostKeys: number;
  /** Доля трафика домена, который приходится на эту страницу (%). */
  trafficShare: number;
}

export interface SpywordsData {
  overview: SpywordsDomainOverview;
  /** SEO-конкуренты (пересекаются с нашим доменом в органической выдаче). */
  competitors: {
    yandex: SpywordsCompetitor[];
    google: SpywordsCompetitor[];
  };
  /** Рекламные конкуренты (пересекаются с нашим доменом в платной выдаче).
   *  Отдельный список — рекламные и органические конкуренты часто разные. */
  advCompetitors?: {
    yandex: SpywordsCompetitor[];
    google: SpywordsCompetitor[];
  };
  /** Наши объявления в платной выдаче. */
  ads: {
    yandex: SpywordsAd[];
    google: SpywordsAd[];
  };
  /** Топ страниц домена по органике с метриками. */
  topPages?: {
    yandex: SpywordsDomainUrl[];
    google: SpywordsDomainUrl[];
  };
  /** Топ органических позиций (для дополнения Keys.so данных).
   *  ⚠️ На API Start метод недоступен (платный тариф). */
  organic: {
    yandex: SpywordsOrganicPosition[];
    google: SpywordsOrganicPosition[];
  };
}

// ─── Individual methods ─────────────────────────────────────────────────────

/**
 * DomainOverview — общая статистика по домену в обоих поисковиках.
 * На API Start этот метод доступен.
 *
 * Формат ответа (TSV, cp1251):
 *   SE | KeysAdTot | TotUniqAds | AvgAdPos | AdSpend | AdTraf | Top50KeysOrgTot | Top10KeysOrgTot | OrgTraf | Уникальных url
 *   Яндекс | 9408 | 4405 | 1 | 47 031,20 | 28144 | 73 712 | 23111 | 47 763 | 3 101
 *   Google | 0   |      |   | 0         | 69687 | 17627  | 15 057 | 4 958
 *
 * Колонка SE приходит в cp1251. Распознаём по подстроке: «нд» → yandex, "Google" → google.
 */
async function getDomainOverview(domain: string): Promise<SpywordsDomainOverview> {
  const url = buildUrl("DomainOverview", { site: domain });
  const rows = await fetchTsv(url);
  if (!rows) return {};

  const objs = rowsToObjects(rows);
  const out: SpywordsDomainOverview = {};

  for (const o of objs) {
    const seRaw = (o.SE ?? o.se ?? "").trim();
    // «Яндекс» латиницей точно не пишут — определяем по наличию русских букв.
    const se: "yandex" | "google" | null =
      /Google/i.test(seRaw) ? "google" :
      seRaw.length > 0 ? "yandex" : null;
    if (!se) continue;

    const block = {
      organicKeysTop10: num(o.Top10KeysOrgTot),
      organicKeysTop50: num(o.Top50KeysOrgTot),
      organicTraffic:   num(o.OrgTraf),
      adKeywords:       num(o.KeysAdTot),
      uniqueAds:        num(o.TotUniqAds),
      avgAdPos:         num(o.AvgAdPos),
      adTraffic:        num(o.AdTraf),
      adBudget:         num(o.AdSpend),
    };

    // Пропускаем строки где вообще ничего нет (Google без рекламы и без органики).
    const hasAny =
      block.organicKeysTop50 + block.organicKeysTop10 + block.organicTraffic +
      block.adKeywords + block.adTraffic + block.adBudget > 0;
    if (!hasAny) continue;

    out[se] = block;
  }
  return out;
}

/**
 * DomainOrganicCompetitors — список доменов-конкурентов в органике.
 *
 * Колонки: Domain | Competition Level, % | KeyOverlap | Unique Keys |
 *          Top50KeysOrgTot | Top10KeysOrgTot | OrgTraf
 */
async function getOrganicCompetitors(domain: string, se: SearchEngine, limit = 10): Promise<SpywordsCompetitor[]> {
  const url = buildUrl("DomainOrganicCompetitors", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    domain:           o.Domain ?? o.domain ?? "",
    commonKeywords:   num(o.KeyOverlap),
    totalKeywords:    num(o.Top50KeysOrgTot),
    uniqueKeywords:   num(o["Unique Keys"] ?? o.UniqueKeys),
    competitionLevel: num(o["Competition Level, %"] ?? o.CompetitionLevel),
  })).filter(c => c.domain.length > 0).slice(0, limit);
}

/**
 * DomainAdvCompetitors — конкуренты в платной выдаче (Я.Директ / Google Ads).
 * Часто это совсем другой список чем органические конкуренты — рекламодатели
 * выкупают наши же ключи. Доступен на API Start.
 *
 * Колонки: Domain | Competition Level, % | KeyOverlap | Unique Keys | KeysTot | TotUniqAds | AvgPos | AdTraf
 */
async function getAdvCompetitors(domain: string, se: SearchEngine, limit = 10): Promise<SpywordsCompetitor[]> {
  const url = buildUrl("DomainAdvCompetitors", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    domain:           o.Domain ?? "",
    commonKeywords:   num(o.KeyOverlap),
    totalKeywords:    num(o.KeysTot),
    uniqueKeywords:   num(o["Unique Keys"] ?? o.UniqueKeys),
    competitionLevel: num(o["Competition Level, %"] ?? o.CompetitionLevel),
  })).filter(c => c.domain.length > 0).slice(0, limit);
}

/**
 * DomainUrl — топ страниц домена по органике.
 * Доступен на API Start. Полезен для понимания «какая страница приносит трафик».
 *
 * Колонки: URL | UrlTitle | Top10KeysOrgTot | Top50KeysOrgTot | TotWordLost | TraffShare % | (раздел?) | URL ID
 */
async function getDomainTopPages(domain: string, se: SearchEngine, limit = 15): Promise<SpywordsDomainUrl[]> {
  const url = buildUrl("DomainUrl", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    url:           o.URL ?? "",
    title:         o.UrlTitle ?? "",
    top10Keys:     num(o.Top10KeysOrgTot),
    top50Keys:     num(o.Top50KeysOrgTot),
    lostKeys:      num(o.TotWordLost),
    trafficShare:  num(o["TraffShare %"] ?? o.TraffShare),
  })).filter(p => p.url.length > 0).slice(0, limit);
}

/**
 * DomainAdv — объявления домена в контекстной рекламе.
 *
 * Колонки: Keyword | AdCopy | Pos | Volume | VolumeBase | VolumeTot | CPC | TraffShare % | KeyComp | RealURL
 * AdCopy: «Заголовок / Описание / VisibleURL Заголовок-2» — разделители ` / `.
 * Pos формата "CP1"/"CP2" — спецпозиция, число извлекаем.
 */
async function getDomainAds(domain: string, se: SearchEngine, limit = 10): Promise<SpywordsAd[]> {
  const url = buildUrl("DomainAdv", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => {
    const adCopy = o.AdCopy ?? "";
    // Разбиваем AdCopy: первая часть — заголовок, последующие — описание / vis.url
    const parts = adCopy.split(" / ").map(s => s.trim()).filter(Boolean);
    const title = parts[0];
    const description = parts.slice(1, -1).join(" • ") || parts[1];
    // Последний фрагмент обычно содержит видимую ссылку (без http) + дублирующее имя — берём первый «домен-выглядящий» токен.
    const lastPart = parts[parts.length - 1] ?? "";
    const visibleUrl = lastPart.split(/\s+/)[0];

    const posRaw = o.Pos ?? "";
    const posMatch = posRaw.match(/\d+/);
    const position = posMatch ? Number(posMatch[0]) : undefined;

    return {
      keyword:     o.Keyword ?? "",
      title:       title || undefined,
      description: description || undefined,
      visibleUrl:  visibleUrl || undefined,
      position,
    };
  }).filter(a => a.keyword.length > 0).slice(0, limit);
}

/**
 * DomainOrganic — топ-позиции домена в органике.
 * ⚠️ На тарифе API Start метод недоступен (возвращает «Для запрашиваемой
 * выборки доступен платный тариф :(»). Оставляем для будущего апгрейда.
 */
async function getDomainOrganic(domain: string, se: SearchEngine, limit = 20): Promise<SpywordsOrganicPosition[]> {
  const url = buildUrl("DomainOrganic", { site: domain, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    keyword:  o.Keyword ?? o.keyword ?? "",
    position: num(o.Pos ?? o.position ?? "0"),
    volume:   num(o.Volume ?? o.frequency ?? "0"),
    url:      o.RealURL ?? o.url ?? undefined,
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
/** Сколько топ-конкурентов обогащать индивидуальными вызовами (overview + ads).
 *  Каждый конкурент = 2 доп. запроса к API (Overview + Ads), на каждый ПС = ×2.
 *  ENRICH_TOP=5 = 5*2*2 = 20 запросов. На балансе 1 млн юнитов это ничего. */
const ENRICH_TOP_COMPETITORS = 5;

/**
 * Для top-N конкурентов параллельно дёргаем их DomainOverview + DomainAdv,
 * чтобы дашборд показывал «не только что они конкуренты, но и насколько
 * больше у них трафика, сколько ключей в рекламе, какие топ-объявления».
 */
async function enrichCompetitors(
  competitors: SpywordsCompetitor[],
  se: SearchEngine,
): Promise<SpywordsCompetitor[]> {
  const top = competitors.slice(0, ENRICH_TOP_COMPETITORS);

  await Promise.all(top.map(async c => {
    try {
      const [overview, ads] = await Promise.all([
        getDomainOverview(c.domain).catch(() => null),
        getDomainAds(c.domain, se, 3).catch(() => [] as SpywordsAd[]),
      ]);
      if (overview && overview[se]) {
        const o = overview[se]!;
        c.overview = {
          organicKeysTop10: o.organicKeysTop10,
          organicKeysTop50: o.organicKeysTop50,
          organicTraffic:   o.organicTraffic,
          adKeywords:       o.adKeywords,
          uniqueAds:        o.uniqueAds,
          adTraffic:        o.adTraffic,
          adBudget:         o.adBudget,
        };
      }
      if (ads.length > 0) c.topAds = ads;
    } catch { /* skip this competitor on error, оставляем без enrichment */ }
  }));

  return competitors;
}

export async function getSpywordsData(domain: string): Promise<SpywordsData | null> {
  if (!hasCreds()) return null;

  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  if (!cleanDomain) return null;

  try {
    // Шаг 1 — базовые вызовы параллельно (то что было раньше + новые).
    const [
      overview,
      yCompetitors, gCompetitors,
      yAdvCompetitors, gAdvCompetitors,
      yAds, gAds,
      yOrganic, gOrganic,
      yPages, gPages,
    ] = await Promise.all([
      getDomainOverview(cleanDomain).catch(() => ({} as SpywordsDomainOverview)),
      getOrganicCompetitors(cleanDomain, "yandex").catch(() => [] as SpywordsCompetitor[]),
      getOrganicCompetitors(cleanDomain, "google").catch(() => [] as SpywordsCompetitor[]),
      getAdvCompetitors(cleanDomain, "yandex").catch(() => [] as SpywordsCompetitor[]),
      getAdvCompetitors(cleanDomain, "google").catch(() => [] as SpywordsCompetitor[]),
      getDomainAds(cleanDomain, "yandex").catch(() => [] as SpywordsAd[]),
      getDomainAds(cleanDomain, "google").catch(() => [] as SpywordsAd[]),
      getDomainOrganic(cleanDomain, "yandex").catch(() => [] as SpywordsOrganicPosition[]),
      getDomainOrganic(cleanDomain, "google").catch(() => [] as SpywordsOrganicPosition[]),
      getDomainTopPages(cleanDomain, "yandex").catch(() => [] as SpywordsDomainUrl[]),
      getDomainTopPages(cleanDomain, "google").catch(() => [] as SpywordsDomainUrl[]),
    ]);

    // Шаг 2 — обогащаем топ-конкурентов их персональными метриками + объявлениями.
    // Каждый конкурент = 2 доп. вызова, лимит ENRICH_TOP_COMPETITORS.
    await Promise.all([
      enrichCompetitors(yCompetitors, "yandex"),
      enrichCompetitors(gCompetitors, "google"),
    ]);

    const hasAnything =
      !!overview.yandex || !!overview.google ||
      yCompetitors.length > 0 || gCompetitors.length > 0 ||
      yAdvCompetitors.length > 0 || gAdvCompetitors.length > 0 ||
      yAds.length > 0 || gAds.length > 0 ||
      yPages.length > 0 || gPages.length > 0;

    if (!hasAnything) {
      console.warn(`[spywords] No data for ${cleanDomain}`);
      return null;
    }

    return {
      overview,
      competitors:    { yandex: yCompetitors, google: gCompetitors },
      advCompetitors: { yandex: yAdvCompetitors, google: gAdvCompetitors },
      ads:            { yandex: yAds, google: gAds },
      topPages:       { yandex: yPages, google: gPages },
      organic:        { yandex: yOrganic, google: gOrganic },
    };
  } catch (err) {
    console.error(`[spywords] getSpywordsData failed for ${cleanDomain}:`, err);
    return null;
  }
}
