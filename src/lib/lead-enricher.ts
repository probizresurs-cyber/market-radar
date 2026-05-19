/**
 * Lead contact enricher — извлекает email / телефоны / имена контактных
 * лиц с сайта компании, чтобы CRM-менеджеру было с чего начать аутрич.
 *
 * Стратегия:
 *   1. Скачиваем несколько типичных страниц с контактами параллельно:
 *      `/`, `/contacts`, `/contact`, `/контакты`, `/about`, `/о-компании`.
 *   2. Из всего HTML парсим email и phone регулярками.
 *      - mailto:/tel: атрибуты приоритетнее текста
 *      - junk-адреса фильтруем (noreply@, support@cloudflare, etc)
 *      - email на домене лида ранжируется выше
 *   3. Если на странице найдено что-то типа «Директор: Иванов И.И.» —
 *      Haiku вытаскивает имена + должности (опционально, ~1 ₽ на лид).
 *
 * Возвращает structured данные. Сам lead обновлять не умеет — это делает
 * API роут, который заодно решает «не перетирать если юзер уже заполнил».
 */

import { safeAnthropicCreate, extractJson } from "@/lib/anthropic-safe";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 300_000;

// Страницы которые обычно содержат контакты. Главная — почти всегда (footer),
// плюс типичные имена контактных страниц на русском/английском.
const CANDIDATE_PATHS = [
  "/",
  "/contacts",
  "/contact",
  "/contacts.html",
  "/контакты",
  "/about",
  "/about-us",
  "/о-компании",
  "/o-kompanii",
];

// Email/телефоны которые игнорируем — это явно не контакты компании.
const EMAIL_BLACKLIST_DOMAINS = [
  "example.com", "example.ru", "domain.com", "test.com",
  "react.dev", "nextjs.org", "vercel.com", "cloudflare.com",
  "github.com", "gravatar.com", "google.com", "yandex.ru/maps",
  "schema.org", "w3.org",
];
const EMAIL_BLACKLIST_LOCAL = [
  "noreply", "no-reply", "donotreply",
];

async function fetchPage(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const text = await res.text();
    return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Нормализует телефон в формат +7XXXXXXXXXX (без скобок и пробелов).
 *  Если на входе 8XXXXXXXXXX — конвертит в +7. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return "+7" + digits.slice(1);
  if (digits.length === 11 && digits.startsWith("7")) return "+" + digits;
  if (digits.length === 10) return "+7" + digits;
  // Иностранные: только если начинается с + и длина 10-15
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) return "+" + digits;
  return null;
}

