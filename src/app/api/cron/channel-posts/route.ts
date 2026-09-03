/**
 * GET/POST /api/cron/channel-posts
 *
 * Крон для контент-ленты Telegram-канала @company24pro:
 *   1. maybeCreateScheduledDraft() — по расписанию (пн/ср/пт 10:00 МСК,
 *      см. src/lib/channel-poster.ts) пишет новый черновик и шлёт его
 *      менеджеру на одобрение. Идемпотентно: не создаст второй черновик,
 *      если за последние 12 часов уже создавался.
 *   2. publishDue() — публикует посты, которые менеджер одобрил с отложенным
 *      временем (/when или кнопка «Отложить») и это время уже наступило.
 *   3. maybeRefreshProductContext() — раз в ~сутки пересобирает описание
 *      продукта для промпта генератора из раздела «Реализованные модули»
 *      CLAUDE.md, чтобы новые фичи попадали в посты без ручной правки кода.
 *
 * Вызывать раз в час (уже подключено в scripts/cron-tick.sh) — все три
 * функции сами решают, пора ли им что-то делать.
 *   curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/channel-posts
 *
 * Защита: тот же CRON_SECRET, что у остальных cron-эндпоинтов (см.
 * /api/cron/run-agents) — без него на проде эндпоинт отказывает.
 */
import { NextResponse } from "next/server";
import { maybeCreateScheduledDraft, publishDue, maybeRefreshProductContext } from "@/lib/channel-poster";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron/channel-posts] CRON_SECRET not configured in production — refusing to run");
      return false;
    }
    return true;
  }
  const url = new URL(req.url);
  const bearerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = url.searchParams.get("secret");
  const headerSecret = req.headers.get("x-cron-secret");
  return bearerToken === secret || querySecret === secret || headerSecret === secret;
}

async function run() {
  const draft = await maybeCreateScheduledDraft();
  const due = await publishDue();
  const context = await maybeRefreshProductContext();
  return NextResponse.json({ ok: true, draft, due, context });
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return run();
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return run();
}
