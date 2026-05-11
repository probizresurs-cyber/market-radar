/**
 * VK-publisher.
 *
 * Публикует пост в VK-сообщество через wall.post API. Требует:
 *   - User access token с правами `wall, photos, groups` (env VK_ACCESS_TOKEN)
 *   - owner_id (id сообщества с минусом для группы: `-12345`)
 *
 * Картинки: используется полный 3-step flow:
 *   1. photos.getWallUploadServer — получаем upload_url
 *   2. POST multipart с файлом → возвращает {server, photo, hash}
 *   3. photos.saveWallPhoto — сохраняет, возвращает owner_id + photo_id
 *   4. wall.post с attachments=photoOwner_photoId
 *
 * Поддерживает как http(s) URL так и data:image/...;base64,... — оба
 * приводятся к Blob для multipart-загрузки.
 */

const VK_API_VERSION = "5.199";
const VK_TOKEN = process.env.VK_ACCESS_TOKEN;
const VK_GROUP_ID = process.env.VK_GROUP_ID; // например, "-123456789" для сообщества

export interface VkPublishParams {
  /** Текст поста. ≤16384 символов; обрезается. */
  text: string;
  /** Опционально — картинка. URL должен быть публично доступен ИЛИ data:URL. */
  imageUrl?: string;
  /** Перекрыть owner_id (по умолчанию VK_GROUP_ID из env). */
  ownerId?: string;
}

export interface VkPublishResult {
  ok: boolean;
  postId?: string;
  messageUrl?: string;
  error?: string;
}

const VK_LIMIT = 16000;

/**
 * Загружает картинку как фото на стену сообщества и возвращает строку attachments
 * вида "photo<owner>_<id>" для wall.post. На любой ошибке возвращает null —
 * пост уйдёт без картинки, а не упадёт целиком.
 */
async function uploadWallPhoto(imageUrl: string, ownerId: string, token: string): Promise<string | null> {
  try {
    // Step 1: получаем upload_url. owner_id для группы передаётся как
    // group_id с положительным числом (без минуса).
    const groupNum = ownerId.startsWith("-") ? ownerId.slice(1) : ownerId;
    const u1 = await fetch(
      `https://api.vk.com/method/photos.getWallUploadServer?group_id=${encodeURIComponent(
        groupNum,
      )}&access_token=${token}&v=${VK_API_VERSION}`,
    );
    const j1 = (await u1.json()) as {
      response?: { upload_url: string };
      error?: { error_msg: string };
    };
    if (!j1.response?.upload_url) return null;

    // Step 2: качаем картинку → multipart → upload
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const blob = await imgRes.blob();
    // Имя файла — обязательно с расширением, иначе VK ругается.
    // Берём что-то по умолчанию (jpg) — VK всё равно перекодирует.
    const fileName = "photo.jpg";

    const fd = new FormData();
    fd.append("photo", blob, fileName);
    const up = await fetch(j1.response.upload_url, { method: "POST", body: fd });
    const upJson = (await up.json()) as {
      server?: number;
      photo?: string;
      hash?: string;
    };
    if (!upJson.photo) return null;

    // Step 3: photos.saveWallPhoto
    const saveParams = new URLSearchParams({
      group_id: groupNum,
      server: String(upJson.server ?? ""),
      photo: upJson.photo ?? "",
      hash: upJson.hash ?? "",
      access_token: token,
      v: VK_API_VERSION,
    });
    const s = await fetch(`https://api.vk.com/method/photos.saveWallPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: saveParams.toString(),
    });
    const sJson = (await s.json()) as {
      response?: Array<{ id: number; owner_id: number }>;
      error?: { error_msg: string };
    };
    const photo = sJson.response?.[0];
    if (!photo) return null;
    return `photo${photo.owner_id}_${photo.id}`;
  } catch {
    return null;
  }
}

export async function publishToVK(p: VkPublishParams): Promise<VkPublishResult> {
  if (!VK_TOKEN) return { ok: false, error: "VK_ACCESS_TOKEN не настроен" };
  const ownerId = p.ownerId ?? VK_GROUP_ID;
  if (!ownerId) return { ok: false, error: "VK_GROUP_ID не настроен" };

  // Truncate text
  const text = p.text.length > VK_LIMIT
    ? p.text.slice(0, VK_LIMIT - 3) + "..."
    : p.text;

  // Попытка загрузить картинку — best-effort. Если не вышло, идём без фото.
  let attachments = "";
  if (p.imageUrl) {
    const att = await uploadWallPhoto(p.imageUrl, ownerId, VK_TOKEN);
    if (att) attachments = att;
  }

  const params = new URLSearchParams({
    owner_id: ownerId,
    message: text,
    from_group: "1",
    access_token: VK_TOKEN,
    v: VK_API_VERSION,
  });
  if (attachments) params.append("attachments", attachments);

  try {
    const r = await fetch(`https://api.vk.com/method/wall.post`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const j = await r.json() as { response?: { post_id: number }; error?: { error_code: number; error_msg: string } };
    if (j.error) return { ok: false, error: `VK error ${j.error.error_code}: ${j.error.error_msg}` };

    const postId = j.response?.post_id;
    if (!postId) return { ok: false, error: "VK не вернул post_id" };

    const messageUrl = `https://vk.com/wall${ownerId}_${postId}`;
    return { ok: true, postId: String(postId), messageUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
