/**
 * GET /api/video-status?videoId=...
 *
 * Поллит готовность видео, созданного через HeyGen Video Agent v3.
 * Параметр называется videoId для совместимости со старым клиентом, но
 * фактически это session_id из /v3/video-agents.
 *
 * Двухшаговый poll:
 *   1) GET /v3/video-agents/{session_id} — статус сессии + video_id
 *   2) Если status=completed и video_id есть —
 *      GET /v3/videos/{video_id} → { video_url, thumbnail_url, duration }
 *
 * Маппинг статусов HeyGen → наш фронт:
 *   thinking / generating / reviewing / waiting_for_input → "processing"
 *   completed → "completed" (с videoUrl)
 *   failed → "failed"
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("videoId") ?? searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "videoId / sessionId обязателен" }, { status: 400 });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    // Шаг 1: status сессии Video Agent
    const sessionRes = await fetch(
      `https://api.heygen.com/v3/video-agents/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
      },
    );

    const sessionText = await sessionRes.text();
    if (!sessionRes.ok) {
      // Fallback: вдруг это старый v1/v2 video_id (если есть unmigrated рилсы
      // в localStorage). Пробуем старый эндпоинт.
      if (sessionRes.status === 404) {
        const legacyRes = await fetch(
          `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(sessionId)}`,
          { headers: { "X-Api-Key": apiKey, Accept: "application/json" } },
        );
        if (legacyRes.ok) {
          const legacyText = await legacyRes.text();
          let legacy: {
            data?: { status?: string; video_url?: string; thumbnail_url?: string; error?: { message?: string } | string | null };
          } = {};
          try { legacy = JSON.parse(legacyText); } catch { /* ignore */ }
          const status = legacy?.data?.status ?? "unknown";
          const errRaw = legacy?.data?.error;
          const errorMsg =
            typeof errRaw === "string" ? errRaw :
            errRaw && typeof errRaw === "object" && "message" in errRaw
              ? (errRaw as { message?: string }).message
              : undefined;
          return NextResponse.json({
            ok: true,
            data: {
              status,
              videoUrl: legacy?.data?.video_url,
              thumbnailUrl: legacy?.data?.thumbnail_url,
              error: errorMsg,
            },
          });
        }
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen ${sessionRes.status}: ${sessionText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: {
      data?: {
        session_id?: string;
        status?: string;
        progress?: number;
        video_id?: string | null;
        messages?: Array<{ role: string; content: string; type: string }>;
      };
    } = {};
    try { parsed = JSON.parse(sessionText); } catch { /* ignore */ }

    const rawStatus = (parsed?.data?.status ?? "unknown").toLowerCase();
    const status =
      rawStatus === "completed" ? "completed" :
      rawStatus === "failed" ? "failed" :
      // thinking / generating / reviewing / waiting_for_input — всё в "processing"
      "processing";

    let videoUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    const realVideoId = parsed?.data?.video_id;
    if (rawStatus === "completed" && realVideoId) {
      try {
        const videoRes = await fetch(
          `https://api.heygen.com/v3/videos/${encodeURIComponent(realVideoId)}`,
          { headers: { "X-Api-Key": apiKey, Accept: "application/json" } },
        );
        if (videoRes.ok) {
          const videoText = await videoRes.text();
          let videoData: { data?: { video_url?: string; thumbnail_url?: string } } = {};
          try { videoData = JSON.parse(videoText); } catch { /* ignore */ }
          videoUrl = videoData?.data?.video_url;
          thumbnailUrl = videoData?.data?.thumbnail_url;
        }
        // Если URL ещё не готов — клиент продолжит поллинг.
        if (!videoUrl) {
          return NextResponse.json({
            ok: true,
            data: { status: "processing", videoUrl: undefined, thumbnailUrl: undefined, error: undefined },
          });
        }
      } catch {
        return NextResponse.json({
          ok: true,
          data: { status: "processing", videoUrl: undefined, thumbnailUrl: undefined, error: undefined },
        });
      }
    }

    let errorMessage: string | undefined;
    if (status === "failed") {
      const lastModelMsg = (parsed?.data?.messages ?? []).find(m => m.role === "model");
      errorMessage = lastModelMsg?.content ?? "Сессия завершилась с ошибкой";
    }

    return NextResponse.json({
      ok: true,
      data: { status, videoUrl, thumbnailUrl, error: errorMessage },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
