// ─────────────────────────────────────────────────────────────────────────────
// Клиент hh.ru API + загрузка HTML сайтов компаний.
// Заголовки и подход переиспользуют конвенции из src/lib/enricher.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { SETTINGS } from "./config.mjs";

const HH_HEADERS = {
  // hh.ru требует осмысленный HH-User-Agent — иначе быстрее банит
  "HH-User-Agent": "MarketRadar-Parser/1.0 (radar@company24.pro)",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
};

const SITE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Опциональный прокси (обход гео/IP-блока). Включается переменной HH_PROXY,
// напр. HH_PROXY=http://user:pass@host:port . Использует undici ProxyAgent.
let proxyDispatcher;
let proxyInit = false;
async function getDispatcher() {
  if (proxyInit) return proxyDispatcher;
  proxyInit = true;
  const url = process.env.HH_PROXY;
  if (!url) return undefined;
  try {
    const { ProxyAgent } = await import("undici");
    proxyDispatcher = new ProxyAgent(url);
    console.log(`🌐 Использую прокси HH_PROXY (${url.replace(/\/\/[^@]*@/, "//***@")})`);
  } catch (e) {
    console.warn(`⚠ Не удалось включить HH_PROXY (${e.message}). Иду напрямую.`);
  }
  return proxyDispatcher;
}

async function fetchWithTimeout(url, { headers, timeout, responseType = "json" }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const dispatcher = await getDispatcher();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, dispatcher });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return responseType === "text" ? await res.text() : await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** JSON-запрос к hh API с ретраями и бэкоффом на 403/429/5xx. */
export async function hhGet(url) {
  let lastErr;
  for (let attempt = 0; attempt <= SETTINGS.maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, {
        headers: HH_HEADERS,
        timeout: SETTINGS.apiTimeout,
      });
    } catch (e) {
      lastErr = e;
      const retriable = !e.status || e.status === 403 || e.status === 429 || e.status >= 500;
      if (!retriable || attempt === SETTINGS.maxRetries) break;
      const wait = SETTINGS.retryBackoffMs * (attempt + 1);
      console.warn(`  ⟳ hh ${e.message}, ретрай через ${wait}мс (${url.slice(0, 90)})`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** Дерево регионов hh: возвращает узел "Россия" со всеми субъектами. */
export async function fetchRussiaAreas() {
  const tree = await hhGet("https://api.hh.ru/areas");
  const russia = Array.isArray(tree) ? tree.find((c) => c.id === "113") : null;
  if (!russia) throw new Error("Не найдена Россия (id=113) в дереве /areas");
  return russia;
}

/**
 * Одна страница выдачи вакансий по запросу + области.
 * Возвращает { items, pages, found }.
 */
export async function fetchVacanciesPage({ text, areaId, page, perPage }) {
  const url =
    `https://api.hh.ru/vacancies?text=${encodeURIComponent(text)}` +
    `&area=${areaId}&per_page=${perPage}&page=${page}` +
    `&order_by=publication_time`;
  const data = await hhGet(url);
  return {
    items: data.items || [],
    pages: data.pages ?? 0,
    found: data.found ?? 0,
  };
}

/** Деталка работодателя: site_url, type (company/agency), description. */
export async function fetchEmployer(employerId) {
  return hhGet(`https://api.hh.ru/employers/${employerId}`);
}

/** Загрузка HTML сайта компании (для парсинга телефона). Не бросает — null при ошибке. */
export async function fetchSiteHtml(siteUrl) {
  let url = siteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      return await fetchWithTimeout(url, {
        headers: SITE_HEADERS,
        timeout: SETTINGS.siteTimeout,
        responseType: "text",
      });
    } catch (e) {
      if (attempt === 0) {
        await sleep(SETTINGS.retryBackoffMs);
        continue;
      }
      console.warn(`  ⚠ сайт недоступен (${url.slice(0, 60)}): ${e.message}`);
      return null;
    }
  }
  return null;
}
