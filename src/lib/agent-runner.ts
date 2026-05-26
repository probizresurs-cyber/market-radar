/**
 * Agent runner — wraps @anthropic-ai/claude-agent-sdk into a job-based API.
 *
 * Job lifecycle:
 *   queued → running → succeeded | failed
 *
 * Each job gets a temp directory (/tmp/agent-runs/<jobId>) where files
 * the agent creates can be saved and later served.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SDKMessage = any;
// Lazy runtime import so Next.js build doesn't fail when the package
// isn't installed locally (it IS installed on the VPS production server).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sdkQuery: ((opts: any) => AsyncIterable<any>) | null = null;
async function getSdkQuery() {
  if (_sdkQuery) return _sdkQuery;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@anthropic-ai/claude-agent-sdk") as { query: (opts: any) => AsyncIterable<any> };
    _sdkQuery = mod.query;
  } catch {
    throw new Error("@anthropic-ai/claude-agent-sdk not installed. Run: npm install @anthropic-ai/claude-agent-sdk");
  }
  return _sdkQuery;
}
function query(opts: Parameters<NonNullable<typeof _sdkQuery>>[0]) {
  return (async function* () {
    const fn = await getSdkQuery();
    yield* fn(opts);
  })();
}
import { mkdirSync, existsSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

export interface ContextFile {
  name: string;
  content: string | Buffer;
}

const RUN_ROOT = "/tmp/agent-runs";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface AgentJob {
  id: string;
  status: JobStatus;
  prompt: string;
  cwd: string;            // working directory the agent operates in
  startedAt: number;
  finishedAt?: number;
  outputFiles: string[];  // relative paths inside cwd
  error?: string;
  log: string[];          // human-readable progress line(s)
  /** ID пользователя, инициировавшего job. Нужно для проверки доступа в
   *  /api/agent/job/[id] и /api/agent/file/[id] — иначе любой авторизованный
   *  юзер мог скачать чужую готовую презентацию по jobId (IDOR от
   *  аудит-агента 25.05). Опционально для legacy-job'ов, созданных до миграции. */
  userId?: string;
}

const jobs = new Map<string, AgentJob>();

// Лимиты:
// - MAX_ACTIVE_PER_USER: сколько premium-jobs может крутиться одновременно
//   у одного юзера. Премиум-генерация стоит ₽30-200, без лимита один юзер
//   может запустить 50 параллельно (₽1500-10000 на Claude за секунды).
// - TTL_MS: jobs Map растёт неограниченно — на активной платформе через
//   год будут десятки тысяч записей. Очищаем job'ы старше 24h.
const MAX_ACTIVE_JOBS_PER_USER = 2;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

export function getJob(id: string): AgentJob | undefined {
  return jobs.get(id);
}

/** Сколько активных job'ов (queued/running) у юзера. Считаем перед стартом. */
export function countActiveJobsForUser(userId: string): number {
  let n = 0;
  for (const j of jobs.values()) {
    if (j.userId === userId && (j.status === "queued" || j.status === "running")) n++;
  }
  return n;
}

/** Очистка job'ов старше TTL. Запускается через setInterval ниже. */
function evictOldJobs(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, job] of jobs.entries()) {
    const lastActivity = job.finishedAt ?? job.startedAt;
    if (lastActivity < cutoff) {
      jobs.delete(id);
    }
  }
}

// Запускаем сборку мусора раз в час. Используем globalThis-флаг чтобы не
// плодить интервалы при HMR-reload в dev.
declare global {
  // eslint-disable-next-line no-var
  var __mrAgentRunnerEvictionInterval: NodeJS.Timeout | undefined;
}
if (typeof setInterval !== "undefined" && !globalThis.__mrAgentRunnerEvictionInterval) {
  globalThis.__mrAgentRunnerEvictionInterval = setInterval(evictOldJobs, 60 * 60 * 1000);
}

function ensureRunRoot() {
  if (!existsSync(RUN_ROOT)) mkdirSync(RUN_ROOT, { recursive: true });
}

/** Walk the cwd and collect every produced file (relative paths). */
function collectOutputFiles(cwd: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix = "") => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      // ignore hidden + node_modules just in case
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else {
        out.push(rel);
      }
    }
  };
  walk(cwd);
  return out;
}

