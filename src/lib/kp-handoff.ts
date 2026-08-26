// Передача готового анализа из КП в аккаунт платформы.
//
// Один и тот же шаг нужен двум входам воронки:
//   - magic-link: менеджер жмёт «Создать доступ» из карточки лида;
//   - онбординг: человек зарегистрировался, КП сгенерировалось само.
// Держим в одном месте, потому что тут два правила, которые легко нарушить
// по-разному в двух копиях: не затирать уже имеющийся анализ клиента и
// проставлять platform_user_id, иначе воронка теряет связь КП с аккаунтом.
import { randomUUID } from "crypto";
import { query } from "./db";
import type { AnalysisResult } from "./types";

/**
 * Кладёт анализ из КП в user_data.company, если у аккаунта своих данных ещё
 * нет, и привязывает генерацию к пользователю.
 *
 * Чужой или более старый анализ НЕ должен затирать текущую работу клиента —
 * поэтому вставка идёт только при отсутствии ключа, а не upsert'ом.
 *
 * @returns true, если анализ реально перенесли (false — у аккаунта уже был свой)
 */
export async function seedCompanyFromKp(
  userId: string,
  kpId: string,
  company: AnalysisResult,
): Promise<boolean> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM user_data WHERE user_id = $1 AND key = 'company'`,
    [userId],
  );

  let seeded = false;
  if (existing.length === 0) {
    const withDate: AnalysisResult = { ...company, analyzedAt: new Date().toISOString() };
    await query(
      `INSERT INTO user_data (id, user_id, key, value) VALUES ($1, $2, 'company', $3)
       ON CONFLICT (user_id, key) DO NOTHING`,
      [randomUUID(), userId, JSON.stringify(withDate)],
    );
    seeded = true;
  }

  await query(`UPDATE kp_generations SET platform_user_id = $2 WHERE id = $1`, [kpId, userId]);
  return seeded;
}
