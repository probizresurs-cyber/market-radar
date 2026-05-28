/**
 * Pexels Videos API — поиск + скачивание стоковых вертикальных видео.
 *
 * Pexels даёт бесплатный API (200 запросов/час, не нужно карту привязывать).
 * Получить ключ: https://www.pexels.com/api/ → Get Started → подтверждение
 * через email → ключ в личном кабинете.
 *
 * Используется в /api/fetch-stock-videos для подмены AI-сгенерированных
 * b-roll картинок на реальные cinematic кадры. Очень повышает «продакшн-
 * фил» промо-роликов — стоковое видео всегда выглядит дороже AI-картинки.
 *
 * Docs: https://www.pexels.com/api/documentation/#videos-search
 */

const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? "";
const PEXELS_BASE = "https://api.pexels.com/videos";

interface PexelsVideoFile {
  id: number;
  quality: string;       // "hd", "sd", "uhd"
  file_type: string;     // "video/mp4"
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;      // секунды
  video_files: PexelsVideoFile[];
  url: string;
}

interface PexelsSearchResponse {
  videos?: PexelsVideo[];
  error?: string;
}

export interface SearchedVideo {
  pexelsId: number;
  durationSec: number;
  width: number;
  height: number;
  /** Прямая ссылка на MP4 файл, готовый для скачивания. Выбираем
   *  оптимальное качество: HD 720-1080p, не выше — иначе раздуем размер. */
  downloadUrl: string;
  /** Ссылка на страницу видео на pexels.com (для атрибуции в публикации) */
  pexelsPageUrl: string;
}

export interface PexelsSearchResult {
  ok: boolean;
  videos?: SearchedVideo[];
  error?: string;
}

/**
 * Выбирает наилучший MP4-файл из набора качеств:
 *  - portrait orientation (height > width)
 *  - height 1080-1920 (full HD)
 *  - если нет — берёт максимальное доступное hd
 */
function pickBestFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const mp4s = files.filter((f) => f.file_type === "video/mp4");
  if (mp4s.length === 0) return null;

  // Сортируем по приоритету: вертикальные → HD → большая высота
  const sorted = [...mp4s].sort((a, b) => {
    const aPortrait = a.height > a.width ? 1 : 0;
    const bPortrait = b.height > b.width ? 1 : 0;
    if (aPortrait !== bPortrait) return bPortrait - aPortrait;

    const aHd = a.quality === "hd" ? 1 : 0;
    const bHd = b.quality === "hd" ? 1 : 0;
    if (aHd !== bHd) return bHd - aHd;

    // Среди HD выбираем тот что ближе к 1920p по высоте (но не больше)
    const aDistance = Math.abs(a.height - 1920);
    const bDistance = Math.abs(b.height - 1920);
    return aDistance - bDistance;
  });

  return sorted[0];
}

/**
 * Ищет видео по запросу в Pexels. Возвращает до `count` штук.
 *
 * Запрос строится так: query на английском + фильтр portrait orientation.
 * Pexels не очень хорошо ищет на русском — поэтому query желательно
 * передавать английским ключевым словом (orchestrator переводит ниши).
 */
export async function searchPexelsVideos(opts: {
  query: string;
  count: number;
  perPage?: number;
}): Promise<PexelsSearchResult> {
  if (!PEXELS_API_KEY) {
    return { ok: false, error: "PEXELS_API_KEY не настроен в env" };
  }

  // perPage чуть больше count — даём место выбрать лучшие из выборки.
  const perPage = Math.min(80, Math.max(opts.count, opts.perPage ?? opts.count * 3));

  const params = new URLSearchParams({
    query: opts.query,
    orientation: "portrait",
    size: "medium", // не качаем 4K, нам этого хватит
    per_page: String(perPage),
  });

  try {
    const res = await fetch(`${PEXELS_BASE}/search?${params}`, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Pexels ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as PexelsSearchResponse;
    if (data.error) return { ok: false, error: data.error };
    if (!data.videos?.length) return { ok: true, videos: [] };

    // Фильтруем только portrait + берём top N. Каждое — самый подходящий MP4.
    const portrait = data.videos.filter((v) => v.height > v.width);
    const selected: SearchedVideo[] = [];
    for (const v of portrait) {
      if (selected.length >= opts.count) break;
      const file = pickBestFile(v.video_files);
      if (!file) continue;
      // Пропускаем слишком длинные видео — будем рендерить с обрезкой,
      // но не хочется качать 60-секундные клипы под 5-секундный слот.
      if (v.duration > 20) continue;
      selected.push({
        pexelsId: v.id,
        durationSec: v.duration,
        width: file.width,
        height: file.height,
        downloadUrl: file.link,
        pexelsPageUrl: v.url,
      });
    }

    return { ok: true, videos: selected };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Pexels fetch failed: ${msg}` };
  }
}

/**
 * Скачивает MP4 из downloadUrl и возвращает Buffer.
 * Используется чтобы кэшировать видео локально — иначе при каждом
 * рендере Remotion тянет с Pexels CDN, что медленно и зависит от их
 * стабильности.
 */
export async function downloadPexelsVideo(downloadUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
