/**
 * POST /api/check-url-alive
 *
 * Быстрая проверка что URL ещё жив (200) — используется для Stitch
 * htmlUrl/imageUrl, которые истекают через 1-7 дней. UI показывает
 * badge «срок истёк» если в истории лендингов превью 404'ит.
 *
 * Делает HEAD-запрос (быстро + не качает body). Если HEAD не поддерживается
 * (некоторые CDN отвечают 405) — fallback на GET с Range: 0-0.
 *
 * Защита от SSRF — переиспользуем checkSafeUrl.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkSafeUrl } from "@/lib/url-guard";
import { fetchWithTimeout, FAST_TIMEOUT_MS } from "@/lib/fetch-timeout";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  let body: { url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const url = (body.url ?? "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });

  // SSRF guard
  const guard = await checkSafeUrl(url, {
    allowedProtocols: ["https:", "http:"],
    resolveDns: true,
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.reason, alive: false }, { status: 400 });
  }

  // HEAD first
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD" }, FAST_TIMEOUT_MS);
    if (res.ok) return NextResponse.json({ ok: true, alive: true, status: res.status });
    if (res.status === 405) {
      // HEAD не разрешён — fallback на GET 0-0
      const res2 = await fetchWithTimeout(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      }, FAST_TIMEOUT_MS);
      return NextResponse.json({ ok: true, alive: res2.ok || res2.status === 206, status: res2.status });
    }
    return NextResponse.json({ ok: true, alive: false, status: res.status });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      alive: false,
      error: e instanceof Error ? e.message : "fetch failed",
    });
  }
}
