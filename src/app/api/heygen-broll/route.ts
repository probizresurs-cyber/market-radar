/**
 * POST /api/heygen-broll
 *
 * Создаёт b-roll-клип через HeyGen Video Agent (workflows API).
 * Использует тот же `HEYGEN_API_KEY` что и обычные говорящие аватары —
 * новый вендор не подключаем.
 *
 * Шаг 1: POST /v1/workflows/executions (workflow_type=GenerateVideoNode)
 * Шаг 2: возвращаем execution_id; фронт поллит /api/heygen-broll-status
 * Шаг 3: когда статус completed — приходит video_url
 *
 * Поставщики (provider):
 *   veo_3_1       — премиум, ~$2/мин, Veo 3.1 от Google
 *   veo_3_1_fast  — дешевле, чуть проще
 *   kling_pro     — Kling 3.0 от Kuaishou (хорошая физика)
 *   sora          — OpenAI Sora 2
 *   seedance      — динамичные камеры
 *
 * Body:
 *   prompt        обязателен — visual description for b-roll (English лучше)
 *   referenceImageUrl  опц — image-to-video (animate static image)
 *   tailImageUrl       опц — last-frame guidance
 *   provider           default "veo_3_1_fast" (быстрее/дешевле)
 *   aspectRatio        default "9:16" (vertical для рилсов)
 *
 * Returns:
 *   { ok, executionId, status: "pending" }
 *
 * Pricing reference: HeyGen Video Agent API = $2/min, 5-сек клип ≈ $0.17.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const HEYGEN_PROVIDERS = new Set([
  "veo_3_1",
  "veo_3_1_fast",
  "veo3",
  "veo3_fast",
  "kling_pro",
  "kling",
  "sora",
  "runway",
  "seedance",
]);

const HEYGEN_ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1"]);

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

    const provider = HEYGEN_PROVIDERS.has(body.provider) ? body.provider : "veo_3_1_fast";
    const aspectRatio = HEYGEN_ASPECT_RATIOS.has(body.aspectRatio) ? body.aspectRatio : "9:16";

    interface BrollInput {
      prompt: string;
      provider: string;
      aspect_ratio: string;
      reference_image_url?: string;
      tail_image_url?: string;
    }

    const input: BrollInput = {
      prompt,
      provider,
      aspect_ratio: aspectRatio,
    };
    if (typeof body.referenceImageUrl === "string" && body.referenceImageUrl.startsWith("http")) {
      input.reference_image_url = body.referenceImageUrl;
    }
    if (typeof body.tailImageUrl === "string" && body.tailImageUrl.startsWith("http")) {
      input.tail_image_url = body.tailImageUrl;
    }

    const res = await fetch("https://api.heygen.com/v1/workflows/executions", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        workflow_type: "GenerateVideoNode",
        input,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${text.slice(0, 400)}` },
        { status: 500 },
      );
    }

    let parsed: {
      data?: { execution_id?: string; id?: string; status?: string };
      execution_id?: string;
    } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    // HeyGen иногда возвращает id в data.execution_id, иногда в data.id, иногда в корне.
    const executionId =
      parsed?.data?.execution_id ??
      parsed?.data?.id ??
      parsed?.execution_id ??
      null;

    if (!executionId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул execution_id: ${text.slice(0, 400)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      executionId,
      status: parsed?.data?.status ?? "pending",
      provider,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
