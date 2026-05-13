/**
 * GET /api/heygen-broll-status?executionId=...
 *
 * Поллит готовность b-roll-клипа через HeyGen v3 Video Agents.
 *
 * Цепочка:
 *   1. GET /v3/video-agents/{session_id} → { status, progress, video_id? }
 *      status: thinking|waiting_for_input|reviewing|generating|completed|failed
 *   2. Если status === "completed" и есть video_id —
 *      GET /v3/videos/{video_id} → { video_url, thumbnail_url, duration }
 *
 * Параметр executionId — это session_id из v3 (имя сохранено для совместимости
 * со старым клиентом, который ждёт executionId).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("executionId") ?? searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "executionId / sessionId обязателен" },
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

    // Шаг 1: status сессии
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
      const hint =
        sessionRes.status === 401 || sessionRes.status === 403
          ? " — Video Agents API недоступен на вашем тарифе HeyGen."
          : "";
      return NextResponse.json(
        { ok: false, error: `HeyGen ${sessionRes.status}: ${sessionText.slice(0, 300)}${hint}` },
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
      rawStatus; // thinking / generating / reviewing / waiting_for_input / ...

    let videoUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    // Шаг 2: если готово — тянем video_url из /v3/videos/{video_id}
    const videoId = parsed?.data?.video_id;
    if (status === "completed" && videoId) {
      try {
        const videoRes = await fetch(
          `https://api.heygen.com/v3/videos/${encodeURIComponent(videoId)}`,
          {
            headers: {
              "X-Api-Key": apiKey,
              Accept: "application/json",
            },
          },
        );
        if (videoRes.ok) {
          const videoText = await videoRes.text();
          let videoData: {
            data?: { video_url?: string; thumbnail_url?: string };
          } = {};
          try { videoData = JSON.parse(videoText); } catch { /* ignore */ }
          videoUrl = videoData?.data?.video_url;
          thumbnailUrl = videoData?.data?.thumbnail_url;
        }
        // Если /v3/videos/{id} не отдал URL — клип на самом деле ещё рендерится,
        // оставим status="generating" чтобы клиент продолжил поллинг.
        if (!videoUrl) {
          return NextResponse.json({
            ok: true,
            data: { status: "generating", videoUrl: undefined, thumbnailUrl: undefined, error: undefined },
          });
        }
      } catch {
        // На ошибке шага 2 — клиент попробует ещё раз через 8 сек.
        return NextResponse.json({
          ok: true,
          data: { status: "generating", videoUrl: undefined, thumbnailUrl: undefined, error: undefined },
        });
      }
    }

    // Финальный fail-message из последнего model-сообщения сессии, если есть.
    let errorMessage: string | undefined;
    if (status === "failed") {
      const lastModelMsg = (parsed?.data?.messages ?? []).find(m => m.role === "model");
      errorMessage = lastModelMsg?.content ?? "Сессия завершилась с ошибкой";
    }

    return NextResponse.json({
      ok: true,
      data: { status, videoUrl, thumbnailUrl, error: errorMessage },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
