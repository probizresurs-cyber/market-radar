/**
 * URL safety guard для server-side fetch'ей с user-supplied URL.
 *
 * Назначение: предотвратить SSRF (Server-Side Request Forgery) когда юзер
 * передаёт нам URL и мы делаем fetch с сервера. Без проверки атакующий
 * может пробить:
 *   - http://localhost:3000/api/admin/... (internal API через прокси нашего сервера)
 *   - http://169.254.169.254/latest/meta-data/ (AWS metadata)
 *   - http://127.0.0.1:5432 (Postgres banner / прочие локальные сервисы)
 *   - http://[::1]:port (IPv6 localhost)
 *
 * Используется во всех endpoint'ах, которые принимают URL как параметр
 * и тянут его с сервера (landing-seo-meta, landing-pixels, ...).
 */

import dns from "dns/promises";

/** Приватные IPv4-блоки (RFC 1918, плюс link-local и loopback). */
const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^10\./,                              // 10.0.0.0/8
  /^127\./,                             // loopback
  /^169\.254\./,                        // link-local (cloud metadata)
  /^172\.(1[6-9]|2\d|3[01])\./,         // 172.16.0.0/12
  /^192\.168\./,                        // 192.168.0.0/16
  /^0\./,                               // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateIp(ip: string): boolean {
  // IPv4
  if (PRIVATE_IPV4_PATTERNS.some(rx => rx.test(ip))) return true;
  // IPv6 loopback / link-local / unique-local
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true; // unique-local fc00::/7
  return false;
}

export interface UrlGuardResult {
  ok: boolean;
  reason?: string;
}

export interface UrlGuardOptions {
  /** Разрешённые домены (точно или поддомен). Если задано — только эти. */
  allowedHosts?: string[];
  /** Разрешённые протоколы. Default: ["https:"]. */
  allowedProtocols?: string[];
  /** Резолвить DNS и проверять что IP не приватный. Default: true. */
  resolveDns?: boolean;
}

/**
 * Проверяет URL — безопасно ли с ним делать server-side fetch.
 *
 * @returns { ok: true } если безопасно. Иначе reason — почему отклонено.
 */
export async function checkSafeUrl(
  rawUrl: string,
  options: UrlGuardOptions = {},
): Promise<UrlGuardResult> {
  const allowedProtocols = options.allowedProtocols ?? ["https:"];
  const resolveDns = options.resolveDns !== false;

  // Парсинг
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { return { ok: false, reason: "Invalid URL" }; }

  // Протокол
  if (!allowedProtocols.includes(url.protocol)) {
    return { ok: false, reason: `Protocol ${url.protocol} not allowed. Use ${allowedProtocols.join(" or ")}` };
  }

  // Host blacklist — даже без DNS-резолва ловим явные localhost.
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "0.0.0.0") {
    return { ok: false, reason: "Localhost not allowed" };
  }

  // Если задан whitelist хостов — проверяем
  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const matches = options.allowedHosts.some(h => {
      const hh = h.toLowerCase();
      return hostname === hh || hostname.endsWith(`.${hh}`);
    });
    if (!matches) {
      return { ok: false, reason: `Host ${hostname} not in whitelist` };
    }
  }

  // Если hostname уже IP-литерал — проверяем без DNS
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    // Снимаем скобки IPv6
    const ip = hostname.replace(/^\[|\]$/g, "");
    if (isPrivateIp(ip)) {
      return { ok: false, reason: `Private IP ${ip} not allowed` };
    }
    return { ok: true };
  }

  // DNS resolve — проверяем все возвращённые IP
  if (resolveDns) {
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const r of records) {
        if (isPrivateIp(r.address)) {
          return { ok: false, reason: `Hostname ${hostname} resolves to private IP ${r.address}` };
        }
      }
    } catch (e) {
      // DNS не резолвится — считаем небезопасным
      return { ok: false, reason: `DNS lookup failed: ${e instanceof Error ? e.message : "error"}` };
    }
  }

  return { ok: true };
}
