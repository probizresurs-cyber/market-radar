/**
 * Распознавание речи через ElevenLabs Scribe — с пословными таймингами.
 *
 * Whisper для нас закрыт (403 unsupported_country_region_territory), а текст
 * нужен дважды: для субтитров и для сверки, один ли это сценарий в старой
 * дорожке ролика и в новой озвучке. Ключ ElevenLabs с сервера работает, так
 * что распознавание берём там же, где синтез.
 *
 * Запуск: node scripts/stt-scribe.mjs <аудио-или-видео> [выходной-json]
 */
import { readFileSync, writeFileSync } from "fs";

const src = process.argv[2];
const out = process.argv[3];
if (!src) { console.error("Укажи файл"); process.exit(1); }
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("Нет ELEVENLABS_API_KEY"); process.exit(1); }

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const form = new FormData();
form.append("file", new Blob([readFileSync(src)]), src.split(/[\\/]/).pop());
form.append("model_id", "scribe_v1");
form.append("language_code", "rus");
form.append("timestamps_granularity", "word");
form.append("diarize", "false");

const r = await fetch(`${base}/v1/speech-to-text`, {
  method: "POST",
  headers: { "xi-api-key": key },
  body: form,
});
const text = await r.text();
if (!r.ok) { console.error(`Распознавание отклонено ${r.status}: ${text.slice(0, 300)}`); process.exit(1); }
const j = JSON.parse(text);

console.log(`--- ${src} ---`);
console.log(j.text);
const words = (j.words || []).filter(w => w.type === "word");
if (words.length) {
  console.log(`\nслов: ${words.length}, речь ${words[0].start.toFixed(2)}–${words[words.length - 1].end.toFixed(2)}с`);
}
if (out) { writeFileSync(out, JSON.stringify(j, null, 1)); console.log(`сохранено: ${out}`); }
