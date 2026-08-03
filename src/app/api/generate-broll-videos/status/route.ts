/**
 * GET|POST /api/generate-broll-videos/status?jobId=...
 *
 * Опрашивается СНАРУЖИ оркестратором (content/video/render) короткими
 * запросами вместо одного долгого — см. шапку ../route.ts про то, почему
 * блокирующий вариант падал на ~300-й секунде даже по loopback.
 *
 * Returns:
 *   { ok: true, data: { done: false } }                                — ещё генерируется
 *   { ok: true, data: { done: true, urls, warning?, durationMs } }     — готово (хотя бы 1 клип)
 *   { ok: false, error }                                                — ни одного клипа не вышло
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { readBrollStatus } from "@/lib/broll-videos-status";

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
  // countUsage:false — опрашивается раз в 5 сек, не должен в одиночку
  // сжирать дневной лимит 100 AI-запросов (см. with-ai-security.ts).
  const access = await checkAiAccess(req, { countUsage: false });
  if (!access.allowed) return access.response;

  if (!jobId) return NextResponse.json({ ok: false, error: "jobId обязателен" }, { status: 400 });

  const status = await readBrollStatus(jobId);
  if (!status) return NextResponse.json({ ok: true, data: { done: false } });

  if (status.status === "failed") {
    return NextResponse.json({ ok: false, error: status.error ?? "Replicate не сгенерил ни одного видео" });
  }

  return NextResponse.json({
    ok: true,
    data: { done: true, urls: status.urls ?? [], warning: status.warning, durationMs: status.durationMs },
  });
}
