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
    // Перешли с JSON+base64 на multipart/form-data: видео 20+ МБ упиралось
    // в дефолтный лимит JSON-парсера Next.js ~10 МБ (Unterminated string at
    // position 10484777). FormData стримит binary напрямую, без лимита.
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
    const name = (form.get("name") as string | null)?.trim() || "Мой видео-аватар";

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

    // Шаг 2: создаём Digital Twin avatar по v3 API.
    // v3 не принимает type:"footage" — теперь это называется "digital_twin".
    // ВАЖНО: HeyGen для digital_twin требует ДВА видео:
    //   1. training_footage — основное (>= 2 мин, 720p+, лицо говорящего)
    //   2. video_consent — отдельная запись согласия (политика против deepfake)
    // Сейчас у нас один файл → шлём только training_footage_url. Если HeyGen
    // не примет — вернём понятную ошибку про consent video.
    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: "digital_twin",
        name,
        // Передаём asset_id — HeyGen может принять (asset загружен в их хранилище
        // на шаге 1) либо потребует public URL и consent video.
        source_asset_id: assetId,
        training_footage_url: assetParsed?.data?.url,
      }),
    });
    const avatarText = await avatarRes.text();
    if (!avatarRes.ok) {
      // v3 error parsing
      let humanMsg = avatarText.slice(0, 400);
      let errCode = "";
      try {
        const errBody: { error?: { code?: string; message?: string } } = JSON.parse(avatarText);
        if (errBody.error?.message) {
          humanMsg = errBody.error.message;
          errCode = errBody.error.code ?? "";
          if (errCode) humanMsg = `${errCode}: ${humanMsg}`;
        }
      } catch { /* keep raw */ }

      // Распознаём типичные причины и даём осмысленную подсказку.
      let hint = "";
      if (avatarRes.status === 401 || avatarRes.status === 403) {
        hint = " — создание Digital Twin доступно на платных тарифах HeyGen Pro+.";
      } else if (/consent/i.test(humanMsg) || /video_consent/i.test(humanMsg)) {
        hint = " — HeyGen требует отдельное consent-видео (запись где спикер говорит, что согласен на использование своего лица для AI-аватара). Этот flow пока не реализован — используйте загрузку фото вместо видео.";
      } else if (/digital_twin|invalid_parameter/i.test(humanMsg)) {
        hint = " — возможно, видео не соответствует требованиям HeyGen (нужно ≥2 мин, 720p+, чёткое лицо говорящего).";
      }
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
