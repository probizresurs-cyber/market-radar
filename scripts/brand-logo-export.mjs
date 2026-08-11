/**
 * Выгрузка логотипа бренда из брендбука в файл.
 *
 * Нужен для операций, где логотип должен быть ИМЕННО файлом, а не
 * data:-URL: наложение на портрет ведущего, подготовка ассетов, отладка.
 *
 * Ключ брендбука ищем по содержимому — имя несёт суффикс профиля, и жёсткий
 * LIKE уже приводил к ложному «брендбук не найден».
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/brand-logo-export.mjs [путь] [email]
 */
import pg from "pg";
import { writeFileSync } from "fs";

const out = process.argv[2] || "/tmp/brand-logo.png";
const ownerEmail = process.argv[3] || "admin@company24.pro";

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const u = await db.query("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  if (u.rows.length === 0) throw new Error(`Пользователь ${ownerEmail} не найден`);
  const all = await db.query("SELECT key, value FROM user_data WHERE user_id = $1", [u.rows[0].id]);
  const row = all.rows.find((r) => {
    const v = r.value;
    return v && typeof v === "object" && !Array.isArray(v) && Boolean(v.logoDataUrl);
  });
  if (!row) throw new Error("В брендбуке нет логотипа");
  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(row.value.logoDataUrl);
  if (!m) throw new Error("Логотип не в формате data:image;base64");
  const bytes = Buffer.from(m[2], "base64");
  writeFileSync(out, bytes);
  console.log(`${out} — ${m[1]}, ${(bytes.length / 1024).toFixed(1)} КБ (ключ ${row.key})`);
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
