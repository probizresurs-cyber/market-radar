/**
 * POST /api/landing-seo-meta
 *
 * Возвращает готовый HTML-блок SEO meta-тегов для лендинга:
 *   - <title>, <meta description>
 *   - OpenGraph (Facebook/VK/Telegram preview)
 *   - Twitter Card
 *   - JSON-LD Schema.org (Organization или LocalBusiness)
 *
 * Юзер вставляет блок в <head> или мы инжектим автоматически при
 * последующих экспортах. Не дёргает AI — собирает из переданных данных
 * компании (быстро, бесплатно, детерминированно).
 *
 * Body: см. LandingMetaInput из lib/seo-meta.ts.
 * Returns: { ok, data: { metaBlock: string, injectedHtml?: string } }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateLandingMeta, injectSeoMeta, type LandingMetaInput } from "@/lib/seo-meta";
import { fetchWithTimeout, FAST_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { checkSafeUrl } from "@/lib/url-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  // Не дорогой endpoint, но возвращает данные привязанные к лендингу —
  // лучше требовать auth, чтобы не утечь company-данные через body.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  let body: LandingMetaInput & { htmlUrl?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const metaBlock = generateLandingMeta(body);

  // Опционально: если передан htmlUrl — скачаем HTML и сразу инжектим
  // мета-блок, чтобы юзер мог скачать уже готовый файл.
  let injectedHtml: string | undefined;
  let urlWarning: string | undefined;
  if (typeof body.htmlUrl === "string" && body.htmlUrl.startsWith("http")) {
    // КРИТИЧНО: SSRF guard. Раньше принимали любой htmlUrl и тащили его с
    // сервера — можно было пробить http://localhost:3000/api/admin/...
    // (читать чужие admin-эндпоинты через нашу прокси) или AWS metadata.
    // Разрешаем только публичные https URL (Stitch / CDN'ы); DNS-resolve
    // проверяет что hostname не указывает на приватный IP.
    const guard = await checkSafeUrl(body.htmlUrl, {
      allowedProtocols: ["https:"],
      resolveDns: true,
    });
    if (!guard.ok) {
      urlWarning = `htmlUrl отклонён по соображениям безопасности: ${guard.reason}`;
    } else {
      try {
        const res = await fetchWithTimeout(body.htmlUrl, {}, FAST_TIMEOUT_MS);
        if (res.ok) {
          const html = await res.text();
          injectedHtml = injectSeoMeta(html, metaBlock);
        }
      } catch (e) {
        console.warn("[landing-seo-meta] fetch htmlUrl failed:", e);
        // продолжаем — отдадим только metaBlock
      }
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      metaBlock,
      injectedHtml,
      urlWarning,
    },
  });
}
