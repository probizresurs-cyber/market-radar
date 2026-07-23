/**
 * Magic-link вход без пароля — Фаза B ремонта КП-воронки.
 *
 * Менеджер выдаёт лиду доступ к платформе прямо из карточки КП: создаётся
 * (или переиспользуется, если email уже зарегистрирован) реальный аккаунт
 * `users`, готовый анализ из `kp_generations.company` переносится в
 * `user_data` как стартовые данные, и клиенту на email уходит одноразовая
 * ссылка входа.
 *
 * Токен хранится только в виде SHA-256 хэша (как reset-токены большинства
 * систем) — сырой токен известен только письму, БД видит лишь хэш.
 */
import { randomBytes, randomUUID, createHash } from "crypto";
import { query } from "@/lib/db";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней — как обычная сессия

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createMagicLink(userId: string, kpGenerationId: string | null): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO magic_links (id, token_hash, user_id, kp_generation_id, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
    [randomUUID(), hashToken(raw), userId, kpGenerationId],
  );
  return raw;
}

export interface MagicLinkRow {
  id: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
}

/** Валидирует и СРАЗУ помечает токен использованным (одноразовый). null — невалиден/просрочен/уже использован. */
export async function consumeMagicLink(raw: string): Promise<{ userId: string } | null> {
  const hash = hashToken(raw);
  const rows = await query<MagicLinkRow>(
    `SELECT id, user_id, expires_at, used_at FROM magic_links WHERE token_hash = $1`,
    [hash],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(`UPDATE magic_links SET used_at = NOW() WHERE id = $1`, [row.id]);
  return { userId: row.user_id };
}
