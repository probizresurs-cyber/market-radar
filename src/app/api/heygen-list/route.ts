import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Returns lists of avatars and voices available on the user's HeyGen account.
// Useful for the UI picker so the client can choose how the avatar/voice should look.

type AvatarItem = { avatar_id?: string; avatar_name?: string; gender?: string; preview_image_url?: string };
type VoiceItem = { voice_id?: string; name?: string; language?: string; gender?: string; preview_audio?: string };

export async function GET() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const headers = { "X-Api-Key": apiKey, "Accept": "application/json" };

    const [avatarsRes, voicesRes] = await Promise.all([
      fetch("https://api.heygen.com/v2/avatars", { headers }),
      fetch("https://api.heygen.com/v2/voices", { headers }),
    ]);

    const avatarsText = await avatarsRes.text();
    const voicesText = await voicesRes.text();

    let avatars: AvatarItem[] = [];
    let voices: VoiceItem[] = [];
    try {
      const a = JSON.parse(avatarsText) as { data?: { avatars?: AvatarItem[] } | AvatarItem[] };
      avatars = Array.isArray(a?.data) ? a.data : (a?.data?.avatars ?? []);
    } catch { /* ignore */ }
    try {
      const v = JSON.parse(voicesText) as { data?: { voices?: VoiceItem[] } | VoiceItem[] };
      voices = Array.isArray(v?.data) ? v.data : (v?.data?.voices ?? []);
    } catch { /* ignore */ }

    return NextResponse.json({
      ok: true,
      data: {
        avatars: avatars.slice(0, 200).map(a => ({
          id: a.avatar_id ?? "",
          name: a.avatar_name ?? "",
          gender: a.gender ?? "",
          previewImage: a.preview_image_url ?? "",
        })).filter(a => a.id),
        voices: voices.slice(0, 500).map(v => ({
          id: v.voice_id ?? "",
          name: v.name ?? "",
          language: v.language ?? "",
          gender: v.gender ?? "",
          previewAudio: v.preview_audio ?? "",
        })).filter(v => v.id),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
