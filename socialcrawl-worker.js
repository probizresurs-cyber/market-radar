/**
 * Cloudflare Worker — SocialCrawl API Proxy
 *
 * Forwards requests to https://api.socialcrawl.dev, bypassing Russian IP geo-blocks.
 * Deploy at: https://dash.cloudflare.com → Workers & Pages → Create Worker
 *
 * After deploy, copy the Worker URL and add to VPS .env:
 *   SOCIALCRAWL_PROXY_URL=https://your-worker-name.workers.dev
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-api-key, Accept, User-Agent",
        },
      });
    }

    // Build target URL on SocialCrawl
    const targetUrl = new URL(url.pathname + url.search, "https://api.socialcrawl.dev");

    // Forward headers but strip Cloudflare-injected ones
    const forwardHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower.startsWith("cf-") || lower === "x-forwarded-for" || lower === "x-real-ip") continue;
      forwardHeaders.set(key, value);
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      });

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      // Remove CSP and security headers that could block response
      responseHeaders.delete("content-security-policy");

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Proxy error", detail: String(err) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
