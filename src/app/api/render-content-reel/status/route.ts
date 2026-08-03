/**
 * GET|POST /api/render-content-reel/status?jobId=...
 *
 * Опрашивается СНАРУЖИ оркестратором (content/video/render) короткими
 * запросами вместо одного долгого — см. шапку ../route.ts про то, почему
 * блокирующий вариант падал на ~300-й секунде даже по loopback.
 *
 * Returns:
 *   { ok: true, data: { done: false } }                              — ещё рендерится
 *   { ok: true, data: { done: true, url, sizeBytes, durationMs } }    — готово
 *   { ok: false, error }                                              — рендер упал
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { readRenderStatus } from "@/lib/render-content-reel-status";

export const runtime = "nodejs";
export const maxDuration = 30;

/** POST дублирует GET с тем же jobId в теле — оркестраторный callLocal умеет только POST. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return handleStatus(req, String(body.jobId ?? "").trim());
}

export async function GET(req: Request) {
  return handleStatus(req, new URL(req.url).searchParams.get("jobId")?.trim() ?? "");
}

async function handleStatus(req: Request, jobId: string) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  if (!jobId) return NextResponse.json({ ok: false, error: "jobId обязателен" }, { status: 400 });

  const status = await readRenderStatus(jobId);
  if (!status) return NextResponse.json({ ok: true, data: { done: false } });

  if (status.status === "failed") {
    return NextResponse.json({ ok: false, error: status.error ?? "Remotion упал без сообщения" });
  }

  return NextResponse.json({
    ok: true,
    data: {
      done: true,
      url: `/api/promo-reel/${jobId}`,
      sizeBytes: status.sizeBytes,
      durationMs: status.durationMs,
    },
  });
}
