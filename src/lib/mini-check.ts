/**
 * Мини-проверка сайта — верх воронки (/check, он же /new).
 *
 * Диагноз «почему сайт не приносит заявки» за десятки секунд и 0 ₽
 * себестоимости: ни одного вызова Claude. Три независимые пробы:
 *   - semantics: Букварикс — по скольким запросам домен виден в Яндексе
 *     и какие из них главные (спрос ниши);
 *   - readability: заход на сайт + robots.txt — может ли ассистент прочитать
 *     страницу и пускают ли краулеров ассистентов вообще;
 *   - speed: Google PageSpeed (mobile) — скорость и потеря мобильных заявок.
 *
 * Пробы пишут результат в mini_checks.result по мере готовности, страница
 * поллит и дорисовывает блоки.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: «нет данных» — недопустимый ответ.
 * Мы платим за клик по обещанию показать замер; вернуть прочерк — значит
 * не выполнить обещание объявления. Поэтому каждая проба обязана
 * различать «плохо», «нас не пустили» и «сайт не отвечает» и говорить это
 * словами. Отсюда:
 *   - реальный UA браузера, а не «MarketRadarCheck» (по нему шлют 403);
 *   - 401/403/429 и заглушка бот-щита — это НЕ сбой, это находка:
 *     краулеры ассистентов ходят такими же ботами;
 *   - robots.txt читается всегда, даже когда страница закрыта, — правила
 *     для GPTBot/ClaudeBot/YandexBot и есть «читаемость для нейросетей»;
 *   - домен, не отвечающий по DNS, не выдаётся за «вас не видно в поиске»;
 *   - пустая выдача Букварикса — это «домена нет в базе», а не приговор.
 *
 * Почему без Claude — принципиально: на холодный трафик из Директа нельзя
 * ставить генерацию за деньги и 1–3 минуты ожидания. Полное КП стартует
 * только после оставленного email (см. /api/mini-check/lead).
 */
import { randomUUID } from "crypto";
import { resolve as dnsResolve } from "dns/promises";
import { query } from "./db";
import { bukvarixDomainKeywords, normalizeDomain } from "./bukvarix";
import { getPageSpeedScores } from "./enricher";

export type ProbeStatus = "pending" | "done" | "failed";

/** Чем закончился заход на сайт. */
export type SiteAccess = "ok" | "blocked" | "unreachable";

/** Вердикт robots.txt по конкретному боту. */
export type BotRule = "allowed" | "blocked" | "no-rule";

export interface MiniCheckResult {
  semantics?: {
    status: ProbeStatus;
    /** По скольким запросам домен виден (1000 = «1000+», лимит выборки). */
    visibleCount?: number;
    /** Топ-запросы домена по частотности: подтверждение, что спрос в нише есть. */
    top?: { keyword: string; freq: number; exact: number; position: number }[];
    /** Суммарная широкая частотность топ-выборки — масштаб спроса рядом. */
    demandNearby?: number;
    /**
     * Почему пусто. «no-data» — домена нет в базе Букварикса (бывает у молодых
     * и узких сайтов, это не диагноз). «unreachable» — сайт вообще не отвечает.
     */
    empty?: "no-data" | "unreachable";
  };
  readability?: {
    status: ProbeStatus;
    access?: SiteAccess;
    httpStatus?: number;
    /** 200, но отдана заглушка бот-щита вместо страницы. */
    botStub?: boolean;
    hasSchema?: boolean;
    hasTitle?: boolean;
    hasDescription?: boolean;
    h1Count?: number;
    hasSitemap?: boolean;
    hasRobots?: boolean;
    textChars?: number;
    /** Сколько проверок из checksTotal сайт прошёл. */
    checksPassed?: number;
    checksTotal?: number;
    /** Правила robots.txt для краулеров ассистентов. */
    aiBots?: { name: string; rule: BotRule }[];
  };
  speed?: {
    status: ProbeStatus;
    performance?: number;
    lcpDisplay?: string;
    seoScore?: number;
    /** Запасной замер, когда Lighthouse не ответил: наш собственный заход. */
    fallback?: { ttfbMs: number; htmlKb: number };
    /** Сайт вообще не отвечает — мерить нечего, и это тоже ответ. */
    unreachable?: boolean;
  };
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Safari/537.36";
const BROWSER_HEADERS = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
};

