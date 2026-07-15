/**
 * Live SERP position checker (Google — Playwright; Yandex — см. ниже).
 *
 * ПОЧЕМУ ТАК: позиция сайта в выдаче — это факт реального мира, который
 * меняется каждый день и не может быть "угадан" LLM.
 *
 * Yandex: раньше здесь тоже был Playwright-скрейпинг yandex.ru, но на проде
 * он блокировался SmartCaptcha в 100% случаев (проверено 15.07.2026).
 * Заменено на официальный Yandex Search API — см. lib/yandex-search-api.ts
 * (checkKeywordPositionViaYandexApi), вызывается напрямую из роутов
 * /api/check-positions и /api/kp-position-check в обход этого файла.
 * resolveYandexRegion() ниже переиспользуется этим модулем.
 *
 * Google: официального API нет, поэтому здесь по-прежнему живой браузер —
 * загружаем страницу выдачи и парсим органику. ЭТО ХРУПКО. Google меняет
 * разметку без предупреждения, показывает капчу датацентровым IP,
 * персонализирует результаты. Поэтому:
 *   - если распознать выдачу/капчу не удалось — статус "failed", позиция
 *     null. НИКОГДА не подставляем произвольное число.
 *   - если сайт не найден в проверенных страницах — статус "not_found",
 *     это НЕ ошибка, а результат ("сайта нет в топ-N").
 *   - селекторы ниже — best-effort на разметку конца 2025/начала 2026.
 *     Если Google обновит вёрстку, парсинг сломается молча в сторону
 *     "failed" (не в сторону выдумывания позиции) — осознанный компромисс
 *     в пользу честности, а не полноты.
 *
 * Запускается через Playwright Chromium (уже используется в проекте для
 * screencast-recorder.ts — тот же launch-паттерн: headless, no-sandbox
 * для VPS). ВАЖНО: playwright — devDependency в package.json (как и в
 * screencast-recorder), т.е. на проде должен быть установлен через
 * `npm install` без --production/NODE_ENV=production, иначе бинарник
 * chromium не подтянется. Тот же риск уже существует для скринкастов —
 * ничего нового не вводим, но если когда-то деплой перейдёт на
 * --omit=dev, эта фича (и скринкасты) молча сломаются.
 */
import { chromium, type Browser, type Page } from "playwright";

export type SearchEngine = "yandex" | "google";

export interface PositionCheckResult {
  keyword: string;
  position: number | null;
  status: "done" | "not_found" | "failed";
  errorMessage?: string;
}

// Сколько страниц выдачи листаем на один keyword. 3 страницы × ~10
// органических результатов = проверяем топ-30. Можно было бы дойти до
// топ-50 (5 страниц), но каждая доп. страница — это ещё один запрос к
// поисковику с того же IP, а значит выше риск капчи. 3 — компромисс.
const MAX_PAGES_PER_KEYWORD = 3;
const RESULTS_PER_PAGE_ASSUMPTION = 10;

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ─── Domain matching ───────────────────────────────────────────────────────

export function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  d = d.split(":")[0]; // strip port
  d = d.replace(/^www\./, "");
  return d;
}

export function isValidDomain(raw: string): boolean {
  const d = normalizeDomain(raw);
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(d);
}

function hostMatches(resultHost: string, targetDomain: string): boolean {
  const h = normalizeDomain(resultHost);
  const t = normalizeDomain(targetDomain);
  return h === t || h.endsWith(`.${t}`);
}

// ─── Region resolution ──────────────────────────────────────────────────────

// Небольшой словарь для удобства ввода региона текстом. Если передан
// числовой код Yandex-региона (lr) — используем как есть. Если ничего не
// распознано — дефолт Москва (213), т.к. прод крутится на VPS в Москве,
// и это region-код совпадает с "родным" для сервера местоположением.
const YANDEX_REGION_ALIASES: Record<string, string> = {
  "москва": "213", moscow: "213",
  "санкт-петербург": "2", "спб": "2", spb: "2",
  "екатеринбург": "54", ekaterinburg: "54",
  "новосибирск": "65", novosibirsk: "65",
  "казань": "43", kazan: "43",
  "россия": "225", russia: "225",
};

export function resolveYandexRegion(region?: string): string {
  if (!region) return "213";
  const t = region.trim().toLowerCase();
  if (/^\d+$/.test(t)) return t;
  return YANDEX_REGION_ALIASES[t] ?? "213";
}

function resolveGoogleCountry(region?: string): string {
  if (!region) return "ru";
  const t = region.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(t)) return t;
  return "ru";
}

// ─── Browser lifecycle ───────────────────────────────────────────────────────

