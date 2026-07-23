/**
 * Подбор фоновой музыки для видео-конвейера Контент-завода по настроению
 * ролика (mood из плана Director-агента — см. content/video/plan/route.ts).
 *
 * Файлы + манифест — public/music/ (см. public/music/README.md). Мы
 * сознательно НЕ качаем и не бандлим никакие треки сами: лицензию файла,
 * который я как агент нашёл бы и положил сюда без ведома владельца
 * платформы, никто не проверял — это должен сделать человек. Если
 * manifest.json пуст (по умолчанию) — pickMusicUrl всегда возвращает null,
 * ролики рендерятся без музыки (голос + субтитры), это штатное поведение.
 */
import { readFile } from "fs/promises";
import path from "path";

export type VideoMood = "upbeat" | "calm" | "corporate" | "dramatic" | "playful";

interface MusicTrack {
  file: string;
  moods: string[];
  license?: string;
}

let cache: { tracks: MusicTrack[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // манифест меняется редко, но не требует рестарта процесса чтобы подхватить новый трек

async function loadManifest(): Promise<MusicTrack[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.tracks;
  try {
    const manifestPath = path.join(process.cwd(), "public", "music", "manifest.json");
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    const tracks = Array.isArray(parsed)
      ? parsed.filter((t): t is MusicTrack => typeof t?.file === "string" && Array.isArray(t?.moods))
      : [];
    cache = { tracks, loadedAt: Date.now() };
    return tracks;
  } catch {
    cache = { tracks: [], loadedAt: Date.now() };
    return [];
  }
}

/**
 * Выбирает URL трека под настроение. null, если библиотека пуста —
 * вызывающий код (оркестратор) должен спокойно рендерить без музыки.
 */
export async function pickMusicUrl(mood?: string | null): Promise<string | null> {
  const tracks = await loadManifest();
  if (tracks.length === 0) return null;

  const byMood = mood ? tracks.filter((t) => t.moods.includes(mood)) : [];
  const pool = byMood.length > 0 ? byMood : tracks;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `/api/static-asset/music/${pick.file}`;
}
