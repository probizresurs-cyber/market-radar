/**
 * GET /api/heygen-broll-status?executionId=...
 *
 * Поллит HeyGen workflow execution на готовность b-roll-клипа.
 * Используется фронтом раз в 5-10 секунд после старта генерации.
 *
 * Статусы HeyGen:
 *   pending / running / processing — ещё не готово
 *   completed / succeeded — video_url доступен
 *   failed / error — провал, читаем error_message
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const executionId = searchParams.get("executionId");
    if (!executionId) {
      return NextResponse.json(
        { ok: false, error: "executionId обязателен" },
        { status: 400 },
      );
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "HEYGEN_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://api.heygen.com/v1/workflows/executions/${encodeURIComponent(executionId)}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
      },
    );

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: {
      data?: {
        status?: string;
        output?: { video_url?: string; thumbnail_url?: string };
        video_url?: string;
        thumbnail_url?: string;
        error?: string | { message?: string };
        error_message?: string;
      };
    } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const rawStatus = (parsed?.data?.status ?? "unknown").toLowerCase();
    const status =
      rawStatus === "completed" || rawStatus === "succeeded" ? "completed" :
      rawStatus === "failed" || rawStatus === "error" ? "failed" :
      rawStatus; // pending / running / processing / ...

    const videoUrl =
      parsed?.data?.output?.video_url ??
      parsed?.data?.video_url;
    const thumbnailUrl =
      parsed?.data?.output?.thumbnail_url ??
      parsed?.data?.thumbnail_url;

    const errRaw = parsed?.data?.error;
    const errorMessage =
      typeof errRaw === "string" ? errRaw :
      errRaw && typeof errRaw === "object" ? errRaw.message :
      parsed?.data?.error_message;

    return NextResponse.json({
      ok: true,
      data: { status, videoUrl, thumbnailUrl, error: errorMessage },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
