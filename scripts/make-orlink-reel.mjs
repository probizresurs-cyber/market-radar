/**
 * Запуск ролика ГК ОРЛИНК ко Дню строителя напрямую на сервере.
 *
 * Зачем скриптом, а не из кабинета: доступа к браузеру сейчас нет, а
 * оркестратор /api/content/video/render требует сессионную куку. Скрипт
 * логинится сервисным путём — берёт userId из БД и подписывает сессию тем же
 * секретом, что и приложение, — после чего дёргает оркестратор как обычный
 * авторизованный клиент.
 *
 * Что получится: вертикальный ролик 30 сек, говорящий аватар врезкой, наша
 * озвучка ElevenLabs, субтитры по пословным таймингам Whisper, логотип в углу
 * и крупно на финальном кадре.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/make-orlink-reel.mjs [email-владельца]
 */
import pg from "pg";
import { SignJWT } from "jose";

const ownerEmail = process.argv[2] || "admin@company24.pro";
/**
 * Порт приложения. PORT в .env не задан (его выставляет PM2), поэтому
 * дефолт 3000 дал «fetch failed» — процесс слушает другой порт. Пробуем
 * несколько кандидатов и берём тот, который отвечает.
 */
const PORT_CANDIDATES = [process.env.PORT, "3000", "3001", "3002", "3100", "3200", "8080"]
  .filter(Boolean);

async function resolveBase() {
  if (process.env.REEL_BASE_URL) return process.env.REEL_BASE_URL;
  for (const p of PORT_CANDIDATES) {
    const url = `http://127.0.0.1:${p}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      // Код ответа не важен — важен сам факт соединения с нашим процессом.
      await fetch(`${url}/api/content/video/plan`, { method: "HEAD", signal: ctrl.signal });
      clearTimeout(t);
      console.log(`Приложение отвечает на порту ${p}`);
      return url;
    } catch { /* пробуем следующий */ }
  }
  throw new Error(
    `Приложение не отвечает ни на одном из портов: ${PORT_CANDIDATES.join(", ")}. ` +
    "Посмотрите реальный порт: pm2 env 4 | grep -i port",
  );
}

const AVATAR_ID = "3e74b8e8b04c4007bd32cc4f21c9f9d1";
const VOICE_ID = "rYBvDw8ISDqxmPyq2HAn";

// Сценарий: из поста ко Дню строителя оставлена ремесленная конкретика
// (узлы, геометрия, нормативы) — на слух она и отличает поздравление
// «от своих», тогда как перечисления и «мы гордимся» в 30 секунд не работают.
const VOICEOVER = `Здание начинается не с бетона. Оно начинается с расчёта.
Точность узла — миллиметры. Контроль геометрии — до миллиметра. Нормативы, сроки, слаженная бригада на площадке.
Каждый сданный объект — это рабочие места, производство, логистика. Реальные дела, которые стоят десятилетия.
Девятого августа — День строителя. Праздник тех, чьими руками и расчётом всё это поднимается.
С праздником, коллеги.`;

const BASE = await resolveBase();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const u = await db.query("SELECT id, role FROM users WHERE email = $1", [ownerEmail]);
  if (u.rows.length === 0) throw new Error(`Пользователь ${ownerEmail} не найден`);
  const userId = u.rows[0].id;
  const role = u.rows[0].role ?? "user";

  console.log(`Владелец: ${ownerEmail}`);

  // Ключ брендбука ищем по содержимому, а не по угаданному имени: в user_data
  // он лежит под ключом, который зависит от профиля (суффикс ::p_<id>), и
  // жёсткий LIKE 'm_brandbook%' уже дал ложное «брендбук НЕ найден».
  // Признак настоящего брендбука — палитра colors или логотип, а не имя ключа.
  const all = await db.query(
    "SELECT key, value FROM user_data WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId],
  );
  console.log(`Ключей в user_data: ${all.rows.length}`);
  const brandRow = all.rows.find((r) => {
    const v = r.value;
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    return Boolean(v.logoDataUrl) || Array.isArray(v.colors);
  });
  const brandBook = brandRow?.value ?? null;
  const logoUrl = brandBook?.logoDataUrl ?? null;
  console.log(
    `Брендбук: ${brandBook ? `найден (ключ ${brandRow.key})` : "НЕ найден"}, ` +
    `логотип: ${logoUrl ? `есть, ${Math.round(String(logoUrl).length / 1024)} КБ` : "НЕТ"}`,
  );
  if (!logoUrl) {
    console.log("  ⚠ Без логотипа ролик соберётся с текстовым названием на финальном кадре.");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Нет JWT_SECRET в окружении");
  // Payload и имя куки — ровно как в src/lib/auth.ts: {userId, email, role}
  // в куке mr_token. Роль обязательна: без неё проверки доступа к продуктам
  // считают пользователя обычным и режут AI-роуты.
  const token = await new SignJWT({ userId, email: ownerEmail, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));

  const res = await fetch(`${BASE}/api/content/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `mr_token=${token}` },
    body: JSON.stringify({
      mode: "broll",
      title: "День строителя",
      scenario: "Поздравление ко Дню строителя от ГК ОРЛИНК: уважение к профессии через конкретику ремесла — расчёт узлов, контроль геометрии, нормативы, работа бригады.",
      voiceoverScript: VOICEOVER,
      companyName: "ГК ОРЛИНК",
      companyNiche: "Металлоконструкции: проектирование, производство, монтаж",
      brandName: "ГК ОРЛИНК",
      brandBook,
      brandColor: "#111111",
      accentColor: "#F5A623",
      logoUrl,
      avatarId: AVATAR_ID,
      elevenlabsVoiceId: VOICE_ID,
      voiceId: VOICE_ID,
      subtitles: true,
      targetDurationSec: 30,
      // Подача голоса: живее и чуть быстрее дикторского пресета.
      // stability НИЖЕ = больше модуляций (0.35 против дефолтных 0.45),
      // style ВЫШЕ = больше эмоции, speed 1.08 — заметно, но без спешки.
      voiceStability: 0.35,
      voiceStyle: 0.68,
      voiceSpeed: 1.08,
      // Круглая врезка с ведущим, а не полноэкранный аватар.
      avatarPlacement: "pip",
      // Субтитры не пропадают на текстовых карточках.
      captionsOverCards: true,
      stylePrompt:
        "Сдержанный индустриальный тон, тяжёлое машиностроение, а не стартап. " +
        "Кадры: металлоконструкции, сварка, монтаж, стройплощадка, чертежи. " +
        "Говорящий ведущий врезкой в кадре на весь ролик.",
    }),
  });

  const j = await res.json().catch(() => ({}));
  if (!j?.ok || !j?.data?.jobId) {
    console.error("Запуск не удался:", JSON.stringify(j).slice(0, 500));
    process.exit(1);
  }
  console.log(`\njobId: ${j.data.jobId}`);
  console.log(`Статус: curl -s "${BASE}/api/promo-job-status/${j.data.jobId}" -H "cookie: mr_token=${token}" | head -c 800`);
  console.log("\nРендер занимает 3-8 минут. Опрашивайте статус командой выше.");
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
