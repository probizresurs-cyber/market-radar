/**
 * Создание фото-аватара: генерируем портрет ведущего и заводим его в HeyGen.
 *
 * Две стадии, обе через прод-эндпоинты (значит, тем же путём, что и из
 * кабинета — если сломается, сломается одинаково):
 *   1) /api/generate-image      — портрет по описанию
 *   2) /api/heygen-upload-photo — /v3/avatars type:"photo" → avatar_id,
 *      который принимает наш слой говорящей головы
 *
 * ВАЖНО про логотип на каске: генеративные модели не умеют рисовать заданный
 * логотип — выходят похожие на буквы кляксы, и на 360px-врезке это читается
 * как брак. Поэтому просим каску В ФИРМЕННЫХ ЦВЕТАХ без надписей, а не
 * «каску с логотипом ОРЛИНК». Настоящий логотип в ролике и так présent —
 * в углу кадра и на финале.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/make-avatar.mjs "имя аватара" [email]
 */
import pg from "pg";
import { SignJWT } from "jose";
import { writeFileSync } from "fs";

const avatarName = process.argv[2] || "Орлинк — прораб";
const ownerEmail = process.argv[3] || "admin@company24.pro";

const PROMPT = `Photorealistic portrait photograph of a young Russian construction site manager, age 28-32, clean-shaven or light stubble, friendly confident expression, looking directly at camera.

Wearing a bright amber-yellow hard hat (solid colour, NO text, NO logos, NO stickers) and a dark charcoal work jacket with amber-yellow high-visibility stripes.

Shot: upper chest and head, centred, slight three-quarter angle, eye level. Shallow depth of field, blurred modern construction site background with steel structures. Soft natural daylight, professional corporate photography, sharp focus on face, neutral colour grading.

Strictly no text, no letters, no writing, no watermarks anywhere in the image.`;

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
  const cookie = `mr_token=${token}`;

  console.log("1/2 Генерирую портрет…");
  const gi = await fetch(`${BASE}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ prompt: PROMPT }),
  });
  const gj = await gi.json().catch(() => ({}));
  const dataUrl = gj?.imageUrl || gj?.data?.imageUrl || gj?.url;
  if (!dataUrl) throw new Error(`Портрет не сгенерился: ${JSON.stringify(gj).slice(0, 300)}`);

  // Картинка приходит data:-URL'ом; HeyGen-роут ждёт файл в multipart.
  const m = /^data:(image\/\w+);base64,(.+)$/s.exec(dataUrl);
  const [mime, b64] = m ? [m[1], m[2]] : ["image/png", null];
  const bytes = b64
    ? Buffer.from(b64, "base64")
    : Buffer.from(await (await fetch(dataUrl)).arrayBuffer());
  console.log(`   портрет получен, ${(bytes.length / 1024).toFixed(0)} КБ`);

  // Копию кладём рядом — чтобы можно было посмотреть, кого именно завели.
  const preview = `public/promo-images/avatar-${Date.now()}.png`;
  writeFileSync(preview, bytes);
  console.log(`   превью: https://marketradar24.ru/api/static-asset/promo-images/${preview.split("/").pop()}`);

  console.log("2/2 Завожу аватар в HeyGen…");
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: mime }), "avatar.png");
  fd.append("name", avatarName);
  const up = await fetch(`${BASE}/api/heygen-upload-photo`, { method: "POST", headers: { cookie }, body: fd });
  const uj = await up.json().catch(() => ({}));
  if (!uj?.ok) throw new Error(`HeyGen отказал: ${JSON.stringify(uj).slice(0, 300)}`);

  console.log(`\nГотово. avatarId: ${uj.data.heygenAvatarId}`);
  console.log(`Статус: ${uj.data.status ?? "?"}`);
  if (uj.data.previewUrl) console.log(`Превью HeyGen: ${uj.data.previewUrl}`);
  console.log("\nПодставьте этот id в бриф ролика (поле avatarId).");
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