/**
 * Start an agent run as a fire-and-forget background promise.
 * Returns the jobId immediately; poll getJob(id) to read progress.
 */
/**
 * Thrown when юзер пытается запустить больше MAX_ACTIVE_JOBS_PER_USER
 * параллельных премиум-job'ов. Route'у нужно поймать и вернуть 429.
 */
export class TooManyActiveJobsError extends Error {
  constructor(active: number) {
    super(`У вас уже ${active} активных премиум-генераций. Дождитесь завершения текущих (макс. ${MAX_ACTIVE_JOBS_PER_USER}).`);
    this.name = "TooManyActiveJobsError";
  }
}

export function startAgentJob(opts: {
  prompt: string;
  contextFiles?: ContextFile[];
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  userId?: string;
}): string {
  // Защита от financial DoS: один юзер не может запустить N параллельных
  // дорогих jobs. Без этого через прямой API-вызов можно было сжечь
  // ₽10000+ за секунды.
  if (opts.userId) {
    const active = countActiveJobsForUser(opts.userId);
    if (active >= MAX_ACTIVE_JOBS_PER_USER) {
      throw new TooManyActiveJobsError(active);
    }
  }
  ensureRunRoot();
  const id = randomBytes(8).toString("hex");
  const cwd = join(RUN_ROOT, id);
  mkdirSync(cwd, { recursive: true });

  // Drop context files into the working directory so the agent can read them
  // with its Read tool (avoids stuffing them into the prompt).
  if (opts.contextFiles) {
    for (const f of opts.contextFiles) {
      const filePath = join(cwd, f.name);
      // Ensure subdirectories exist (e.g. references/ref-1.jpg)
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      if (dir && dir !== cwd && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      if (typeof f.content === "string") {
        writeFileSync(filePath, f.content, "utf-8");
      } else {
        writeFileSync(filePath, f.content);
      }
    }
  }

  const job: AgentJob = {
    id,
    status: "queued",
    prompt: opts.prompt,
    cwd,
    startedAt: Date.now(),
    outputFiles: [],
    log: ["Очередь..."],
    userId: opts.userId,
  };
  jobs.set(id, job);

  // Run in background — do NOT await
  void runAgent(job, opts).catch((err) => {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    job.finishedAt = Date.now();
    job.log.push(`✗ Ошибка: ${job.error}`);
  });

  return id;
}

async function runAgent(
  job: AgentJob,
  opts: {
    prompt: string;
    model?: string;
    systemPrompt?: string;
    maxTurns?: number;
  }
) {
  job.status = "running";
  job.log.push("Запуск агента...");

  const model = opts.model || "claude-sonnet-4-5";

  const messages = query({
    prompt: opts.prompt,
    options: {
      model,
      cwd: job.cwd,
      maxTurns: opts.maxTurns || 60,
      permissionMode: "bypassPermissions",
      systemPrompt: opts.systemPrompt
        ? { type: "preset", preset: "claude_code", append: opts.systemPrompt }
        : { type: "preset", preset: "claude_code" },
      // Allow file ops + bash (skills need bash to run python/libreoffice)
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Skill"],
    },
  });

  let lastTextSnippet = "";
  for await (const msg of messages as AsyncGenerator<SDKMessage>) {
    // Track the agent's intermediate text for progress display
    if (msg.type === "assistant" && "message" in msg) {
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") {
            const text = block.text.trim();
            if (text && text !== lastTextSnippet) {
              lastTextSnippet = text;
              const oneLine = text.replace(/\s+/g, " ").slice(0, 140);
              job.log.push(oneLine);
              if (job.log.length > 50) job.log.shift();
            }
          } else if (block.type === "tool_use") {
            job.log.push(`→ ${block.name}`);
          }
        }
      }
    } else if (msg.type === "result") {
      if (msg.subtype === "success") {
        job.log.push("✓ Готово");
      } else {
        job.error = `agent returned ${msg.subtype}`;
        job.log.push(`✗ ${msg.subtype}`);
      }
    }
  }

  job.outputFiles = collectOutputFiles(job.cwd);
  job.status = job.error ? "failed" : "succeeded";
  job.finishedAt = Date.now();
}
