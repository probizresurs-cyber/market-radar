// Cloudflare Worker-прокси для OpenAI API.
//
// Зачем: OpenAI блокирует российские IP и отвечает
// `403 {"code":"unsupported_country_region_territory"}`.
//
// Почему понадобился новый: воркер, прописанный в OPENAI_BASE_URL до этого
// (hidden-base-b01d), до API доходил, но отдавал ту же гео-ошибку — то есть
// пересылал запрос вместе с заголовками Cloudflare (`cf-connecting-ip`,
// `x-forwarded-for`), по которым OpenAI и определяет страну клиента.
// Здесь эти заголовки вырезаны, как в рабочем anthropic-proxy.js.
//
// Что это чинило по факту: Whisper-транскрипцию озвучки в видео-конвейере
// (403 на /v1/audio/transcriptions), из-за чего субтитры теряли пословную
// синхронизацию с голосом и раскладывались оценочно.
//
// ВАЖНО про тело запроса: `/v1/audio/transcriptions` принимает
// multipart/form-data с аудиофайлом. Тело пробрасывается потоком
// (`request.body` + `duplex: "half"`), поэтому multipart проходит без
// пересборки. НЕ читать тело через `.text()`/`.formData()` — это сломает
// загрузку файлов и стриминг ответов chat/completions.
//
// ──────────────────────────────────────────────────────────────
// Как задеплоить
// ──────────────────────────────────────────────────────────────
// Вариант А (быстрее) — обновить существующий воркер:
//   Dashboard Cloudflare → Workers & Pages → hidden-base-b01d → Edit code →
//   вставить этот файл целиком → Deploy. URL не меняется, .env трогать не надо.
//
// Вариант Б — создать новый:
//   1. Workers & Pages → Create → Worker, имя например `mr-openai`.
//   2. Edit code → вставить этот файл → Deploy.
//   3. На VPS в .env заменить строку (БЕЗ завершающего слэша и без /v1):
//        OPENAI_BASE_URL=https://mr-openai.<account>.workers.dev
//      Проверить, что этой переменной нет в .env.local — он приоритетнее.
//   4. pm2 restart market-radar
//
// Проверка с VPS (оба должны вернуть 200):
//   curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $OPENAI_API_KEY" \
//     "$OPENAI_BASE_URL/v1/models"
//   curl -s -o /dev/null -w "%{http_code}\n" -X POST "$OPENAI_BASE_URL/v1/chat/completions" \
//     -H "Authorization: Bearer $OPENAI_API_KEY" -H 'Content-Type: application/json' \
//     -d '{"model":"gpt-4o-mini","max_tokens":5,"messages":[{"role":"user","content":"ping"}]}'

const UPSTREAM = "https://api.openai.com";

// Пропускаем только API-пути OpenAI — чтобы воркер нельзя было использовать
// как открытый прокси в произвольные адреса.
const ALLOWED_PREFIX = "/v1/";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ВРЕМЕННАЯ ДИАГНОСТИКА — удалить, когда причина 403 будет найдена.
    // Отвечает на два вопроса сразу: живой ли на воркере наш код (по
    // workerCodeVersion) и каким IP/страной воркер виден снаружи. Ключей не
    // логирует и ничего не проксирует.
    if (url.pathname === "/__diag") {
      const out = { workerCodeVersion: "openai-proxy-2026-07-31" };
      // Эхо-сервис НЕ на Cloudflare: запрос с Cloudflare на cloudflare.com
      // может не покидать их сеть и показывает внутренний адрес, а не тот,
      // которым воркер реально стучится в OpenAI. Первый замер был именно
      // таким и вывод по нему оказался несостоятельным.
      try {
        out.egress_ipify = (await fetch("https://api.ipify.org?format=json").then((r) => r.text())).slice(0, 120);
      } catch (e) {
        out.ipifyError = String(e && e.message ? e.message : e);
      }
      try {
        out.egress_icanhazip = (await fetch("https://icanhazip.com").then((r) => r.text())).trim().slice(0, 60);
      } catch (e) {
        out.icanhazipError = String(e && e.message ? e.message : e);
      }
      try {
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: request.headers.get("authorization") || "" },
        });
        out.openaiStatus = r.status;
        out.openaiBody = (await r.text()).slice(0, 200);
      } catch (e) {
        out.openaiError = String(e && e.message ? e.message : e);
      }
      return json(out, 200);
    }

    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return json(
        { error: { type: "invalid_request_error", message: "Only " + ALLOWED_PREFIX + "* paths are proxied" } },
        404,
      );
    }

    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    // Ключевая часть: вырезаем заголовки, раскрывающие исходный IP. Именно
    // из-за них прежний воркер получал гео-блок, хотя сам живёт вне РФ.
    // content-type НЕ трогаем — для multipart он несёт boundary.
    const fwdHeaders = new Headers();
    for (const [k, v] of request.headers) {
      const lk = k.toLowerCase();
      if (
        lk === "host" ||
        lk === "content-length" ||
        lk.startsWith("cf-") ||
        lk === "x-forwarded-for" ||
        lk === "x-forwarded-proto" ||
        lk === "x-forwarded-host" ||
        lk === "x-real-ip" ||
        lk === "true-client-ip" ||
        lk === "forwarded"
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
        // Тело как поток — иначе Workers требует duplex, а multipart с
        // аудиофайлом пришлось бы буферизовать целиком в памяти воркера.
        ...(body ? { duplex: "half" } : {}),
      });
    } catch (err) {
      return json(
        { error: { type: "api_error", message: "Upstream fetch failed: " + (err && err.message ? err.message : String(err)) } },
        502,
      );
    }

    // Ответ отдаём потоком — нужно и для SSE (stream: true в chat/completions),
    // и для крупных ответов вроде транскрипции длинного аудио.
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, OpenAI-Organization, OpenAI-Beta",
    "Access-Control-Max-Age": "86400",
  };
}
