/**
 * Общий файл-статус между кик-роутом (analyze) и статус-роутом
 * (analyze/status) — company-анализ (scrapeWebsite → Claude → куча
 * enrichment-источников: DaData/HH/SpyWords/Keys.so/PageSpeed/Wayback/
 * Rusprofile/Yandex/2GIS) может уйти за минуту, а self-hosted `next start`
 * без кастомного server.js не соблюдает Next.js maxDuration — Node режет
 * соединение около 300с, а nginx перед ним может резать ещё раньше при
 * нагрузке (эмпирически: 502 на orlink.ru при первом запуске). Тот же
 * приём, что уже применён для видео-рендера (см.
 * render-content-reel-status.ts) — кик пишет "running" и запускает пайплайн
 * в фоне, статус-роут читает файл, результату негде больше жить, кроме
 * диска, раз сам HTTP-запрос кика уже завершился.
 *
 * Не привязано к Remotion (в отличие от REMOTION_PROJECT_DIR/OUTPUT_DIR),
 * поэтому просто os.tmpdir() + своя подпапка.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import type { AnalysisResult } from "@/lib/types";

export const ANALYZE_JOBS_DIR =
  process.env.ANALYZE_JOBS_DIR ?? path.join(os.tmpdir(), "market-radar-analyze-jobs");

export interface AnalyzeStatus {
  status: "running" | "done" | "failed";
  /** Присутствует только при status:"done" — полный AnalysisResult, как раньше уходил в HTTP-ответ. */
  data?: AnalysisResult;
  error?: string;
  startedAt: number;
}

function statusFile(jobId: string): string {
  return path.join(ANALYZE_JOBS_DIR, `${jobId}.json`);
}

export async function writeAnalyzeStatus(jobId: string, status: AnalyzeStatus): Promise<void> {
  await mkdir(ANALYZE_JOBS_DIR, { recursive: true });
  await writeFile(statusFile(jobId), JSON.stringify(status), "utf8");
}

export async function readAnalyzeStatus(jobId: string): Promise<AnalyzeStatus | null> {
  try {
    const raw = await readFile(statusFile(jobId), "utf8");
    return JSON.parse(raw) as AnalyzeStatus;
  } catch {
    return null; // файла ещё нет — джоб не найден (неизвестный jobId либо ещё не успел стартовать)
  }
}
