/**
 * Клиентский kick+poll для POST /api/analyze.
 *
 * Company-ветка анализа (scrapeWebsite → Claude → DaData/HH/SpyWords/
 * Keys.so/PageSpeed/Wayback/Rusprofile/Yandex/2GIS) переведена на фон —
 * см. шапку src/app/api/analyze/route.ts и src/lib/analyze-status.ts: nginx
 * на VPS обрывает долгие проксируемые запросы, синхронный анализ на
 * медленных сайтах падал 502 (живой репро: orlink.ru).
 *
 * POST теперь только кикает и возвращает { ok, jobId }, дальше опрашиваем
 * GET /api/analyze/status?jobId=... до { done: true, data }.
 *
 * Personal-brand ветка (profileKind: "personal") на сервере осталась
 * синхронной — она короче и стабильна (не источник 502 в проде). Она
 * отвечает сразу { ok, data } без jobId — отличаем по его отсутствию и
 * возвращаем data напрямую, не уходя в поллинг.
 *
 * Используется из src/components/AppShell.tsx (analyzeUrl) и
 * src/components/dashboard/QuickAnalyzeCard.tsx (handleAnalyze) — контракт
 * (принимает body анализа, возвращает данные результата или бросает Error
 * с человекочитаемым текстом) не меняется относительно старого прямого fetch.
 */
import { jsonOrThrow } from "@/lib/safe-fetch-json";

const ANALYZE_POLL_INTERVAL_MS = 4000;
// 5 минут — анализ реально может идти долго при живых внешних API
// (SpyWords/Keys.so/PageSpeed и т.д.), не 90s maxDuration самого кика.
const ANALYZE_POLL_DEADLINE_MS = 300_000;

interface AnalyzeKickResponse {
  ok: boolean;
  jobId?: string;
  data?: unknown; // personal-brand ветка отвечает синхронно тем же {ok,data}, без jobId
  error?: string;
}

interface AnalyzeStatusResponse {
  ok: boolean;
  done?: boolean;
  data?: unknown;
  error?: string;
}

export async function analyzeCompanyKickPoll<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Защита от HTML-ответов nginx (502/504 при таймауте на самом кике) —
  // не падаем на JSON.parse, отдаём понятную ошибку.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    console.error("[analyze] non-JSON response on kick", res.status, text.slice(0, 200));
    throw new Error(
      res.status === 504 || res.status === 502
        ? "Сервер не успел запустить анализ (timeout). Попробуйте ещё раз."
        : `Ошибка сервера (${res.status})`,
    );
  }

  const kick = await jsonOrThrow<AnalyzeKickResponse>(res);
  if (!kick.ok) throw new Error(kick.error ?? "Ошибка анализа");

  // Personal-brand: сервер уже всё сделал синхронно, jobId не выдавался.
  if (!kick.jobId) {
    return kick.data as T;
  }

  const jobId = kick.jobId;
  const deadline = Date.now() + ANALYZE_POLL_DEADLINE_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, ANALYZE_POLL_INTERVAL_MS));

    let statusJson: AnalyzeStatusResponse;
    try {
      const sr = await fetch(`/api/analyze/status?jobId=${encodeURIComponent(jobId)}`);
      statusJson = await jsonOrThrow<AnalyzeStatusResponse>(sr);
    } catch {
      // Сетевой сбой самого опроса (blip) — не вердикт по задаче анализа,
      // пробуем на следующем тике вместо немедленного провала (тот же
      // паттерн, что internal-fetch-failed в src/app/api/content/video/render/route.ts).
      continue;
    }

    if (!statusJson.ok) {
      throw new Error(statusJson.error ?? "Ошибка анализа");
    }
    if (statusJson.done) {
      return statusJson.data as T;
    }
    // done: false — анализ ещё идёт, пробуем на следующем тике.
  }

  throw new Error("Анализ занял слишком много времени (>5 мин). Попробуйте ещё раз.");
}
