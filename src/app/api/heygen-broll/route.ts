/**
 * POST /api/heygen-broll
 *
 * Создаёт b-roll-клип через HeyGen Video Agent v3.
 *
 * Старый путь (deprecated 2025):
 *   POST /v1/workflows/executions { workflow_type: "GenerateVideoNode", input: {...} }
 *
 * Актуальный путь (HeyGen v3 docs, 2026):
 *   POST /v3/video-agents { prompt, mode, orientation, files? }
 *   → возвращает { session_id, status, video_id (когда готов) }
 *
 * Status-polling:
 *   GET /v3/video-agents/{session_id} → { status, progress, video_id }
 *   GET /v3/videos/{video_id} → { video_url, thumbnail_url } (когда готово)
 *
 * Body нашего route:
 *   prompt        обязателен — visual description for b-roll (English лучше)
 *   referenceImageUrl  опц — image-to-video через files[]
 *   aspectRatio        default "9:16" (vertical для рилсов) → orientation: "portrait"
 *
 * Returns:
 *   { ok, sessionId, status: "thinking"|"generating"|... }
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const HEYGEN_ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1"]);

function mapOrientation(aspectRatio: string): "landscape" | "portrait" | null {
  if (aspectRatio === "9:16") return "portrait";
  if (aspectRatio === "16:9") return "landscape";
  // 1:1 не имеет прямого аналога в v3 video-agents — отдаём auto-detect.
  return null;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "HEYGEN_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt: string = String(body.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "prompt обязателен" },
        { status: 400 },
      );
    }
    if (prompt.length > 10000) {
      return NextResponse.json(
        { ok: false, error: "prompt длиннее 10000 символов (лимит HeyGen)" },
        { status: 400 },
      );
    }

    const aspectRatio = HEYGEN_ASPECT_RATIOS.has(body.aspectRatio) ? body.aspectRatio : "9:16";
    const orientation = mapOrientation(aspectRatio);

    // Тело v3-эндпоинта. Только обязательное (prompt) и явно нужные поля.
    interface AgentPayload {
      prompt: string;
      mode: "generate";
      orientation?: "landscape" | "portrait";
      files?: Array<{ url: string }>;
    }
    const payload: AgentPayload = {
      prompt,
      mode: "generate",
    };
    if (orientation) payload.orientation = orientation;
    if (typeof body.referenceImageUrl === "string" && body.referenceImageUrl.startsWith("http")) {
      payload.files = [{ url: body.referenceImageUrl }];
    }

    const res = await fetch("https://api.heygen.com/v3/video-agents", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      // Особые случаи: 401/403 — нет доступа к Video Agents (нужен платный план),
      // 404 — endpoint не существует (старый ключ / урезанный аккаунт).
      const hint =
        res.status === 401 || res.status === 403
          ? " — Video Agents API недоступен на вашем тарифе HeyGen. Нужен платный план с включённым продуктом."
          : res.status === 404
          ? " — endpoint /v3/video-agents не найден. Возможно, у вас старая версия API."
          : "";
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${text.slice(0, 400)}${hint}` },
        { status: 500 },
      );
    }

    let parsed: {
      data?: { session_id?: string; status?: string; video_id?: string | null };
    } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const sessionId = parsed?.data?.session_id;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул session_id: ${text.slice(0, 400)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      // Совместимость со старым клиентом — он ждёт executionId, отдаём sessionId
      // под тем же ключом.
      executionId: sessionId,
      sessionId,
      status: parsed?.data?.status ?? "thinking",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
