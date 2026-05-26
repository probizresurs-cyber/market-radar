/**
 * POST /api/presentation-voiceover
 *
 * Озвучка презентации через ElevenLabs. Каждый slide.note → mp3.
 * Возвращаем массив data URL (base64 audio/mpeg) — клиент сохраняет в
 * slide.audioUrl + использует для autoplay-просмотра.
 *
 * Если у юзера нет speaker notes — отказ. Запустите сначала
 * /api/presentation-speaker-notes.
 *
 * Body: { notes: string[], voiceId?, modelId? }
 * Returns: { ok, data: { tracks: string[] } } — массив длины notes.length
 *
 * Стоимость: ~30¢ за 12 слайдов × 90 сек = $0.30/презентация (ElevenLabs
 * Multilingual v2 ~$0.18/min). Premium-фича.
 */
import { NextResponse } from "next/server";
import { checkAiAccess } from "@/lib/with-ai-security";
import { ELEVENLABS_DEFAULT_MODEL } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 180;

const CONCURRENCY = 3; // параллельных TTS-запросов

export async function POST(req: Request) {
  const access = await checkAiAccess(req);
  if (!access.allowed) return access.response;

  let body: { notes?: string[]; voiceId?: string; modelId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const notes = Array.isArray(body.notes) ? body.notes.slice(0, 25) : [];
  if (notes.length === 0 || notes.every(n => !n?.trim())) {
    return NextResponse.json(
      { ok: false, error: "Нет speaker notes. Сгенерируйте их через «Speaker notes» сначала." },
      { status: 400 },
    );
  }

  const voiceId = (body.voiceId ?? "").trim();
  const modelId = (body.modelId ?? ELEVENLABS_DEFAULT_MODEL).trim();
  if (!voiceId) {
    return NextResponse.json(
      { ok: false, error: "voiceId required. Загрузите или выберите голос в настройках аватара." },
      { status: 400 },
    );
  }

  // Параллельная озвучка с concurrency limit (ElevenLabs free tier — 10 req/min).
  const tracks: (string | null)[] = new Array(notes.length).fill(null);

  // Дёргаем наш собственный /api/elevenlabs-tts — он уже умеет auth/logging.
  // Тут только координация и concurrency.
  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";

  const callTts = async (text: string): Promise<string | null> => {
    try {
      const r = await fetch(`${origin}/api/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ voiceId, text, modelId }),
      });
      const j = await r.json() as { ok: boolean; data?: { dataUrl: string }; error?: string };
      return j.ok && j.data?.dataUrl ? j.data.dataUrl : null;
    } catch {
      return null;
    }
  };

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = idx++;
      if (i >= notes.length) return;
      const text = (notes[i] ?? "").trim();
      if (!text) { tracks[i] = null; continue; }
      tracks[i] = await callTts(text);
    }
  });
  await Promise.all(workers);

  const totalChars = notes.reduce((s, n) => s + (n?.length ?? 0), 0);
  await access.log({
    endpoint: "presentation-voiceover",
    model: modelId,
    success: true,
    promptTokens: totalChars, // характеры → ElevenLabs тарифицирует по ним
  });

  return NextResponse.json({ ok: true, data: { tracks } });
}
