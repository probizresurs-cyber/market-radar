/**
 * Agent registry — централизованное место, где регистрируются все
 * автономные периодические агенты MarketRadar.
 *
 * Каждый агент:
 *   - имеет уникальное `name` (slug, идёт в DB)
 *   - человекочитаемое `label` для UI
 *   - функцию `run(ctx)`, которая выполняет работу
 *   - default `schedule` (можно перекрыть в `agent_configs.schedule`)
 *
 * Runner (/api/cron/run-agents) перебирает конфиги, выбирает due,
 * параллельно зовёт `definition.run()`, пишет результат в `agent_runs`
 * + обновляет `last_run_*` в `agent_configs`.
 *
 * Конкретные агенты лежат рядом — `src/lib/agents/<name>.ts`. Они
 * импортируются и регистрируются в `agents` ниже.
 */

import { query, initDb } from "@/lib/db";
import { randomUUID } from "crypto";

export type AgentSchedule = "hourly" | "daily" | "weekly" | "manual";

export interface AgentContext {
  userId: string;
  /** Текущий конфиг — может содержать params от пользователя. */
  params: Record<string, unknown>;
  /** Дата последнего успешного запуска (для diff-логики). */
  lastRunAt: Date | null;
  /** Id текущего запуска (для логов / inbox-связки). */
  runId: string;
}

export interface AgentRunResult {
  /** Однострочное summary для UI карточки в Hub. */
  summary: string;
  /** Полный output (artifacts, drafts, diffs). Кладётся в agent_runs.result. */
  result?: Record<string, unknown>;
  /** Если true — результат добавится в Inbox, юзер должен approve. */
  needsApproval?: boolean;
  /** Для skip-сценариев — агент сам решил, что бежать не нужно. */
  skipped?: boolean;
}

export interface AgentDefinition {
  name: string;
  label: string;
  /** 1-2 предложения о том, что делает агент — показывается в Hub. */
  description: string;
  /** Иконка lucide-name. */
  icon: string;
  defaultSchedule: AgentSchedule;
  /** Расписание агента можно жёстко зафиксировать (тогда юзер не сможет менять). */
  fixedSchedule?: boolean;
  /** В каком разделе платформы показывать. */
  category: "content" | "competitors" | "reviews" | "visibility" | "system";
  /** Минимальная подписка для использования. */
  minPlan?: "mini" | "base" | "pro" | "agency";
  run: (ctx: AgentContext) => Promise<AgentRunResult>;
}

// ─── Регистрация ─────────────────────────────────────────────────────
const registry = new Map<string, AgentDefinition>();

export function registerAgent(def: AgentDefinition): void {
  if (registry.has(def.name)) {
    // eslint-disable-next-line no-console
    console.warn(`[agents] re-registering ${def.name}`);
  }
  registry.set(def.name, def);
}

export function getAgent(name: string): AgentDefinition | null {
  return registry.get(name) ?? null;
}

export function listAgents(): AgentDefinition[] {
  return Array.from(registry.values());
}

// ─── Helpers для cron-runner ─────────────────────────────────────────

export interface DueAgent {
  configId: string;
  userId: string;
  agentName: string;
  schedule: AgentSchedule;
  params: Record<string, unknown>;
  lastRunAt: Date | null;
}

/**
 * Возвращает список конфигов, которым пора запускаться (now > nextDueAt).
 * Логика: hourly → ≥1 час с last_run_at; daily → ≥24 ч; weekly → ≥7 дн.
 * manual — не возвращается этим методом (запускается только руками).
 */
export async function findDueAgents(): Promise<DueAgent[]> {
  await initDb();
  const rows = await query<{
    id: string;
    user_id: string;
    agent_name: string;
    schedule: AgentSchedule;
    params: Record<string, unknown> | null;
    last_run_at: string | null;
  }>(`
    SELECT id, user_id, agent_name, schedule, params, last_run_at
      FROM agent_configs
     WHERE enabled = true AND schedule <> 'manual'
  `);

  const now = Date.now();
  const due: DueAgent[] = [];
  for (const r of rows) {
    const lastMs = r.last_run_at ? new Date(r.last_run_at).getTime() : 0;
    const ageMs = now - lastMs;
    const threshold =
      r.schedule === "hourly" ? 60 * 60 * 1000 :
      r.schedule === "daily"  ? 24 * 60 * 60 * 1000 :
      r.schedule === "weekly" ? 7 * 24 * 60 * 60 * 1000 :
      Infinity;
    if (ageMs >= threshold) {
      due.push({
        configId: r.id,
        userId: r.user_id,
        agentName: r.agent_name,
        schedule: r.schedule,
        params: r.params ?? {},
        lastRunAt: r.last_run_at ? new Date(r.last_run_at) : null,
      });
    }
  }
  return due;
}

/**
 * Выполняет один агент: пишет старт-запись в agent_runs, запускает
 * `def.run`, потом пишет результат и обновляет agent_configs.
 *
 * Возвращает run-id для опционального ackа.
 */
export async function runAgent(
  configId: string,
  userId: string,
  agentName: string,
  params: Record<string, unknown>,
  lastRunAt: Date | null,
): Promise<{ runId: string; ok: boolean; summary: string; error?: string }> {
  await initDb();
  const def = registry.get(agentName);
  const runId = randomUUID();
  const startedAt = new Date();

  if (!def) {
    return { runId, ok: false, summary: "", error: `Unknown agent: ${agentName}` };
  }

  // start row
  await query(
    `INSERT INTO agent_runs (id, user_id, agent_name, started_at, status, summary)
       VALUES ($1, $2, $3, $4, 'running', '')`,
    [runId, userId, agentName, startedAt.toISOString()],
  );

  const t0 = Date.now();
  try {
    const out = await def.run({ userId, params, lastRunAt, runId });
    const durationMs = Date.now() - t0;
    const status = out.skipped ? "skipped" : "ok";

    await query(
      `UPDATE agent_runs
          SET finished_at = NOW(),
              status      = $1,
              summary     = $2,
              result      = $3::jsonb,
              duration_ms = $4,
              needs_approval = $5
        WHERE id = $6`,
      [
        status,
        out.summary.slice(0, 500),
        JSON.stringify(out.result ?? {}),
        durationMs,
        Boolean(out.needsApproval),
        runId,
      ],
    );

    await query(
      `UPDATE agent_configs
          SET last_run_at      = NOW(),
              last_run_status  = $1,
              last_run_summary = $2,
              updated_at       = NOW()
        WHERE id = $3`,
      [status, out.summary.slice(0, 500), configId],
    );

    return { runId, ok: true, summary: out.summary };
  } catch (err) {
    const durationMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : "Unknown error";

    await query(
      `UPDATE agent_runs
          SET finished_at = NOW(),
              status      = 'error',
              error_message = $1,
              duration_ms = $2
        WHERE id = $3`,
      [msg.slice(0, 1000), durationMs, runId],
    );
    await query(
      `UPDATE agent_configs
          SET last_run_at      = NOW(),
              last_run_status  = 'error',
              last_run_summary = $1,
              updated_at       = NOW()
        WHERE id = $2`,
      [msg.slice(0, 500), configId],
    );

    return { runId, ok: false, summary: "", error: msg };
  }
}
