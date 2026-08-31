/**
 * Озвучка под ролик «кёрлинг → падел», ~32 секунды.
 *
 * База — выбранный на слух вариант «1-razgovorny» (без speaker_boost,
 * умеренный style), с двумя правками по фидбеку:
 *  - паузы: многоточия и разрывы абзацев в тексте (на eleven_v3 это
 *    единственный надёжный способ — XML <break> не поддерживается);
 *  - интонации: style 0.30 → 0.35 и stability 0.40 → 0.36 — рисунок речи
 *    живее, но до «актёрства» (0.5+) далеко.
 *
 * Все факты — из поста заказчика (кёрлинг, падел, ровный пол, пролёты без
 * колонн, вентиляция). Цифр в тексте нет намеренно: банк фактов не заполнен.
 *
 * Скрипт сам меряет длительность ffprobe'ом: цель 30-34 сек, при промахе
 * перегенерирует с поправленным темпом (одна итерация, 68 слов стоят копейки).
 *
 * Запуск:
 *   set -a; . ./.env 2>/dev/null; . ./.env.local 2>/dev/null; set +a
 *   node scripts/voice-arena.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const VOICE_ID = "hRJPpkSVdR2btkZBUz26"; // RU igor
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

const TEXT = `Эту арену мы строили под кёрлинг… Идеально ровное основание, особый микроклимат — лёд не прощает ошибок.

Сдали. Объект работал.

А потом рынок изменился… кёрлинг ушёл — пришёл падел.

И вот здесь сыграло качество: ровный монолитный пол… большие пролёты без колонн… вентиляция.

Та же коробка — совершенно новая жизнь. Без капитальной перестройки.

Стройте с запасом универсальности… и объект переживёт смену правил игры.

ГК Орлинк. С вас — задача… с нас — реализация под ключ.`;

const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("Нет ELEVENLABS_API_KEY"); process.exit(1); }

mkdirSync("public/voiceovers", { recursive: true });

async function synth(speed, name) {
  const r = await fetch(`${base}/v1/text-to-speech/${VOICE_ID}`, {
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
        speed,
      },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const path = `public/voiceovers/${name}`;
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  const { stdout } = await execFileAsync("ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { timeout: 10_000 });
  return Number(String(stdout).trim());
}

let speed = 1.08;
let name = "orlink-arena-32s.mp3";
let dur = await synth(speed, name);
console.log(`Попытка 1: темп ${speed} → ${dur.toFixed(1)}с`);

// Одна корректировка при промахе мимо окна 29-34с: темп ∝ длительности.
if (dur > 34 || dur < 29) {
  speed = Math.min(1.1, Math.max(0.9, Number((speed * (dur / 32)).toFixed(2))));
  dur = await synth(speed, name);
  console.log(`Попытка 2: темп ${speed} → ${dur.toFixed(1)}с`);
}

console.log(`\nГотово: https://marketradar24.ru/api/static-asset/voiceovers/${name}  (${dur.toFixed(1)}с)`);
