/**
 * Финальная озвучка арены + пословные тайминги под субтитры.
 *
 * Утверждённый вариант — v2b (драматургия + аудио-теги), минус интимная
 * вставка «[whispers] Лёд не прощает ошибок»: по фидбеку шёпот лишний.
 * Фраза убрана целиком, а не только тег, — иначе она повисает лишним
 * утверждением там, где ритм уже пошёл дальше.
 *
 * Отличие от прошлых скриптов: эндпоинт with-timestamps. Он возвращает и
 * аудио, и посимвольный alignment — из него собираются точные тайминги слов.
 * Whisper для субтитров не нужен (и недоступен: регион заблокирован), а
 * тайминги от самого синтезатора точнее распознавания по определению.
 *
 * На выходе: mp3 + captions.json (чанки по 2-4 слова с точными временами).
 * ASS-файл собирается локально при сведении — там известна геометрия кадра.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/voice-arena-final.mjs
 */
import { writeFileSync, mkdirSync } from "fs";

const VOICE_ID = "hRJPpkSVdR2btkZBUz26"; // RU igor
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

const TEXT = `Эту арену мы строили под кёрлинг… Идеально ровное основание, особый микроклимат.

Сдали. Объект работал.

А потом рынок развернулся… кёрлинг ушёл — пришёл падел. И что теперь — ломать?

[excited] Нет! В этом и суть: ровный монолитный пол, большие пролёты без колонн, вентиляция — всё уже было заложено.

Та же коробка… совершенно новая игра.

ГК Орлинк. Стройте с запасом — и объект переживёт любые перемены.`;

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
      stability: 0.30,
      similarity_boost: 0.85,
      style: 0.35,
      use_speaker_boost: false,
      speed: 1.08,
    },
  }),
});
if (!r.ok) {
  console.error(`ОТКАЗ HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  process.exit(1);
}
const j = await r.json();

mkdirSync("public/voiceovers", { recursive: true });
const audio = Buffer.from(j.audio_base64, "base64");
writeFileSync("public/voiceovers/orlink-arena-final.mp3", audio);

const al = j.alignment || j.normalized_alignment;
if (!al) { console.error("Нет alignment в ответе"); process.exit(1); }

/**
 * Символы → слова. Скобочные аудио-теги ([excited]) выкидываем: они
 * управляют подачей, но не произносятся — в субтитрах им делать нечего.
 */
const words = [];
let cur = null;
let inTag = false;
for (let i = 0; i < al.characters.length; i++) {
  const ch = al.characters[i];
  if (ch === "[") { inTag = true; continue; }
  if (ch === "]") { inTag = false; continue; }
  if (inTag) continue;

  if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } continue; }
  const st = al.character_start_times_seconds[i];
  const en = al.character_end_times_seconds[i];
  if (!cur) cur = { text: ch, start: st, end: en };
  else { cur.text += ch; cur.end = en; }
}
if (cur) words.push(cur);

/**
 * Слова → чанки субтитров. Правила: не больше 3 слов и 20 символов, и
 * обязательный разрыв после знака конца фразы — субтитр не должен склеивать
 * два предложения, иначе теряется та самая драматургия пауз.
 */
const chunks = [];
let buf = [];
const flush = () => {
  if (!buf.length) return;
  chunks.push({
    text: buf.map(w => w.text).join(" "),
    start: buf[0].start,
    end: buf[buf.length - 1].end,
  });
  buf = [];
};
for (const w of words) {
  buf.push(w);
  const len = buf.reduce((n, x) => n + x.text.length + 1, 0);
  if (/[.!?…:]$/.test(w.text) || buf.length >= 3 || len >= 20) flush();
}
flush();

writeFileSync("public/voiceovers/orlink-arena-captions.json", JSON.stringify(chunks, null, 1));

const dur = words.length ? words[words.length - 1].end : 0;
console.log(`Озвучка: ${(audio.length / 1024).toFixed(0)} КБ, речь до ${dur.toFixed(1)}с`);
console.log(`Субтитров: ${chunks.length} чанков, слов: ${words.length}`);
console.log(chunks.slice(0, 5).map(c => `  ${c.start.toFixed(1)}-${c.end.toFixed(1)}  ${c.text}`).join("\n"));
