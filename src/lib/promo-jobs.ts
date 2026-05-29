/**
 * In-memory store для long-running promo-reel jobs.
 *
 * Зачем нужно: рендер промо-ролика занимает 5-12 минут, любой reverse-proxy
 * (Cloudflare Free/Pro 100s, nginx default 60s) рубит долгие HTTP-запросы
 * до того как сервер успеет ответить. Async-pipeline:
 *   1. POST /api/generate-promo-reel-full → создаёт job, запускает
 *      pipeline в фоне через setImmediate, возвращает {jobId} <1 сек
 *   2. Pipeline пишет прогресс через updateJob() между шагами
 *   3. UI поллит GET /api/promo-job-status/{jobId} каждые 3 сек —
 *      каждый запрос быстрый, никаких proxy-таймаутов
 *   4. Когда status: "done" — UI показывает финальный плеер
 *
 * Хранилище в памяти Node-процесса. При PM2 restart данные теряются —
 * это приемлемо для текущего use case (admin testing). В прод-версии
 * можно перенести в Redis/Postgres.
 */

export type PromoJobStatus = "queued" | "running" | "done" | "failed";

export interface PromoStepReport {
  name: "images" | "screencast" | "voiceover" | "stock-videos" | "animated-broll" | "render";
  status: "ok" | "failed" | "skipped" | "in_progress";
  ms: number;
  error?: string;
}

export interface PromoJobResult {
  url: string;
  jobId: string; // render-promo-reel jobId (имя MP4 на диске)
  sizeBytes: number;
  totalMs: number;
}

export interface PromoJob {
  /** Уникальный ID этой generation-задачи (не путать с render jobId). */
  id: string;
  /** Кто запустил — для фильтрации по юзеру в /status. null = аноним/админ. */
  userId: string | null;
  status: PromoJobStatus;
  progress: PromoStepReport[];
  result: PromoJobResult | null;
  error: string | null;
  /** Когда юзер закрыл вкладку — поток не остановится, но юзер не увидит результат.
   *  Для понимания живой ли клиент: refresh updatedAt при каждом poll. */
  createdAt: number;
  updatedAt: number;
  lastPollAt: number | null;
}

const jobs = new Map<string, PromoJob>();

// Авто-очистка: jobs старше 2 часов или completed/failed >30 мин — удаляем,
// чтобы Map не разрастался бесконечно. Запускается раз в 5 минут.
const ONE_HOUR = 60 * 60 * 1000;
const RETAIN_COMPLETED_MS = 30 * 60 * 1000;
const RETAIN_TOTAL_MS = 2 * ONE_HOUR;

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
      const ageMs = now - job.createdAt;
      const sinceUpdate = now - job.updatedAt;
      const isTerminal = job.status === "done" || job.status === "failed";
      if (ageMs > RETAIN_TOTAL_MS) {
        jobs.delete(id);
      } else if (isTerminal && sinceUpdate > RETAIN_COMPLETED_MS) {
        jobs.delete(id);
      }
    }
  }, 5 * 60 * 1000);
}

export function createJob(userId: string | null): PromoJob {
  const id = `pjob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const job: PromoJob = {
    id,
    userId,
    status: "queued",
    progress: [],
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    lastPollAt: null,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): PromoJob | null {
  return jobs.get(id) ?? null;
}

export function updateJob(id: string, patch: Partial<Omit<PromoJob, "id" | "createdAt">>): PromoJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  job.updatedAt = Date.now();
  return job;
}

/** Зафиксировать момент когда UI запросил статус — полезно для диагностики
 *  «закрыл ли юзер вкладку». Не блокирует pipeline. */
export function touchPoll(id: string): PromoJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  job.lastPollAt = Date.now();
  return job;
}

/** Список своих jobs по userId — для админ-страницы «активные сейчас». */
export function listJobsByUser(userId: string | null, limit = 20): PromoJob[] {
  const result: PromoJob[] = [];
  for (const job of jobs.values()) {
    if (job.userId === userId) result.push(job);
    if (result.length >= limit) break;
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}
