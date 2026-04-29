/**
 * Keys.so API client — общий обёртчик для всех вызовов
 *
 * Документация: https://apidoc.keys.so/
 *
 * Авторизация: header `X-Keyso-TOKEN: <token>` (тот же что в существующем enricher.ts)
 * Регионы (base):
 *   msk     — Яндекс Москва
 *   spb     — Яндекс СПб
 *   ru      — Яндекс Россия (агрегат)
 *   goo_ru  — Google Россия
 *   gru     — Google Russia (legacy alias)
 */

const KEYSO_BASE_URL = "https://api.keys.so";
const KEYSO_TIMEOUT_MS = 25000;

export type KeysoBase = "msk" | "spb" | "ru" | "goo_ru" | "gru";

/** Низкоуровневый запрос к Keys.so. Возвращает null при ошибке (не бросает).
 *  method: "GET" (default) кладёт params в query string; "POST" — в JSON body.
 */
export async function keysoFetch<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  method: "GET" | "POST" = "GET",
): Promise<T | null> {
  const token = process.env.KEYSO_API_TOKEN;
  if (!token) {
    console.warn("[Keyso] KEYSO_API_TOKEN не задан");
    return null;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KEYSO_TIMEOUT_MS);

  let url: string;
  let fetchInit: RequestInit;

  if (method === "POST") {
    url = `${KEYSO_BASE_URL}${path}`;
    // Убираем undefined-значения
    const body: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") body[k] = v;
    }
    fetchInit = {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "X-Keyso-TOKEN": token,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "MarketRadar/1.0",
      },
      body: JSON.stringify(body),
    };
  } else {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    url = `${KEYSO_BASE_URL}${path}?${qs.toString()}`;
    fetchInit = {
      signal: ctrl.signal,
      headers: {
        "X-Keyso-TOKEN": token,
        Accept: "application/json",
        "User-Agent": "MarketRadar/1.0",
      },
    };
  }

  try {
    const res = await fetch(url, fetchInit);
    if (!res.ok) {
      console.warn(`[Keyso] HTTP ${res.status} ${path} — ${await res.text().then(t => t.slice(0, 150)).catch(() => "")}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[Keyso] fetch failed ${path}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Type definitions for response shapes ─────────────────────────────────────

export interface KeysoCompetitor {
  domain: string;
  /** Общие ключевые слова */
  intersected?: number;
  /** Общая видимость (relative) */
  visibility?: number;
  /** Трафик с поиска */
  traffic?: number;
  /** Среднее отношение пересечения */
  similarity?: number;
}

export interface KeysoAd {
  /** Заголовок объявления */
  title?: string;
  /** Текст объявления */
  text?: string;
  /** Посадочный URL */
  url?: string;
  /** Видимость объявления */
  visibility?: number;
  /** Позиция в выдаче */
  position?: number;
  /** Ключевые фразы по которым показывается */
  keywords?: string[];
}

export interface KeysoMarketShare {
  domain: string;
  /** Доля видимости в нише, 0–100 */
  share: number;
  /** Видимость в попугаях */
  visibility: number;
  /** Трафик */
  traffic?: number;
}

export interface KeysoAiMention {
  /** Запрос в Алисе/Нейро */
  query: string;
  /** Упоминается ли домен в ответе AI */
  mentioned: boolean;
  /** Позиция в списке упомянутых компаний (если применимо) */
  position?: number | null;
  /** Полный текст ответа (если API возвращает) */
  answer?: string;
}

export interface KeysoAiCompetitor {
  domain: string;
  /** Сколько раз упоминается в AI-ответах */
  mentions: number;
  /** Доля от общего числа AI-запросов */
  share?: number;
}

// ─── High-level helpers — основные эндпоинты ──────────────────────────────────

/**
 * Реальные SEO-конкуренты домена по органике (Яндекс).
 * @param domain  — корень типа "example.ru"
 * @param base    — регион (по умолчанию msk)
 * @param limit   — сколько вернуть (по умолчанию 15)
 */
export async function fetchOrganicCompetitors(
  domain: string,
  base: KeysoBase = "msk",
  limit = 15,
): Promise<KeysoCompetitor[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/organic/concurents",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((c) => ({
    domain: String(c.domain ?? c.host ?? ""),
    intersected: typeof c.intersected === "number" ? c.intersected : undefined,
    visibility: typeof c.vis === "number" ? c.vis : (typeof c.visibility === "number" ? c.visibility : undefined),
    traffic: typeof c.traffic === "number" ? c.traffic : undefined,
    similarity: typeof c.similarity === "number" ? c.similarity : undefined,
  })).filter(c => c.domain);
}

/** Реальные конкуренты по контекстной рекламе (Я.Директ). */
export async function fetchContextCompetitors(
  domain: string,
  base: KeysoBase = "msk",
  limit = 15,
): Promise<KeysoCompetitor[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/context/concurents",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((c) => ({
    domain: String(c.domain ?? c.host ?? ""),
    intersected: typeof c.intersected === "number" ? c.intersected : undefined,
    visibility: typeof c.vis === "number" ? c.vis : undefined,
    traffic: typeof c.traffic === "number" ? c.traffic : undefined,
  })).filter(c => c.domain);
}

/** Реальные объявления Я.Директ конкурента — заголовки, тексты, URL. */
export async function fetchContextAds(
  domain: string,
  base: KeysoBase = "msk",
  limit = 20,
): Promise<KeysoAd[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/context/ads",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((ad) => ({
    title: typeof ad.title === "string" ? ad.title : (typeof ad.head === "string" ? ad.head : undefined),
    text: typeof ad.text === "string" ? ad.text : (typeof ad.body === "string" ? ad.body : undefined),
    url: typeof ad.url === "string" ? ad.url : (typeof ad.target === "string" ? ad.target : undefined),
    visibility: typeof ad.vis === "number" ? ad.vis : undefined,
    position: typeof ad.position === "number" ? ad.position : undefined,
  })).filter(ad => ad.title || ad.text);
}

/**
 * Доли рынка по нише. Передаём список доменов — Keys.so возвращает % видимости каждого.
 * Использует /report/site/organic-comparison.
 */
export async function fetchMarketShare(
  domains: string[],
  base: KeysoBase = "msk",
): Promise<KeysoMarketShare[]> {
  if (domains.length === 0) return [];
  const cleaned = domains.map(d => d.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0]).filter(Boolean);
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/site/organic-comparison",
    { domains: cleaned.join(","), base },
  );
  if (!data?.data) return [];

  // Считаем общую видимость для долей
  const items = data.data.map((d) => ({
    domain: String(d.domain ?? ""),
    visibility: typeof d.vis === "number" ? d.vis : (typeof d.visibility === "number" ? d.visibility : 0),
    traffic: typeof d.traffic === "number" ? d.traffic : undefined,
  })).filter(x => x.domain && x.visibility > 0);

  const total = items.reduce((s, x) => s + x.visibility, 0);
  if (total === 0) return [];

  return items
    .map((x) => ({ ...x, share: Math.round((x.visibility / total) * 1000) / 10 }))
    .sort((a, b) => b.share - a.share);
}

/**
 * AI-видимость в Яндекс Алисе и Нейро по домену.
 * Возвращает список запросов где компания упоминается + примеры ответов.
 */
export async function fetchAiAnswers(
  domain: string,
  base: KeysoBase = "msk",
  limit = 25,
): Promise<KeysoAiMention[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/domain_dashboard/ai-answers",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((m) => ({
    query: String(m.keyword ?? m.query ?? m.phrase ?? ""),
    mentioned: m.mentioned !== false, // если поле есть и false — точно не упомянут
    position: typeof m.position === "number" ? m.position : null,
    answer: typeof m.answer === "string" ? m.answer : (typeof m.text === "string" ? m.text : undefined),
  })).filter(m => m.query);
}

/** Конкуренты домена в AI-ответах Алисы/Нейро (кто ещё упоминается рядом). */
export async function fetchAiCompetitors(
  domain: string,
  base: KeysoBase = "msk",
  limit = 15,
): Promise<KeysoAiCompetitor[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/domain_dashboard/ai-concurents",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  const items = data.data.slice(0, limit).map((c) => ({
    domain: String(c.domain ?? ""),
    mentions: typeof c.mentions === "number" ? c.mentions : (typeof c.count === "number" ? c.count : 0),
  })).filter(c => c.domain && c.mentions > 0);
  const total = items.reduce((s, x) => s + x.mentions, 0);
  return items.map(x => ({ ...x, share: total > 0 ? Math.round((x.mentions / total) * 1000) / 10 : undefined }));
}

// ─── Расширенные данные о компании ────────────────────────────────────────────

export interface KeysoTopPage {
  url: string;
  traffic: number;
  keysCount: number;
  topKeyword?: string;
}

export interface KeysoLostKeyword {
  keyword: string;
  oldPosition: number;
  newPosition: number | null;  // null = выпало из топ-100
  volume: number;
}

export interface KeysoAnchor {
  anchor: string;
  count: number;
  share?: number;
}

export interface KeysoReferringDomain {
  domain: string;
  dr?: number;
  links: number;
  firstSeen?: string;
}

export interface KeysoPopularPage {
  url: string;
  backlinks: number;
  refDomains: number;
}

export interface KeysoTopic {
  topic: string;
  weight: number;  // 0..1
}

/** Топовые страницы сайта по органическому трафику.
 *  /sitepages/withkeys возвращает строки (keyword × page) — группируем по url.
 */
export async function fetchTopPages(
  domain: string,
  base: KeysoBase = "msk",
  limit = 15,
): Promise<KeysoTopPage[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  // per_page побольше, чтобы захватить несколько страниц после группировки
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/organic/sitepages/withkeys",
    { domain: cleanDomain, base, page: 1, per_page: 100 },
  );
  if (!data?.data) return [];

  // Группируем по URL: keysCount = кол-во ключей, traffic = vis (одинаков для всей страницы)
  const map = new Map<string, { traffic: number; keysCount: number; topKeyword?: string }>();
  for (const row of data.data) {
    const url = String(row.url ?? row.page ?? row.path ?? "").trim();
    if (!url) continue;
    const vis = Number(row.vis ?? row.traffic ?? 0);
    const word = typeof row.word === "string" ? row.word : undefined;
    if (!map.has(url)) {
      map.set(url, { traffic: vis, keysCount: 1, topKeyword: word });
    } else {
      const entry = map.get(url)!;
      entry.keysCount += 1;
      if (vis > entry.traffic) entry.traffic = vis; // берём максимум vis
    }
  }

  return Array.from(map.entries())
    .map(([url, v]) => ({ url, ...v }))
    .sort((a, b) => b.traffic - a.traffic)
    .slice(0, limit);
}

/** Потерянные ключевые слова — рейтинги что упали. */
export async function fetchLostKeywords(
  domain: string,
  base: KeysoBase = "msk",
  limit = 20,
): Promise<KeysoLostKeyword[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/organic/lost_keywords",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((k) => ({
    keyword: String(k.word ?? k.keyword ?? k.phrase ?? ""),
    // lost_keywords endpoint has `pos` = was-position; no new position (they dropped out)
    oldPosition: Number(k.pos ?? k.old_pos ?? k.posOld ?? 0),
    newPosition: k.new_pos !== undefined ? (k.new_pos === null ? null : Number(k.new_pos)) : null,
    volume: Number(k.wsk ?? k.ws ?? k.volume ?? 0),
  })).filter(k => k.keyword);
}

/** Распределение анкорного текста бэклинков. */
export async function fetchAnchors(
  domain: string,
  base: KeysoBase = "msk",
  limit = 15,
): Promise<KeysoAnchor[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/links/anchors",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  const items = data.data.slice(0, limit).map((a) => ({
    anchor: String(a.anchor ?? a.text ?? a.ankor ?? ""),
    count: Number(a.count ?? a.cnt ?? a.links ?? 0),
  })).filter(a => a.anchor && a.count > 0);
  const total = items.reduce((s, x) => s + x.count, 0);
  return items.map(x => ({ ...x, share: total > 0 ? Math.round((x.count / total) * 1000) / 10 : undefined }));
}

/** Качество ссылающихся доменов (с разбивкой по DR). */
export async function fetchReferringDomains(
  domain: string,
  base: KeysoBase = "msk",
  limit = 25,
): Promise<KeysoReferringDomain[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/links/refdomains",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((d) => ({
    domain: String(d.domain ?? d.host ?? d.from_domain ?? ""),
    dr: typeof d.dr === "number" ? d.dr : (typeof d.domain_rating === "number" ? d.domain_rating : undefined),
    links: Number(d.links ?? d.cnt ?? d.count ?? 0),
    firstSeen: typeof d.first_seen === "string" ? d.first_seen : (typeof d.firstSeen === "string" ? d.firstSeen : undefined),
  })).filter(d => d.domain);
}

/** Топовые страницы по количеству бэклинков (link magnets). */
export async function fetchPopularPages(
  domain: string,
  base: KeysoBase = "msk",
  limit = 10,
): Promise<KeysoPopularPage[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/links/popular",
    { domain: cleanDomain, base, page: 1, per_page: limit },
  );
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((p) => ({
    url: String(p.url ?? p.page ?? p.path ?? ""),
    backlinks: Number(p.backlinks ?? p.links ?? p.cnt ?? 0),
    refDomains: Number(p.ref_domains ?? p.refDomains ?? p.domains ?? 0),
  })).filter(p => p.url);
}

/** Основные темы сайта по мнению Яндекса. */
export async function fetchMainTopics(
  domain: string,
  base: KeysoBase = "msk",
): Promise<KeysoTopic[]> {
  const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  const data = await keysoFetch<{ data?: Array<Record<string, unknown>> }>(
    "/report/simple/site_topics",
    { domain: cleanDomain, base },
  );
  if (!data?.data) return [];
  return data.data.map((t) => ({
    topic: String(t.topic ?? t.name ?? t.theme ?? t.category ?? ""),
    weight: typeof t.weight === "number" ? t.weight
      : (typeof t.share === "number" ? t.share
      : (typeof t.vis === "number" ? t.vis : 0)),
  })).filter(t => t.topic).sort((a, b) => b.weight - a.weight);
}

/** Проверка лимитов аккаунта Keys.so — для UI-индикатора */
export async function fetchKeysoLimits(): Promise<{ used: number; limit: number; resetAt?: string } | null> {
  const data = await keysoFetch<{ data?: Record<string, unknown> }>("/report/tools/limits", {});
  if (!data?.data) return null;
  return {
    used: Number(data.data.used ?? 0),
    limit: Number(data.data.limit ?? 0),
    resetAt: typeof data.data.reset_at === "string" ? data.data.reset_at : undefined,
  };
}
