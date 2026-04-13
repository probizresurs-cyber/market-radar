import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Proxy Stitch-generated landing HTML to bypass X-Frame-Options / CORS.
 * Usage: GET /api/proxy-landing?url=<encoded_stitch_url>
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Sanity check — only allow fetching from known CDN domains
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const allowedHosts = [
    "storage.googleapis.com",
    "firebasestorage.googleapis.com",
    "stitch.googleapis.com",
    "stitch-pa.googleapis.com",
    "googleusercontent.com",
    "googleapis.com",
  ];
  const isAllowed = allowedHosts.some(h => parsedUrl.hostname.endsWith(h));
  if (!isAllowed) {
    return NextResponse.json({ error: `Host not allowed: ${parsedUrl.hostname}` }, { status: 403 });
  }

  const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;

  const fetchHeaders: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,*/*",
    "User-Agent": "Mozilla/5.0 (compatible; MarketRadar/1.0)",
  };
  if (apiKey) {
    fetchHeaders["X-Goog-Api-Key"] = apiKey;
  }

  let html: string;
  try {
    const res = await fetch(targetUrl, { headers: fetchHeaders });
    if (!res.ok) {
      // Return a helpful error page inside the iframe
      html = `<!doctype html><html><body style="font-family:sans-serif;padding:40px;color:#666">
        <h3>Не удалось загрузить лендинг</h3>
        <p>HTTP ${res.status}: ${res.statusText}</p>
        <p><a href="${targetUrl}" target="_blank">Открыть напрямую →</a></p>
      </body></html>`;
    } else {
      html = await res.text();

      // Patch relative asset URLs to be absolute (so fonts/images load from Stitch CDN)
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/[^/]*$/, "/")}`;
      html = html.replace(/<head>/i, `<head><base href="${baseUrl}">`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    html = `<!doctype html><html><body style="font-family:sans-serif;padding:40px;color:#666">
      <h3>Ошибка загрузки</h3><p>${msg}</p>
      <p><a href="${targetUrl}" target="_blank">Открыть напрямую →</a></p>
    </body></html>`;
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Allow embedding in iframe from any origin
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
      "Cache-Control": "public, max-age=300",
    },
  });
}
