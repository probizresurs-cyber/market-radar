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
    // multipart/form-data (single field `file`) — consistent с heygen-upload-video.
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (parseErr) {
      const ct = req.headers.get("content-type") ?? "(no content-type)";
      const hint = ct.includes("json")
        ? "Старая версия фронтенда (Content-Type: application/json). Сделайте Ctrl+Shift+R."
        : `Content-Type: ${ct}`;
      return NextResponse.json({
        ok: false,
        error: `Не удалось распарсить тело как multipart/form-data. ${hint}`,
        debug: parseErr instanceof Error ? parseErr.message : String(parseErr),
      }, { status: 400 });
    }
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok: false, error: "Файл не передан (поле `file` пустое)" }, { status: 400 });
    }
    const mime = file.type;
    if (!mime.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Ожидается изображение (JPG / PNG)" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Файл больше 10 МБ" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

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

    const name = (form.get("name") as string | null)?.trim() || "My avatar";
    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId: talkingPhotoId,
        previewUrl: parsed?.data?.talking_photo_url ?? "",
        name,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
