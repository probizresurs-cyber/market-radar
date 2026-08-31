/**
 * GET /api/admin/funnel-health — что из воронки реально настроено на проде.
 *
 * Появился после вопроса «а с какого бота уведомления и откуда аккаунт
 * менеджера»: ответ жил в .env на сервере, и проверить его снаружи было
 * нельзя. Молчащее уведомление выглядит точно так же, как отсутствие
 * заявок, — поэтому нужен способ отличить одно от другого, не заходя по SSH.
 *
 * Отдаёт ТОЛЬКО факт настроенности и безопасные хвосты значений: сами
 * токены, chat_id и ключи наружу не уходят даже админу — этот эндпоинт
 * отвечает на вопрос «работает ли», а не «какой там секрет».
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { initDb, query } from "@/lib/db";

export const runtime = "nodejs";

/** «Задано / не задано» без утечки значения: длина и последние 3 символа. */
const mask = (v: string | undefined) =>
  v ? { set: true, len: v.length, tail: v.slice(-3) } : { set: false };

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  await initDb();

  const [pending, recentLeads, recentRequests] = await Promise.all([
    query<{ n: string }>(`SELECT COUNT(*) n FROM kp_generations WHERE status IN ('queued','running')`),
    query<{ n: string }>(
      `SELECT COUNT(*) n FROM kp_generations
        WHERE source='public' AND created_at > NOW() - INTERVAL '7 days'`,
    ),
    query<{ n: string }>(
      `SELECT COUNT(*) n FROM kp_generations
        WHERE consult_requested_at > NOW() - INTERVAL '30 days'`,
    ),
  ]);

  return NextResponse.json({
    ok: true,
    telegram: {
      bot: "@market_radar1_bot",
      botToken: mask(process.env.TELEGRAM_BOT_TOKEN),
      // Главное, ради чего эндпоинт и заведён: без этого chat_id заявки
      // менеджеру уходят только письмом-дублем.
      managerChatId: mask(process.env.KP_MANAGER_TG_CHAT_ID),
      apiBase: process.env.TG_API_BASE ?? "https://api.telegram.org",
    },
    mail: {
      managerEmailFallback: process.env.KP_MANAGER_EMAIL || "support@marketradar24.ru",
      smtpHost: mask(process.env.SMTP_HOST),
      // EMAIL_ENABLED=false глушит вообще всю почту — включая письма о
      // готовности разбора и подтверждения заявок.
      emailEnabled: process.env.EMAIL_ENABLED !== "false",
    },
    cron: { secretConfigured: mask(process.env.CRON_SECRET) },
    data: {
      kpInQueue: Number(pending[0]?.n ?? 0),
      publicKpLast7d: Number(recentLeads[0]?.n ?? 0),
      consultRequestsLast30d: Number(recentRequests[0]?.n ?? 0),
    },
  });
}