export async function launchCheckerBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // важно для VPS с маленьким /dev/shm (см. screencast-recorder.ts)
      "--disable-blink-features=AutomationControlled", // убираем самый очевидный маркер автоматизации
    ],
  });
}

export async function newCheckerPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    userAgent: DESKTOP_USER_AGENT,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    extraHTTPHeaders: {
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  return context.newPage();
}

function jitterMs(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

/** Пауза между keyword-запросами (человекоподобный интервал, снижает риск капчи). */
export async function humanDelayBetweenKeywords(): Promise<void> {
  await new Promise((r) => setTimeout(r, jitterMs(3000, 8000)));
}

async function humanDelayBetweenPages(): Promise<void> {
  await new Promise((r) => setTimeout(r, jitterMs(1200, 3200)));
}

// ─── Blocking / CAPTCHA detection ───────────────────────────────────────────

async function isGoogleBlocked(page: Page): Promise<boolean> {
  const url = page.url();
  if (/\/sorry\//i.test(url)) return true;
  const text = await page
    .evaluate(() => document.body?.innerText?.slice(0, 3000) ?? "")
    .catch(() => "");
  return /unusual traffic|our systems have detected|detected unusual|recaptcha|подозрительн(ый|ую) трафик/i.test(
    text
  );
}

async function dismissGoogleConsent(page: Page): Promise<void> {
  try {
    const btn = page
      .locator(
        'button:has-text("Accept all"), button:has-text("Принять все"), button:has-text("I agree"), button:has-text("Согласен")'
      )
      .first();
    await btn.waitFor({ state: "visible", timeout: 1500 });
    await btn.click({ timeout: 3000 });
    await page.waitForTimeout(400);
  } catch {
    // Баннера нет (или он в другой разметке) — просто продолжаем без него.
  }
}

// ─── Result page parsing ────────────────────────────────────────────────────

interface RawResult {
  href: string;
}

async function fetchGooglePage(
  page: Page,
  keyword: string,
  country: string,
  pageIndex: number
): Promise<RawResult[]> {
  const start = pageIndex * RESULTS_PER_PAGE_ASSUMPTION;
  const url = `https://www.google.com/search?q=${encodeURIComponent(
    keyword
  )}&hl=ru&gl=${encodeURIComponent(country)}&num=10&start=${start}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await dismissGoogleConsent(page);
  await page.waitForTimeout(jitterMs(500, 1200));

  if (await isGoogleBlocked(page)) {
    throw new Error("BLOCKED_GOOGLE");
  }

  return page.evaluate(() => {
    const container =
      document.querySelector("#rso") || document.querySelector("#search") || document.body;
    const anchors = Array.from(container.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
    const seen = new Set<string>();
    const out: { href: string }[] = [];
    for (const a of anchors) {
      // Органические результаты в Google всегда имеют заголовок <h3> внутри
      // самой ссылки-контейнера — так отсекаем сайтлинки-дубли/картинки/меню.
      if (!a.querySelector("h3")) continue;
      if (seen.has(a.href)) continue;
      seen.add(a.href);
      out.push({ href: a.href });
    }
    return out;
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Только Google — Yandex теперь проверяется через официальный API
// (checkKeywordPositionViaYandexApi в lib/yandex-search-api.ts), без браузера.
export async function checkKeywordPosition(
  page: Page,
  opts: { domain: string; keyword: string; engine: "google"; region?: string }
): Promise<PositionCheckResult> {
  const { domain, keyword } = opts;
  let position = 0; // счётчик органических позиций, растёт по мере листания страниц

  try {
    for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_KEYWORD; pageIndex++) {
      if (pageIndex > 0) await humanDelayBetweenPages();

      const results = await fetchGooglePage(page, keyword, resolveGoogleCountry(opts.region), pageIndex);

      if (results.length === 0) {
        // Пустая страница выдачи — либо реально конец результатов, либо
        // страница не распарсилась (разметка изменилась). Прекращаем
        // листать, но не считаем это блокировкой сама по себе.
        break;
      }

      for (const r of results) {
        position++;
        let host: string;
        try {
          host = new URL(r.href).hostname;
        } catch {
          continue;
        }
        if (hostMatches(host, domain)) {
          return { keyword, position, status: "done" };
        }
      }
    }

    return { keyword, position: null, status: "not_found" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const humanMsg =
      msg === "BLOCKED_GOOGLE"
        ? "Поисковик показал капчу / заблокировал запрос — проверка не удалась"
        : `Не удалось проверить: ${msg.slice(0, 200)}`;
    return { keyword, position: null, status: "failed", errorMessage: humanMsg };
  }
}
