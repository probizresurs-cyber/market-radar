/**
 * POST /api/fetch-reviews-yandex
 *
 * Подтягивает отзывы с Яндекс.Карт через публичный reviews-widget endpoint
 * (тот же, что встраивается на сайты бизнесов).
 *
 * Логика:
 *   1. Если orgId не передан — ищем через search-maps API по companyName.
 *   2. Скачиваем https://yandex.ru/maps-reviews-widget/{orgId}?comments — HTML
 *      с .comment-блоками, парсим через cheerio.
 *
 * Body: { companyName: string, address?: string, limit?: number, orgId?: string }
 * Returns: { ok, data: { reviews: Review[], rating, reviewCount, orgId } }
 */
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { Review } from "@/lib/review-types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Достаёт город из строки адреса. Принимаем форматы:
 *    «119071, г. Москва, ...»
 *    «Москва, ул...»
 *    «Россия, Санкт-Петербург, ...»
 *  Берём первый сегмент похожий на город (без индекса, не «г.»-префикса). */
function extractCity(addr: string): string {
  for (const part of addr.split(",")) {
    const p = part.trim().replace(/^г\.?\s*/i, "").replace(/^город\s+/i, "");
    if (!p) continue;
    if (/^\d/.test(p)) continue;                          // индекс
    if (/^(россия|рф)$/i.test(p)) continue;
    if (/^(респ|обл|край|округ|район)/i.test(p)) continue;
    if (/^(ул|пр|пер|просп|шоссе|наб|пл|бул|внутригор|тер)/i.test(p)) continue;
    return p;
  }
  return "";
}

/** Чистим название от юр.префиксов («ГК», «ООО», «ИП»...). Поиск идёт лучше
 *  именно по бренду — «ОРЛИНК», а не «ГК ОРЛИНК». */
function cleanBrandName(name: string): string {
  return name
    .replace(/^\s*(ООО|ИП|АО|ПАО|ОАО|ЗАО|ГК|НКО|ТСЖ|СНТ)\s+/i, "")
    .replace(/[«»"]/g, "")
    .trim();
}

async function findOrgId(name: string, address: string): Promise<string | null> {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) return null;

  // Стратегии в порядке от специфичной к общей. Чем выше — тем точнее.
  // Раньше пробовали только 2 — расширили до 5, дополнительно `name+city`
  // и вариант без юр.префикса.
  const city = address ? extractCity(address) : "";
  const brand = cleanBrandName(name);
  const firstAddrLine = address.split(",").map(s => s.trim()).find(s => s && !/^\d{6}$/.test(s)) ?? "";

  const queries: string[] = [];
  if (city) queries.push(`${name} ${city}`);
  if (brand && brand !== name && city) queries.push(`${brand} ${city}`);
  if (firstAddrLine && firstAddrLine !== city) queries.push(`${name} ${firstAddrLine}`);
  if (address) queries.push(`${name} ${address}`);
  queries.push(name);
  if (brand && brand !== name) queries.push(brand);

  const unique = [...new Set(queries.filter(Boolean))];

  for (const q of unique) {
    try {
      const res = await fetch(
        `https://search-maps.yandex.ru/v1/?text=${encodeURIComponent(q)}&type=biz&lang=ru_RU&apikey=${apiKey}&results=1`,
      );
      if (!res.ok) continue;
      const data = await res.json() as {
        features?: Array<{ properties?: { CompanyMetaData?: { id?: string } } }>;
      };
      const id = data.features?.[0]?.properties?.CompanyMetaData?.id;
      if (id) return id;
    } catch { /* try next */ }
  }
  return null;
}

interface ParsedReview {
  author: string;
  rating: number;
  text: string;
  date: string;
}

async function fetchWidget(orgId: string, limit: number): Promise<ParsedReview[]> {
  const url = `https://yandex.ru/maps-reviews-widget/${encodeURIComponent(orgId)}?comments`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);

  const out: ParsedReview[] = [];
  $(".comment").each((_, el) => {
    if (out.length >= limit) return false;
    const $el = $(el);
    const text = $el.find(".comment__text").text().trim();
    const author = $el.find(".comment__author").text().trim() || "Пользователь Яндекс.Карт";
    const date = $el.find(".comment__date").text().trim();
    const starsClass = $el.find(".stars").attr("class") ?? "";
    const ratingMatch = starsClass.match(/_rating_(\d+)/);
    const rating = ratingMatch ? Math.max(1, Math.min(5, parseInt(ratingMatch[1], 10))) : 0;
    if (!text) return;
    out.push({ author, rating, text, date });
  });
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = (body.companyName ?? "").toString().trim();
    const address: string = (body.address ?? "").toString().trim();
    const limit: number = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
    let orgId: string = (body.orgId ?? "").toString().trim();

    if (!orgId) {
      if (!companyName) {
        return NextResponse.json(
          { ok: false, error: "Передайте companyName или orgId" },
          { status: 400 },
        );
      }
      const found = await findOrgId(companyName, address);
      if (!found) {
        return NextResponse.json({
          ok: true,
          data: {
            reviews: [],
            rating: 0,
            reviewCount: 0,
            orgId: null,
            note: "Не нашли организацию в Яндекс.Картах. Уточните название или адрес.",
          },
        });
      }
      orgId = found;
    }

    const parsed = await fetchWidget(orgId, limit);
    const reviews: Review[] = parsed.map((r, i) => ({
      id: `yandex-${orgId}-${i}`,
      platform: "yandex",
      author: r.author,
      rating: r.rating,
      text: r.text,
      date: r.date || new Date().toLocaleDateString("ru"),
    }));

    // Средний рейтинг = среднее по полученным
    const ratingsWithValue = reviews.filter(r => r.rating > 0);
    const avgRating = ratingsWithValue.length
      ? ratingsWithValue.reduce((s, r) => s + r.rating, 0) / ratingsWithValue.length
      : 0;

    return NextResponse.json({
      ok: true,
      data: {
        reviews,
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
        orgId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
