/**
 * Проверка позиции домена в Yandex через официальный Yandex Search API
 * (Yandex Cloud / AI Studio), а не через headless-скрейпинг yandex.ru.
 *
 * ПОЧЕМУ: Playwright-скрейпинг выдачи Yandex (см. position-checker.ts)
 * в проде блокируется SmartCaptcha в 100% случаев (проверено 15.07.2026,
 * все keyword-строки уходили в status="failed"). Yandex Search API — тот
 * же поисковый индекс, но как легитимный платный API-вызов, а не
 * автоматизация браузера, поэтому капча не применяется в принципе.
 *
 * Контракт: POST https://searchapi.api.cloud.yandex.net/v2/web/search,
 * заголовок Authorization: Api-Key <ключ>, тело — SearchQuery + folderId +
 * responseFormat. Ответ — { rawData: "<base64 XML>" }. XML — классический
 * формат Яндекс.XML (<yandexsearch><response><results><grouping><group>
 * ...<doc><domain>/<url>...</doc></group></grouping></results></response>
 * </yandexsearch>), группировка по домену (GROUP_MODE_DEEP, как в самой
 * выдаче Яндекса) — порядковый номер <group> внутри <grouping> = позиция.
 *
 * Требует переменные окружения на сервере:
 *   YANDEX_API_KEY    — API-ключ (Yandex Cloud / AI Studio)
 *   YANDEX_FOLDER_ID  — идентификатор каталога, где создан ключ
 * Те же имена переменных, что уже используются для этого сервисного
 * аккаунта в marketradar-leadgen (src/lib/enrich/yandex-search.ts) — один
 * и тот же Yandex Cloud ключ, просто переиспользуется в другом продукте.
 * Если не заданы — возвращаем честный status="failed" с понятной причиной,
 * НИКОГДА не подставляем позицию наугад.
 */
import { normalizeDomain, resolveYandexRegion, type PositionCheckResult } from "./position-checker";

const ENDPOINT = "https://searchapi.api.cloud.yandex.net/v2/web/search";

// Максимум групп на странице для XML — 100. Забираем топ-100 одним
// запросом вместо постраничного листания: дешевле (1 запрос вместо 3-5) и
// не требует пауз между страницами, которые были нужны только из-за риска
// капчи при скрейпинге, а не из-за лимитов самого API.
const GROUPS_ON_PAGE = 100;

export function isYandexSearchApiConfigured(): boolean {
  return Boolean(process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID);
}

function hostMatches(resultHost: string, targetDomain: string): boolean {
  const h = normalizeDomain(resultHost);
  const t = normalizeDomain(targetDomain);
  return h === t || h.endsWith(`.${t}`);
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Возвращает 1-based позицию домена среди <group> внутри <grouping>,
 * null если домен не найден среди полученных групп, или "error" если XML
 * не удалось разобрать вовсе (неожиданный формат ответа).
 */
function findDomainPosition(xml: string, domain: string): number | null | "error" {
  if (!/<yandexsearch/i.test(xml)) return "error";

  const groupBlocks = xml.match(/<group>[\s\S]*?<\/group>/gi);
  if (!groupBlocks || groupBlocks.length === 0) {
    // Пустая выдача — валидный результат (0 совпадений), а не сбой парсинга.
    const foundAll = xml.match(/<found priority="all">\s*(\d+)\s*<\/found>/i);
    if (foundAll && foundAll[1] === "0") return null;
    if (/<results\s*\/?>|<results>\s*<\/results>/i.test(xml)) return null;
    return "error";
  }

  for (let i = 0; i < groupBlocks.length; i++) {
    const domainMatch = groupBlocks[i].match(/<domain>([^<]*)<\/domain>/i);
    const urlMatch = groupBlocks[i].match(/<url>([^<]*)<\/url>/i);
    const rawHost = domainMatch?.[1]?.trim() || (urlMatch ? safeHostname(urlMatch[1].trim()) : null);
    if (rawHost && hostMatches(rawHost, domain)) {
      return i + 1;
    }
  }
  return null;
}

export async function checkKeywordPositionViaYandexApi(opts: {
  domain: string;
  keyword: string;
  region?: string;
}): Promise<PositionCheckResult> {
  const { domain, keyword } = opts;
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    return {
      keyword,
      position: null,
      status: "failed",
      errorMessage: "Yandex Search API не настроен на сервере (нет YANDEX_API_KEY/YANDEX_FOLDER_ID)",
    };
  }

  const body = {
    query: { searchType: "SEARCH_TYPE_RU", queryText: keyword },
    groupSpec: { groupMode: "GROUP_MODE_DEEP", groupsOnPage: String(GROUPS_ON_PAGE), docsInGroup: "1" },
    region: resolveYandexRegion(opts.region),
    folderId,
    responseFormat: "FORMAT_XML",
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Api-Key ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      keyword,
      position: null,
      status: "failed",
      errorMessage: `Не удалось выполнить запрос к Yandex Search API: ${msg.slice(0, 200)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      keyword,
      position: null,
      status: "failed",
      errorMessage: `Yandex Search API вернул ошибку ${res.status}: ${text.slice(0, 200)}`,
    };
  }

  let json: { rawData?: string };
  try {
    json = await res.json();
  } catch {
    return { keyword, position: null, status: "failed", errorMessage: "Не удалось разобрать ответ Yandex Search API" };
  }
  if (!json.rawData) {
    return { keyword, position: null, status: "failed", errorMessage: "Пустой ответ Yandex Search API" };
  }

  let xml: string;
  try {
    xml = Buffer.from(json.rawData, "base64").toString("utf-8");
  } catch {
    return { keyword, position: null, status: "failed", errorMessage: "Не удалось декодировать ответ Yandex Search API (base64)" };
  }

  const position = findDomainPosition(xml, domain);
  if (position === "error") {
    return {
      keyword,
      position: null,
      status: "failed",
      errorMessage: "Не удалось разобрать XML-ответ Yandex Search API (неожиданный формат)",
    };
  }
  if (position === null) {
    return { keyword, position: null, status: "not_found" };
  }
  return { keyword, position, status: "done" };
}
