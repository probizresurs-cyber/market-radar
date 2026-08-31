/**
 * Универсальная озвучка под готовый ролик: синтез v3 + пословные тайминги.
 *
 * Обобщение voice-prof/voice-sys: голос и темп приходят аргументами, потому
 * что подбор темпа под чужой хронометраж — это всегда две-три итерации, а
 * плодить по скрипту на каждый ролик бессмысленно.
 *
 * Подача — рецепт натуральности, выведенный на слепом сравнении восьми
 * вариантов: speaker_boost выключен (он и давал «рекламную» студийность),
 * stability низкая (живые перепады), style умеренный (интонации без
 * театральности), паузы — многоточиями в самом тексте.
 *
 * Запуск: node scripts/voice-fit-reel.mjs <voiceId> <speed> <префикс-выхода>
 */
import { writeFileSync } from "fs";

const [voiceId, speedArg, prefix] = process.argv.slice(2);
if (!voiceId || !speedArg || !prefix) {
  console.error("Нужно: <voiceId> <speed> <префикс>");
  process.exit(1);
}
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

const TEXT = `На стройке нет места ошибкам.

Каждое решение влияет на сроки, бюджет и результат.

В ГК Орлинк мы берём процесс под контроль с первого дня…

организуем поставки, координируем работы и следим за каждым этапом.

Вы получаете не просто стройку, а чётко выстроенную систему.

ГК Орлинк — строим надёжно, строим под результат.`;

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("Нет ELEVENLABS_API_KEY"); process.exit(1); }

const r = await fetch(`${base}/v1/text-to-speech/${voiceId}/with-timestamps`, {
  method: "POST",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    text: TEXT,
    model_id: MODEL,
    voice_settings: {
      stability: 0.36,
      similarity_boost: 0.85,
      style: 0.35,
      use_speaker_boost: false,
      speed: Number(speedArg),
    },
  }),
});
if (!r.ok) { console.error(`ОТКАЗ ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const j = await r.json();
writeFileSync(`/tmp/${prefix}.mp3`, Buffer.from(j.audio_base64, "base64"));

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
writeFileSync(`/tmp/${prefix}-words.json`, JSON.stringify({ words: words.map(w => ({ ...w, type: "word" })) }, null, 1));
console.log(`${prefix}: слов ${words.length}, речь до ${words[words.length-1].end.toFixed(2)}с (темп ${speedArg})`);
