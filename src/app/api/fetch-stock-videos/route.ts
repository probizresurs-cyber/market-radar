/**
 * POST /api/fetch-stock-videos
 *
 * Ищет в Pexels стоковые портретные видео по теме и качает их на диск
 * для использования в Remotion-композиции как замена AI-картинок b-roll'а.
 *
 * Зачем стоковые видео когда есть AI-картинки:
 *  - Cinematic движение само по себе — не нужно Ken-burns костыли
 *  - Реальные кадры с людьми/природой смотрятся «дороже» чем AI
 *  - Бесплатно (free Pexels tier 200 req/час, лицензия CC0-like)
 *
 * Body:
 *   query     — английская фраза по которой искать (Pexels плохо понимает русский)
 *   count     — сколько видео нужно (1-8)
 *   jobId?    — для группировки файлов на диске
 *
 * Returns:
 *   { ok, data: { videos: [{ url, durationSec, pexelsPageUrl }], jobId } }
 *
 * Видео сохраняются в /public/stock-videos/{jobId}-{i}.mp4 и отдаются
 * через /api/static-asset/stock-videos/... (Next 16 кеширует 404 для
 * прямой /public-статики, через API-роут — нет).
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { searchPexelsVideos, downloadPexelsVideo } from "@/lib/pexels-video";

export const runtime = "nodejs";
// Скачивание 4-8 видео по 5-15 MB каждое = 30-120 MB трафика, может
// растянуться до 90 сек на медленном CDN.
export const maxDuration = 180;

const STOCK_DIR = "stock-videos";

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const query = String(body.query ?? "").trim();
    if (!query) {
      return NextResponse.json(
        { ok: false, error: "query обязателен (на английском)" },
        { status: 400 },
      );
    }

    const count = Math.max(1, Math.min(8, Number(body.count ?? 4)));
    const jobId = String(body.jobId ?? `stock-${Date.now()}-${randomUUID().slice(0, 8)}`);

    // 1. Ищем в Pexels
    const search = await searchPexelsVideos({ query, count });
    if (!search.ok) {
      return NextResponse.json(
        { ok: false, error: `Pexels search failed: ${search.error}` },
        { status: 502 },
      );
    }
    if (!search.videos || search.videos.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Pexels не нашёл portrait-видео по запросу "${query}". Попробуй другой запрос.`,
        },
        { status: 404 },
      );
    }

    // 2. Качаем параллельно. Каждое видео ~5-15 MB. Если падает — пропускаем.
    const publicDir = path.join(process.cwd(), "public", STOCK_DIR);
    await mkdir(publicDir, { recursive: true });

    const downloadResults = await Promise.all(
      search.videos.map(async (v, i) => {
        const buf = await downloadPexelsVideo(v.downloadUrl);
        if (!buf) return { url: null, pexelsId: v.pexelsId, error: "download failed" };
        const fileName = `${jobId}-${i + 1}.mp4`;
        await writeFile(path.join(publicDir, fileName), buf);
        return {
          url: `/api/static-asset/${STOCK_DIR}/${fileName}`,
          pexelsId: v.pexelsId,
          pexelsPageUrl: v.pexelsPageUrl,
          durationSec: v.durationSec,
          bytes: buf.byteLength,
        };
      }),
    );

    const successful = downloadResults.filter((r) => r.url !== null);
    if (successful.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Все скачивания упали" },
        { status: 502 },
      );
    }

    await access.log({
      endpoint: "fetch-stock-videos",
      model: "pexels",
      success: true,
      durationMs: Date.now() - t0,
    });

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        videos: successful,
        urls: successful.map((s) => s.url as string),
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, elapsedMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}
