/**
 * Букварикс — база ключевых слов и семантики доменов.
 *
 * Зачем: бесплатный источник частотности (широкая + точная) и семантики
 * конкурентов по РФ-регионам. Закрывает то, за что сейчас платим Key.so:
 * ключи домена, пересечение и уникальные запросы двух доменов.
 *
 * Ключ: BUKVARIX_API_KEY, по умолчанию публичный "free". Бесплатный ключ
 * работает без регистрации, но с лимитами уровня незалогиненного аккаунта
 * (до 100 фраз в списочном поиске, до 10 доменов в мультисравнении) и без
 * фильтров broad_from/exact_from/words_from — с ними бесплатный ключ отдаёт
 * 402. Поэтому фильтрация здесь делается КОДОМ после получения данных.
 *
 * Документация: https://www.bukvarix.com/api.html
 */

const BASE = "https://api.bukvarix.com/v1";
const API_KEY = process.env.BUKVARIX_API_KEY || "free";
const TIMEOUT_MS = 25_000;

/** Регионы поисковой выдачи. Полный список — в доке; здесь то, что реально нужно. */
export type BukvarixRegion =
  | "msk" | "spb" | "rus" | "gmsk"
  | "nsk" | "ekb" | "kzn" | "nnv" | "kry" | "che" | "sam" | "ufa"
  | "rnd" | "krr" | "oms" | "vrn" | "prm" | "vlg" | "sar" | "tmn" | "tom"
  | "minsk" | "gminsk" | "nursul" | "gkiev";

export interface BukvarixKeyword {
  keyword: string;
  words: number;
  chars: number;
  /** Широкая частотность, регион «Весь мир». */
  broadFreq: number;
  /** Точная частотность («!фраза»), регион «Весь мир». */
  exactFreq: number;
}

export interface BukvarixDomainKeyword extends BukvarixKeyword {
  /** Количество результатов в поисковой машине по этой фразе. */
  resultsInSe: number;
  /** Позиция домена в выдаче по этой фразе. */
  position: number;
}

export class BukvarixError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "BukvarixError";
  }
}

function explain(status: number): string {
  switch (status) {
    case 400: return "неверные параметры запроса";
    case 401: return "неверный или заблокированный ключ API";
    case 402: return "превышены лимиты бесплатного ключа";
    case 429: return "слишком часто — нужна пауза";
    case 503: return "на стороне Букварикса плановые работы";
    default: return `HTTP ${status}`;
  }
}

/**
 * Один запрос к API. На 429 делает одну повторную попытку через 2 секунды:
 * документация прямо говорит «сделайте паузу и повторите», а разовый всплеск
 * при параллельном разборе конкурентов — нормальная ситуация, ронять из-за
 * неё весь анализ незачем.
 */
async function call(path: string, params: Record<string, string>, retry = true): Promise<unknown[][]> {
  const qs = new URLSearchParams({ ...params, api_key: API_KEY, format: "json" });
  const res = await fetch(`${BASE}${path}?${qs}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (res.status === 429 && retry) {
    await new Promise(r => setTimeout(r, 2000));
    return call(path, params, false);
  }
  if (!res.ok) throw new BukvarixError(res.status, `Букварикс: ${explain(res.status)}`);

  const json = await res.json().catch(() => null) as { data?: unknown[][] } | null;
  return Array.isArray(json?.data) ? json.data : [];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Порядок колонок ВАЖЕН и отличается от того, что перечислено в документации:
 * у site/ «Результатов в Яндексе» идёт вторым полем, а не после символов.
 * Проверено запросом format=csv&header=1 — не менять по памяти, только сверив
 * с живым ответом, иначе частотность молча уедет в колонку позиции.
 *
 * keywords/ : Ключевое слово; Слов; Символов; Частотность; !Точная частотность
 * site/     : Ключевое слово; Результатов в ПС; Слов; Символов; Частотность; !Точная; Позиция
 */
const rowToKeyword = (r: unknown[]): BukvarixKeyword => ({
  keyword: String(r[0] ?? ""),
  words: num(r[1]),
  chars: num(r[2]),
  broadFreq: num(r[3]),
  exactFreq: num(r[4]),
});

const rowToDomainKeyword = (r: unknown[]): BukvarixDomainKeyword => ({
  keyword: String(r[0] ?? ""),
  resultsInSe: num(r[1]),
  words: num(r[2]),
  chars: num(r[3]),
  broadFreq: num(r[4]),
  exactFreq: num(r[5]),
  position: num(r[6]),
});

/** Подбор ключевых слов по одной фразе — расширение семантики. */
export async function bukvarixKeywords(
  phrase: string,
  opts: { limit?: number } = {},
): Promise<BukvarixKeyword[]> {
  const q = phrase.trim();
  if (!q) return [];
  const rows = await call("/keywords/", { q, num: String(opts.limit ?? 250) });
  return rows.map(rowToKeyword).filter(k => k.keyword);
}

/**
 * Семантика домена: по каким запросам он виден и на каких позициях.
 * Домен передаётся без протокола и пути — API принимает только хост.
 */
export async function bukvarixDomainKeywords(
  domain: string,
  opts: { limit?: number; region?: BukvarixRegion } = {},
): Promise<BukvarixDomainKeyword[]> {
  const q = normalizeDomain(domain);
  if (!q) return [];
  const rows = await call("/site/", {
    q,
    num: String(opts.limit ?? 250),
    region: opts.region ?? "msk",
  });
  return rows.map(rowToDomainKeyword).filter(k => k.keyword);
}

/**
 * Сравнение двух доменов.
 *  - intersect     — общие запросы (где конкурируем напрямую);
 *  - domain1_uniq  — есть у первого, нет у второго;
 *  - domain2_uniq  — есть у второго, нет у первого. Это и есть «что забираем
 *                    себе»: спрос, который конкурент собирает, а мы нет.
 */
export async function bukvarixCompareDomains(
  domain: string,
  rival: string,
  opts: { type?: "intersect" | "domain1_uniq" | "domain2_uniq"; limit?: number; region?: BukvarixRegion } = {},
): Promise<BukvarixDomainKeyword[]> {
  const q = normalizeDomain(domain);
  const q2 = normalizeDomain(rival);
  if (!q || !q2) return [];
  const rows = await call("/site_cmp/", {
    q, q2,
    comparison_type: opts.type ?? "intersect",
    num: String(opts.limit ?? 250),
    region: opts.region ?? "msk",
  });
  return rows.map(rowToDomainKeyword).filter(k => k.keyword);
}

/**
 * Приводит ввод к тому, что ждёт API: голый хост без схемы, пути и www.
 * Кириллические домены оставляем кириллицей — доке нужен именно percent-encoded
 * кириллический хост, а не punycode, и URLSearchParams сделает это сам.
 */
export function normalizeDomain(input: string): string {
  let s = String(input || "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");   // схема
  s = s.split("/")[0].split("?")[0].split("#")[0]; // путь/квери/якорь
  s = s.replace(/:\d+$/, "");                      // порт
  s = s.replace(/^www\./, "");
  return s;
}
