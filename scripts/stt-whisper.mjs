/**
 * Whisper через амстердамский прокси call-agent'а.
 *
 * Прямой api.openai.com отвечает нам 403 unsupported_country_region_territory,
 * но у call-agent на этом же сервере уже настроен рабочий обход —
 * OPENAI_BASE_URL. Скрипт секретов не читает: ключ и адрес прокси приходят
 * через окружение (то же `set -a; . .env` в каталоге call-agent, каким мы
 * запускаем и скрипты market-radar).
 *
 * verbose_json + word timestamps: текст нужен для субтитров и сверки
 * сценариев, тайминги — чтобы посадить фразы новой озвучки на места старой.
 *
 * Запуск: node scripts/stt-whisper.mjs <аудио> [выход.json]
 */
import { readFileSync, writeFileSync } from "fs";

const src = process.argv[2];
const out = process.argv[3];
if (!src) { console.error("Укажи файл"); process.exit(1); }

const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "").replace(/\/v1$/, "");
const key = process.env.OPENAI_API_KEY;
if (!key) { console.error("Нет OPENAI_API_KEY в окружении"); process.exit(1); }

const form = new FormData();
form.append("file", new Blob([readFileSync(src)]), src.split(/[\\/]/).pop());
form.append("model", "whisper-1");
form.append("language", "ru");
form.append("response_format", "verbose_json");
form.append("timestamp_granularities[]", "word");
form.append("timestamp_granularities[]", "segment");

const r = await fetch(`${base}/v1/audio/transcriptions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
const text = await r.text();
if (!r.ok) { console.error(`Whisper отклонил ${r.status}: ${text.slice(0, 300)}`); process.exit(1); }
const j = JSON.parse(text);

console.log(`--- ${src} ---`);
console.log(j.text);
const words = j.words || [];
if (words.length) console.log(`слов: ${words.length}, речь ${words[0].start.toFixed(2)}–${words[words.length - 1].end.toFixed(2)}с`);
if (out) { writeFileSync(out, JSON.stringify(j, null, 1)); console.log(`сохранено: ${out}`); }
