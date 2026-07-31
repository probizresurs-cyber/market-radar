/**
 * Собирает public/music/manifest.json из файлов, лежащих в public/music/.
 *
 * Зачем скрипт: сама библиотека музыки работает давно, не хватало только
 * файлов — и вести манифест руками для 15-20 треков муторно. Скачивание
 * оставлено человеку осознанно (см. public/music/README.md): лицензию
 * каждого трека должен подтвердить тот, кто отвечает за клиентские ролики.
 * Скрипт снимает только рутину — разбор имён и запись JSON.
 *
 * Настроение берётся из имени файла: достаточно назвать трек так, чтобы в
 * имени было одно из ключевых слов (или сразу несколько через дефис):
 *   corporate-calm-piano.mp3     -> ["corporate","calm"]
 *   upbeat-energy-drums.mp3      -> ["upbeat"]
 *   dramatic-tension.mp3         -> ["dramatic"]
 * Файл без единого ключевого слова попадёт во все настроения — он будет
 * подбираться как универсальный.
 *
 * Запуск (на сервере, из корня проекта):
 *   node scripts/build-music-manifest.mjs
 *   node scripts/build-music-manifest.mjs --license "CC0 — Pixabay"
 */
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";

const MUSIC_DIR = path.join(process.cwd(), "public", "music");
const MANIFEST = path.join(MUSIC_DIR, "manifest.json");

/** Словарь настроений совпадает с VideoMood в src/lib/music-library.ts. */
const MOODS = {
  upbeat: ["upbeat", "energy", "energetic", "happy", "bright", "power", "sport"],
  calm: ["calm", "ambient", "soft", "piano", "chill", "relax", "acoustic"],
  corporate: ["corporate", "business", "tech", "presentation", "neutral"],
  dramatic: ["dramatic", "tension", "epic", "cinematic", "dark", "trailer"],
  playful: ["playful", "fun", "funny", "quirky", "ukulele", "pop"],
};

const AUDIO_RE = /\.(mp3|m4a|aac|ogg|wav)$/i;

function moodsFor(fileName) {
  const stem = fileName.replace(AUDIO_RE, "").toLowerCase();
  const hits = Object.entries(MOODS)
    .filter(([, words]) => words.some((w) => stem.includes(w)))
    .map(([mood]) => mood);
  // Без совпадений трек считаем универсальным, а не выбрасываем: лучше
  // подложить что-то нейтральное, чем оставить ролик совсем без музыки.
  return hits.length > 0 ? hits : Object.keys(MOODS);
}

const licenseArg = process.argv.indexOf("--license");
const license = licenseArg > -1 ? process.argv[licenseArg + 1] : undefined;

const files = (await readdir(MUSIC_DIR).catch(() => []))
  .filter((f) => AUDIO_RE.test(f))
  .sort();

if (files.length === 0) {
  console.log(`В ${MUSIC_DIR} нет аудиофайлов. Положите туда .mp3 и запустите снова.`);
  console.log("Ролики без музыки рендерятся штатно — это не ошибка.");
  process.exit(0);
}

// Ранее проставленные лицензии не затираем: их могли выставить вручную.
const prev = await readFile(MANIFEST, "utf8").then((r) => JSON.parse(r)).catch(() => []);
const prevLicense = new Map(
  (Array.isArray(prev) ? prev : []).map((t) => [t.file, t.license]).filter(([, l]) => l),
);

const tracks = files.map((file) => ({
  file,
  moods: moodsFor(file),
  license: license ?? prevLicense.get(file) ?? "УКАЖИТЕ ЛИЦЕНЗИЮ",
}));

await writeFile(MANIFEST, JSON.stringify(tracks, null, 2) + "\n", "utf8");

console.log(`Записано треков: ${tracks.length}`);
for (const t of tracks) console.log(`  ${t.file} -> ${t.moods.join(", ")}`);

const unlicensed = tracks.filter((t) => t.license === "УКАЖИТЕ ЛИЦЕНЗИЮ");
if (unlicensed.length > 0) {
  console.log(`\nБез указанной лицензии: ${unlicensed.length}. Проставьте вручную в manifest.json`);
  console.log(`или перезапустите с флагом: node scripts/build-music-manifest.mjs --license "CC0 — Pixabay"`);
}
