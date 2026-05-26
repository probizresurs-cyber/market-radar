/**
 * GET /api/agent/job/[id] — poll job status + progress + outputs
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJob, getJobFromDb } from "@/lib/agent-runner";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await ctx.params;
  // Сначала пытаемся достать из RAM (быстро для активных pollers). Если нет —
  // достаём из БД (выжил после PM2 restart).
  const job = getJob(id) ?? await getJobFromDb(id);
  if (!job) return NextResponse.json({ ok: false, error: "Job не найден" }, { status: 404 });

  // IDOR: раньше любой залогиненный мог поллить чужой jobId и видеть
  // логи генерации (содержат компанию/ЦА/СММ — конкурентная разведка)
  // или скачивать чужую готовую PPTX. Проверяем владение явно.
  // Admin может смотреть всё для дебага. Legacy-job без userId — допускаем
  // (создан до миграции), но новые точно проверяются.
  if (job.userId && job.userId !== session.userId && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому job" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      log: job.log,
      outputFiles: job.outputFiles,
      error: job.error,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      durationSec: job.finishedAt
        ? Math.round((job.finishedAt - job.startedAt) / 1000)
        : Math.round((Date.now() - job.startedAt) / 1000),
    },
  });
}
