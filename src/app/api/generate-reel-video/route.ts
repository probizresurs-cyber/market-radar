import { NextResponse } from "next/server";
import { ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_MODEL } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 120;

// HeyGen v2 video generation.
// Docs: https://docs.heygen.com/reference/create-an-avatar-video-v2
// Returns a video_id which must then be polled via /api/video-status.
//
// Two voice modes are supported:
//   1. HeyGen TTS (default) — pass voiceId from HeyGen catalog; HeyGen synthesizes.
//   2. ElevenLabs voice      — pass elevenlabsVoiceId; this route:
//        a) calls ElevenLabs TTS to synthesize an MP3,
//        b) uploads that MP3 to HeyGen as an audio asset,
//        c) calls HeyGen v2 video/generate with voice.type = "audio".
//      This is how we plug cloned ElevenLabs voices into HeyGen talking-photo
//      videos — HeyGen's own voice-clone API 404s, ElevenLabs works reliably.

const DEFAULT_AVATAR_ID = "Daisy-inskirt-20220818";
const DEFAULT_VOICE_ID = "1bd001e7e50f421d891986aad5158bc8"; // дефолтный голос HeyGen

type HeyGenVoice =
  | { type: "text"; input_text: string; voice_id: string }
  | { type: "audio"; audio_asset_id: string };

async function synthesizeWithElevenLabs(
  text: string,
  voiceId: string,
): Promise<{ ok: true; mp3: ArrayBuffer } | { ok: false; error: string; status: number }> {
  if (!ELEVENLABS_API_KEY) {
    return { ok: false, error: "ELEVENLABS_API_KEY не настроен", status: 500 };
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
        model_id: ELEVENLABS_DEFAULT_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!res.ok) {
    const errorText = await res.text();
    return {
      ok: false,
      error: `ElevenLabs TTS error ${res.status}: ${errorText.slice(0, 300)}`,
      status: 500,
    };
  }
  return { ok: true, mp3: await res.arrayBuffer() };
}

async function uploadAudioToHeyGen(
  apiKey: string,
  mp3: ArrayBuffer,
): Promise<{ ok: true; assetId: string } | { ok: false; error: string }> {
  // HeyGen asset upload. Docs: https://docs.heygen.com/reference/upload-asset
  // Endpoint: POST https://upload.heygen.com/v1/asset
  // Body: raw binary, Content-Type: audio/mpeg (or image/* / video/*).
  // Response: { code: 100, data: { id, url, ... } } — "id" is the asset_id
  // that HeyGen v2 video/generate accepts as audio_asset_id.
  const res = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "Content-Type": "audio/mpeg",
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
    body: new Uint8Array(mp3),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `HeyGen asset upload ${res.status}: ${text.slice(0, 300)}` };
  }
  let parsed: { data?: { id?: string; asset_id?: string } } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* ignore */
  }
  const assetId = parsed?.data?.id ?? parsed?.data?.asset_id;
  if (!assetId) {
    return {
      ok: false,
      error: `HeyGen asset upload вернул неожиданный ответ: ${text.slice(0, 300)}`,
    };
  }
  return { ok: true, assetId };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const script: string = (body.script ?? "").toString().trim();
    const avatarId: string = body.avatarId ?? process.env.HEYGEN_AVATAR_ID ?? DEFAULT_AVATAR_ID;
    const voiceId: string = body.voiceId ?? process.env.HEYGEN_VOICE_ID ?? DEFAULT_VOICE_ID;
    const avatarType: "preset" | "talking_photo" =
      body.avatarType === "talking_photo" ? "talking_photo" : "preset";
    const aspect: "portrait" | "landscape" =
      body.aspect === "landscape" ? "landscape" : "portrait";
    const elevenlabsVoiceId: string | undefined =
      typeof body.elevenlabsVoiceId === "string" && body.elevenlabsVoiceId.trim()
        ? body.elevenlabsVoiceId.trim()
        : undefined;
    const voiceProvider: "heygen" | "elevenlabs" =
      body.voiceProvider === "elevenlabs" || elevenlabsVoiceId ? "elevenlabs" : "heygen";

    if (!script) {
      return NextResponse.json({ ok: false, error: "Пустой текст для озвучки" }, { status: 400 });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const dimension =
      aspect === "portrait" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

    const character =
      avatarType === "talking_photo"
        ? { type: "talking_photo", talking_photo_id: avatarId }
        : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" };

    // Build voice payload. For ElevenLabs, synthesize to MP3 then upload to HeyGen.
    let voice: HeyGenVoice;
    if (voiceProvider === "elevenlabs" && elevenlabsVoiceId) {
      const tts = await synthesizeWithElevenLabs(script, elevenlabsVoiceId);
      if (!tts.ok) {
        return NextResponse.json({ ok: false, error: tts.error }, { status: tts.status });
      }
      const upload = await uploadAudioToHeyGen(apiKey, tts.mp3);
      if (!upload.ok) {
        return NextResponse.json({ ok: false, error: upload.error }, { status: 500 });
      }
      voice = { type: "audio", audio_asset_id: upload.assetId };
    } else {
      voice = { type: "text", input_text: script, voice_id: voiceId };
    }

    const payload = {
      video_inputs: [{ character, voice }],
      dimension,
    };

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `HeyGen error ${res.status}: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: { data?: { video_id?: string }; error?: unknown } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }

    const videoId = parsed?.data?.video_id;
    if (!videoId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen вернул неожиданный ответ: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: { videoId, voiceProvider },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
