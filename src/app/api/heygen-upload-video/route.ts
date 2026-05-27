/**
 * POST /api/heygen-upload-video
 *
 * Загружает видео-asset в HeyGen и возвращает asset_id + URL.
 * НЕ создаёт аватара (для digital_twin нужны два asset'а — training +
 * consent). Создание аватара через /api/heygen-create-digital-twin.
 *
 * Body: multipart/form-data
 *   file: видео (MP4 / MOV / WebM, до 100 МБ)
 *
 * Response: { ok, data: { assetId, assetUrl, size, mimeType } }
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
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
    if (!mime.startsWith("video/")) {
      return NextResponse.json({ ok: false, error: "Ожидается видео-файл (MP4 / MOV / WebM)" }, { status: 400 });
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Файл больше 100 МБ" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    // Загружаем asset через legacy upload.heygen.com/v1/asset (стабильный путь)
    const assetRes = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      body: new Uint8Array(buffer),
    });
    const assetText = await assetRes.text();
    if (!assetRes.ok) {
      // Распознаём типичные коды ошибок HeyGen для понятного фидбэка юзеру.
      let hint = "";
      if (assetRes.status === 401 || assetRes.status === 403) {
        hint = " — нужен платный тариф HeyGen с включённой загрузкой видео.";
      } else if (/400543|Content type not match|quicktime/i.test(assetText)) {
        hint = " — HeyGen принимает только MP4. Если файл .MOV (iPhone) — пересохраните в MP4: QuickTime Player → File → Export As → 1080p (он сохранит .mov-контейнер как .mp4), или используйте CapCut → Export.";
      } else if (/file size|too large/i.test(assetText)) {
        hint = " — файл слишком большой, попробуйте сжать.";
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen asset upload ${assetRes.status}: ${assetText.slice(0, 300)}${hint}` },
        { status: 500 },
      );
    }
    let assetParsed: { data?: { id?: string; asset_id?: string; url?: string } } = {};
    try { assetParsed = JSON.parse(assetText); } catch { /* ignore */ }
    const assetId = assetParsed?.data?.id ?? assetParsed?.data?.asset_id;
    const assetUrl = assetParsed?.data?.url;
    if (!assetId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул asset_id: ${assetText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        assetId,
        assetUrl,
        size: file.size,
        mimeType: mime,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
