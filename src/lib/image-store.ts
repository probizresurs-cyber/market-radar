/**
 * Persistent image store — конвертирует base64 data-URI в стабильный URL,
 * который не раздувает localStorage и тело POST /api/data.
 *
 * Картинки от OpenAI / Gemini / Pollinations возвращаются как
 *   `data:image/png;base64,iVBORw0KGgo...`
 * длиной 1-2 MB. Если такой URI положить в `GeneratedPost.imageUrl`
 * и сохранить — после 2-4 постов localStorage переполняется и пост
 * теряется на следующем reload (catch проглатывает QuotaExceededError).
 *
 * Этот хелпер:
 *   1) Принимает data-URI или обычный URL,
 *   2) Если это data-URI и есть `userId` — сохраняет байты в Postgres
 *      (таблица `user_images`) и возвращает `/api/image/{id}`,
 *   3) Иначе возвращает исходную строку (graceful fallback — пост хотя
 *      бы покажется в текущей сессии, даже если потом не переживёт reload).
 *
 * Использовать в любом API-роуте сразу после получения картинки:
 *
 *   const dataUri = imgResult.imageUrl;
 *   const safeUrl = await persistImageDataUri(dataUri, access.userId);
 *   // safeUrl = "/api/image/abc-uuid" (короткий, дёшево хранить)
 */

import { randomUUID } from "crypto";
import { query } from "./db";

export async function persistImageDataUri(
  imageUrlOrDataUri: string | undefined,
  userId: string | null | undefined,
): Promise<string | undefined> {
  if (!imageUrlOrDataUri) return imageUrlOrDataUri;
  if (!imageUrlOrDataUri.startsWith("data:image/")) {
    // уже обычный URL — ничего не делаем
    return imageUrlOrDataUri;
  }
  const match = imageUrlOrDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return imageUrlOrDataUri;
  const mimeType = match[1];
  const base64 = match[2];
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch (e) {
    console.warn("[image-store] base64 decode failed:", e);
    return imageUrlOrDataUri;
  }
  const id = randomUUID();
  try {
    // user_id NULL допустим (anon-flow) — мы релакснули колонку в db.ts
    await query(
      `INSERT INTO user_images (id, user_id, mime_type, data, size_bytes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId ?? null, mimeType, bytes, bytes.length],
    );
    return `/api/image/${id}`;
  } catch (e) {
    console.error(`[image-store] DB insert failed for ${userId ? "user " + userId : "anon"}, size=${bytes.length}, keeping inline base64:`, e);
    return imageUrlOrDataUri;
  }
}
