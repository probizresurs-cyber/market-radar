import { NextResponse } from "next/server";
import { ELEVENLABS_API_KEY } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 120;

// Clone a user voice via ElevenLabs Instant Voice Cloning.
// Docs: https://elevenlabs.io/docs/api-reference/voices/add
// Endpoint: POST https://api.elevenlabs.io/v1/voices/add (multipart/form-data)
// Form fields: name (string), files[] (one or more audio files), description (optional)
// Returns: { voice_id: string, requires_verification: boolean }
//
// Client sends JSON { dataUrl, mimeType, name }. Server rebuilds a multipart
// form with the audio blob + name, and forwards to ElevenLabs.

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dataUrl?: string;
      mimeType?: string;
      name?: string;
    };

    const dataUrl = body.dataUrl?.trim();
    const name = (body.name ?? "").trim() || "Custom voice";

    if (!dataUrl) {
      return NextResponse.json({ ok: false, error: "Пустой аудио-семпл" }, { status: 400 });
    }
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "ELEVENLABS_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Невалидный data URL" }, { status: 400 });
    }
    const mime = body.mimeType || match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (!mime.startsWith("audio/")) {
      return NextResponse.json(
        { ok: false, error: "Ожидается аудио-файл (MP3 / WAV / M4A)" },
        { status: 400 },
      );
    }
    const MAX = 15 * 1024 * 1024; // ElevenLabs accepts up to 10MB per sample, we keep 15 guard
    if (buffer.byteLength > MAX) {
      return NextResponse.json({ ok: false, error: "Файл больше 15 МБ" }, { status: 400 });
    }
    if (buffer.byteLength < 50 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Слишком короткий семпл — нужно не менее 20–30 секунд чистой речи для качественного клона",
        },
        { status: 400 },
      );
    }

    // Build multipart body for ElevenLabs
    const form = new FormData();
    const ext = mime.split("/")[1] ?? "mp3";
    const blob = new Blob([new Uint8Array(buffer)], { type: mime });
    form.append("name", name);
    form.append("files", blob, `sample.${ext}`);
    form.append(
      "description",
      "Custom voice cloned via MarketRadar content factory",
    );

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        Accept: "application/json",
      },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      // Typical failures: 401 bad key, 403 plan doesn't allow cloning,
      // 422 audio too short / bad format, 429 rate limit.
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "ElevenLabs отклонил запрос: проверьте API-ключ или лимиты тарифа (нужен Creator+ для клонирования).",
          },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { ok: false, error: `ElevenLabs error ${res.status}: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: { voice_id?: string; requires_verification?: boolean; name?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }

    const voiceId = parsed?.voice_id;
    if (!voiceId) {
      return NextResponse.json(
        { ok: false, error: `ElevenLabs вернул неожиданный ответ: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        elevenlabsVoiceId: voiceId,
        name: parsed?.name ?? name,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
