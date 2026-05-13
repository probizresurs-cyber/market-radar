/**
 * POST /api/heygen-upload-video
 *
 * Создаёт аватара из загруженного видео (HeyGen "look from footage").
 * Поддерживает MP4/MOV/WebM до 100 МБ.
 *
 * Цепочка:
 *   1. POST /v3/assets (multipart binary) → asset_id
 *   2. POST /v3/avatars { type: "footage", source_asset_id, name } → avatar_id
 *      HeyGen анализирует footage и создаёт avatar look.
 *
 * Аватар будет в статусе "processing" сразу после создания. Готовность
 * (~5-15 минут) проверяется через GET /v3/avatars/{avatar_id}, но мы пока
 * просто возвращаем avatar_id — пользователь увидит его в списке.
 *
 * Body (JSON): { dataUrl, mimeType, name }
 * Response: { ok, data: { heygenAvatarId, name, status } }
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json() as { dataUrl?: string; mimeType?: string; name?: string };
    const dataUrl = body.dataUrl?.trim();
    const name = body.name?.trim() || "Мой видео-аватар";
    if (!dataUrl) {
      return NextResponse.json({ ok: false, error: "Пустое видео" }, { status: 400 });
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

    if (!mime.startsWith("video/")) {
      return NextResponse.json({ ok: false, error: "Ожидается видео-файл (MP4 / MOV / WebM)" }, { status: 400 });
    }
    if (buffer.byteLength > 100 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Файл больше 100 МБ" }, { status: 400 });
    }

    // Шаг 1: загружаем asset через v3 endpoint.
    // По docs HeyGen: POST /v3/assets — multipart upload, до 32 МБ через JSON
    // base64; больше — нужен прямой upload binary.
    // Используем legacy upload.heygen.com/v1/asset (стабильный canonical путь).
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
      const hint =
        assetRes.status === 401 || assetRes.status === 403
          ? " — нужен платный тариф HeyGen с включённой загрузкой видео."
          : "";
      return NextResponse.json(
        { ok: false, error: `HeyGen asset upload ${assetRes.status}: ${assetText.slice(0, 300)}${hint}` },
        { status: 500 },
      );
    }
    let assetParsed: { data?: { id?: string; asset_id?: string; url?: string } } = {};
    try { assetParsed = JSON.parse(assetText); } catch { /* ignore */ }
    const assetId = assetParsed?.data?.id ?? assetParsed?.data?.asset_id;
    if (!assetId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул asset_id: ${assetText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    // Шаг 2: создаём avatar из footage. По v3 docs:
    //   POST /v3/avatars { type: "footage", name, source_asset_id }
    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: "footage",
        name,
        source_asset_id: assetId,
      }),
    });
    const avatarText = await avatarRes.text();
    if (!avatarRes.ok) {
      // v3 error parsing
      let humanMsg = avatarText.slice(0, 400);
      try {
        const errBody: { error?: { code?: string; message?: string } } = JSON.parse(avatarText);
        if (errBody.error?.message) {
          humanMsg = errBody.error.message;
          if (errBody.error.code) humanMsg = `${errBody.error.code}: ${humanMsg}`;
        }
      } catch { /* keep raw */ }

      const hint =
        avatarRes.status === 401 || avatarRes.status === 403
          ? " — создание аватаров из видео доступно на платных тарифах HeyGen Pro+."
          : "";
      return NextResponse.json(
        { ok: false, error: `HeyGen ${avatarRes.status}: ${humanMsg}${hint}` },
        { status: 500 },
      );
    }
    let avatarParsed: { data?: { avatar_id?: string; id?: string; status?: string } } = {};
    try { avatarParsed = JSON.parse(avatarText); } catch { /* ignore */ }
    const avatarId = avatarParsed?.data?.avatar_id ?? avatarParsed?.data?.id;
    if (!avatarId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул avatar_id: ${avatarText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId: avatarId,
        name,
        status: avatarParsed?.data?.status ?? "processing",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
