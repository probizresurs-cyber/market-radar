/**
 * GET /api/agent/job/[id] — poll job status + progress + outputs
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJob } from "@/lib/agent-runner";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "Job не найден" }, { status: 404 });

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
