/**
 * Сборка ролика по брифу — универсальная замена make-orlink-reel.mjs,
 * который был жёстко зашит под один текст.
 *
 * Бриф — JSON-файл:
 * {
 *   "title": "...",
 *   "scenario": "о чём ролик (идёт режиссёру, не в озвучку)",
 *   "voiceover": "текст, который произносит голос",
 *   "brandName": "ГК ОРЛИНК",
 *   "companyNiche": "...",
 *   "brandColor": "#111111", "accentColor": "#F5A623",
 *   "avatarId": "...",
 *   "voiceId": "..."   // НЕОБЯЗАТЕЛЬНО и обычно НЕ НУЖНО (см. ниже)
 *
 * Про voiceId: явный id перебивает бренд-голос из ELEVENLABS_BRAND_VOICE_ID.
 * На проде туда прописан Igor взамен инстант-клона, который и давал «робота».
 * Значит, зашитый в бриф старый id молча откатывает это исправление. Поэтому
 * поле оставляем пустым — голос берётся из окружения — и задаём, только когда
 * для конкретного ролика осознанно нужен другой голос.
 *   "assets": ["/api/static-asset/promo-images/foo.jpg", ...],  // свои фото/видео
 *   "stylePrompt": "...",
 *   "durationSec": 30
 * }
 *
 * assets — реальные снимки объекта. Если они есть, AI-видеоряд не заказывается:
 * настоящая площадка убедительнее синтетики и ничего не стоит.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/make-reel.mjs briefs/sport.json [email]
 */
import pg from "pg";
import { SignJWT } from "jose";
import { readFileSync } from "fs";

const briefPath = process.argv[2];
const ownerEmail = process.argv[3] || "admin@company24.pro";
if (!briefPath) {
  console.error("Укажите файл брифа: node scripts/make-reel.mjs briefs/sport.json");
  process.exit(1);
}
const brief = JSON.parse(readFileSync(briefPath, "utf8"));

const PORTS = [process.env.PORT, "3001", "3000", "3002"].filter(Boolean);
async function resolveBase() {
  if (process.env.REEL_BASE_URL) return process.env.REEL_BASE_URL;
  for (const p of PORTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      await fetch(`http://127.0.0.1:${p}/api/content/video/plan`, { method: "HEAD", signal: ctrl.signal });
      clearTimeout(t);
      console.log(`Приложение на порту ${p}`);
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
  const userId = u.rows[0].id;

  // Брендбук ищем по содержимому: ключ несёт суффикс профиля, и жёсткое имя
  // уже приводило к ложному «брендбук не найден».
  const all = await db.query(
    "SELECT key, value FROM user_data WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId],
  );
  const brandRow = all.rows.find((r) => {
    const v = r.value;
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    return Boolean(v.logoDataUrl) || Array.isArray(v.colors);
  });
  const brandBook = brandRow?.value ?? null;
  const logoUrl = brandBook?.logoDataUrl ?? null;
  console.log(`Брендбук: ${brandBook ? "есть" : "нет"}, логотип: ${logoUrl ? "есть" : "НЕТ"}`);
  console.log(`Свои материалы: ${(brief.assets ?? []).length} шт.`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Нет JWT_SECRET в окружении");
  const token = await new SignJWT({ userId, email: ownerEmail, role: u.rows[0].role ?? "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));

  const res = await fetch(`${BASE}/api/content/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `mr_token=${token}` },
    body: JSON.stringify({
      mode: "broll",
      title: brief.title,
      scenario: brief.scenario,
      voiceoverScript: brief.voiceover,
      companyName: brief.brandName,
      companyNiche: brief.companyNiche ?? "",
      brandName: brief.brandName,
      brandBook,
      brandColor: brief.brandColor ?? "#111111",
      accentColor: brief.accentColor ?? "#F5A623",
      logoUrl,
      brollAssets: brief.assets ?? [],
      avatarId: brief.avatarId,
      avatarPlacement: "pip",
      elevenlabsVoiceId: brief.voiceId,
      voiceId: brief.voiceId,
      subtitles: true,
      captionsOverCards: true,
      targetDurationSec: brief.durationSec ?? 30,
      voiceStability: brief.voiceStability ?? 0.35,
      voiceStyle: brief.voiceStyle ?? 0.68,
      voiceSpeed: brief.voiceSpeed ?? 1.08,
      stylePrompt: brief.stylePrompt ?? "",
    }),
  });

  const j = await res.json().catch(() => ({}));
  if (!j?.ok || !j?.data?.jobId) {
    console.error("Запуск не удался:", JSON.stringify(j).slice(0, 500));
    process.exit(1);
  }
  console.log(`\njobId: ${j.data.jobId}`);
  console.log(`Статус: node scripts/reel-status.mjs ${j.data.jobId}`);
} catch (e) {
  console.error("ОШИБКА:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
