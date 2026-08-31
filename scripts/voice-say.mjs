/**
 * Озвучка произвольного текста голосом ElevenLabs v3 + пословные тайминги.
 *
 * Заменяет цепочку voice-prof / voice-sys / voice-fit-reel: там текст был
 * зашит в код, и под каждый ролик заводился отдельный скрипт. Здесь текст
 * приходит файлом, поэтому скрипт один на все будущие ролики.
 *
 * Подача — рецепт натуральности, выведенный слепым сравнением восьми
 * вариантов на Igor: speaker_boost выключен (именно он давал «рекламную»
 * студийность), stability низкая (живые перепады между фразами), style
 * умеренно высокий (интонации без театральности). Паузы задаются
 * пунктуацией в самом тексте — XML-теги пауз на v3 не поддерживаются и
 * рискуют быть прочитанными вслух.
 *
 * Запуск: node scripts/voice-say.mjs <voiceId> <speed> <префикс> <файл-с-текстом>
 */
import { readFileSync, writeFileSync } from "fs";

const [voiceId, speedArg, prefix, textFile] = process.argv.slice(2);
if (!voiceId || !speedArg || !prefix || !textFile) {
  console.error("Нужно: <voiceId> <speed> <префикс> <файл-с-текстом>");
  process.exit(1);
}
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";
const TEXT = readFileSync(textFile, "utf8").trim();

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
      stability: 0.28,          // ниже, чем обычно: больше эмоциональных перепадов
      similarity_boost: 0.85,
      style: 0.50,              // выраженное интонирование, но до театральности
      use_speaker_boost: false, // главный источник студийности — выключен
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
console.log(`${prefix}: слов ${words.length}, речь до ${words[words.length - 1].end.toFixed(2)}с (темп ${speedArg})`);
