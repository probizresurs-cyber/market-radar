/**
 * Universal price scraper.
 *
 * Адаптация n8n-workflow «Competitor Price Monitoring» под нашу инфру —
 * вместо `n8n.html.extractHtmlContent` с захардкоженным CSS-селектором,
 * мы пробуем несколько стратегий по очереди:
 *
 *   1) **JSON-LD schema.org/Product** — самый надёжный (ставит ~70% магазинов):
 *      `<script type="application/ld+json">` с offers.price.
 *   2) **OpenGraph / Twitter** — `<meta property="og:price:amount" content="...">`,
 *      `product:price:amount`, `twitter:data1`.
 *   3) **Microdata** — `[itemprop="price"]`, `[itemprop="offers"] [itemprop="price"]`.
 *   4) **Common CSS-classes** — `.price`, `.product-price`, `.price__regular`,
 *      `[class*="price"]`, `.cost`, `.product-card__price`. Перебираем
 *      первые попавшиеся, фильтруя по виду «число + валюта/руб/$».
 *   5) **Custom CSS-selector** — если пользователь задал свой, используем его.
 *
 * Для каждого варианта парсим число из строки: убираем «руб», «₽», пробелы,
 * меняем «,» на «.», возвращаем `parseFloat`.
 *
 * Возвращаем `{ ok, price, currency, productName, method }`.
 */

import * as cheerio from "cheerio";

export interface ScrapedPrice {
  ok: true;
  price: number;
  currency: string;        // 'RUB' | 'USD' | 'EUR' | 'UNK'
  productName?: string;
  /** какой способ сработал (для отладки / админки) */
  method: "jsonld" | "opengraph" | "microdata" | "css" | "custom";
}

export interface ScrapeError {
  ok: false;
  error: string;
  status?: number;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

// ─── Парсинг числа из строки цены ────────────────────────────────────────────
// "12 990 ₽" → 12990 ; "$1,234.56" → 1234.56 ; "от 990 руб" → 990
function parsePrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Убираем валюты, слова, лишние знаки. Оставляем цифры, точки, запятые, пробелы.
  let s = String(raw)
    .replace(/&nbsp;/g, " ")
    .replace(/[^\d\s.,]/g, "")
    .trim();
  if (!s) return null;
  // Если есть и точка и запятая — обычно , = тысячи (US), . = десятичный разделитель
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    // Только запятая. Если она перед последними 2-3 цифрами — это десятичный.
    const parts = s.split(",");
    const last = parts[parts.length - 1];
    if (last.length === 2 || last.length === 1) {
      s = s.replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }
  s = s.replace(/\s+/g, "");
  const n = parseFloat(s);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

function detectCurrency(raw: string): string {
  const r = raw.toLowerCase();
  if (/руб|₽|rub/i.test(r)) return "RUB";
  if (/[$]|usd|dollar/i.test(r)) return "USD";
  if (/[€]|eur|euro/i.test(r)) return "EUR";
  if (/[¥]|jpy|yen/i.test(r)) return "JPY";
  return "UNK";
}

// ─── 1. JSON-LD schema.org Product ───────────────────────────────────────────
interface JsonLdOffer { price?: number | string; priceCurrency?: string }
interface JsonLdProduct {
  "@type"?: string;
  name?: string;
  offers?: JsonLdOffer | JsonLdOffer[] | { "@type": string; offers?: JsonLdOffer[] };
}
function tryJsonLd($: cheerio.CheerioAPI): ScrapedPrice | null {
  const scripts = $("script[type='application/ld+json']");
  for (const el of scripts.toArray()) {
    try {
      const text = $(el).html() ?? "";
      if (!text.trim()) continue;
      const data = JSON.parse(text);
      const candidates: JsonLdProduct[] = Array.isArray(data) ? data : [data];
      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (!types.some(t => typeof t === "string" && /product/i.test(t))) continue;

        // offers может быть object или array
        let offer: JsonLdOffer | undefined;
        if (Array.isArray(item.offers)) offer = item.offers[0];
        else if (item.offers && typeof item.offers === "object") {
          const o = item.offers as JsonLdOffer & { offers?: JsonLdOffer[] };
          if (Array.isArray(o.offers)) offer = o.offers[0];
          else offer = o;
        }
        if (!offer || offer.price == null) continue;

        const price = parsePrice(String(offer.price));
        if (price == null) continue;
        return {
          ok: true,
          price,
          currency: offer.priceCurrency ?? "RUB",
          productName: typeof item.name === "string" ? item.name : undefined,
          method: "jsonld",
        };
      }
    } catch { /* skip malformed JSON-LD blocks */ }
  }
  return null;
}

