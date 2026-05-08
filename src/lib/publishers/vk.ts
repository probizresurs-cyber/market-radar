/**
 * VK-publisher.
 *
 * Публикует пост в VK-сообщество через wall.post API. Требует:
 *   - User access token с правами `wall, photos, groups` (получает юзер
 *     при подключении сообщества в Settings → Соцсети)
 *   - owner_id (id сообщества с минусом для группы: `-12345`)
 *
 * Для текущей итерации мы кладём токен в env `VK_ACCESS_TOKEN`, group в
 * `VK_GROUP_ID`. В следующей итерации добавим UI для подключения
 * сообщества прямо из Settings (OAuth-flow).
 *
 * Картинки: VK требует загрузки фото отдельным шагом (photos.getWallUploadServer
 * → upload → photos.saveWallPhoto), потом attachment к wall.post. Сейчас
 * поддерживаем только текстовый пост; картинку можно приложить как ссылку
 * в attachment, что VK сам подтянет.
 */

const VK_API_VERSION = "5.199";
const VK_TOKEN = process.env.VK_ACCESS_TOKEN;
const VK_GROUP_ID = process.env.VK_GROUP_ID; // например, "-123456789" для сообщества

export interface VkPublishParams {
  /** Текст поста. ≤16384 символов; обрезается. */
  text: string;
  /** Опционально — картинка. URL должен быть публично доступен. */
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

export async function publishToVK(p: VkPublishParams): Promise<VkPublishResult> {
  if (!VK_TOKEN) return { ok: false, error: "VK_ACCESS_TOKEN не настроен" };
  const ownerId = p.ownerId ?? VK_GROUP_ID;
  if (!ownerId) return { ok: false, error: "VK_GROUP_ID не настроен" };

  // Truncate
  const text = p.text.length > VK_LIMIT
    ? p.text.slice(0, VK_LIMIT - 3) + "..."
    : p.text;

  const params = new URLSearchParams({
    owner_id: ownerId,
    message: text,
    from_group: "1",
    access_token: VK_TOKEN,
    v: VK_API_VERSION,
  });

  if (p.imageUrl && p.imageUrl.startsWith("http")) {
    // VK не принимает data-URL. Если картинка — http, пробуем
    // приложить как attachment "link" с превью; но это даст плохой UX.
    // Для нормальной интеграции нужна загрузка через photos.getWallUploadServer.
    // На MVP оставляем текст; картинку добавим в next iteration.
    // params.append("attachments", p.imageUrl);
  }

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
