import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// Clone a user voice via HeyGen Instant Voice Clone.
// Docs (Voice API): https://docs.heygen.com/reference/instant-voice-cloning
// Endpoint: POST https://api.heygen.com/v1/voice_clone (multipart/form-data)
// Returns: { data: { voice_id } }
//
// Client sends JSON { dataUrl, mimeType, name }. Server rebuilds a multipart
// form with the audio blob + name, and forwards to HeyGen. Voice Clone
// requires a paid HeyGen plan — graceful 402 response if not enabled.

export async function POST(req: Request) {
  try {
    const body = await req.json() as { dataUrl?: string; mimeType?: string; name?: string };
    const dataUrl = body.dataUrl?.trim();
    const name = (body.name ?? "").trim() || "Custom voice";
    if (!dataUrl) {
      return NextResponse.json({ ok: false, error: "Пустой аудио-семпл" }, { status: 400 });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Невалидный data URL" }, { status: 400 });
    }
    const mime = body.mimeType || match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (!mime.startsWith("audio/")) {
      return NextResponse.json({ ok: false, error: "Ожидается аудио-файл (MP3 / WAV / M4A)" }, { status: 400 });
    }
    const MAX = 15 * 1024 * 1024; // 15 MB
    if (buffer.byteLength > MAX) {
      return NextResponse.json({ ok: false, error: "Файл больше 15 МБ" }, { status: 400 });
    }
    // HeyGen требует минимум ~20 сек качественного звука, чтобы клон получился
    if (buffer.byteLength < 50 * 1024) {
      return NextResponse.json({ ok: false, error: "Слишком короткий семпл — нужно не менее 20–30 секунд чистой речи" }, { status: 400 });
    }

    // Собираем multipart/form-data
    const form = new FormData();
    const ext = mime.split("/")[1] ?? "mp3";
    const blob = new Blob([new Uint8Array(buffer)], { type: mime });
    form.append("audio", blob, `sample.${ext}`);
    form.append("name", name);

    const res = await fetch("https://api.heygen.com/v1/voice_clone", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Accept": "application/json",
      },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      if (res.status === 403 || res.status === 401 || /permission|not.*allow|plan|upgrade/i.test(text)) {
        return NextResponse.json(
          { ok: false, error: "Клонирование голоса требует платного тарифа HeyGen (Pro/Business). Активируйте Instant Voice Clone в кабинете HeyGen." },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen error ${res.status}: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: { data?: { voice_id?: string; voice_name?: string }; error?: unknown } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const voiceId = parsed?.data?.voice_id;
    if (!voiceId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen вернул неожиданный ответ: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenVoiceId: voiceId,
        name: parsed?.data?.voice_name ?? name,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
