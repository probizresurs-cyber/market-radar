/**
 * Границы фраз в дорожке по огибающей громкости.
 *
 * Зачем свой анализ, а не silencedetect: в смонтированном ролике под речью
 * лежит музыка, поэтому абсолютного порога тишины не существует — ffmpeg
 * честно отвечает «пауз нет». Здесь порог берётся ОТНОСИТЕЛЬНО собственного
 * уровня дорожки (доля от медианы речи), а речь выделяется полосой 300-3400 Гц
 * — телефонной полосой разборчивости, где голос доминирует над музыкой.
 *
 * Нужно для пересборки: чтобы посадить фразы новой озвучки на те же места,
 * где они звучат в готовом ролике, надо сперва узнать эти места.
 *
 * Запуск: node scripts/audio-phrases.mjs <файл> [минимальная-пауза-сек]
 */
import { execFileSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";

const src = process.argv[2];
const minGap = Number(process.argv[3] ?? 0.22);
if (!src) { console.error("Укажи файл"); process.exit(1); }

const tmp = `${process.env.TEMP || "/tmp"}/phrases-${process.pid}.raw`;
// Полоса разборчивости + моно 16 кГц: музыка с басом и «воздухом» уходит,
// речевая огибающая остаётся.
execFileSync("ffmpeg", [
  "-v", "error", "-i", src,
  "-af", "highpass=f=300,lowpass=f=3400",
  "-ac", "1", "-ar", "16000", "-f", "s16le", "-y", tmp,
]);

const buf = readFileSync(tmp);
unlinkSync(tmp);
const SR = 16000, HOP = Math.round(SR * 0.02); // окно 20 мс
const n = Math.floor(buf.length / 2);
const rms = [];
for (let i = 0; i + HOP <= n; i += HOP) {
  let acc = 0;
  for (let k = 0; k < HOP; k++) { const s = buf.readInt16LE((i + k) * 2) / 32768; acc += s * s; }
  rms.push(Math.sqrt(acc / HOP));
}

// Порог — доля от медианы ЗВУЧАЩИХ окон: устойчиво и к тихой записи, и к
// музыкальной подложке, в отличие от фиксированных дБ.
const sorted = [...rms].filter(v => v > 0).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length * 0.6)] || 0.01;
const thr = median * 0.35;

const segs = [];
let start = null;
let quiet = 0;
const minQuietFrames = Math.round(minGap / 0.02);
rms.forEach((v, i) => {
  const t = i * 0.02;
  if (v >= thr) {
    if (start === null) start = t;
    quiet = 0;
  } else if (start !== null) {
    quiet++;
    if (quiet >= minQuietFrames) { segs.push([start, t - quiet * 0.02]); start = null; quiet = 0; }
  }
});
if (start !== null) segs.push([start, rms.length * 0.02]);

const total = rms.length * 0.02;
console.log(`${src}`);
console.log(`  длительность ${total.toFixed(2)}с, порог ${thr.toFixed(4)}, фраз: ${segs.length}`);
segs.forEach(([a, b], i) => {
  const gap = i > 0 ? (a - segs[i - 1][1]) : a;
  console.log(`  ${String(i + 1).padStart(2)}  ${a.toFixed(2)}–${b.toFixed(2)}  (${(b - a).toFixed(2)}с, пауза перед: ${gap.toFixed(2)}с)`);
});
