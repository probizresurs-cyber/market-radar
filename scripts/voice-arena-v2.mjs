/**
 * Вторая итерация озвучки арены: лечим «одну интонацию на всё».
 *
 * Диагноз: монотонность давал сам ТЕКСТ — восемь утвердительных предложений
 * подряд. Никакие настройки не заставят диктора менять интонацию, если в
 * тексте нечего менять. Интонация живёт на смене типа фразы.
 *
 * Что изменено:
 *  1. Драматургия текста: вопрос («И что теперь — ломать?»), ответ-контраст
 *     («Нет.»), тихая ремарка, энергичный финал. Смысл и факты те же.
 *  2. stability 0.36 → 0.30 — больше свободы между фразами.
 *  3. Вариант B добавляет аудио-теги v3 по ходу текста: [whispers] на
 *     ремарке про лёд (интимная вставка), [excited] на развороте к паделу.
 *     Вариант A — тот же текст без тегов: сравнить, дают ли теги живость
 *     или звучат наигранно.
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/voice-arena-v2.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const VOICE_ID = "hRJPpkSVdR2btkZBUz26"; // RU igor
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

const TEXT_PLAIN = `Эту арену мы строили под кёрлинг… Идеально ровное основание, особый микроклимат. Лёд не прощает ошибок.

Сдали. Объект работал.

А потом рынок развернулся… кёрлинг ушёл — пришёл падел. И что теперь — ломать?

Нет. В этом и суть: ровный монолитный пол, большие пролёты без колонн, вентиляция — всё уже было заложено.

Та же коробка… совершенно новая игра.

ГК Орлинк. Стройте с запасом — и объект переживёт любые перемены.`;

const TEXT_TAGGED = `Эту арену мы строили под кёрлинг… Идеально ровное основание, особый микроклимат. [whispers] Лёд не прощает ошибок.

Сдали. Объект работал.

А потом рынок развернулся… кёрлинг ушёл — пришёл падел. И что теперь — ломать?

[excited] Нет! В этом и суть: ровный монолитный пол, большие пролёты без колонн, вентиляция — всё уже было заложено.

Та же коробка… совершенно новая игра.

ГК Орлинк. Стройте с запасом — и объект переживёт любые перемены.`;

const VARIANTS = [
  { tag: "v2a-dramaturgia", text: TEXT_PLAIN,
    note: "вопрос/ответ/контраст в тексте, без аудио-тегов" },
  { tag: "v2b-s-tegami", text: TEXT_TAGGED,
    note: "то же + [whispers] на ремарке про лёд и [excited] на развороте" },
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
        stability: 0.30,
        similarity_boost: 0.85,
        style: 0.35,
        use_speaker_boost: false,
        speed: 1.08,
      },
    }),
  });
  if (!r.ok) {
    console.log(`${v.tag}: ОТКАЗ HTTP ${r.status} — ${(await r.text()).slice(0, 160)}`);
    continue;
  }
  const path = `public/voiceovers/orlink-arena-${v.tag}.mp3`;
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  const { stdout } = await execFileAsync("ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { timeout: 10_000 });
  console.log(`${v.tag} (${v.note}) — ${Number(stdout).toFixed(1)}с`);
  console.log(`   https://marketradar24.ru/api/static-asset/voiceovers/orlink-arena-${v.tag}.mp3`);
}
