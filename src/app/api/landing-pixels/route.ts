/**
 * POST /api/landing-pixels
 *
 * Возвращает HTML-snippets для встраивания tracking-счётчиков в лендинг:
 *   - Yandex.Metrika (с webvisor)
 *   - Google Analytics 4
 *   - VK Pixel
 *   - Facebook/Meta Pixel
 *
 * Body: { yandexMetrika?, googleAnalytics?, vkPixel?, facebookPixel?, htmlUrl? }
 * Returns:
 *   { ok, data: { pixelsBlock, warnings, injectedHtml? } }
 *
 * Если передан `htmlUrl` — скачиваем HTML и сразу инжектим pixel-блок,
 * возвращая готовый файл к скачиванию.
 *
 * Не дёргает AI — pure JS templates. Не списывает с подписки.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  generatePixelsBlock,
  validatePixels,
  injectPixels,
  type PixelConfig,
} from "@/lib/landing-pixels";
import { fetchWithTimeout, FAST_TIMEOUT_MS } from "@/lib/fetch-timeout";
import { checkSafeUrl } from "@/lib/url-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  // Auth обязателен — pixel-конфиг привязан к лендингу пользователя.
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  let body: PixelConfig & { htmlUrl?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const validation = validatePixels(body);
  const pixelsBlock = generatePixelsBlock(body);

  let injectedHtml: string | undefined;
  let urlWarning: string | undefined;
  if (typeof body.htmlUrl === "string" && body.htmlUrl.startsWith("http") && pixelsBlock) {
    // SSRF guard — same defenses as landing-seo-meta.
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
          injectedHtml = injectPixels(html, pixelsBlock);
        }
      } catch (e) {
        console.warn("[landing-pixels] fetch htmlUrl failed:", e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      pixelsBlock,
      warnings: validation.warnings,
      injectedHtml,
      urlWarning,
    },
  });
}
