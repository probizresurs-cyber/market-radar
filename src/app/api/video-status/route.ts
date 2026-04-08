import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Polls HeyGen for the readiness of a generated video.
// Docs: https://docs.heygen.com/reference/get-video-status

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ ok: false, error: "videoId обязателен" }, { status: 400 });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const res = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Accept": "application/json",
        },
      },
    );

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `HeyGen status error ${res.status}: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: {
      data?: {
        status?: string;          // "pending" | "processing" | "completed" | "failed"
        video_url?: string;
        thumbnail_url?: string;
        error?: { message?: string } | string | null;
      };
    } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const status = parsed?.data?.status ?? "unknown";
    const videoUrl = parsed?.data?.video_url;
    const errorRaw = parsed?.data?.error;
    const errorMsg = typeof errorRaw === "string"
      ? errorRaw
      : errorRaw && typeof errorRaw === "object" && "message" in errorRaw
        ? (errorRaw as { message?: string }).message
        : undefined;

    return NextResponse.json({
      ok: true,
      data: {
        status,
        videoUrl,
        thumbnailUrl: parsed?.data?.thumbnail_url,
        error: errorMsg,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
