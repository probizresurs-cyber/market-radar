/**
 * Общий файл-статус между кик-роутом (render-content-reel) и статус-роутом
 * (render-content-reel/status) — Remotion-рендер идёт в фоне через spawn,
 * а не внутри HTTP-запроса, поэтому его результат негде хранить, кроме диска.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const REMOTION_PROJECT_DIR =
  process.env.REMOTION_PROJECT_DIR ?? path.join(process.cwd(), "remotion");
export const OUTPUT_DIR = path.join(REMOTION_PROJECT_DIR, "out");

export interface RenderStatus {
  status: "done" | "failed";
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
}

function statusFile(jobId: string): string {
  return path.join(OUTPUT_DIR, `${jobId}.status.json`);
}

export async function writeRenderStatus(jobId: string, status: RenderStatus): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(statusFile(jobId), JSON.stringify(status), "utf8");
}

export async function readRenderStatus(jobId: string): Promise<RenderStatus | null> {
  try {
    const raw = await readFile(statusFile(jobId), "utf8");
    return JSON.parse(raw) as RenderStatus;
  } catch {
    return null; // файла ещё нет — рендер не завершился (ни успехом, ни провалом)
  }
}
