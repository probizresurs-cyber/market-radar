/**
 * Хранилище кодов привязки MR-XXXXXX → chat_id.
 *
 * Было: in-memory Map + setTimeout — коды терялись при pm2 restart в окне
 * между «юзер отправил код боту» и «нажал Проверить подключение» (до 10 мин),
 * и не работали бы при >1 процессе. Теперь таблица tg_connect_codes (db.ts),
 * TTL — попутной чисткой по created_at, без отдельного крона.
 */
import { query, initDb } from "./db";

const TTL_MINUTES = 10;

export async function saveChatId(code: string, chatId: number): Promise<void> {
  await initDb();
  // Повторная отправка того же кода обновляет chat_id и продлевает TTL —
  // юзер мог отправить код со второго Telegram-аккаунта.
  await query(
    `INSERT INTO tg_connect_codes (code, chat_id) VALUES ($1, $2)
     ON CONFLICT (code) DO UPDATE SET chat_id = EXCLUDED.chat_id, created_at = NOW()`,
    [code.toUpperCase(), chatId],
  );
}

export async function getChatId(code: string): Promise<number | null> {
  await initDb();
  // Попутная чистка протухших кодов — дешевле отдельного cron-задания.
  await query(
    `DELETE FROM tg_connect_codes WHERE created_at < NOW() - INTERVAL '${TTL_MINUTES} minutes'`,
  );
  const rows = await query<{ chat_id: string }>(
    `SELECT chat_id FROM tg_connect_codes WHERE code = $1`,
    [code.toUpperCase()],
  );
  return rows[0] ? Number(rows[0].chat_id) : null;
}
