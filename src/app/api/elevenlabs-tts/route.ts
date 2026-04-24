import { NextResponse } from "next/server";
import { ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_MODEL } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 120;

// Server-side ElevenLabs TTS.
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
// Endpoint: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
// Body (JSON): { text, model_id, voice_settings }
// Response: MP3 audio bytes.
//
// We return the audio as a base-64 data URL so the caller (browser OR another
// API route) can drop it straight into <audio src> or upload it to HeyGen
// as an asset for lip-sync video generation.

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      voiceId?: string;
      text?: string;
      modelId?: string;
      stability?: number;
      similarity?: number;
      style?: number;
    };

    const voiceId = (body.voiceId ?? "").trim();
    const text = (body.text ?? "").trim();
    const modelId = body.modelId ?? ELEVENLABS_DEFAULT_MODEL;

    if (!voiceId) {
      return NextResponse.json({ ok: false, error: "voiceId обязателен" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ ok: false, error: "Пустой текст для озвучки" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json(
        { ok: false, error: "Слишком длинный текст (>5000 символов)" },
        { status: 400 },
      );
    }
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "ELEVENLABS_API_KEY не настроен" },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: body.stability ?? 0.5,
            similarity_boost: body.similarity ?? 0.75,
            style: body.style ?? 0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { ok: false, error: "ElevenLabs отклонил запрос: проверьте API-ключ или квоту." },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { ok: false, error: `ElevenLabs TTS error ${res.status}: ${errorText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    const arrayBuf = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return NextResponse.json({
      ok: true,
      data: {
        dataUrl,
        mimeType: "audio/mpeg",
        bytes: arrayBuf.byteLength,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
