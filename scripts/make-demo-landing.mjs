/**
 * Сборка демо-лендинга напрямую на сервере, минуя UI.
 *
 * Нужен потому, что генерацию из кабинета сейчас не запустить (нет доступа к
 * браузеру), а проверить сквозной путь надо целиком: Stitch → HTML → публичная
 * ссылка. Скрипт повторяет ровно то, что делают роуты generate-landing и
 * landing-share, включая владение проектом (landing_projects) — иначе шара
 * получилась бы «ничьей» и её нельзя было бы удалить из кабинета.
 *
 * Запуск (env подхватываем из обоих файлов, .env.local приоритетнее):
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/make-demo-landing.mjs <email-владельца>
 */
import { StitchToolClient, Stitch } from "@google/stitch-sdk";
import pg from "pg";
import { randomBytes } from "crypto";

const ownerEmail = process.argv[2] || "admin@company24.pro";

const apiKey = process.env.GOOGLE_STITCH_API_KEY || process.env.STITCH_API_KEY;
if (!apiKey) {
  console.error("Нет GOOGLE_STITCH_API_KEY в окружении");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Нет DATABASE_URL в окружении");
  process.exit(1);
}

// ── Бренд ГК ОРЛИНК: чёрный + жёлтый ────────────────────────────
const BRAND = {
  name: "GK ORLINK",           // техническое ASCII-имя: Stitch не принимает кириллицу
  displayName: "ГК ОРЛИНК",
  colors: ["#111111", "#F5A623"],
  font: "MONTSERRAT",
};

const prompt = `Create a professional landing page for "ГК ОРЛИНК".

About: Производство и монтаж металлоконструкций под ключ — проектирование, изготовление, доставка и монтаж.

Main company landing page with hero, services, benefits, process, testimonials, CTA sections.

Use these exact colors: ${BRAND.colors.join(", ")} — deep black as the base, bright amber as the accent for buttons, highlights and section markers.

Typography: Use "Montserrat" as the main font family.

Base requirements:
- Mobile-responsive layout
- All text content in Russian language
- Professional, conversion-optimized design
- Hero section with headline, subheadline, CTA button
- Clean typography with proper spacing and visual hierarchy
- Subtle hover effects and smooth transitions
- Industrial, confident tone — heavy engineering, not startup style`;

const client = new StitchToolClient({ apiKey });
const stitch = new Stitch(client);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const users = await db.query("SELECT id FROM users WHERE email = $1", [ownerEmail]);
  if (users.rows.length === 0) {
    console.error(`Пользователь ${ownerEmail} не найден`);
    process.exit(1);
  }
  const userId = users.rows[0].id;
  console.log(`Владелец: ${ownerEmail} (${userId})`);

  const project = await stitch.createProject(`${BRAND.name} Landing`);
  console.log(`Проект: ${project.id}`);

  // Дизайн-система по контракту SDK: theme с enum-полями, а не свободные строки.
  try {
    await project.createDesignSystem({
      displayName: `${BRAND.name} brand`,
      theme: {
        colorMode: "DARK",
        headlineFont: BRAND.font,
        bodyFont: BRAND.font,
        roundness: "ROUND_EIGHT",
        customColor: BRAND.colors[1],
      },
    });
    console.log("Дизайн-система: ок");
  } catch (e) {
    console.warn("Дизайн-система не создалась:", e?.message ?? e);
  }

  // GEMINI_3_PRO снята Google — идём по актуальным моделям.
  let screen = null;
  for (const model of ["GEMINI_3_1_PRO", "GEMINI_3_FLASH"]) {
    try {
      console.log(`Генерация (${model})… это занимает пару минут`);
      screen = await project.generate(prompt, "DESKTOP", model);
      console.log(`Экран: ${screen.id}`);
      break;
    } catch (e) {
      console.warn(`  ${model} не сработала: ${e?.message ?? e}`);
    }
  }
  if (!screen) throw new Error("Ни одна модель не сработала");

  const htmlUrl = screen.data?.htmlCode?.downloadUrl || (await screen.getHtml());
  if (!htmlUrl) throw new Error("Stitch не отдал ссылку на HTML");

  // HTML тянем сразу: ссылки Stitch живут 1-7 дней, а шара должна работать вечно.
  const res = await fetch(htmlUrl, { headers: { "X-Goog-Api-Key": apiKey } });
  if (!res.ok) throw new Error(`Скачивание HTML: HTTP ${res.status}`);
  const html = await res.text();
  console.log(`HTML: ${(html.length / 1024).toFixed(1)} КБ`);

  await db.query(
    `INSERT INTO landing_projects (project_id, user_id, workspace_id, landing_type)
     VALUES ($1, $2, $2, 'main') ON CONFLICT (project_id) DO NOTHING`,
    [project.id, userId],
  );

  const slug = randomBytes(8).toString("hex");
  await db.query(
    `INSERT INTO shared_landings (slug, user_id, project_id, title, html_content)
     VALUES ($1, $2, $3, $4, $5)`,
    [slug, userId, project.id, `${BRAND.displayName} — лендинг`, html],
  );

  console.log(`\nГотово: https://marketradar24.ru/l/${slug}`);
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
  await db.end().catch(() => {});
}