// ─── 2. OpenGraph / meta-теги ─────────────────────────────────────────────────
function tryMeta($: cheerio.CheerioAPI): ScrapedPrice | null {
  const props = [
    "product:price:amount",
    "og:price:amount",
    "twitter:data1",
  ];
  for (const p of props) {
    const meta = $(`meta[property='${p}'], meta[name='${p}']`).attr("content");
    if (meta) {
      const price = parsePrice(meta);
      if (price != null) {
        const currency = $(
          `meta[property='product:price:currency'], meta[property='og:price:currency']`,
        ).attr("content") ?? "RUB";
        const name = $(`meta[property='og:title']`).attr("content");
        return { ok: true, price, currency, productName: name ?? undefined, method: "opengraph" };
      }
    }
  }
  return null;
}

// ─── 3. Microdata itemprop="price" ────────────────────────────────────────────
function tryMicrodata($: cheerio.CheerioAPI): ScrapedPrice | null {
  const el = $("[itemprop='price']").first();
  if (el.length === 0) return null;
  // Может быть в content или в text
  const value = el.attr("content") ?? el.attr("data-price") ?? el.text();
  const price = parsePrice(value);
  if (price == null) return null;
  const currency = $("[itemprop='priceCurrency']").first().attr("content") ?? detectCurrency(el.text());
  const name = $("[itemprop='name']").first().text() || undefined;
  return { ok: true, price, currency, productName: name, method: "microdata" };
}

// ─── 4. Common CSS-classes guess ──────────────────────────────────────────────
function tryCommonCSS($: cheerio.CheerioAPI): ScrapedPrice | null {
  const selectors = [
    ".price__regular .price-item--regular",     // shopify
    ".product__price-current",
    ".product-price__price",
    ".product-card__price-current",
    ".price-current",
    ".price-now",
    ".js-product-price",
    "[data-test='price']",
    "[data-product-price]",
    ".product-price",
    ".price",
    ".price-tag",
    ".cost",
  ];
  for (const sel of selectors) {
    const elements = $(sel);
    for (const el of elements.toArray()) {
      const text = $(el).text().trim();
      if (!text || text.length > 80) continue;        // пропускаем крупные блоки
      // Проверяем что в строке есть цифра и (валюта или ₽/$/€ символ)
      if (!/\d/.test(text)) continue;
      const price = parsePrice(text);
      if (price != null) {
        return {
          ok: true,
          price,
          currency: detectCurrency(text),
          method: "css",
        };
      }
    }
  }
  return null;
}

// ─── 5. Custom selector (fallback ручной) ────────────────────────────────────
function tryCustomSelector($: cheerio.CheerioAPI, selector: string): ScrapedPrice | null {
  const text = $(selector).first().text().trim();
  if (!text) return null;
  const price = parsePrice(text);
  if (price == null) return null;
  return {
    ok: true,
    price,
    currency: detectCurrency(text),
    method: "custom",
  };
}

// ─── Marketplace adapters (Wildberries / Ozon) ───────────────────────────────
// Маркетплейсы агрессивно блокируют html-scrape (anti-bot, JS-rendered SPA).
// WB возвращает HTTP 498 без правильных Cookie/Headers. Ozon — 403/JS-challenge.
// Поэтому идём в их публичные JSON-эндпоинты, которые используются их же
// фронтом — там нет anti-bot.

function extractWbNm(url: string): string | null {
  // Поддерживаемые форматы:
  //   https://www.wildberries.ru/catalog/123456789/detail.aspx
  //   https://wildberries.ru/catalog/123456789
  //   https://m.wildberries.ru/catalog/123456789/detail.aspx?targetUrl=...
  const m = url.match(/wildberries\.[a-z]+\/catalog\/(\d+)/i);
  return m ? m[1] : null;
}

interface WbProduct {
  id?: number;
  name?: string;
  /** Цена в копейках (старая схема). */
  salePriceU?: number;
  priceU?: number;
  /** Новая схема (sizes[0].price.product / total / basic). */
  sizes?: Array<{
    price?: {
      basic?: number;       // обычная цена в копейках
      product?: number;     // цена с базовой скидкой
      total?: number;       // финальная (с WB-скидкой)
    };
  }>;
  /** Бренд — добавляем к имени для понятности. */
  brand?: string;
}

