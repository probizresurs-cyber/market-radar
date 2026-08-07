/**
 * Статус сборки ролика по jobId.
 *
 * Отдельным скриптом, потому что /api/promo-job-status требует сессионную
 * куку: гонять админский токен через переписку и переменные окружения — и
 * неудобно, и небезопасно. Здесь он подписывается на месте тем же секретом,
 * что и в приложении, живёт 5 минут и никуда не печатается.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/reel-status.mjs <jobId> [email]
 */
import pg from "pg";
import { SignJWT } from "jose";

const jobId = process.argv[2];
const ownerEmail = process.argv[3] || "admin@company24.pro";
if (!jobId) {
  console.error("Укажите jobId: node scripts/reel-status.mjs pjob-...");
  process.exit(1);
}

const PORTS = [process.env.PORT, "3001", "3000", "3002"].filter(Boolean);
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

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const base = await resolveBase();
  const u = await db.query("SELECT id, role FROM users WHERE email = $1", [ownerEmail]);
  if (u.rows.length === 0) throw new Error(`Пользователь ${ownerEmail} не найден`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Нет JWT_SECRET в окружении");
  const token = await new SignJWT({ userId: u.rows[0].id, email: ownerEmail, role: u.rows[0].role ?? "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));

  const res = await fetch(`${base}/api/promo-job-status/${jobId}`, {
    headers: { cookie: `mr_token=${token}` },
  });
  const j = await res.json().catch(() => ({}));
  const d = j?.data ?? j;

  console.log(`Статус: ${d?.status ?? "?"}${d?.error ? ` — ${d.error}` : ""}`);

  // Отчёт по шагам лежит в progress.steps, а ссылка на файл — в result.url:
  // ровно этот контракт возвращает /api/promo-job-status (см. его шапку).
  // Раньше скрипт искал steps/videoUrl на верхнем уровне и печатал пустоту
  // даже при успешной сборке.
  // progress — это САМ массив шагов, а не объект со steps внутри (проверено
  // на живом ответе). Прошлая версия скрипта искала progress.steps и молча
  // печатала пустоту, из-за чего провал шага avatar пришлось искать в логах.
  const steps = Array.isArray(d?.progress) ? d.progress : (d?.progress?.steps ?? d?.steps ?? []);
  for (const s of steps) {
    const secs = s.ms ? ` ${(s.ms / 1000).toFixed(1)}с` : "";
    const mark = s.status === "ok" ? "✓" : s.status === "skipped" ? "–" : s.status === "in_progress" ? "…" : "✗";
    console.log(`  ${mark} ${s.name}${secs}${s.error ? ` — ${s.error}` : ""}`);
  }
  if (d?.progress?.stage) console.log(`Этап: ${d.progress.stage}`);

  const r = d?.result;
  if (r?.url) {
    const mb = r.sizeBytes ? ` (${(r.sizeBytes / 1024 / 1024).toFixed(1)} МБ)` : "";
    const mins = r.totalMs ? `, собран за ${(r.totalMs / 60000).toFixed(1)} мин` : "";
    console.log(`\nВидео: https://marketradar24.ru${r.url}${mb}${mins}`);
  }
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
