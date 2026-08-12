/**
 * Вторая итерация подачи Igor: «человечнее» по фидбеку на первую пятёрку.
 *
 * Запрос: больше эмоции, естественные паузы длиннее, где-то вдох.
 *
 * Инструменты:
 *  - паузы: двойные многоточия и разрыв абзаца — v3 отыгрывает их как
 *    настоящие остановки; XML <break> не поддерживается;
 *  - дыхание: аудио-тег [exhales] (документирован для v3) — выдох перед
 *    финальной фразой, как у живого диктора; в одном варианте без тега,
 *    чтобы сравнить, не звучит ли тег искусственно;
 *  - эмоция: style выше, чем в «разговорном» (0.30), но ниже театрального
 *    порога 0.7; буст выключен — студийность убрана в прошлой итерации.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/voice-variants-human.mjs
 */
import { writeFileSync, mkdirSync } from "fs";

const VOICE_ID = "hRJPpkSVdR2btkZBUz26"; // RU igor
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

// Слова те же, что в первой пятёрке — паузы удлинены пунктуацией.
const TEXT_PAUSES = `Металлоконструкции под ключ… … проектирование, производство, монтаж — без посредников.

Показываем объекты как есть… От каркаса… до сдачи.

ГК Орлинк. Строим — для жизни и бизнеса.`;

// То же + выдох перед финальной фразой бренда.
const TEXT_BREATH = `Металлоконструкции под ключ… … проектирование, производство, монтаж — без посредников.

Показываем объекты как есть… От каркаса… до сдачи.

[exhales] ГК Орлинк. Строим — для жизни и бизнеса.`;

const VARIANTS = [
  { tag: "6-emotsionalny", text: TEXT_PAUSES, stability: 0.30, style: 0.50, speed: 1.10,
    note: "эмоциональнее «разговорного», длинные паузы, без вдоха" },
  { tag: "7-s-vdohom", text: TEXT_BREATH, stability: 0.30, style: 0.50, speed: 1.10,
    note: "то же + выдох перед «ГК Орлинк»" },
  { tag: "8-teply", text: TEXT_BREATH, stability: 0.27, style: 0.60, speed: 1.08,
    note: "самый живой: максимум модуляций до театрального порога, с выдохом" },
];

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("Нет ELEVENLABS_API_KEY"); process.exit(1); }

mkdirSync("public/voiceovers", { recursive: true });

for (const v of VARIANTS) {
  const r = await fetch(`${base}/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: v.text,
      model_id: MODEL,
      voice_settings: {
        stability: v.stability,
        similarity_boost: 0.85,
        style: v.style,
        use_speaker_boost: false,
        speed: v.speed,
      },
    }),
  });
  if (!r.ok) {
    console.log(`${v.tag}: ОТКАЗ HTTP ${r.status} — ${(await r.text()).slice(0, 160)}`);
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const name = `igor-nat-${v.tag}.mp3`;
  writeFileSync(`public/voiceovers/${name}`, buf);
  console.log(`${v.tag} (${v.note})`);
  console.log(`   https://marketradar24.ru/api/static-asset/voiceovers/${name}  [${(buf.length / 1024).toFixed(0)} КБ]`);
}
