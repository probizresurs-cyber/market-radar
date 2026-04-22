import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Upload a user-supplied photo to HeyGen as a "talking photo" (custom avatar).
// Docs: https://docs.heygen.com/reference/upload-asset-talking-photo
// HeyGen endpoint: POST https://upload.heygen.com/v1/talking_photo
// Body: raw binary image. Content-Type: image/jpeg | image/png.
// Response: { code: 100, data: { talking_photo_id, talking_photo_url } }.
//
// We accept { dataUrl, mimeType, name } from the client (JSON), decode the
// base64 data, and forward binary to HeyGen.

export async function POST(req: Request) {
  try {
    const body = await req.json() as { dataUrl?: string; mimeType?: string; name?: string };
    const dataUrl = body.dataUrl?.trim();
    if (!dataUrl) {
      return NextResponse.json({ ok: false, error: "Пустое изображение" }, { status: 400 });
    }

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    // Decode data URL
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Невалидный data URL" }, { status: 400 });
    }
    const mime = body.mimeType || match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (!mime.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Ожидается изображение (JPG / PNG)" }, { status: 400 });
    }
    if (buffer.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Файл больше 10 МБ" }, { status: 400 });
    }

    const res = await fetch("https://upload.heygen.com/v1/talking_photo", {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "X-Api-Key": apiKey,
        "Accept": "application/json",
      },
      body: new Uint8Array(buffer),
    });

    const text = await res.text();
    if (!res.ok) {
      // Специфичная обработка прав доступа
      if (res.status === 403 || res.status === 401 || /permission|not.*allow|plan/i.test(text)) {
        return NextResponse.json(
          { ok: false, error: "Эта функция требует платного тарифа HeyGen (Business/Pro). Активируйте Talking Photo в кабинете HeyGen." },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen error ${res.status}: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    let parsed: { data?: { talking_photo_id?: string; talking_photo_url?: string }; error?: unknown } = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const talkingPhotoId = parsed?.data?.talking_photo_id;
    if (!talkingPhotoId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen вернул неожиданный ответ: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId: talkingPhotoId,
        previewUrl: parsed?.data?.talking_photo_url ?? "",
        name: body.name ?? "My avatar",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
