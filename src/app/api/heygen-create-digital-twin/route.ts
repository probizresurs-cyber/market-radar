/**
 * POST /api/heygen-create-digital-twin
 *
 * Создаёт video-аватара (Digital Twin) в HeyGen v3 из ДВУХ ранее
 * загруженных видео-asset'ов:
 *   1. training_asset_id — основное видео (≥ 2 мин, 720p, лицо говорящего)
 *   2. consent_asset_id — отдельная запись согласия (политика HeyGen
 *      против deepfake — спикер на камеру говорит, что согласен на
 *      использование своего лица для AI-аватара)
 *
 * Оба asset'а должны быть загружены через /api/heygen-upload-video,
 * который возвращает assetId.
 *
 * Body (JSON): { trainingAssetId, trainingAssetUrl, consentAssetId,
 *               consentAssetUrl, name }
 * Response: { ok, data: { heygenAvatarId, status } }
 *
 * Статус аватара после создания = "processing". Готовность (5-15 мин)
 * проверяется через polling GET /v3/avatars/{id} — отдельный endpoint
 * /api/heygen-avatar-status (для будущей реализации).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    const body = await req.json() as {
      trainingAssetId?: string;
      trainingAssetUrl?: string;
      consentAssetId?: string;
      consentAssetUrl?: string;
      name?: string;
    };

    const trainingAssetId = body.trainingAssetId?.trim();
    const trainingAssetUrl = body.trainingAssetUrl?.trim();
    const consentAssetId = body.consentAssetId?.trim();
    const consentAssetUrl = body.consentAssetUrl?.trim();
    const name = body.name?.trim() || "Мой видео-аватар";

    if (!trainingAssetId && !trainingAssetUrl) {
      return NextResponse.json({ ok: false, error: "Тренировочное видео не загружено" }, { status: 400 });
    }
    if (!consentAssetId && !consentAssetUrl) {
      return NextResponse.json({ ok: false, error: "Consent-видео не загружено" }, { status: 400 });
    }

    // POST /v3/avatars { type: "digital_twin", ... }
    // Документация HeyGen v3 защищена авторизацией, поэтому передаём все
    // возможные варианты полей — HeyGen возьмёт что узнает:
    //   training_footage_url / training_video_url / training_asset_id
    //   video_consent_url / consent_video_url / consent_asset_id
    const requestBody: Record<string, unknown> = {
      type: "digital_twin",
      name,
    };
    if (trainingAssetUrl) {
      requestBody.training_footage_url = trainingAssetUrl;
      requestBody.training_video_url = trainingAssetUrl;
    }
    if (trainingAssetId) {
      requestBody.training_asset_id = trainingAssetId;
    }
    if (consentAssetUrl) {
      requestBody.video_consent_url = consentAssetUrl;
      requestBody.consent_video_url = consentAssetUrl;
    }
    if (consentAssetId) {
      requestBody.consent_asset_id = consentAssetId;
    }

    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const avatarText = await avatarRes.text();

    if (!avatarRes.ok) {
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

      let hint = "";
      if (avatarRes.status === 401 || avatarRes.status === 403) {
        hint = " — создание Digital Twin доступно на платных тарифах HeyGen Pro+.";
      } else if (/consent/i.test(humanMsg)) {
        hint = " — HeyGen отклонил consent-видео. Спикер на нём должен чётко произнести: «I consent to HeyGen using my likeness to create an AI avatar».";
      } else if (/duration|too short|2 minutes|720/i.test(humanMsg)) {
        hint = " — тренировочное видео должно быть ≥ 2 минут, разрешение 720p+.";
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen ${avatarRes.status}: ${humanMsg}${hint}`, debug: avatarText.slice(0, 500) },
        { status: 500 },
      );
    }

    let avatarParsed: { data?: { avatar_id?: string; id?: string; status?: string } } = {};
    try { avatarParsed = JSON.parse(avatarText); } catch { /* ignore */ }
    const heygenAvatarId = avatarParsed?.data?.avatar_id ?? avatarParsed?.data?.id;
    if (!heygenAvatarId) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул avatar_id: ${avatarText.slice(0, 300)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId,
        name,
        status: avatarParsed?.data?.status ?? "processing",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
