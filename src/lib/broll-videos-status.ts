/**
 * Общий файл-статус между кик-роутом (generate-broll-videos) и статус-роутом
 * (generate-broll-videos/status) — та же схема, что render-content-reel-status.ts:
 * генерация Replicate-клипов идёт в фоне, а не внутри HTTP-запроса.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const BROLL_STATUS_DIR = path.join(process.cwd(), "public", "broll-videos", ".status");

export interface BrollVideosStatus {
  status: "done" | "failed";
  urls?: string[];
  warning?: string | null;
  error?: string;
  durationMs?: number;
}

function statusFile(jobId: string): string {
  return path.join(BROLL_STATUS_DIR, `${jobId}.json`);
}

export async function writeBrollStatus(jobId: string, status: BrollVideosStatus): Promise<void> {
  await mkdir(BROLL_STATUS_DIR, { recursive: true });
  await writeFile(statusFile(jobId), JSON.stringify(status), "utf8");
}

export async function readBrollStatus(jobId: string): Promise<BrollVideosStatus | null> {
  try {
    const raw = await readFile(statusFile(jobId), "utf8");
    return JSON.parse(raw) as BrollVideosStatus;
  } catch {
    return null; // файла ещё нет — генерация не завершилась
  }
}
