/**
 * POST /api/heygen-create-digital-twin
 *
 * Создаёт video-аватара (Digital Twin) в HeyGen v3 через multipart-запрос.
 * HeyGen для type="digital_twin" ожидает multipart/form-data с полем
 * `file` (training video), а не JSON с URLs (proven by error 400543
 * «invalid_parameter: Field required, param: file»).
 *
 * Body: multipart/form-data
 *   file              — training video (≥ 2 мин, 720p+)
 *   consent_file      — consent video (отдельная запись согласия)
 *   name              — имя аватара
 *   trainingAssetId   — опц., если ассет уже загружен в HeyGen ранее
 *   consentAssetId    — опц.
 *
 * Response: { ok, data: { heygenAvatarId, status } }
 *
 * Статус «processing» 5-15 минут после создания. Polling статуса —
 * через GET /v3/avatars/{id} (отдельный endpoint, ещё не реализован).
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

    let inForm: FormData;
    try {
      inForm = await req.formData();
    } catch (parseErr) {
      return NextResponse.json({
        ok: false,
        error: `Не удалось распарсить тело как multipart/form-data: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      }, { status: 400 });
    }

    const trainingFile = inForm.get("file");
    const consentFile = inForm.get("consent_file");
    const name = ((inForm.get("name") as string | null) ?? "").trim() || "Мой видео-аватар";
    const trainingAssetId = ((inForm.get("trainingAssetId") as string | null) ?? "").trim();
    const consentAssetId = ((inForm.get("consentAssetId") as string | null) ?? "").trim();

    if (!trainingFile || typeof trainingFile === "string") {
      return NextResponse.json({ ok: false, error: "Тренировочное видео не передано" }, { status: 400 });
    }
    if (!consentFile || typeof consentFile === "string") {
      return NextResponse.json({ ok: false, error: "Consent-видео не передано" }, { status: 400 });
    }

    // Пересылаем в HeyGen многоразовым multipart-запросом.
    // Передаём ВСЕ возможные имена полей которые могут понадобиться —
    // HeyGen возьмёт то что узнает.
    const outForm = new FormData();
    outForm.append("type", "digital_twin");
    outForm.append("name", name);
    // Training video — пробуем разные имена
    outForm.append("file", trainingFile);
    outForm.append("training_file", trainingFile);
    outForm.append("training_footage", trainingFile);
    // Consent video — пробуем тоже разные
    outForm.append("consent_file", consentFile);
    outForm.append("video_consent", consentFile);
    outForm.append("consent_video", consentFile);
    // Asset IDs если есть (ассеты ранее загружены)
    if (trainingAssetId) outForm.append("training_asset_id", trainingAssetId);
    if (consentAssetId) outForm.append("consent_asset_id", consentAssetId);

    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
        // ВАЖНО: НЕ ставить Content-Type — fetch сам поставит с boundary
      },
      body: outForm,
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
        hint = " — создание Digital Twin доступно на платных тарифах HeyGen Pro+.";
      } else if (/consent/i.test(humanMsg)) {
        hint = " — HeyGen отклонил consent-видео. Спикер должен чётко произнести: «I, [name], consent to HeyGen using my likeness and voice to create an AI avatar».";
      } else if (/duration|too short|2 minutes|720/i.test(humanMsg)) {
        hint = " — тренировочное видео должно быть ≥ 2 минут, разрешение 720p+.";
      } else if (/file|param/i.test(humanMsg) && errParam) {
        hint = ` — HeyGen ожидает поле «${errParam}». Возможно изменился их API — пришлите этот лог разработчику.`;
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
