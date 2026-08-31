/**
 * Озвучка ролика «Профессиональное строительство» — Igor, подача
 * «разговорный №1» (выбрана заказчицей на слух из восьми вариантов):
 * без speaker_boost, умеренный style, темп 1.10.
 *
 * with-timestamps: пословные тайминги нужны для посадки фраз на губы
 * готового ролика и для субтитров — распознавание не требуется вовсе.
 *
 * Запуск: node scripts/voice-prof.mjs
 */
import { writeFileSync } from "fs";

const VOICE_ID = "hRJPpkSVdR2btkZBUz26"; // RU igor
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

const TEXT = `ГК Орлинк — строительство металлоконструкций под ключ.

Мы реализуем проекты любой сложности — от идеи до готового объекта.

Контролируем каждый этап: проектирование, поставку и монтаж.

Соблюдаем сроки, оптимизируем решения и гарантируем надёжность.

Работаем точно, быстро и без лишних затрат для клиента.

ГК Орлинк — строим для жизни и бизнеса.`;

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("Нет ELEVENLABS_API_KEY"); process.exit(1); }

const r = await fetch(`${base}/v1/text-to-speech/${VOICE_ID}/with-timestamps`, {
  method: "POST",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    text: TEXT,
    model_id: MODEL,
    voice_settings: {
      stability: 0.40,
      similarity_boost: 0.85,
      style: 0.30,
      use_speaker_boost: false,
      speed: 1.10,
    },
  }),
});
if (!r.ok) { console.error(`ОТКАЗ ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const j = await r.json();
writeFileSync("/tmp/prof-voice.mp3", Buffer.from(j.audio_base64, "base64"));

const al = j.alignment || j.normalized_alignment;
// Символы → слова (структура как в voice-arena-final).
const words = [];
let cur = null;
for (let i = 0; i < al.characters.length; i++) {
  const ch = al.characters[i];
  if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } continue; }
  const st = al.character_start_times_seconds[i], en = al.character_end_times_seconds[i];
  if (!cur) cur = { text: ch, start: st, end: en };
  else { cur.text += ch; cur.end = en; }
}
if (cur) words.push(cur);
writeFileSync("/tmp/prof-voice-words.json", JSON.stringify({ words: words.map(w => ({ ...w, type: "word" })) }, null, 1));
console.log(`слов: ${words.length}, речь до ${words[words.length-1].end.toFixed(2)}с`);
