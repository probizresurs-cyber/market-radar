/**
 * POST /api/agents/<name>/run
 *
 * Ручной запуск агента из UI «Agent Hub». Юзер жмёт кнопку «Запустить»
 * → этот endpoint грузит config, вызывает runAgent(), возвращает result.
 *
 * Если у юзера ещё нет config для этого агента — создаём дефолтный
 * (enabled=true, schedule=default), чтобы можно было запустить без
 * предварительного toggle.
 *
 * Body: { params? }  — оверрайд параметров на этот запуск (не сохраняется)
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { runAgent, getAgent } from "@/lib/agents";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // некоторые агенты могут идти долго

export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const { name } = await ctx.params;
  const def = getAgent(name);
  if (!def) {
    return NextResponse.json({ ok: false, error: `Агент ${name} не найден` }, { status: 404 });
  }

  await initDb();
  const body = await req.json().catch(() => ({}));
  const overrideParams = body.params && typeof body.params === "object" ? body.params : null;

  // Грузим config (или создаём дефолтный)
  type Row = {
    id: string;
    params: Record<string, unknown> | null;
    last_run_at: string | null;
  };
  const existing = await query<Row>(
    `SELECT id, params, last_run_at FROM agent_configs WHERE user_id = $1 AND agent_name = $2 LIMIT 1`,
    [session.userId, name],
  );

  let configId: string;
  let lastRunAt: Date | null = null;
  let params: Record<string, unknown> = {};

  if (existing.length === 0) {
    // Manual run НЕ активирует cron: создаём конфиг с enabled=false и
    // schedule='manual'. Юзер сознательно делает toggle Enabled + меняет
    // расписание на hourly/daily/weekly, чтобы агент пошёл на cron.
    configId = randomUUID();
    await query(
      `INSERT INTO agent_configs (id, user_id, agent_name, enabled, schedule, params)
         VALUES ($1, $2, $3, false, 'manual', '{}'::jsonb)`,
      [configId, session.userId, name],
    );
  } else {
    configId = existing[0].id;
    lastRunAt = existing[0].last_run_at ? new Date(existing[0].last_run_at) : null;
    params = existing[0].params ?? {};
  }

  // Merge persistent params + override
  const runParams = { ...params, ...(overrideParams ?? {}) };

  const result = await runAgent(configId, session.userId, name, runParams, lastRunAt);
  return NextResponse.json(result);
}
