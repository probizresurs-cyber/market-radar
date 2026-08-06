/**
 * GET /api/analyze/status?jobId=...
 *
 * Опрашивается СНАРУЖИ клиентом (AppShell.tsx analyzeUrl / QuickAnalyzeCard)
 * короткими запросами вместо одного долгого — см. шапку ../route.ts про то,
 * почему блокирующий company-анализ падал 502 на nginx.
 *
 * Returns:
 *   { ok: true, done: false }                — джоб ещё не найден / выполняется
 *   { ok: true, done: true, data: <AnalysisResult> } — готово, форма ответа
 *     та же, что раньше уходила синхронно из POST /api/analyze
 *   { ok: false, error }                     — анализ упал
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { readAnalyzeStatus } from "@/lib/analyze-status";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  // countUsage:false — опрашивается раз в несколько секунд, не должен в
  // одиночку сжирать дневной лимит 100 AI-запросов (см. with-ai-security.ts).
  const access = await checkAiAccess(req, { countUsage: false });
  if (!access.allowed) return access.response;

  const jobId = new URL(req.url).searchParams.get("jobId")?.trim() ?? "";
  if (!jobId) return NextResponse.json({ ok: false, error: "jobId обязателен" }, { status: 400 });

  const status = await readAnalyzeStatus(jobId);
  if (!status || status.status === "running") {
    return NextResponse.json({ ok: true, done: false });
  }

  if (status.status === "failed") {
    return NextResponse.json({ ok: false, error: status.error ?? "Анализ упал без сообщения" });
  }

  return NextResponse.json({ ok: true, done: true, data: status.data });
}
