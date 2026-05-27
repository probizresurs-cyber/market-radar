/**
 * POST /api/heygen-create-digital-twin
 *
 * HeyGen v3 /v3/avatars — JSON endpoint (не multipart!), как сказал
 * сам HeyGen: «Request body must be valid JSON». Принимаем
 * asset_id'ы которые фронт получил после upload через
 * /api/heygen-upload-video → /v1/asset.
 *
 * Body: multipart/form-data (от фронта) с полями:
 *   trainingAssetId / trainingAssetUrl
 *   consentAssetId  / consentAssetUrl
 *   name
 *
 * Шлём в HeyGen JSON с type: "digital_twin" и asset_id'ами в РАЗНЫХ
 * возможных именах полей — HeyGen возьмёт что узнает.
 *
 * Response: { ok, data: { heygenAvatarId, status } }
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "HEYGEN_API_KEY не настроен" }, { status: 500 });
    }

    // Принимаем multipart (фронт всё ещё шлёт FormData с file для
    // совместимости), но из него берём только текстовые поля —
    // сами файлы уже загружены в HeyGen на предыдущем шаге.
    let inForm: FormData;
    try {
      inForm = await req.formData();
    } catch (parseErr) {
      return NextResponse.json({
        ok: false,
        error: `Не удалось распарсить тело: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      }, { status: 400 });
    }

    const trainingAssetId = ((inForm.get("trainingAssetId") as string | null) ?? "").trim();
    const consentAssetId = ((inForm.get("consentAssetId") as string | null) ?? "").trim();
    const trainingAssetUrl = ((inForm.get("trainingAssetUrl") as string | null) ?? "").trim();
    const consentAssetUrl = ((inForm.get("consentAssetUrl") as string | null) ?? "").trim();
    const name = ((inForm.get("name") as string | null) ?? "").trim() || "Мой видео-аватар";

    if (!trainingAssetId) {
      return NextResponse.json({ ok: false, error: "Тренировочный asset не загружен" }, { status: 400 });
    }
    if (!consentAssetId) {
      return NextResponse.json({ ok: false, error: "Consent asset не загружен" }, { status: 400 });
    }

    // JSON-тело со всеми возможными именами полей которые HeyGen может ожидать.
    // Передаём asset_id'ы под разными ключами — HeyGen возьмёт известные.
    const jsonBody: Record<string, unknown> = {
      type: "digital_twin",
      avatar_type: "digital_twin",
      name,
      avatar_name: name,
      // Training video — пробуем все варианты имён
      training_asset_id: trainingAssetId,
      training_video_asset_id: trainingAssetId,
      video_asset_id: trainingAssetId,
      source_asset_id: trainingAssetId,
      file: trainingAssetId,
      // Consent video — тоже все варианты
      consent_asset_id: consentAssetId,
      video_consent_asset_id: consentAssetId,
      consent_video_asset_id: consentAssetId,
    };
    // URL'ы тоже на случай если HeyGen ждёт URL не asset_id
    if (trainingAssetUrl) {
      jsonBody.training_footage_url = trainingAssetUrl;
      jsonBody.training_video_url = trainingAssetUrl;
      jsonBody.video_url = trainingAssetUrl;
    }
    if (consentAssetUrl) {
      jsonBody.video_consent_url = consentAssetUrl;
      jsonBody.consent_video_url = consentAssetUrl;
    }

    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonBody),
    });

    const avatarText = await avatarRes.text();

    if (!avatarRes.ok) {
      let humanMsg = avatarText.slice(0, 400);
      let errCode = "";
      let errParam = "";
      try {
        const errBody: { error?: { code?: string; message?: string; param?: string } } = JSON.parse(avatarText);
        if (errBody.error?.message) {
          humanMsg = errBody.error.message;
          errCode = errBody.error.code ?? "";
          errParam = errBody.error.param ?? "";
          if (errCode) humanMsg = `${errCode}: ${humanMsg}`;
          if (errParam) humanMsg += ` (поле: ${errParam})`;
        }
      } catch { /* keep raw */ }

      let hint = "";
      if (avatarRes.status === 401 || avatarRes.status === 403) {
        hint = " — Digital Twin доступен только на платных тарифах HeyGen Pro+.";
      } else if (/consent/i.test(humanMsg)) {
        hint = " — HeyGen отклонил consent-видео. Спикер должен чётко произнести: «I, [name], consent to HeyGen using my likeness and voice to create an AI avatar».";
      } else if (/duration|too short|2 minutes|720/i.test(humanMsg)) {
        hint = " — тренировочное видео ≥ 2 минут, разрешение 720p+.";
      } else if (errParam) {
        hint = ` — HeyGen ожидает поле «${errParam}». Возможно их API изменился — пришлите debug лог разработчику.`;
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