/** Краулеры, от которых зависит попадание в ответы ассистентов. */
const AI_BOTS = [
  { name: "GPTBot", label: "ChatGPT" },
  { name: "OAI-SearchBot", label: "ChatGPT Search" },
  { name: "ClaudeBot", label: "Claude" },
  { name: "PerplexityBot", label: "Perplexity" },
  { name: "Google-Extended", label: "Google AI" },
  { name: "YandexBot", label: "Яндекс (Алиса, Нейро)" },
];

async function mergeResult(id: string, patch: Partial<MiniCheckResult>): Promise<void> {
  // jsonb || jsonb — мердж верхнего уровня; каждая проба владеет своим ключом,
  // поэтому параллельные записи не затирают друг друга.
  await query(
    `UPDATE mini_checks SET result = result || $2::jsonb, updated_at = NOW() WHERE id = $1`,
    [id, JSON.stringify(patch)],
  );
}

export interface PageFetch {
  access: SiteAccess;
  httpStatus?: number;
  html?: string;
  botStub?: boolean;
  ttfbMs?: number;
}

/**
 * Один заход на главную — общий для проб читаемости и семантики.
 *
 * Классификация важнее самого HTML: «403» и «домена нет» — разные диагнозы,
 * и ни один из них не «нет данных».
 */
