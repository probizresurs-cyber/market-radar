/**
 * POST /api/record-screencast
 *
 * Запускает Playwright-сценарий, записывает mobile-скринкаст, конвертит в MP4,
 * публикует в /public/screencasts/, возвращает публичный URL.
 *
 * Этот URL потом передаётся в /api/render-promo-reel как screencastUrl,
 * чтобы Remotion-композиция показала запись внутри phone-frame.
 *
 * Тяжёлая операция (Playwright + Chrome + ffmpeg) — может занимать 25-40 сек
 * для 20-сек сценария. maxDuration выставлен в 120 сек с запасом.
 *
 * Body:
 *   scenarioId  — id сценария из screencast-scenarios.ts (default "marketing-tour")
 *   baseUrl?    — какой сайт записывать; default берётся из заголовков запроса
 *                 (origin), чтобы можно было запустить и на staging, и на prod
 *
 * Returns:
 *   { ok: true, data: { jobId, url, sizeBytes, durationMs } }
 *   url — /screencasts/{jobId}.mp4 (статика Next из /public)
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { checkAiAccess } from "@/lib/with-ai-security";
import { recordMobileScreencast, publishScreencast } from "@/lib/screencast-recorder";
import { getScenario, listScenarios } from "@/lib/screencast-scenarios";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const t0 = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const scenarioId = String(body.scenarioId ?? "marketing-tour");

    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        {
          ok: false,
          error: `Сценарий "${scenarioId}" не найден. Доступные: ${listScenarios().join(", ")}`,
          reason: "unknown-scenario",
        },
        { status: 400 },
      );
    }

    // baseUrl — либо явный из body, либо origin запроса (тот же домен где запущен app)
    const originFromReq = new URL(req.url).origin;
    const baseUrl = String(body.baseUrl ?? originFromReq);

    const jobId = `screencast-${Date.now()}-${randomUUID().slice(0, 8)}`;
    // Промежуточный output-dir — внутри remotion/out, который уже создаётся
    // в render-promo-reel. /public/screencasts создаётся при публикации.
    const tmpDir = path.join(process.cwd(), "remotion", "out", "screencasts-tmp");
    const publicDir = path.join(process.cwd(), "public", "screencasts");

    const result = await recordMobileScreencast({
      outDir: tmpDir,
      fileName: jobId,
      baseUrl,
      scenario,
      maxDurationSec: 30,
    });

    // Переносим в /public/screencasts, чтобы Next отдавал как статику
    await publishScreencast(result.mp4Path, publicDir, jobId);

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        scenarioId,
        // Через /api/static-asset/, а не прямую /screencasts/ статику —
        // Next 16 кеширует 404 для /public-путей которые мы дёргаем
        // ДО создания файла, и потом продолжает отдавать тот 404.
        url: `/api/static-asset/screencasts/${jobId}.mp4`,
        sizeBytes: result.sizeBytes,
        recordedInMs: result.durationMs,
        totalMs: Date.now() - t0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg, reason: "record-failed", elapsedMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: { scenarios: listScenarios() },
  });
}
