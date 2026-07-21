import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { minifyHtml, deferExternalScripts, inlineCombineCss } from "@/lib/optimize-item";
import { assembleAstroProject, MODEL, type AstroFile, type OptimizationReport, type RebuildAstroResult, type SpeedCompare } from "../route";

// POST /api/rebuild-astro/optimize-item { id, key } — точечное одобрение ОДНОГО
// "ручного" пункта оптимизации (Фаза 4, п.8 спеки: клиент одобряет → делаем).
// В отличие от /optimize (стартует от baseHtml, применяет весь набор безопасных
// фиксов заново) — этот эндпоинт строит НАД текущим previewHtml, чтобы не
// потерять уже применённые правки (общие или другие точечные).
export const runtime = "nodejs";
export const maxDuration = 60;

interface Snapshot {
  previewHtml: string;
  baseHtml?: string;
  files: AstroFile[];
  fixes: string[];
  optimization?: OptimizationReport;
  optimizedAt?: string | null;
  speedCompare?: SpeedCompare | null;
  summary: string;
  modelUsed?: string;
  source: { url: string; title: string; issues: string[] };
  createdAt?: string;
}
interface Row { snapshot: Snapshot }

const ALLOWED_KEYS = new Set(["html-size", "ext-scripts", "ext-css", "jquery"]);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const limit = checkRateLimit(ip, { keyPrefix: "rebuild-optimize-item", maxRequests: 30, windowMs: 24 * 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Лимит запросов исчерпан. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  try {
    await initDb();
    const body = await req.json().catch(() => ({}));
    const id: string = typeof body.id === "string" ? body.id : "";
    const key: string = typeof body.key === "string" ? body.key : "";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
    }

    const rows = await query<Row>("SELECT snapshot FROM astro_rebuilds WHERE id = $1", [id]);
    const snap = rows[0]?.snapshot;
    if (!snap?.previewHtml) {
      return NextResponse.json({ ok: false, error: "Результат не найден или устарел" }, { status: 404 });
    }

    const optimization: OptimizationReport = snap.optimization
      ?? { stats: { htmlKb: 0, externalScripts: 0, externalCss: 0, images: 0, lazyImages: 0 }, issues: [], applied: [] };
    const issue = optimization.issues.find((i) => i.key === key);

    // jquery: безопасного авто-фикса нет — ставим задачу на ручную доработку,
    // HTML не трогаем. Честно, а не притворяемся, что "починили".
    if (key === "jquery") {
      if (issue) issue.queued = true;
      optimization.applied = [...optimization.applied, "jQuery: заявка на ручное удаление передана команде"];
      await query(
        "UPDATE astro_rebuilds SET snapshot = jsonb_set(snapshot, '{optimization}', $2::jsonb) WHERE id = $1",
        [id, JSON.stringify(optimization)],
      );
      return NextResponse.json({ ok: true, id, queuedManual: true, optimization });
    }

    let html = snap.previewHtml;
    let origin = "";
    try { origin = new URL(snap.source.url).origin; } catch { /* ignore */ }
    let appliedNote = "";

    if (key === "html-size") {
      const { html: out, savedBytes } = minifyHtml(html);
      html = out;
      appliedNote = `HTML минифицирован — освобождено ~${Math.round(savedBytes / 1024)} КБ`;
    } else if (key === "ext-scripts") {
      const { html: out, count } = deferExternalScripts(html);
      html = out;
      appliedNote = count > 0 ? `${count} внешних скриптов переведены на отложенную загрузку (defer)` : "Все скрипты уже не блокируют отрисовку";
    } else if (key === "ext-css") {
      const { html: out, count } = await inlineCombineCss(html);
      html = out;
      appliedNote = count > 0 ? `${count} CSS-файлов объединены в один встроенный блок` : "Не удалось объединить (файлы недоступны или их меньше двух)";
      if (count === 0) {
        return NextResponse.json({ ok: false, error: "Не удалось объединить стили — возможно, файлы уже объединены или недоступны" }, { status: 422 });
      }
    }

    if (issue) issue.fixed = true;
    optimization.applied = [...optimization.applied, appliedNote];

    const files = assembleAstroProject(html, origin || "https://example.com", snap.source.title || "Сайт");
    const updated: Snapshot = { ...snap, previewHtml: html, optimization, files };
    await query("UPDATE astro_rebuilds SET snapshot = $2 WHERE id = $1", [id, JSON.stringify(updated)]);

    const result: RebuildAstroResult = {
      ok: true, id, previewUrl: `/api/site-preview/${id}`,
      source: snap.source, files, fixes: snap.fixes,
      optimization, optimizedAt: snap.optimizedAt ?? null, speedCompare: snap.speedCompare ?? null,
      summary: snap.summary, modelUsed: snap.modelUsed || MODEL,
    };
    return NextResponse.json({ ...result, appliedNote });
  } catch (e) {
    console.error("rebuild-astro/optimize-item error:", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