export async function fetchPage(target: string): Promise<PageFetch> {
  const t0 = Date.now();
  try {
    const r = await fetch(target, {
      signal: AbortSignal.timeout(15_000),
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    const ttfbMs = Date.now() - t0;
    if (r.status === 401 || r.status === 403 || r.status === 429) {
      return { access: "blocked", httpStatus: r.status, ttfbMs };
    }
    if (!r.ok) return { access: "unreachable", httpStatus: r.status, ttfbMs };

    const html = await r.text();
    // 200 с крохотным телом — типичная заглушка бот-щита (JS-челлендж).
    // Ассистенту достаётся ровно это же: пустая страница вместо услуг.
    const botStub = html.length < 4000 && !/<(p|article|section)[\s>]/i.test(html);
    return { access: botStub ? "blocked" : "ok", httpStatus: r.status, html, botStub, ttfbMs };
  } catch {
    return { access: "unreachable" };
  }
}

/**
 * Есть ли у домена A/AAAA-запись. Отделяет «сайт лежит» от «домена не существует»
 * — второе для нас важнее: на несуществующий домен нельзя выдавать вердикт
 * «вас почти не видно».
 */
async function domainResolves(domain: string): Promise<boolean> {
  try {
    const a = await dnsResolve(domain, "A").catch(() => [] as string[]);
    if (a.length > 0) return true;
    const aaaa = await dnsResolve(domain, "AAAA").catch(() => [] as string[]);
    return aaaa.length > 0;
  } catch {
    return false;
  }
}

/**
 * Разбор robots.txt по группам User-agent.
 *
 * «no-rule» ≠ «запрещено»: отсутствие правила по умолчанию означает разрешение.
 * Мы это различаем сознательно — пугать «вас не пускает GPTBot» там, где просто
 * нет строки, значит врать на той самой странице, где обещаем не врать.
 */
export function parseRobots(txt: string): (bot: string) => BotRule {
  const groups: { agents: string[]; disallowAll: boolean }[] = [];
  let cur: { agents: string[]; disallowAll: boolean } | null = null;
  let prevWasAgent = false;

  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();

    if (field === "user-agent") {
      // Подряд идущие User-agent относятся к одной группе.
      if (!cur || !prevWasAgent) {
        cur = { agents: [], disallowAll: false };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      prevWasAgent = true;
      continue;
    }
    prevWasAgent = false;
    if (!cur) continue;
    if (field === "disallow" && (value === "/" || value === "/*")) cur.disallowAll = true;
    // Allow: / после Disallow: / снимает запрет — самый частый способ
    // «закрыть всё, кроме главной»; полноценный матчинг путей тут излишен.
    if (field === "allow" && value === "/") cur.disallowAll = false;
  }

  return (bot: string) => {
    const b = bot.toLowerCase();
    const own = groups.find(g => g.agents.includes(b));
    if (own) return own.disallowAll ? "blocked" : "allowed";
    const star = groups.find(g => g.agents.includes("*"));
    if (star?.disallowAll) return "blocked";
    return "no-rule";
  };
}

async function probeSemantics(
  id: string,
  domain: string,
  pagePromise: Promise<PageFetch>,
): Promise<void> {
  try {
    const rows = await bukvarixDomainKeywords(domain, { limit: 1000, region: "msk" });
    const top = rows
      .filter(k => k.broadFreq >= 10)
      .sort((a, b) => b.broadFreq - a.broadFreq)
      .slice(0, 5)
      .map(k => ({ keyword: k.keyword, freq: k.broadFreq, exact: k.exactFreq, position: k.position }));

    // Пусто — выясняем, почему, прежде чем ставить диагноз.
    let empty: "no-data" | "unreachable" | undefined;
    if (rows.length === 0) {
      const page = await pagePromise;
      const alive = page.access !== "unreachable" || (await domainResolves(domain));
      empty = alive ? "no-data" : "unreachable";
    }

    await mergeResult(id, {
      semantics: {
        status: "done",
        visibleCount: rows.length,
        top,
        demandNearby: rows.reduce((s, k) => s + k.broadFreq, 0),
        ...(empty ? { empty } : {}),
      },
    });
  } catch {
    await mergeResult(id, { semantics: { status: "failed" } });
  }
}

async function probeReadability(
  id: string,
  target: string,
  pagePromise: Promise<PageFetch>,
): Promise<void> {
  try {
    const origin = new URL(target).origin;
    const page = await pagePromise;

    // robots.txt читаем всегда: он отдаётся даже там, где страница закрыта
    // щитом, и именно он говорит, пускают ли краулеров ассистентов.
    const robotsTxt = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(8_000),
      headers: BROWSER_HEADERS,
      redirect: "follow",
    }).then(r => (r.ok ? r.text() : "")).catch(() => "");
    const hasRobots = robotsTxt.trim().length > 0;
    const ruleFor = parseRobots(robotsTxt);
    const aiBots = AI_BOTS.map(b => ({ name: b.label, rule: hasRobots ? ruleFor(b.name) : "no-rule" as BotRule }));

    if (page.access !== "ok" || !page.html) {
      // Не сбой пробы, а результат: мы не смогли прочитать сайт — и это
      // ровно то, что увидит краулер ассистента.
      await mergeResult(id, {
        readability: {
          status: "done",
          access: page.access,
          httpStatus: page.httpStatus,
          botStub: page.botStub,
          hasRobots,
          aiBots,
        },
      });
      return;
    }

    const html = page.html;
    const hasSchema = /<script[^>]+application\/ld\+json/i.test(html);
    const hasTitle = /<title[^>]*>[^<]{3,}<\/title>/i.test(html);
    const hasDescription = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html);
    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
    const textChars = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ").length;

    const hasSitemap = /sitemap\s*:/i.test(robotsTxt)
      ? true
      : await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(6_000), headers: BROWSER_HEADERS, redirect: "follow" })
          .then(r => r.ok).catch(() => false);

    const checks = [hasSchema, hasTitle, hasDescription, h1Count > 0, hasSitemap, hasRobots, textChars > 1500];
    await mergeResult(id, {
      readability: {
        status: "done",
        access: "ok",
        httpStatus: page.httpStatus,
        hasSchema, hasTitle, hasDescription, h1Count, hasSitemap, hasRobots, textChars,
        checksPassed: checks.filter(Boolean).length,
        checksTotal: checks.length,
        aiBots,
      },
    });
  } catch {
    await mergeResult(id, { readability: { status: "failed" } });
  }
}

