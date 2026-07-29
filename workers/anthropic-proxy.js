// Cloudflare Worker-прокси для Anthropic API (Claude).
//
// Зачем: Anthropic блокирует российские IP — прямой запрос с VPS получает
// `403 {"type":"forbidden","message":"Request not allowed"}`. Worker живёт на
// инфраструктуре Cloudflare (вне РФ), принимает те же пути, что
// api.anthropic.com (`/v1/messages`, `/v1/models`, ...) и форвардит их
// один-в-один. Ключ идёт в заголовке клиента — Worker его не хранит и не
// логирует.
//
// Взамен прокси по IP (http://155.212.231.73:8080), который 24.07.26 умер
// целиком и утащил за собой все ИИ-функции на Claude: КП-генератор, анализы
// компании/ЦА/СММ, тренды, генерацию постов, режиссёра роликов. Тот прокси
// был ещё и по HTTP — ключ ходил по открытому каналу через чужой сервер.
//
// ВАЖНО про стриминг: часть роутов (kp-generate, content/video/plan) ходит
// через `messages.stream` — это SSE. `upstream.body` пробрасывается как
// ReadableStream без буферизации, поэтому стрим работает. НЕ оборачивать
// ответ в `.text()`/`.json()` — это сломает стриминг и вернёт таймауты.
//
// ──────────────────────────────────────────────────────────────
// Как задеплоить
// ──────────────────────────────────────────────────────────────
// 1. Dashboard Cloudflare → Workers & Pages → Create → Worker.
// 2. Имя, например `mr-anthropic`. Deploy → затем "Edit code".
// 3. Вставить весь этот файл целиком, Deploy.
// 4. Скопировать URL вида https://mr-anthropic.<account>.workers.dev
// 5. На VPS в `.env.local` заменить строку (их там было ДВЕ — оставить одну):
//       ANTHROPIC_BASE_URL=https://mr-anthropic.<account>.workers.dev
//    БЕЗ завершающего слэша и без /v1 — SDK сам дописывает путь.
// 6. `pm2 restart market-radar`
// 7. Проверка с VPS (должен вернуть HTTP 200):
//       curl -sS -m 30 -o /dev/null -w "%{http_code} %{time_total}s\n" \
//         -X POST "$ANTHROPIC_BASE_URL/v1/messages" \
//         -H "x-api-key: $ANTHROPIC_API_KEY" \
//         -H "anthropic-version: 2023-06-01" \
//         -H "content-type: application/json" \
//         -d '{"model":"claude-haiku-4-5","max_tokens":20,"messages":[{"role":"user","content":"ping"}]}'
//
// Про лимиты: бесплатный тариф Workers — 100k запросов/день и 10 мс CPU на
// запрос. Проксирование почти не тратит CPU (только пересылаем поток, ничего
// не считаем), поэтому лимита хватает с запасом. Ограничение 30 секунд на
// бесплатном плане относится к CPU-времени, а не к ожиданию апстрима —
// длинные генерации Claude через Worker проходят.

const UPSTREAM = "https://api.anthropic.com";

// Пропускаем только API-пути Anthropic — чтобы Worker нельзя было
// использовать как открытый прокси в произвольные адреса.
const ALLOWED_PREFIX = "/v1/";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return json(
        { error: { type: "invalid_request_error", message: "Only " + ALLOWED_PREFIX + "* paths are proxied" } },
        404,
      );
    }

    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    // Чистим заголовки: host и cf-* поломают запрос/раскроют инфраструктуру.
    // x-api-key, anthropic-version, anthropic-beta, content-type, accept —
    // проходят как есть, они нужны Anthropic.
    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers) {
      const lk = k.toLowerCase();
      if (
        lk === "host" ||
        lk === "content-length" ||
        lk.startsWith("cf-") ||
        lk === "x-forwarded-for" ||
        lk === "x-forwarded-proto" ||
        lk === "x-real-ip"
      ) continue;
      fwdHeaders.set(k, v);
    }

    const body = ["GET", "HEAD"].includes(request.method) ? undefined : request.body;

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: fwdHeaders,
        body,
        // Нужно для передачи тела как потока (иначе Workers требует duplex).
        ...(body ? { duplex: "half" } : {}),
      });
    } catch (err) {
      return json(
        { error: { type: "api_error", message: "Upstream fetch failed: " + (err && err.message ? err.message : String(err)) } },
        502,
      );
    }

    // Ответ отдаём потоком — критично для SSE-стриминга messages.stream.
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders())) respHeaders.set(k, v);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  },
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version, anthropic-beta, authorization",
    "Access-Control-Max-Age": "86400",
  };
}
