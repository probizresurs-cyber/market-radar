/**
 * POST /api/heygen-upload-photo
 *
 * Создаёт фото-аватара по официальному контракту HeyGen v3
 * (developers.heygen.com/reference/create-avatar, type:"photo"):
 *   POST /v3/avatars { type:"photo", name, file:{type:"base64",...} }
 *
 * Раньше шёл через legacy POST https://upload.heygen.com/v1/talking_photo —
 * тот отдаёт talking_photo_id, формат ДРУГОГО, более старого API (v2
 * генерация видео с character:{type:"talking_photo",...}). Наш слой
 * говорящей головы (generate-avatar-clip) зовёт /v3/videos с avatar_id —
 * talking_photo_id туда не подходит, поэтому фото-аватары были несовместимы
 * с остальной цепочкой. type:"photo" в /v3/avatars отдаёт avatar_item.id
 * ровно в том формате, что понимает /v3/videos.
 *
 * Фото-аватары, в отличие от digital twin, согласия не требуют (HeyGen:
 * «Photo avatars... depict no real, identifiable person» с точки зрения
 * их API — тем не менее лицо реального человека на фото, поэтому UI
 * по-прежнему явно спрашивает согласие пользователя перед загрузкой).
 *
 * Body: multipart/form-data { file: image, name? }
 * Response: { ok, data: { heygenAvatarId, previewUrl, name, status } }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { heygenMessage } from "@/lib/heygen-avatar";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AvatarItem {
  id?: string;
  name?: string;
  status?: string;
  preview_image_url?: string | null;
  error?: { code?: string; message?: string } | null;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

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
    // HeyGen /v3/avatars документирован под JPEG/PNG — не расширяем на
    // webp/gif, как для vision-скриншотов в другом месте кода.
    if (mime !== "image/jpeg" && mime !== "image/png") {
      return NextResponse.json({ ok: false, error: "Ожидается изображение JPG или PNG" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Файл больше 10 МБ" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = (form.get("name") as string | null)?.trim() || "Мой аватар";

    const res = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type: "photo",
        name,
        file: { type: "base64", media_type: mime, data: buffer.toString("base64") },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      const human = heygenMessage(res.status, text);
      let hint = "";
      if (res.status === 401 || res.status === 403 || /permission|not.*allow|plan/i.test(human)) {
        hint = " — эта функция требует платного тарифа HeyGen (Business/Pro).";
      }
      return NextResponse.json(
        { ok: false, error: `HeyGen ${res.status}: ${human}${hint}`, debug: text.slice(0, 500) },
        { status: 500 },
      );
    }

    let parsed: { data?: { avatar_item?: AvatarItem } } = {};
    try { parsed = JSON.parse(text); } catch { /* ниже отработает проверка на id */ }
    const item = parsed.data?.avatar_item;
    if (!item?.id) {
      return NextResponse.json(
        { ok: false, error: `HeyGen не вернул avatar id: ${text.slice(0, 300)}` },
        { status: 500 },
      );
    }
    if (item.status === "failed") {
      return NextResponse.json(
        { ok: false, error: `HeyGen отклонил фото: ${item.error?.message ?? item.error?.code ?? "причина не указана"}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        heygenAvatarId: item.id,
        previewUrl: item.preview_image_url ?? "",
        name: item.name ?? name,
        status: item.status === "completed" ? "ready" : "processing",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
