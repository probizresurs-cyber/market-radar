/**
 * Поиск соцсетей компании ЗА пределами её сайта.
 *
 * Зачем: у Орлинка есть Telegram-канал и Rutube, но на сайте нет ни одной
 * ссылки на них — скрапер честно возвращал пустоту, и разбор писал «соцсетей
 * нет». Формально верно, по сути — нет: каналы существуют, просто сайт с ними
 * не связан. Это и само по себе находка (ни человек, ни краулер ассистента не
 * свяжет канал с брендом), но список каналов всё равно надо найти.
 *
 * ГЛАВНЫЙ РИСК И КАК ОН ЗАКРЫТ. Поиск по названию бренда легко приносит чужой
 * канал-однофамилец, и приписать компании чужой аккаунт в коммерческом
 * предложении — хуже, чем не найти ничего. Поэтому кандидат попадает в
 * результат только пройдя проверку соответствия:
 *   1) в заголовке или описании страницы канала есть название компании
 *      (нормализованное: без кавычек, регистра, «ООО»/«ГК» и пробелов), либо
 *   2) на странице канала указан домен компании.
 * Совпадения по одному только адресу канала (t.me/orlink) недостаточно:
 * совпадение подстроки — не доказательство принадлежности.
 *
 * Всё, что проверку не прошло, отбрасывается молча. Пустой результат —
 * нормальный и честный исход.
 */
import { searchYandexUrls } from "./yandex-search-api";

export interface BrandSocialHit {
  network: string;
  url: string;
  /** Чем подтверждено, что канал принадлежит компании — печатается в разборе. */
  matchedBy: "название на странице" | "домен на странице";
  title: string;
}

const NETWORKS: { network: string; host: RegExp; label: string }[] = [
  { network: "telegram", host: /(^|\.)t\.me$/i, label: "Telegram" },
  { network: "vk", host: /(^|\.)vk\.(com|ru)$/i, label: "ВКонтакте" },
  { network: "rutube", host: /(^|\.)rutube\.ru$/i, label: "Rutube" },
  { network: "youtube", host: /(^|\.)youtube\.com$/i, label: "YouTube" },
  { network: "dzen", host: /(^|\.)dzen\.ru$/i, label: "Дзен" },
  { network: "ok", host: /(^|\.)ok\.ru$/i, label: "Одноклассники" },
];

/**
 * Нормализация названия для сравнения: снимаем организационные формы, кавычки,
 * регистр и пробелы. «ГК "ОРЛИНК"» и «Орлинк» должны считаться одним и тем же,
 * иначе проверка соответствия отвергнет настоящий канал.
 */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/["«»'`]/g, "")
    .replace(/\b(ооо|оао|зао|ип|пао|ао|гк|группа компаний|тд|торговый дом)\b/gi, "")
    .replace(/[^a-zа-яё0-9]/gi, "");
}

/** Достаточно ли длинное имя, чтобы сравнение по нему что-то значило. */
function isNameUsable(normalized: string): boolean {
  // «ГК» → «» после нормализации; «Дом» → «дом» встречается где угодно.
  return normalized.length >= 5;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9",
      },
      redirect: "follow",
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/**
 * Проверка принадлежности канала компании. Открываем страницу канала и ищем
 * либо название компании, либо её домен. Оба сигнала ставит на страницу сам
 * владелец — подделать их посторонний не может, не завладев каналом.
 */
async function verifyOwnership(
  url: string,
  companyName: string,
  domain: string,
): Promise<{ matchedBy: BrandSocialHit["matchedBy"]; title: string } | null> {
  const html = await fetchPage(url);
  if (!html) return null;

  const title = (html.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1] ?? "").trim();
  const description = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']{0,400})/i)?.[1] ?? "";
  const haystack = normalizeName(`${title} ${description}`);

  const needle = normalizeName(companyName);
  if (isNameUsable(needle) && haystack.includes(needle)) {
    return { matchedBy: "название на странице", title: title.slice(0, 120) };
  }

  // Домен ищем в исходном HTML: он пишется латиницей и нормализацию не переживёт.
  const bareDomain = domain.replace(/^www\./, "");
  if (bareDomain.length >= 6 && new RegExp(bareDomain.replace(/\./g, "\\."), "i").test(html)) {
    return { matchedBy: "домен на странице", title: title.slice(0, 120) };
  }

  return null;
}

/**
 * Ищет каналы компании в выдаче Яндекса и оставляет только подтверждённые.
 *
 * Требует настроенного Yandex Search API (YANDEX_API_KEY + YANDEX_FOLDER_ID) —
 * без него возвращает пустой массив, не выдумывая результатов.
 */
export async function findBrandSocials(opts: {
  companyName: string;
  domain: string;
  /** Сколько каналов максимум — поиск платный, а больше пяти в разбор не идёт. */
  limit?: number;
}): Promise<BrandSocialHit[]> {
  const { companyName, domain } = opts;
  const limit = opts.limit ?? 5;
  if (!companyName.trim() || !process.env.YANDEX_API_KEY || !process.env.YANDEX_FOLDER_ID) return [];

  // Ищем по названию + площадка: так выдача возвращает страницу канала, а не
  // упоминания компании в чужих постах.
  const queries = [
    `${companyName} официальный телеграм канал`,
    `${companyName} вконтакте`,
    `${companyName} rutube youtube канал`,
  ];

  const found = new Map<string, { network: string; url: string }>();
  for (const q of queries) {
    const urls = await searchYandexUrls(q);
    for (const u of urls) {
      let host: string;
      try { host = new URL(u).hostname; } catch { continue; }
      const net = NETWORKS.find(n => n.host.test(host));
      if (!net) continue;
      // Служебные и share-адреса каналом компании не являются.
      if (/\/(share|joinchat|s\/|addstickers)/i.test(u)) continue;
      if (!found.has(u)) found.set(u, { network: net.label, url: u });
      if (found.size >= limit * 3) break;
    }
  }

  const hits: BrandSocialHit[] = [];
  for (const cand of found.values()) {
    if (hits.length >= limit) break;
    const proof = await verifyOwnership(cand.url, companyName, domain);
    if (!proof) continue;
    hits.push({ network: cand.network, url: cand.url, matchedBy: proof.matchedBy, title: proof.title });
  }
  return hits;
}
