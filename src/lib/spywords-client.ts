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
const DEFAULT_TIMEOUT = 8000;

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
  /** До 50 объявлений конкурента в платной выдаче с метриками
   *  (keyword + позиция + Volume + CPC + competition). Это весь список
   *  ключевых слов в рекламе — то что SpyWords даёт на API Start. */
  topAds?: SpywordsAd[];
  /** Общие органические ключи с НАШИМ доменом — пересечение через FightOrganic.
   *  Это и есть «органические ключи конкурента» доступные на API Start. */
  commonOrganicKeys?: SpywordsFightKeyword[];
  /** Общие рекламные ключи с НАШИМ доменом — пересечение через FightAdv. */
  commonAdKeys?: SpywordsFightKeyword[];
  /** Side-by-side сравнение метрик нашего домена и конкурента. */
  fightOverview?: SpywordsFightOverview | null;
}

export interface SpywordsAd {
  keyword: string;
  /** Заголовок объявления. */
  title?: string;
  /** Текст объявления. */
  description?: string;
  /** Видимая ссылка. */
  visibleUrl?: string;
  /** Позиция (если есть). 1-7 для рекламной выдачи. */
  position?: number;
  /** Частотность запроса в месяц (Volume в API). */
  volume?: number;
  /** Цена клика по ключу — рекомендованная ставка ₽. */
  cpc?: number;
  /** Уровень конкуренции по запросу (KeyComp, 0-100). */
  competition?: number;
  /** Реальный URL посадочной страницы. */
  realUrl?: string;
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
  /** Умный подбор похожих запросов через SmartKeywords (по топ-1 ключу
   *  нашего домена). Заполняется только если у нас есть хоть один топ-ad-keyword. */
  smartKeywords?: SpywordsSmartKeyword[];
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
    const parts = adCopy.split(" / ").map(s => s.trim()).filter(Boolean);
    const title = parts[0];
    const description = parts.slice(1, -1).join(" • ") || parts[1];
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
      volume:      num(o.Volume) || undefined,
      cpc:         num(o.CPC) || undefined,
      competition: num(o.KeyComp) || undefined,
      realUrl:     o.RealURL || undefined,
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

// ─── Дополнительные методы API Start ──────────────────────────────────────

/** SmartKeywords — генерация похожих/тематических запросов из seed-ключа. */
export interface SpywordsSmartKeyword {
  keyword: string;
  volumeYandex: number;
  volumeBase: number;
  volumeTot: number;
  cpc: number;
  advTot: number;
  topic?: string;
  intent?: string;
}

export async function getSmartKeywords(seedKeyword: string, se: SearchEngine = "yandex", limit = 50): Promise<SpywordsSmartKeyword[]> {
  if (!hasCreds()) return [];
  const url = buildUrl("SmartKeywords", { word: seedKeyword, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  // Колонки: Keyword | Volume Yandex | VolumeBase Yandex | VolumeTot Yandex | YandexCPC | YandexAdvTot | Тип ключа | Тематика
  return objs.map(o => ({
    keyword:      o.Keyword ?? "",
    volumeYandex: num(o["Volume Yandex"] ?? o.Volume),
    volumeBase:   num(o["VolumeBase Yandex"] ?? o.VolumeBase),
    volumeTot:    num(o["VolumeTot Yandex"] ?? o.VolumeTot),
    cpc:          num(o.YandexCPC ?? o.CPC),
    advTot:       num(o.YandexAdvTot ?? o.AdvTot),
    topic:        Object.values(o).slice(-1)[0] || undefined,
    intent:       Object.values(o).slice(-2, -1)[0] || undefined,
  })).filter(k => k.keyword.length > 0);
}

/** KeywordOverview — общая статистика по запросу (объём, CPC, количество рекламодателей). */
export interface SpywordsKeywordOverview {
  yandex?: { volume: number; volumeBase: number; volumeTot: number; advTot: number; cpc: number };
  google?: { volume: number; volumeBase: number; volumeTot: number; advTot: number; cpc: number };
}

export async function getKeywordOverview(keyword: string): Promise<SpywordsKeywordOverview> {
  if (!hasCreds()) return {};
  const url = buildUrl("KeywordOverview", { word: keyword });
  const rows = await fetchTsv(url);
  if (!rows) return {};

  const objs = rowsToObjects(rows);
  const out: SpywordsKeywordOverview = {};
  for (const o of objs) {
    const seRaw = (o.SE ?? "").trim();
    const se: "yandex" | "google" | null =
      /Google/i.test(seRaw) ? "google" : seRaw.length > 0 ? "yandex" : null;
    if (!se) continue;
    out[se] = {
      volume:     num(o.Volume),
      volumeBase: num(o.VolumeBase),
      volumeTot:  num(o.VolumeTot),
      advTot:     num(o.AdvTot),
      cpc:        num(o.AvgCPC ?? o.CPC),
    };
  }
  return out;
}

/** KeywordAdv — кто РЕКЛАМИРУЕТСЯ по запросу. */
export interface SpywordsKeywordAdvertiser {
  domain: string;
  avgPos: number;
  totalKeys: number;
  adCopy?: string;
  url?: string;
}

export async function getKeywordAdvertisers(keyword: string, se: SearchEngine = "yandex", limit = 20): Promise<SpywordsKeywordAdvertiser[]> {
  if (!hasCreds()) return [];
  const url = buildUrl("KeywordAdv", { word: keyword, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => {
    const posRaw = o.AvgPos ?? "";
    const posMatch = posRaw.match(/\d+/);
    return {
      domain:    o.Domain ?? "",
      avgPos:    posMatch ? Number(posMatch[0]) : 0,
      totalKeys: num(o.KeysTot),
      adCopy:    o.AdCopy || undefined,
      url:       o.RealURL || undefined,
    };
  }).filter(a => a.domain.length > 0);
}

/** KeywordOrganic — кто РАНЖИРУЕТСЯ в органике по запросу. */
export interface SpywordsKeywordOrganicResult {
  position: number;
  domain: string;
  snippet?: string;
  domainKeys?: number;
  url?: string;
}

export async function getKeywordOrganic(keyword: string, se: SearchEngine = "yandex", limit = 20): Promise<SpywordsKeywordOrganicResult[]> {
  if (!hasCreds()) return [];
  const url = buildUrl("KeywordOrganic", { word: keyword, se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    position:   num(o.Pos),
    domain:     o.Domain ?? "",
    snippet:    o.Snippet || undefined,
    domainKeys: num(o["Domen words"] ?? o.DomenWords),
    url:        o.RealURL || undefined,
  })).filter(r => r.domain.length > 0 && r.position > 0);
}

// ─── Fight* методы — сравнение двух доменов ────────────────────────────────

/** FightOverview — side-by-side сравнение двух доменов. */
export interface SpywordsFightOverview {
  /** Метрики side1 / side2 по одинаковым параметрам (ключи в контексте, бюджет и т.д.). */
  metrics: Array<{ parameter: string; site1Value: string; site2Value: string }>;
}

export async function getFightOverview(site1: string, site2: string, se: SearchEngine = "yandex"): Promise<SpywordsFightOverview | null> {
  if (!hasCreds()) return null;
  const url = buildUrl("FightOverview", { site1, site2, se });
  const rows = await fetchTsv(url);
  if (!rows) return null;

  // Формат: Parameter | site1 | site2 — первая строка заголовки, дальше по строке на метрику
  if (rows.length < 2) return null;
  const metrics = rows.slice(1).map(r => ({
    parameter:  (r[0] ?? "").trim(),
    site1Value: (r[1] ?? "").trim(),
    site2Value: (r[2] ?? "").trim(),
  })).filter(m => m.parameter.length > 0);
  return { metrics };
}

/** FightAdv / FightOrganic — общие или уникальные ключи между двумя доменами. */
export interface SpywordsFightKeyword {
  keyword: string;
  volume: number;
  volumeTot: number;
  avgCpc?: number;
  /** Позиция site1 (для общих — позиции обоих, для уникальных — только одного). */
  site1Pos?: number;
  site1Url?: string;
  site2Pos?: number;
  site2Url?: string;
}

/**
 * sector: 1 = только site1, 2 = только site2, 12 = общие.
 * Для конкурентного анализа: sector=12 показывает общие ключи (по ним идёт прямая борьба).
 */
async function getFightKeywords(
  method: "FightAdv" | "FightOrganic",
  site1: string, site2: string,
  sector: 1 | 2 | 12,
  se: SearchEngine = "yandex",
  limit = 30,
): Promise<SpywordsFightKeyword[]> {
  if (!hasCreds()) return [];
  const url = buildUrl(method, { site1, site2, sector: String(sector), se, limit });
  const rows = await fetchTsv(url);
  if (!rows) return [];

  const objs = rowsToObjects(rows);
  return objs.map(o => ({
    keyword:    o.Keyword ?? "",
    volume:     num(o.Volume),
    volumeTot:  num(o.VolumeTot),
    avgCpc:     num(o.AvgCPC),
    // Колонки с именами доменов: `<domain>:Pos`, `<domain>:URL`, `<domain>:AdPos`.
    site1Pos:   pickPosByDomain(o, site1),
    site1Url:   pickUrlByDomain(o, site1),
    site2Pos:   pickPosByDomain(o, site2),
    site2Url:   pickUrlByDomain(o, site2),
  })).filter(k => k.keyword.length > 0).slice(0, limit);
}

function pickPosByDomain(o: Record<string, string>, domain: string): number | undefined {
  for (const sfx of ["Pos", "AdPos"]) {
    const key = `${domain}:${sfx}`;
    const v = o[key];
    if (v && v !== "") {
      const n = num(v);
      if (n > 0) return n;
      // CP1/CP2/CP3 — рекламная позиция, извлекаем цифру
      const m = v.match(/\d+/);
      if (m) return Number(m[0]);
    }
  }
  return undefined;
}

function pickUrlByDomain(o: Record<string, string>, domain: string): string | undefined {
  const v = o[`${domain}:URL`];
  return v && v !== "" ? v : undefined;
}

export async function getFightAdv(site1: string, site2: string, sector: 1 | 2 | 12, se: SearchEngine = "yandex", limit = 30): Promise<SpywordsFightKeyword[]> {
  return getFightKeywords("FightAdv", site1, site2, sector, se, limit);
}

export async function getFightOrganic(site1: string, site2: string, sector: 1 | 2 | 12, se: SearchEngine = "yandex", limit = 30): Promise<SpywordsFightKeyword[]> {
  return getFightKeywords("FightOrganic", site1, site2, sector, se, limit);
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
 *  Каждый конкурент = 2 доп. запроса × 2 ПС × 8s timeout каждый.
 *  ENRICH_TOP=3 уменьшает общее время на 40% по сравнению с 5 — критично
 *  чтобы не упереться в 60s timeout роутов /api/analyze. */
const ENRICH_TOP_COMPETITORS = 3;
const COMPETITOR_ADS_LIMIT = 25;

/**
 * Для top-N конкурентов параллельно дёргаем их DomainOverview + DomainAdv +
 * Fight* (общие ключи с нашим доменом). Это даёт полную картину:
 *   • метрики конкурента
 *   • его топ-объявления
 *   • органические/рекламные ключи где мы прямо конкурируем
 *   • side-by-side сравнение метрик
 */
async function enrichCompetitors(
  ourDomain: string,
  competitors: SpywordsCompetitor[],
  se: SearchEngine,
): Promise<SpywordsCompetitor[]> {
  const top = competitors.slice(0, ENRICH_TOP_COMPETITORS);

  await Promise.all(top.map(async c => {
    try {
      const [overview, ads, commonOrg, commonAds, fight] = await Promise.all([
        getDomainOverview(c.domain).catch(() => null),
        getDomainAds(c.domain, se, COMPETITOR_ADS_LIMIT).catch(() => [] as SpywordsAd[]),
        // sector=12 = общие ключи (по которым прямо конкурируем).
        // На FightOrganic API Start работает в обе стороны (наш ↔ конкурент)
        // в отличие от DomainOrganic, который требует платный тариф.
        getFightOrganic(ourDomain, c.domain, 12, se, 30).catch(() => [] as SpywordsFightKeyword[]),
        getFightAdv(ourDomain, c.domain, 12, se, 30).catch(() => [] as SpywordsFightKeyword[]),
        getFightOverview(ourDomain, c.domain, se).catch(() => null),
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
      if (commonOrg.length > 0) c.commonOrganicKeys = commonOrg;
      if (commonAds.length > 0) c.commonAdKeys = commonAds;
      if (fight) c.fightOverview = fight;
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

    // Шаг 2 — обогащаем топ-конкурентов их персональными метриками + объявлениями
    // + общими ключами с нашим доменом (FightOrganic / FightAdv / FightOverview).
    // Лимит на ВСЁ обогащение — 35s (5 параллельных вызовов на конкурента),
    // чтобы не упереться в 90s hard-limit роута. Если не успеем — оставим
    // конкурентов без enrichment, остальное вернём.
    await Promise.race([
      Promise.all([
        enrichCompetitors(cleanDomain, yCompetitors, "yandex"),
        enrichCompetitors(cleanDomain, gCompetitors, "google"),
      ]),
      new Promise(resolve => setTimeout(resolve, 35000)),
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

    // Шаг 3 — SmartKeywords по топ-1 ключу нашего рекламного домена.
    // Не блокируем основной результат — если упадёт, smartKeywords останется undefined.
    let smartKeywords: SpywordsSmartKeyword[] = [];
    const seedKeyword = yAds[0]?.keyword || gAds[0]?.keyword;
    if (seedKeyword) {
      smartKeywords = await getSmartKeywords(seedKeyword, "yandex", 30).catch(() => []);
    }

    return {
      overview,
      competitors:    { yandex: yCompetitors, google: gCompetitors },
      advCompetitors: { yandex: yAdvCompetitors, google: gAdvCompetitors },
      ads:            { yandex: yAds, google: gAds },
      topPages:       { yandex: yPages, google: gPages },
      smartKeywords:  smartKeywords.length > 0 ? smartKeywords : undefined,
      organic:        { yandex: yOrganic, google: gOrganic },
    };
  } catch (err) {
    console.error(`[spywords] getSpywordsData failed for ${cleanDomain}:`, err);
    return null;
  }
}
