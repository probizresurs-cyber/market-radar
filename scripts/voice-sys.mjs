/**
 * Женская озвучка ролика «Системный подход» — голос gelrownZgbRhxH6LI78J (замена по фидбеку).
 *
 * Бриф: максимально натурально, с интонациями, без студийности, паузы где
 * надо. Рецепт тот же, что выведен на Igor за день подбора:
 *  - use_speaker_boost=false — главный источник «рекламной» студийности;
 *  - stability 0.32 — живые перепады между фразами;
 *  - style 0.45 — интонации заметные, но до театральности далеко;
 *  - паузы — многоточия и разрывы абзацев в самом тексте.
 * Темп 1.2 (перегенерация): в ролике речь плотная (20.4с речи в 20.8с хронометража),
 * медленнее нельзя — не влезем в губы.
 *
 * Запуск: node scripts/voice-sys.mjs
 */
import { writeFileSync } from "fs";

const VOICE_ID = "gelrownZgbRhxH6LI78J";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

const TEXT = `Строительство — это не хаос… это чёткая система, где каждый этап работает на результат.

В ГК Орлинк мы выстраиваем процесс так, чтобы объект собирался точно — и без лишних затрат.

Контроль, опыт и внимание к деталям… на каждом этапе.

В итоге вы получаете надёжную конструкцию, готовую к работе.

ГК Орлинк — строим системно, строим результат.`;

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
      stability: 0.32,
      similarity_boost: 0.85,
      style: 0.45,
      use_speaker_boost: false,
      speed: 1.2,
    },
  }),
});
if (!r.ok) { console.error(`ОТКАЗ ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const j = await r.json();
writeFileSync("/tmp/sys-voice.mp3", Buffer.from(j.audio_base64, "base64"));

const al = j.alignment || j.normalized_alignment;
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
writeFileSync("/tmp/sys-voice-words.json", JSON.stringify({ words: words.map(w => ({ ...w, type: "word" })) }, null, 1));
console.log(`слов: ${words.length}, речь до ${words[words.length-1].end.toFixed(2)}с`);
