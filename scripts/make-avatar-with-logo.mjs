/**
 * Портрет ведущего с НАСТОЯЩИМ логотипом бренда на каске.
 *
 * Почему не генератором HeyGen: он рисует эмблему «в стиле», придумывая знак
 * сам — издалека похоже на фирменный, вблизи это другой логотип. Референсную
 * картинку он не принимает вовсе (только текстовое описание внешности).
 *
 * Поэтому: генерируем портрет Gemini-моделью, отдав ей логотип из брендбука
 * КАК РЕФЕРЕНС (/api/generate-image принимает referenceImages), и просим
 * воспроизвести знак один в один. Готовое фото заводим в HeyGen как
 * photo-аватар — там оно уже не генерируется, а используется как есть.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/make-avatar-with-logo.mjs ["имя аватара"] [email]
 */
import pg from "pg";
import { SignJWT } from "jose";
import { writeFileSync } from "fs";

const avatarName = process.argv[2] || "Орлинк — прораб";
const ownerEmail = process.argv[3] || "admin@company24.pro";

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

const PROMPT = `Photorealistic corporate portrait photograph of a young construction site foreman, about 28 years old, short dark hair, clean-shaven, friendly confident expression, looking directly at the camera.

He wears a WHITE hard hat. On the front of the hard hat, reproduce EXACTLY the logo from the attached reference image — same shape, same proportions, same colours, same orientation. Do not redraw, restyle or invent a different emblem: it must be the same logo, only fitted to the curved surface of the helmet with realistic lighting and slight perspective.

He wears a dark charcoal work jacket with amber-yellow high-visibility stripes. Background: modern construction site with steel structures, softly blurred. Natural daylight, sharp focus on the face, neutral colour grading.

Square framing, head and upper chest, centred. No text anywhere except the logo itself.`;

const BASE = await resolveBase();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const u = await db.query("SELECT id, role FROM users WHERE email = $1", [ownerEmail]);
  if (u.rows.length === 0) throw new Error(`Пользователь ${ownerEmail} не найден`);

  // Логотип берём из брендбука — по содержимому, а не по имени ключа
  // (ключ несёт суффикс профиля).
  const all = await db.query(
    "SELECT key, value FROM user_data WHERE user_id = $1 ORDER BY updated_at DESC",
    [u.rows[0].id],
  );
  const brand = all.rows.find((r) => {
    const v = r.value;
    return v && typeof v === "object" && !Array.isArray(v) && Boolean(v.logoDataUrl);
  })?.value;
  const logo = brand?.logoDataUrl;
  if (!logo) throw new Error("В брендбуке нет логотипа (logoDataUrl) — загрузите его в кабинете");

  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(logo);
  if (!m) throw new Error("Логотип не в формате data:image;base64");
  const [, logoMime, logoB64] = m;
  console.log(`Логотип из брендбука: ${logoMime}, ${(logoB64.length / 1024).toFixed(0)} КБ base64`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Нет JWT_SECRET");
  const token = await new SignJWT({ userId: u.rows[0].id, email: ownerEmail, role: u.rows[0].role ?? "user" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  const cookie = `mr_token=${token}`;

  console.log("Генерирую портрет с логотипом-референсом…");
  const gi = await fetch(`${BASE}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      prompt: PROMPT,
      referenceImages: [{ data: logoB64, mimeType: logoMime }],
    }),
  });
  const gj = await gi.json().catch(() => ({}));
  const dataUrl = gj?.data?.imageUrl || gj?.imageUrl;
  if (!dataUrl) throw new Error(`Портрет не сгенерился: ${JSON.stringify(gj).slice(0, 300)}`);

  const pm = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(dataUrl);
  const bytes = pm
    ? Buffer.from(pm[2], "base64")
    : Buffer.from(await (await fetch(dataUrl)).arrayBuffer());
  const file = `avatar-logo-${Date.now()}.png`;
  writeFileSync(`public/promo-images/${file}`, bytes);
  console.log(`\nПортрет: https://marketradar24.ru/api/static-asset/promo-images/${file}`);
  console.log(`Размер: ${(bytes.length / 1024).toFixed(0)} КБ`);
  console.log("\nПосмотрите на логотип. Если совпадает — заводим аватар:");
  console.log(`  node scripts/adopt-avatar.mjs public/promo-images/${file} "${avatarName}"`);
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
