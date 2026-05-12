/**
 * GET /api/agents
 *   Возвращает список всех зарегистрированных агентов + их конфиг
 *   для текущего юзера (enabled, schedule, last_run_*).
 *
 * POST /api/agents
 *   Обновляет конфиг агента (enable/disable, schedule, params).
 *   Body: { agentName, enabled?, schedule?, params? }
 *   Создаёт запись если её ещё нет.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { listAgents, type AgentSchedule } from "@/lib/agents";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface ConfigRow {
  id: string;
  agent_name: string;
  enabled: boolean;
  schedule: AgentSchedule;
  params: Record<string, unknown> | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_summary: string | null;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const definitions = listAgents();
  const configs = await query<ConfigRow>(
    `SELECT id, agent_name, enabled, schedule, params, last_run_at, last_run_status, last_run_summary
       FROM agent_configs WHERE user_id = $1`,
    [session.userId],
  );
  const cfgByName = new Map(configs.map(c => [c.agent_name, c]));

  // Merge: definitions × config (если конфиг есть)
  const agents = definitions.map(def => {
    const cfg = cfgByName.get(def.name);
    return {
      name: def.name,
      label: def.label,
      description: def.description,
      icon: def.icon,
      category: def.category,
      defaultSchedule: def.defaultSchedule,
      fixedSchedule: def.fixedSchedule ?? false,
      minPlan: def.minPlan,
      // user-specific state
      enabled: cfg?.enabled ?? false,
      schedule: cfg?.schedule ?? def.defaultSchedule,
      params: cfg?.params ?? {},
      lastRunAt: cfg?.last_run_at,
      lastRunStatus: cfg?.last_run_status,
      lastRunSummary: cfg?.last_run_summary,
    };
  });

  return NextResponse.json({ ok: true, agents });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  await initDb();
  const body = await req.json().catch(() => ({}));
  const agentName = String(body.agentName ?? "").trim();
  if (!agentName) {
    return NextResponse.json({ ok: false, error: "agentName обязателен" }, { status: 400 });
  }

  // Проверяем что агент существует в реестре
  const defs = listAgents();
  const def = defs.find(d => d.name === agentName);
  if (!def) {
    return NextResponse.json({ ok: false, error: `Агент ${agentName} не зарегистрирован` }, { status: 404 });
  }

  // Валидация schedule
  const VALID_SCHEDULES: AgentSchedule[] = ["hourly", "daily", "weekly", "manual"];
  const schedule = body.schedule && VALID_SCHEDULES.includes(body.schedule)
    ? body.schedule as AgentSchedule
    : def.defaultSchedule;

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  const params = body.params && typeof body.params === "object" ? body.params : undefined;

  // UPSERT: создаём если нет, обновляем если есть
  const existing = await query<{ id: string }>(
    `SELECT id FROM agent_configs WHERE user_id = $1 AND agent_name = $2 LIMIT 1`,
    [session.userId, agentName],
  );

  if (existing.length === 0) {
    await query(
      `INSERT INTO agent_configs (id, user_id, agent_name, enabled, schedule, params)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        randomUUID(),
        session.userId,
        agentName,
        enabled ?? false,
        // fixedSchedule → нельзя менять, всегда default
        def.fixedSchedule ? def.defaultSchedule : schedule,
        JSON.stringify(params ?? {}),
      ],
    );
  } else {
    // Update только то что прислали
    const updates: string[] = ["updated_at = NOW()"];
    const args: unknown[] = [];
    let i = 1;
    if (enabled !== undefined) { updates.push(`enabled = $${i++}`); args.push(enabled); }
    if (!def.fixedSchedule && body.schedule) { updates.push(`schedule = $${i++}`); args.push(schedule); }
    if (params !== undefined) { updates.push(`params = $${i++}::jsonb`); args.push(JSON.stringify(params)); }
    args.push(existing[0].id);
    await query(
      `UPDATE agent_configs SET ${updates.join(", ")} WHERE id = $${i}`,
      args,
    );
  }

  return NextResponse.json({ ok: true });
}