/** Email — regex + sanity check. Если local-part или domain в blacklist → пропуск. */
function extractEmails(html: string): string[] {
  // mailto: атрибуты + plain text
  const mailtoMatches = Array.from(html.matchAll(/mailto:([^"'\s<>]+)/gi))
    .map(m => m[1].split("?")[0]); // отрезаем ?subject=... если есть
  const textMatches = Array.from(html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g))
    .map(m => m[0]);
  const all = [...mailtoMatches, ...textMatches].map(e => e.toLowerCase().trim());

  const filtered = all.filter(e => {
    const [local, domain] = e.split("@");
    if (!local || !domain) return false;
    if (EMAIL_BLACKLIST_DOMAINS.some(d => domain.endsWith(d))) return false;
    if (EMAIL_BLACKLIST_LOCAL.some(l => local.startsWith(l))) return false;
    // мусор типа very.long.string-1488@x.y.z — пропускаем
    if (local.length > 50 || domain.length > 60) return false;
    // фильтруем явные id-шники / hash (длинные local-part из hex)
    if (/^[a-f0-9]{20,}$/.test(local)) return false;
    return true;
  });

  // Уникальные с сохранением порядка.
  const seen = new Set<string>();
  return filtered.filter(e => seen.has(e) ? false : (seen.add(e), true));
}

/** Парсим телефоны: tel: атрибуты + русские форматы из текста.
 *  Регулярка покрывает: +7XXX..., 8XXX..., с разделителями (пробел/тире/скобки). */
function extractPhones(html: string): string[] {
  const telMatches = Array.from(html.matchAll(/tel:([+\d()\-\s]+)/gi))
    .map(m => m[1]);
  // Текстовая регулярка: ловим последовательность от +7 или 8, потом 10-11 цифр
  // с любыми разделителями. Допускаем пробелы, тире, скобки.
  const textMatches = Array.from(html.matchAll(
    /(?:\+7|8|7)[\s().\-]{0,3}\(?\d{3}\)?[\s().\-]{0,3}\d{3}[\s().\-]{0,3}\d{2}[\s().\-]{0,3}\d{2}/g,
  )).map(m => m[0]);
  const raw = [...telMatches, ...textMatches];

  const normalized = raw
    .map(normalizePhone)
    .filter((p): p is string => !!p);

  // Уникальные
  return Array.from(new Set(normalized));
}

/** Достаём только текст из HTML — без скриптов и стилей. Грубо, через regex. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Опционально: пробуем найти имя контактного лица через Haiku.
 *  На вход — текст контактной страницы, на выход — массив {name, position}.
 *  Если Haiku ничего не нашёл / нет API-ключа → пустой массив. */
async function extractContactPersons(text: string): Promise<Array<{ name: string; position?: string }>> {
  // Слишком короткий текст — не имеет смысла дёргать AI
  if (text.length < 300) return [];
  // Если в тексте нет паттернов с именами/должностями — тоже пропускаем
  const looksPromising = /(директор|руководител|менеджер|основател|founder|ceo|cto|cmo|product|business)/i.test(text);
  if (!looksPromising) return [];

  const { text: aiText } = await safeAnthropicCreate({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Из текста ниже извлеки имена контактных лиц компании с их должностями. Только сотрудники компании-владельца сайта (не партнёры, не клиенты, не отзывы пользователей).

Верни JSON-массив: [{"name": "Иван Иванов", "position": "генеральный директор"}, ...]
Максимум 5 элементов. Если ничего не нашёл — верни [].

Без markdown-обёртки, только JSON.

Текст:
${text.slice(0, 6000)}`,
    }],
  });
  if (!aiText) return [];
  const parsed = extractJson<Array<{ name?: string; position?: string }>>(aiText);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(p => p && typeof p.name === "string" && p.name.length > 2 && p.name.length < 80)
    .map(p => ({ name: p.name!.trim(), position: typeof p.position === "string" ? p.position.trim() : undefined }))
    .slice(0, 5);
}

export interface EnrichResult {
  emails: string[];          // отсортированы: сначала email на домене лида, потом остальные
  phones: string[];          // нормализованные +7...
  persons: Array<{ name: string; position?: string }>;
  pagesScanned: number;      // сколько страниц реально удалось скачать
  domainEmailFound: boolean; // нашли ли хоть один email с домена компании
}

/** Применяет результат enrichment к лиду: заполняет ТОЛЬКО пустые поля.
 *  Никогда не перетирает ручные правки CRM-менеджера.
 *  Возвращает объект с применёнными ключ→значение (для логирования). */
export async function applyEnrichmentToLead(
  leadId: string,
  found: EnrichResult,
  existing: {
    contact_email: string | null;
    contact_phone: string | null;
    contact_person_name: string | null;
  },
  queryFn: (sql: string, params?: unknown[]) => Promise<unknown>,
): Promise<Record<string, string>> {
  const updates: Record<string, string> = {};
  if (!existing.contact_email && found.emails[0]) updates.contact_email = found.emails[0];
  if (!existing.contact_phone && found.phones[0]) updates.contact_phone = found.phones[0];
  if (!existing.contact_person_name && found.persons[0]?.name) updates.contact_person_name = found.persons[0].name;

  if (Object.keys(updates).length > 0) {
    const keys = Object.keys(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = keys.map(k => updates[k]);
    await queryFn(
      `UPDATE leads SET ${setClauses}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
      [...values, leadId],
    );
  }
  return updates;
}

export async function enrichLeadContacts(domain: string, opts: { withAI?: boolean } = {}): Promise<EnrichResult> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  const urls = CANDIDATE_PATHS.map(p => `https://${cleanDomain}${p}`);

  // Параллельно качаем все страницы. Большая часть упадёт на 404 — это норма.
  const htmls = await Promise.all(urls.map(fetchPage));
  const goodHtmls = htmls.filter((h): h is string => !!h);

  const combined = goodHtmls.join("\n");
  const rawEmails = extractEmails(combined);
  const rawPhones = extractPhones(combined);

  // Ранжируем email: те что на @cleanDomain — приоритет (это точно компания).
  const domainEmails = rawEmails.filter(e => e.endsWith("@" + cleanDomain));
  const otherEmails = rawEmails.filter(e => !e.endsWith("@" + cleanDomain));
  const emails = [...domainEmails, ...otherEmails].slice(0, 5);

  // Имена контактных лиц — только если withAI=true (стоит ~1 ₽ на лид).
  let persons: Array<{ name: string; position?: string }> = [];
  if (opts.withAI && goodHtmls.length > 0) {
    // Берём контент НЕ-главной страницы — там обычно нет fluff, чище для AI.
    // Если главная единственная — берём её.
    const contactPage = goodHtmls[1] ?? goodHtmls[0];
    persons = await extractContactPersons(htmlToText(contactPage));
  }

  return {
    emails,
    phones: rawPhones.slice(0, 5),
    persons,
    pagesScanned: goodHtmls.length,
    domainEmailFound: domainEmails.length > 0,
  };
}
