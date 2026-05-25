/**
 * POST/GET /api/cron/run-agents
 *
 * Cron-trigger для агентов. Внешний cron-сервис вызывает этот endpoint
 * раз в час, runner:
 *   1. Находит due-агентов (enabled, по расписанию)
 *   2. Параллельно запускает каждого через runAgent()
 *   3. Возвращает summary: сколько успешно, сколько ошибок
 *
 * Защита: требует CRON_SECRET в заголовке или query (?secret=...) чтобы
 * случайный человек не мог пробежать всех агентов из любопытства.
 *
 * Параллельность ограничена: max 10 одновременно (чтобы не выгружать
 * Anthropic-квоту разом).
 */
import { NextResponse } from "next/server";
import { findDueAgents, runAgent } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 минут на полный прогон

const MAX_PARALLEL = 10;

async function runAll() {
  const due = await findDueAgents();
  if (due.length === 0) {
    return { ok: true, agents: 0, results: [] };
  }

  // Параллельные батчи по MAX_PARALLEL — чтобы не выгребать всю quota AI.
  const results: Array<{ agent: string; user: string; ok: boolean; summary: string; error?: string }> = [];
  for (let i = 0; i < due.length; i += MAX_PARALLEL) {
    const batch = due.slice(i, i + MAX_PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async d => {
        const r = await runAgent(d.configId, d.userId, d.agentName, d.params, d.lastRunAt);
        return {
          agent: d.agentName,
          user: d.userId.slice(0, 8),
          ok: r.ok,
          summary: r.summary,
          error: r.error,
        };
      }),
    );
    results.push(...batchResults);
  }

  return {
    ok: true,
    agents: due.length,
    successful: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  };
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Раньше: «нет секрета → пускаем (dev)». Это опасно — если на новом VPS
  // забыли установить CRON_SECRET, endpoint становится открытым и любой
  // может запускать всех агентов (платные AI-вызовы) по своему расписанию.
  // Теперь: в dev (NODE_ENV !== "production") пускаем для удобства, на
  // проде ОБЯЗАТЕЛЬНО требуем секрет.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron/run-agents] CRON_SECRET not configured in production — refusing to run");
      return false;
    }
    return true; // dev — пускаем
  }
  const url = new URL(req.url);
  // Поддерживаем три формата (как у /api/cron/check-prices, чтобы один
  // CRON_SECRET работал везде):
  //   1. Authorization: Bearer <secret>   — стандартный, рекомендованный
  //   2. ?secret=<secret>                 — для cron-job.org и других сервисов
  //   3. X-Cron-Secret: <secret>          — старый header (на всякий)
  const bearerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = url.searchParams.get("secret");
  const headerSecret = req.headers.get("x-cron-secret");
  return bearerToken === secret || querySecret === secret || headerSecret === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runAll());
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runAll());
}
