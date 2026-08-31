/**
 * Позиции в Яндексе по базе Букварикса — бесплатный источник вместо платного
 * Yandex Search API.
 *
 * Букварикс отдаёт по домену список запросов, по которым тот входит в топ-50
 * Яндекса, и позицию по каждому. Этого достаточно для разбора:
 *   - запрос есть в базе → показываем реальную позицию;
 *   - запроса нет      → домен вне топ-50 по нему. Это ОТВЕТ, а не сбой:
 *                        именно так и надо писать в документе, вместо
 *                        бесполезного «не удалось проверить».
 *
 * Ограничение названо честно и печатается в разборе: это состояние базы на
 * момент её съёма, а не живая выдача сию секунду. Для «где мы сейчас в
 * поиске» точности хватает, для контрольного замера после работ — нет, там
 * нужен живой источник (Yandex Search API, если ключ настроен).
 *
 * Один запрос к Букварикса на весь список ключей: тянем срез домена целиком и
 * сопоставляем локально. Дёргать API на каждый ключ бессмысленно — ответ
 * один и тот же.
 */
import { bukvarixDomainKeywords, normalizeDomain } from "./bukvarix";
import type { PositionCheckResult } from "./position-checker";

/** Нормализация запроса для сопоставления: регистр, ё/е, лишние пробелы. */
function normKeyword(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

export interface BukvarixPositionsResult {
  results: PositionCheckResult[];
  /** Дата съёма среза — печатается рядом с позициями как источник. */
  sourceNote: string;
}

export async function checkPositionsViaBukvarix(opts: {
  domain: string;
  keywords: string[];
  region?: string;
}): Promise<BukvarixPositionsResult | null> {
  const domain = normalizeDomain(opts.domain);
  let rows;
  try {
    rows = await bukvarixDomainKeywords(domain, { limit: 1000, region: "msk" });
  } catch {
    // Источник недоступен — возвращаем null, чтобы вызывающий код мог
    // попробовать другой. Выдумывать позиции нельзя ни при каких условиях.
    return null;
  }

  const byKeyword = new Map<string, number>();
  for (const r of rows) {
    const k = normKeyword(r.keyword);
    // Один запрос может прийти несколькими строками — оставляем лучшую позицию.
    const prev = byKeyword.get(k);
    if (r.position > 0 && (prev === undefined || r.position < prev)) byKeyword.set(k, r.position);
  }

  const results: PositionCheckResult[] = opts.keywords.map((keyword) => {
    const pos = byKeyword.get(normKeyword(keyword));
    if (pos !== undefined) {
      return { keyword, position: pos, status: "done" as const };
    }
    // Домен не найден в базе по этому запросу. База покрывает топ-50, значит
    // домена там нет — это «not_found», а не ошибка проверки.
    return { keyword, position: null, status: "not_found" as const };
  });

  return {
    results,
    sourceNote: rows.length > 0
      ? "по базе видимости (топ-50 Яндекса, Москва)"
      : "домен не найден в базе видимости — в топ-50 Яндекса его нет ни по одному запросу",
  };
}
