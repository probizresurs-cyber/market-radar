/**
 * Мини-проверка сайта — верх воронки (/check).
 *
 * Диагноз «почему сайт не приносит заявки» за десятки секунд и 0 ₽
 * себестоимости: ни одного вызова Claude. Три независимые пробы:
 *   - semantics: Букварикс — по скольким запросам домен виден в Яндексе
 *     и какие из них главные (спрос ниши);
 *   - readability: лёгкий fetch HTML — может ли ассистент прочитать сайт
 *     (Schema.org, заголовки, мета, sitemap/robots);
 *   - speed: Google PageSpeed (mobile) — скорость и потеря мобильных заявок.
 *
 * Пробы пишут результат в mini_checks.result по мере готовности, страница
 * поллит и дорисовывает блоки: семантика и читаемость приходят за секунды,
 * Lighthouse доезжает за 30–90 сек. Любая упавшая проба помечается failed —
 * остальные живут дальше, диагноз из двух проб лучше, чем ничего.
 *
 * Почему без Claude — принципиально: на холодный трафик из Директа нельзя
 * ставить генерацию за деньги и 1–3 минуты ожидания. Полное КП стартует
 * только после оставленного email (см. /api/mini-check/lead).
 */
import { randomUUID } from "crypto";
import { query } from "./db";
import { bukvarixDomainKeywords, normalizeDomain } from "./bukvarix";
import { getPageSpeedScores } from "./enricher";

export type ProbeStatus = "pending" | "done" | "failed";

export interface MiniCheckResult {
  semantics?: {
    status: ProbeStatus;
    /** По скольким запросам домен виден (1000 = «1000+», лимит выборки). */
    visibleCount?: number;
    /** Топ-запросы домена по частотности: подтверждение, что спрос в нише есть. */
    top?: { keyword: string; freq: number; position: number }[];
    /** Суммарная широкая частотность топ-выборки — масштаб спроса рядом. */
    demandNearby?: number;
  };
  readability?: {
    status: ProbeStatus;
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
  };
  speed?: {
    status: ProbeStatus;
    performance?: number;
    lcpDisplay?: string;
    seoScore?: number;
  };
}

async function mergeResult(id: string, patch: Partial<MiniCheckResult>): Promise<void> {
  // jsonb || jsonb — мердж верхнего уровня; каждая проба владеет своим ключом,
  // поэтому параллельные записи не затирают друг друга.
  await query(
    `UPDATE mini_checks SET result = result || $2::jsonb, updated_at = NOW() WHERE id = $1`,
    [id, JSON.stringify(patch)],
  );
}

async function probeSemantics(id: string, domain: string): Promise<void> {
  try {
    const rows = await bukvarixDomainKeywords(domain, { limit: 1000, region: "msk" });
    const top = rows
      .filter(k => k.broadFreq >= 10)
      .sort((a, b) => b.broadFreq - a.broadFreq)
      .slice(0, 5)
      .map(k => ({ keyword: k.keyword, freq: k.broadFreq, position: k.position }));
    await mergeResult(id, {
      semantics: {
        status: "done",
        visibleCount: rows.length,
        top,
        demandNearby: rows.reduce((s, k) => s + k.broadFreq, 0),
      },
    });
  } catch {
    await mergeResult(id, { semantics: { status: "failed" } });
  }
}

async function probeReadability(id: string, url: string): Promise<void> {
  try {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const origin = new URL(target).origin;
    const html = await fetch(target, {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketRadarCheck/1.0)" },
      redirect: "follow",
    }).then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));

    const hasSchema = /<script[^>]+application\/ld\+json/i.test(html);
    const hasTitle = /<title[^>]*>[^<]{3,}<\/title>/i.test(html);
    const hasDescription = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html);
    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
    const textChars = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ").length;

    // robots/sitemap — HEAD не все сервера любят, поэтому GET с быстрым тайм-аутом.
    const probeUrl = (p: string) =>
      fetch(`${origin}${p}`, { signal: AbortSignal.timeout(6_000), redirect: "follow" })
        .then(r => r.ok).catch(() => false);
    const [hasRobots, hasSitemap] = await Promise.all([probeUrl("/robots.txt"), probeUrl("/sitemap.xml")]);

    const checks = [hasSchema, hasTitle, hasDescription, h1Count > 0, hasSitemap, hasRobots, textChars > 1500];
    await mergeResult(id, {
      readability: {
        status: "done",
        hasSchema, hasTitle, hasDescription, h1Count, hasSitemap, hasRobots, textChars,
        checksPassed: checks.filter(Boolean).length,
        checksTotal: checks.length,
      },
    });
  } catch {
    await mergeResult(id, { readability: { status: "failed" } });
  }
}

async function probeSpeed(id: string, url: string): Promise<void> {
  try {
    const ps = await getPageSpeedScores(url, "mobile");
    if (!ps) throw new Error("pagespeed null");
    await mergeResult(id, {
      speed: {
        status: "done",
        performance: ps.performance,
        lcpDisplay: ps.lcp?.display,
        seoScore: ps.seo,
      },
    });
  } catch {
    await mergeResult(id, { speed: { status: "failed" } });
  }
}

/**
 * Ставит проверку и запускает пробы в фоне (fire-and-forget: serverless тут
 * не используется, процесс Node живёт — тот же приём, что у kp-queue.tick).
 */
export async function startMiniCheck(url: string, clientIp: string | null): Promise<string> {
  const id = randomUUID();
  const domain = normalizeDomain(url);
  await query(
    `INSERT INTO mini_checks (id, url, domain, status, result, client_ip)
     VALUES ($1, $2, $3, 'running', '{"semantics":{"status":"pending"},"readability":{"status":"pending"},"speed":{"status":"pending"}}', $4)`,
    [id, url, domain, clientIp],
  );

  void (async () => {
    // Пробы независимы; Promise.allSettled — чтобы одна упавшая не убила остальные.
    await Promise.allSettled([
      probeSemantics(id, domain),
      probeReadability(id, url),
      probeSpeed(id, url),
    ]);
    await query(`UPDATE mini_checks SET status = 'done', updated_at = NOW() WHERE id = $1`, [id]);
  })();

  return id;
}
