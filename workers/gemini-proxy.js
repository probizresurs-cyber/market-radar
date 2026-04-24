// Cloudflare Worker-прокси для Google Generative Language (Gemini).
//
// Зачем: с российских IP google-api блокируется, поэтому VPS дёргает Gemini
// через этот Worker. Worker разворачивается на Cloudflare и принимает ровно
// те же пути, что и generativelanguage.googleapis.com
// (например `/v1beta/models/gemini-2.5-flash:generateContent?key=...`),
// форвардит их на Google и возвращает ответ как есть.
//
// ──────────────────────────────────────────────────────────────
// Как задеплоить
// ──────────────────────────────────────────────────────────────
// 1. Dashboard Cloudflare → Workers & Pages → Create → Worker → Quick Edit.
// 2. Вставить весь этот файл, Save & Deploy.
// 3. Получить URL вида https://<name>.<account>.workers.dev
// 4. На VPS в `.env`:
//       GEMINI_BASE_URL=https://<name>.<account>.workers.dev
//    (БЕЗ /v1beta и без ключа — все пути и ?key= дописываются в runtime).
// 5. pm2 restart market-radar
//
// Опционально: на Workers Paid ($5/мес) снимается 30-сек лимит — Gemini-image
// иногда генерит до 60 секунд. Если бесплатный тариф — большинство запросов
// всё равно укладывается.

const UPSTREAM = "https://generativelanguage.googleapis.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight — на случай прямых вызовов из браузера (по умолчанию мы
    // ходим с сервера, но пусть будет, дёшево).
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Склеиваем апстрим URL: берём path+query как есть и приклеиваем к Google.
    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    // Фильтруем hop-by-hop и клиентские заголовки, которые Google не любит.
    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers) {
      const lk = k.toLowerCase();
      if (lk === "host" || lk === "cf-connecting-ip" || lk.startsWith("cf-") || lk === "x-forwarded-for" || lk === "x-real-ip") continue;
      fwdHeaders.set(k, v);
    }

    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: fwdHeaders,
        body,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { code: 502, message: "Upstream fetch failed: " + (err && err.message ? err.message : String(err)) } }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // Проксируем ответ как есть, докидывая CORS.
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders())) respHeaders.set(k, v);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-goog-api-key, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
