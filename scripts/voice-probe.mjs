/**
 * Проба голосов ElevenLabs: один и тот же текст разными голосами и моделями.
 *
 * Зачем: спор «звучит роботом» решается только на слух, а гонять ради этого
 * полную сборку ролика (8 минут, деньги за b-roll) бессмысленно. Здесь —
 * только синтез, файлы кладутся в public/voiceovers и доступны по
 * /api/static-asset/voiceovers/<имя>.
 *
 * Заодно печатает тип голоса: instant-клон (category: cloned) звучит хуже
 * профессионального (professional) на любой модели — это свойство самого
 * клона, а не модели, и на слух его часто принимают за «плохую модель».
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/voice-probe.mjs <voiceId>[,<voiceId>...] [model] [текст]
 */
import { writeFileSync, mkdirSync } from "fs";

const ids = (process.argv[2] || "").split(",").map((s) => s.trim()).filter(Boolean);
const model = process.argv[3] || process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const text =
  process.argv[4] ||
  "Спортивно-тренировочный комплекс в Новой Москве. Металлокаркас собран, кровля смонтирована. От чертежа до готового объекта.";

if (ids.length === 0) {
  console.error("Укажите id голосов через запятую");
  process.exit(1);
}

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("Нет ELEVENLABS_API_KEY в окружении");
  process.exit(1);
}

const dir = "public/voiceovers";
mkdirSync(dir, { recursive: true });

for (const id of ids) {
  // Тип голоса важнее модели: у instant-клона нет HQ-моделей вообще.
  let meta = "";
  try {
    const m = await fetch(`${base}/v1/voices/${id}`, { headers: { "xi-api-key": key } });
    if (m.ok) {
      const v = await m.json();
      meta = `${v.name} [${v.category}]`;
    }
  } catch { /* не критично */ }

  const r = await fetch(`${base}/v1/text-to-speech/${id}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.85,
        style: 0.68,
        use_speaker_boost: true,
        speed: 1.08,
      },
    }),
  });

  if (!r.ok) {
    console.log(`${id} ${meta} — ОТКАЗ HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const name = `probe-${id.slice(0, 8)}-${model}.mp3`;
  writeFileSync(`${dir}/${name}`, buf);
  console.log(`${id} ${meta} — ok, ${(buf.length / 1024).toFixed(0)} КБ`);
  console.log(`   https://marketradar24.ru/api/static-asset/voiceovers/${name}`);
}
