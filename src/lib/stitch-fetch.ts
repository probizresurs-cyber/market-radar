/**
 * Скачивание HTML лендинга, сгенерированного Google Stitch.
 *
 * Зачем отдельный модуль: раньше каждый роут (landing-share, landing-export-html,
 * landing-translate, landing-deploy-vercel) проверял URL своим regex'ом и делал
 * «голый» fetch. Оба решения были неверны:
 *
 *  1. Whitelist писался на глаз — `(stitch\.tech|vercel\.app|marketradar\.ai)`.
 *     Домена stitch.tech у Google Stitch не существует: SDK ходит на
 *     stitch.googleapis.com, а downloadUrl отдаётся с googleusercontent /
 *     storage.googleapis.com. Итог: ни «Публичная ссылка», ни «Скачать HTML»
 *     не срабатывали НИ РАЗУ — юзер всегда получал «Допустимы только URL со
 *     Stitch/Vercel/marketradar.ai».
 *  2. Без заголовка X-Goog-Api-Key часть downloadUrl отдаёт 401/403, и роут
 *     показывал это как «Возможно, ссылка истекла», маскируя проблему авторизации.
 *
 * Здесь и то, и другое собрано в одном месте: реальный список хостов, проверка
 * через checkSafeUrl (он матчит host строго по границе домена, так что
 * evil-googleapis.com не пройдёт), ключ Stitch и единый разбор ошибок.
 */
import { checkSafeUrl } from "@/lib/url-guard";

/**
 * Хосты, с которых Stitch реально отдаёт сгенерированный HTML.
 * vercel.app — наш собственный деплой через landing-deploy-vercel.
 */
export const STITCH_ALLOWED_HOSTS = [
  // Фактический хост, с которого Stitch отдаёт HTML (проверено на живой
  // генерации): contribution.usercontent.google.com. Именно его не было
  // ни в старом regex'е (stitch.tech — такого домена не существует), ни в
  // первой версии этого списка, собранной по догадкам из proxy-landing.
  "usercontent.google.com",
  "googleusercontent.com",
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  "stitch.googleapis.com",
  "stitch-pa.googleapis.com",
  "vercel.app",
];

/** Больше 5 МБ в БД не кладём и на экспорт не отдаём. */
export const MAX_LANDING_HTML_BYTES = 5 * 1024 * 1024;

export type StitchHtmlResult =
  | { ok: true; html: string }
  | { ok: false; error: string; status: number };

/**
 * Тянет HTML лендинга по URL от Stitch с SSRF-защитой и авторизацией.
 * HTML берём ТОЛЬКО сервером по URL — принимать готовый htmlContent из тела
 * запроса нельзя, иначе кто угодно зальёт произвольный HTML в чужую шару.
 */
export async function fetchStitchHtml(rawUrl: string, timeoutMs = 25_000): Promise<StitchHtmlResult> {
  const htmlUrl = (rawUrl ?? "").trim();
  if (!htmlUrl) {
    return { ok: false, error: "htmlUrl обязателен", status: 400 };
  }

  const guard = await checkSafeUrl(htmlUrl, { allowedHosts: STITCH_ALLOWED_HOSTS });
  if (!guard.ok) {
    return {
      ok: false,
      error: `Ссылка не похожа на лендинг Stitch (${guard.reason ?? "недопустимый URL"})`,
      status: 400,
    };
  }

  const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,*/*",
  };
  if (apiKey) headers["X-Goog-Api-Key"] = apiKey;

  let html: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(htmlUrl, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      // 401/403 — почти всегда отсутствующий/протухший ключ, а не срок ссылки.
      const hint = res.status === 401 || res.status === 403
        ? "нет доступа к файлу (проверьте GOOGLE_STITCH_API_KEY)"
        : "возможно, ссылка истекла";
      return {
        ok: false,
        error: `Не удалось скачать HTML лендинга (HTTP ${res.status}) — ${hint}.`,
        status: 502,
      };
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Не удалось скачать HTML лендинга: ${msg}`, status: 502 };
  }

  if (html.length > MAX_LANDING_HTML_BYTES) {
    return {
      ok: false,
      error: `HTML слишком большой (${(html.length / 1024 / 1024).toFixed(1)}МБ, максимум 5МБ)`,
      status: 413,
    };
  }
  if (html.length < 100) {
    return {
      ok: false,
      error: "Скачали пустой/слишком короткий HTML — возможно, ссылка уже не работает",
      status: 502,
    };
  }

  return { ok: true, html };
}
