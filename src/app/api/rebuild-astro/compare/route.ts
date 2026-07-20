import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import type { SpeedCompare, SpeedMetrics } from "../route";

// POST /api/rebuild-astro/compare { id } — реальный замер «было → стало»:
// гоняем Lighthouse (Google PageSpeed API, mobile) по ОРИГИНАЛЬНОМУ сайту и
// по нашему публичному превью пересобранной версии, отдаём метрики бок о бок.
// Никаких выдуманных цифр — только то, что вернул PSI; если замер одной из
// сторон упал, честно отдаём null + причину.
//
// Результат сохраняется в snapshot (jsonb_set) — переживает перезагрузку и
// виден всем, у кого есть публичная ссылка на результат.
export const runtime = "nodejs";
export const maxDuration = 180;

const EMPTY: SpeedMetrics = { performance: null, fcpMs: null, lcpMs: null, tbtMs: null, cls: null, bytes: null };

async function runPsi(target: string): Promise<SpeedMetrics> {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", target);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.set("category", "performance");
  // Без ключа у Google жёсткая квота; PAGESPEED_API_KEY (опц.) её снимает.
  const key = process.env.PAGESPEED_API_KEY;
  if (key) api.searchParams.set("key", key);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 110_000);
  try {
    const res = await fetch(api.toString(), { signal: ctrl.signal });
    if (!res.ok) return { ...EMPTY, error: `PageSpeed вернул ${res.status}` };
    const j = await res.json();
    const lr = j?.lighthouseResult;
    const audits = lr?.audits ?? {};
    const num = (k: string): number | null =>
      typeof audits[k]?.numericValue === "number" ? audits[k].numericValue : null;
    const score = lr?.categories?.performance?.score;
    return {
      performance: typeof score === "number" ? Math.round(score * 100) : null,
      fcpMs: num("first-contentful-paint"),
      lcpMs: num("largest-contentful-paint"),
      tbtMs: num("total-blocking-time"),
      cls: num("cumulative-layout-shift"),
      bytes: num("total-byte-weight"),
    };
  } catch (e) {
    return { ...EMPTY, error: e instanceof Error && e.name === "AbortError" ? "Замер не уложился в таймаут" : "Ошибка запроса к PageSpeed" };
  } finally {
    clearTimeout(timer);
  }
}

interface Row { snapshot: { source?: { url?: string } } }

export async function POST(req: Request) {
  // PSI-замеры тяжёлые (до минуты каждый) — свой суточный IP-лимит.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const limit = checkRateLimit(ip, { keyPrefix: "rebuild-compare", maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Лимит замеров на сегодня исчерпан. Попробуйте завтра." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  try {
    await initDb();
    const body = await req.json().catch(() => ({}));
    const id: string = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "Не передан id результата" }, { status: 400 });

    const rows = await query<Row>("SELECT snapshot FROM astro_rebuilds WHERE id = $1", [id]);
    const originalUrl = rows[0]?.snapshot?.source?.url;
    if (!originalUrl) {
      return NextResponse.json({ ok: false, error: "Результат не найден или устарел" }, { status: 404 });
    }

    // Абсолютный публичный URL превью — PSI ходит к нам снаружи.
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const rebuiltUrl = `${proto}://${host}/api/site-preview/${id}`;

    const [original, rebuilt] = await Promise.all([runPsi(originalUrl), runPsi(rebuiltUrl)]);

    const speedCompare: SpeedCompare = {
      original,
      rebuilt,
      measuredAt: new Date().toISOString(),
      strategy: "mobile",
    };

    // Персистим в снапшот — замер переживает перезагрузку и виден по ссылке.
    await query(
      `UPDATE astro_rebuilds SET snapshot = jsonb_set(snapshot, '{speedCompare}', $2::jsonb, true) WHERE id = $1`,
      [id, JSON.stringify(speedCompare)],
    ).catch((e) => console.error("[rebuild-compare] persist failed:", e));

    return NextResponse.json({ ok: true, speedCompare });
  } catch (e) {
    console.error("rebuild-astro/compare error:", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
