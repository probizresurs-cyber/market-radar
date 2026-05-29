/**
 * GET /api/promo-job-status/[jobId]
 *
 * Возвращает текущий статус async promo-reel-задачи:
 *   { ok, data: { jobId, status, progress, result, error, ageMs } }
 *
 * UI поллит этот endpoint каждые 3-5 сек пока status не станет
 * "done" или "failed". Каждый ответ возвращается <100ms — Cloudflare
 * и nginx-таймауты безразличны.
 *
 * Auth: read-only, доступен любому залогиненному юзеру (но видит только
 * свои jobs через filter по userId — anti-snooping).
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { getJob, touchPoll } from "@/lib/promo-jobs";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json(
      {
        ok: false,
        error: "Job не найден (мог истечь, PM2 restart, или typo в jobId)",
        reason: "not-found",
      },
      { status: 404 },
    );
  }

  // Защита: чужой юзер не видит чужой job (по userId). null = админ-fallback.
  if (job.userId && access.userId && job.userId !== access.userId) {
    return NextResponse.json(
      { ok: false, error: "Это не ваша задача", reason: "forbidden" },
      { status: 403 },
    );
  }

  touchPoll(jobId);
  const now = Date.now();

  return NextResponse.json({
    ok: true,
    data: {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      ageMs: now - job.createdAt,
      sinceUpdateMs: now - job.updatedAt,
    },
  });
}
