import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// HeyGen v2 video generation
// Docs: https://docs.heygen.com/reference/create-an-avatar-video-v2
// Returns a video_id which must then be polled via /api/video-status.

const DEFAULT_AVATAR_ID = "Daisy-inskirt-20220818";
const DEFAULT_VOICE_ID = "1bd001e7e50f421d891986aad5158bc8"; // дефолтный голос HeyGen

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const script: string = (body.script ?? "").toString().trim();
    const avatarId: string = body.avatarId ?? process.env.HEYGEN_AVATAR_ID ?? DEFAULT_AVATAR_ID;
    const voiceId: string = body.voiceId ?? process.env.HEYGEN_VOICE_ID ?? DEFAULT_VOICE_ID;
    const avatarType: "preset" | "talking_photo" = body.avatarType === "talking_photo" ? "talking_photo" : "preset";
    const aspect: "portrait" | "landscape" = body.aspect === "landscape" ? "landscape" : "portrait";

    if (!script) {
      return NextResponse.json({ ok: false, error: "Пустой текст для озвучки" }, { status: 400 });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const dimension = aspect === "portrait"
      ? { width: 720, height: 1280 }
      : { width: 1280, height: 720 };

    const character = avatarType === "talking_photo"
      ? { type: "talking_photo", talking_photo_id: avatarId }
      : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" };

    const payload = {
      video_inputs: [
        {
          character,
          voice: {
            type: "text",
            input_text: script,
            voice_id: voiceId,
          },
        },
      ],
      dimension,
    };

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "Accept": "application/json",
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
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const videoId = parsed?.data?.video_id;
    if (!videoId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen вернул неожиданный ответ: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data: { videoId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
