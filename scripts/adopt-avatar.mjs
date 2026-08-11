/**
 * Заведение готового портрета аватаром в HeyGen (photo avatar).
 *
 * Отделено от генерации намеренно: портрет обычно доводят (наложение
 * логотипа, кроп, цвет), и заводить в HeyGen нужно ИМЕННО финальный файл,
 * а не то, что вышло из генератора с первой попытки.
 *
 * Идёт через наш /api/heygen-upload-photo — то есть /v3/avatars type:"photo",
 * который отдаёт avatar_id, совместимый с генерацией говорящей головы
 * (/v3/videos). Легаси-путь talking_photo для этого не годится.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/adopt-avatar.mjs <путь к png> "имя" [email]
 */
import pg from "pg";
import { SignJWT } from "jose";
import { readFileSync } from "fs";

const file = process.argv[2];
const name = process.argv[3] || "Аватар";
const ownerEmail = process.argv[4] || "admin@company24.pro";
if (!file) {
  console.error("Укажите файл: node scripts/adopt-avatar.mjs public/promo-images/x.png \"Имя\"");
  process.exit(1);
}

const PORTS = [process.env.PORT, "3001", "3000"].filter(Boolean);
async function resolveBase() {
  for (const p of PORTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      await fetch(`http://127.0.0.1:${p}/api/content/video/plan`, { method: "HEAD", signal: ctrl.signal });
      clearTimeout(t);
      return `http://127.0.0.1:${p}`;
    } catch { /* следующий */ }
  }
  throw new Error(`Приложение не отвечает на портах ${PORTS.join(", ")}`);
}

const BASE = await resolveBase();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const u = await db.query("SELECT id, role FROM users WHERE email = $1", [ownerEmail]);
  if (u.rows.length === 0) throw new Error(`Пользователь ${ownerEmail} не найден`);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Нет JWT_SECRET");
  const token = await new SignJWT({ userId: u.rows[0].id, email: ownerEmail, role: u.rows[0].role ?? "user" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  const bytes = readFileSync(file);
  console.log(`Файл: ${file}, ${(bytes.length / 1024).toFixed(0)} КБ`);

  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: "image/png" }), "avatar.png");
  fd.append("name", name);

  const r = await fetch(`${BASE}/api/heygen-upload-photo`, {
    method: "POST",
    headers: { cookie: `mr_token=${token}` },
    body: fd,
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) throw new Error(`HeyGen отказал: ${JSON.stringify(j).slice(0, 400)}`);

  console.log(`\navatarId: ${j.data.heygenAvatarId}`);
  console.log(`Статус: ${j.data.status ?? "?"}`);
  if (j.data.previewUrl) console.log(`Превью: ${j.data.previewUrl}`);
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
