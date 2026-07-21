/**
 * Дожим-воронка КП-клиентов в Telegram (Фаза 5+).
 *
 * Вызывается внешним планировщиком раз в час/день:
 *
 *   curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/kp-followups
 *
 * Кому шлём: kp_generations с rebuild_status='sent' (новый сайт уже отправлен
 * и клиент подключил бота — client_tg_chat_id NOT NULL).
 *
 * Серия (анкер — approved_at, момент одобрения/отправки менеджером):
 *   stage 0 → 1: через 24 часа — «как вам новая версия?» + оффер полного
 *                анализа (SEO, конкуренты, ЦА) и SEO/GEO
 *   stage 1 → 2: через 72 часа — последний штрих: конкретика по SEO/GEO,
 *                CTA «ответьте на это сообщение». Дальше серия молчит.
 *
 * Ответ клиента ловит webhook (пересылает менеджеру + Reply-релей обратно).
 */

import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { sendKpFollowup, kpShareUrl, type KpTgLocale } from "@/lib/kp-tg-funnel";

export const runtime = "nodejs";
export const maxDuration = 120;

const SITE = "https://marketradar24.ru";
const BATCH_LIMIT = 30;

interface Row {
  id: string;
  url: string;
  company_name: string | null;
  locale: string;
  share_token: string | null;
  rebuild_id: string | null;
  client_tg_chat_id: number;
  followup_stage: number;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await initDb();
  const rows = await query<Row>(
    `SELECT id, url, company_name, locale, share_token, rebuild_id, client_tg_chat_id, followup_stage
     FROM kp_generations
     WHERE rebuild_status = 'sent'
       AND client_tg_chat_id IS NOT NULL
       AND (
         (followup_stage = 0 AND approved_at < NOW() - INTERVAL '24 hours')
         OR
         (followup_stage = 1 AND approved_at < NOW() - INTERVAL '72 hours')
       )
     ORDER BY approved_at ASC
     LIMIT ${BATCH_LIMIT}`,
  );

  let sent = 0;
  const errors: string[] = [];
  for (const r of rows) {
    const stage = (r.followup_stage === 0 ? 1 : 2) as 1 | 2;
    const locale: KpTgLocale = r.locale === "de" ? "de" : "ru";
    const res = await sendKpFollowup(r.client_tg_chat_id, {
      companyName: r.company_name || r.url,
      locale,
      siteReadyUrl: r.rebuild_id ? `${SITE}/site-ready/${r.rebuild_id}?locale=${locale}` : null,
      kpUrl: kpShareUrl(r.share_token),
    }, stage);

    // Помечаем stage даже при ошибке отправки (напр. клиент заблокировал бота) —
    // иначе cron будет долбить один и тот же чат каждый запуск.
    await query("UPDATE kp_generations SET followup_stage = $2 WHERE id = $1", [r.id, stage]);
    if (res.ok) sent++;
    else errors.push(`${r.id}: ${res.error}`);
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent, errors });
}
