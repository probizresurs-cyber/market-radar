/**
 * GET /api/elevenlabs-voice-previews
 *
 * Отдаёт preview_url готовых пресетов ElevenLabs (см. lib/voice-presets.ts)
 * для проигрывания в UI. НЕ синтезирует речь — читает публичные метаданные
 * голоса (GET /v1/voices/{id}), у премейд-голосов preview_url — статичный
 * сэмпл, который ElevenLabs хостит сам. Поэтому вызов бесплатный и не тратит
 * квоту синтеза, в отличие от реального TTS-запроса.
 *
 * Response: { ok, data: Record<VoicePresetName, { voiceId, label, previewUrl: string|null }> }
 */
import { NextResponse } from "next/server";
import { ELEVENLABS_API_KEY, ELEVENLABS_BASE_URL } from "@/lib/elevenlabs";
import { VOICE_PRESETS } from "@/lib/voice-presets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ ok: false, error: "ELEVENLABS_API_KEY не настроен" }, { status: 500 });
  }

  const entries = Object.entries(VOICE_PRESETS);
  const results = await Promise.all(
    entries.map(async ([name, preset]) => {
      try {
        const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices/${preset.voiceId}`, {
          headers: { "xi-api-key": ELEVENLABS_API_KEY, Accept: "application/json" },
        });
        if (!res.ok) return [name, { ...preset, previewUrl: null }] as const;
        const json = (await res.json()) as { preview_url?: string | null };
        return [name, { ...preset, previewUrl: json.preview_url ?? null }] as const;
      } catch {
        return [name, { ...preset, previewUrl: null }] as const;
      }
    }),
  );

  return NextResponse.json({ ok: true, data: Object.fromEntries(results) });
}