async function probeSpeed(id: string, url: string, pagePromise: Promise<PageFetch>): Promise<void> {
  try {
    const ps = await getPageSpeedScores(url, "mobile");
    if (ps) {
      await mergeResult(id, {
        speed: {
          status: "done",
          performance: ps.performance,
          lcpDisplay: ps.lcp?.display,
          seoScore: ps.seo,
        },
      });
      return;
    }
    // Lighthouse не ответил (квота, таймаут, сайт закрыт от Google) — отдаём
    // свой замер и честно называем его своим, вместо прочерка.
    const page = await pagePromise;
    if (page.access === "unreachable" && page.ttfbMs == null) {
      // Домен не отвечает — Lighthouse и не мог ничего измерить. Говорим это
      // прямо, чтобы карточка не выглядела нашей поломкой.
      await mergeResult(id, { speed: { status: "done", unreachable: true } });
      return;
    }
    if (page.ttfbMs != null) {
      await mergeResult(id, {
        speed: {
          status: "done",
          fallback: { ttfbMs: page.ttfbMs, htmlKb: Math.round((page.html?.length ?? 0) / 1024) },
        },
      });
      return;
    }
    await mergeResult(id, { speed: { status: "failed" } });
  } catch {
    await mergeResult(id, { speed: { status: "failed" } });
  }
}

/**
 * Оживление зависших проб.
 *
 * Пробы живут в памяти процесса (fire-and-forget). Любой рестарт — деплой,
 * pm2 restart, падение — убивает их на полпути, и запись навсегда остаётся в
 * «замер…»: посетитель смотрит на крутящийся индикатор, который уже никогда
 * не закончится. Своего ревайвера у мини-проверки не было, в отличие от
 * kp-queue.
 *
 * Вызывается из GET-роута: поллинг страницы и есть наш планировщик. Порог в
 * 6 минут выбран по самой медленной пробе — Lighthouse тянет до 2 попыток по
 * 120 секунд, и живой замер не должен приниматься за мёртвый.
 */
export async function reviveStuckProbes(id: string): Promise<void> {
  const rows = await query<{ url: string; domain: string; result: MiniCheckResult; stale: boolean }>(
    `SELECT url, domain, result, (updated_at < NOW() - INTERVAL '6 minutes') AS stale
       FROM mini_checks WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r || !r.stale) return;

  const res = r.result ?? {};
  const stuck = (["semantics", "readability", "speed"] as const)
    .filter(k => !res[k] || res[k]?.status === "pending");
  if (stuck.length === 0) return;

  const target = /^https?:///i.test(r.url) ? r.url : `https://${r.url}`;
  // Метку времени двигаем сразу — иначе параллельные поллинги со страницы
  // запустят по перезапуску каждый.
  await query(`UPDATE mini_checks SET updated_at = NOW() WHERE id = $1`, [id]);

  void (async () => {
    const pagePromise = fetchPage(target);
    pagePromise.catch(() => {});
    await Promise.allSettled([
      stuck.includes("semantics") ? probeSemantics(id, r.domain, pagePromise) : null,
      stuck.includes("readability") ? probeReadability(id, target, pagePromise) : null,
      stuck.includes("speed") ? probeSpeed(id, r.url, pagePromise) : null,
    ].filter(Boolean));
    await query(`UPDATE mini_checks SET status = 'done', updated_at = NOW() WHERE id = $1`, [id]);
  })();
}

/**
 * Ставит проверку и запускает пробы в фоне (fire-and-forget: serverless тут
 * не используется, процесс Node живёт — тот же приём, что у kp-queue.tick).
 */
export async function startMiniCheck(url: string, clientIp: string | null): Promise<string> {
  const id = randomUUID();
  const domain = normalizeDomain(url);
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  await query(
    `INSERT INTO mini_checks (id, url, domain, status, result, client_ip)
     VALUES ($1, $2, $3, 'running', '{"semantics":{"status":"pending"},"readability":{"status":"pending"},"speed":{"status":"pending"}}', $4)`,
    [id, url, domain, clientIp],
  );

  void (async () => {
    // Один заход на сайт на все пробы: семантика ждёт его только если пуста,
    // скорость — только если Lighthouse промолчал.
    const pagePromise = fetchPage(target);
    pagePromise.catch(() => {});
    await Promise.allSettled([
      probeSemantics(id, domain, pagePromise),
      probeReadability(id, target, pagePromise),
      probeSpeed(id, url, pagePromise),
    ]);
    await query(`UPDATE mini_checks SET status = 'done', updated_at = NOW() WHERE id = $1`, [id]);
  })();

  return id;
}