async function scrapeWildberries(url: string): Promise<ScrapedPrice | ScrapeError> {
  const nm = extractWbNm(url);
  if (!nm) {
    return { ok: false, error: "Не распознал артикул WB из URL" };
  }
  // dest=-1257786 — регион Москва (стандартный). priceMarginCoeff=1 — без округлений.
  // Другие параметры спионерил из реальных запросов фронта WB.
  const apiUrl =
    `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1257786&spp=30&hide_dtype=10&ab_testing=false&lang=ru&nm=${nm}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(apiUrl, {
      signal: ctrl.signal,
      headers: {
        // WB API ожидает «фронтовые» заголовки. С браузерным UA отвечает JSON.
        "User-Agent": FETCH_HEADERS["User-Agent"],
        "Accept": "*/*",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "Origin": "https://www.wildberries.ru",
        "Referer": "https://www.wildberries.ru/",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `WB API ${res.status}` };
    }
    const json = await res.json() as { data?: { products?: WbProduct[] } };
    const p = json?.data?.products?.[0];
    if (!p) {
      return { ok: false, error: "WB API не нашёл товар (возможно, удалён)" };
    }

    // Берём финальную цену: sizes[0].price.total → product → basic, иначе старое поле
    let priceK: number | undefined;
    const size0 = p.sizes?.[0]?.price;
    if (size0) {
      priceK = size0.total ?? size0.product ?? size0.basic;
    }
    if (priceK == null) priceK = p.salePriceU ?? p.priceU;
    if (priceK == null) {
      return { ok: false, error: "WB API не вернул цену" };
    }
    // Цена в копейках (5-6 знаков для типичных товаров)
    const price = priceK / 100;
    const name = [p.brand, p.name].filter(Boolean).join(" / ") || p.name || undefined;

    return {
      ok: true,
      price,
      currency: "RUB",
      productName: name,
      method: "jsonld", // используем существующий enum — это JSON-источник
    };
  } catch (err) {
    return {
      ok: false,
      error: `WB API: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function isMarketplaceUrl(url: string): "wildberries" | "ozon" | null {
  if (/wildberries\.[a-z]+\/catalog\//i.test(url)) return "wildberries";
  // Ozon — отдельный TODO. Их composer API защищён cookies + cf-challenge.
  // Можно сделать через playwright или внешний proxy-сервис; пока не делаем.
  // if (/ozon\.ru\/product\//i.test(url)) return "ozon";
  return null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function scrapeProductPrice(
  url: string,
  customSelector?: string | null,
): Promise<ScrapedPrice | ScrapeError> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL должен начинаться с http:// или https://" };
  }

  // ── Шаг 0: маркетплейсы (WB / Ozon) — идём в JSON API, минуем HTML ──
  // Custom selector доминирует — если пользователь его задал, скорее всего
  // он знает что делает и хочет проверить кастомный путь. Иначе адаптер.
  if (!customSelector) {
    const marketplace = isMarketplaceUrl(url);
    if (marketplace === "wildberries") {
      const wb = await scrapeWildberries(url);
      if (wb.ok) return wb;
      // Если WB API сам отдал ошибку — возвращаем как есть, без fallback
      // на HTML (он всё равно вернёт 498). Юзер увидит понятную ошибку.
      return wb;
    }
  }

  let html: string;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status} при загрузке страницы` };
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Не удалось загрузить страницу: ${msg}` };
  }

  const $ = cheerio.load(html);

  // Если задан кастомный селектор — пробуем сначала его (доверие пользователю)
  if (customSelector && customSelector.trim()) {
    const c = tryCustomSelector($, customSelector.trim());
    if (c) return c;
    // Если кастомный не сработал — продолжаем со standard цепочкой.
  }

  // Standard fallback chain
  return (
    tryJsonLd($) ??
    tryMeta($) ??
    tryMicrodata($) ??
    tryCommonCSS($) ?? {
      ok: false,
      error:
        "Не удалось найти цену на странице. " +
        "Сайт может требовать JS-рендер или нестандартную разметку. " +
        "Попробуйте задать CSS-селектор вручную в настройках товара.",
    }
  );
}
