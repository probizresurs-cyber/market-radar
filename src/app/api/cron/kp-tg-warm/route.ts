/**
 * ТГ-прогрев КП-лидов: бот пишет первым тем, кто подключил Telegram, но так и
 * не оставил заявку.
 *
 * Зачем отдельная серия. Уже есть две: kp-followups ведёт в TG тех, кому
 * менеджер ОТПРАВИЛ пересобранный сайт (rebuild_status='sent'), lead-followups
 * шлёт письма тем, кто оставил email. Человек, который пришёл через ТГ-дверь на
 * лендинге, не попадает ни в одну: почты у нас может не быть вовсе, сайт ему
 * никто не пересобирал. Он получал ровно одно сообщение «разбор готов» — и
 * тишину. Эта серия закрывает именно этот разрыв.
 *
 * Вызывается планировщиком раз в час:
 *   curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/kp-tg-warm
 *
 * Серия (tg_warm_stage — счётчик отправленного, 3 = серия закончена):
 *   0 → 1  через 2 часа после готовности разбора — «спросите, что непонятно»
 *   1 → 2  через 2 суток после предыдущего — снимаем три типовых возражения
 *   2 → 3  через 4 суток после предыдущего — последнее, предложение поговорить
 *
 * УСЛОВИЯ ОСТАНОВКИ (любое — и серия молчит навсегда):
 *   • consult_requested_at NOT NULL — заявка уже есть, дальше работает менеджер,
 *     и робот, продолжающий уговаривать оставившего заявку, только вредит;
 *   • unsubscribed_at NOT NULL — отписка;
 *   • rebuild_status='sent' — человека уже ведёт TG-серия kp-followups, две
 *     серии в один чат недопустимы;
 *   • platform_user_id NOT NULL — лид стал пользователем платформы;
 *   • бот заблокирован клиентом — считаем это отпиской (см. isDeadChat).
 */
import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { sendKpTgWarm, kpShareUrlWithPassword, type KpTgLocale } from "@/lib/kp-tg-funnel";

export const runtime = "nodejs";
export const maxDuration = 120;

const BATCH_LIMIT = 30;
const FINAL_STAGE = 3;

interface Row {
  id: string;
  url: string;
  company_name: string | null;
  locale: string;
  share_token: string | null;
  share_password: string | null;
  client_tg_chat_id: string;
  tg_warm_stage: number;
}

/**
 * Ответы Telegram, после которых слать в этот чат бессмысленно: клиент
 * заблокировал бота, удалил аккаунт или чат недоступен. Двигать стадию по одной
 * позиции мало — иначе мы ещё двое суток держим мёртвую строку в выборке.
 */
function isDeadChat(error?: string): boolean {
  const e = (error ?? "").toLowerCase();
  return e.includes("blocked") || e.includes("chat not found") || e.includes("deactivated")
    || e.includes("user is deactivated") || e.includes("bot was kicked");
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await initDb();

  // Анкер первого сообщения — completed_at (момент, когда разбор реально
  // собрался), а не created_at: подключение к боту происходит около него же, и
  // от него человек начинает читать. Паузы между вторым и третьим считаются от
  // tg_warm_at — времени предыдущей отправки. Если считать всё от анкера,
  // строка, пролежавшая неделю до деплоя этой серии, получила бы все три
  // сообщения за один запуск cron.
  //
  // Окно 30 дней: серия не будит лидов, которым разбор собрали давно — первое
  // сообщение «спросите, что непонятно» через месяц тишины выглядит нелепо.
  //
  // NOT EXISTS — один чат может быть привязан к нескольким КП (клиент
  // подключался повторно). Прогреваем только по самой свежей строке, иначе
  // человек получит серию столько раз, сколько у него генераций.
  const rows = await query<Row>(
    `SELECT k.id, k.url, k.company_name, k.locale, k.share_token, k.share_password,
            k.client_tg_chat_id, k.tg_warm_stage
       FROM kp_generations k
      WHERE k.status = 'done'
        AND k.client_tg_chat_id IS NOT NULL
        AND k.tg_warm_stage < ${FINAL_STAGE}
        AND k.consult_requested_at IS NULL
        AND k.unsubscribed_at IS NULL
        AND k.platform_user_id IS NULL
        AND k.rebuild_status IS DISTINCT FROM 'sent'
        AND k.completed_at IS NOT NULL
        AND k.completed_at > NOW() - INTERVAL '30 days'
        AND (
          (k.tg_warm_stage = 0 AND k.completed_at < NOW() - INTERVAL '2 hours')
          OR (k.tg_warm_stage = 1 AND k.tg_warm_at < NOW() - INTERVAL '2 days')
          OR (k.tg_warm_stage = 2 AND k.tg_warm_at < NOW() - INTERVAL '4 days')
        )
        AND NOT EXISTS (
          SELECT 1 FROM kp_generations b
           WHERE b.client_tg_chat_id = k.client_tg_chat_id
             AND b.created_at > k.created_at
        )
      ORDER BY k.completed_at ASC
      LIMIT ${BATCH_LIMIT}`,
  );

  let sent = 0, failed = 0, stopped = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const stage = (r.tg_warm_stage + 1) as 1 | 2 | 3;

    // Стадию занимаем ДО отправки и только если она всё ещё прежняя: два
    // параллельных запуска cron (планировщик задвоился, ретрай после таймаута)
    // иначе отправят одно и то же сообщение дважды. Потерять сообщение при
    // падении процесса дешевле, чем задублировать его в личке клиента.
    const claimed = await query<{ id: string }>(
      `UPDATE kp_generations SET tg_warm_stage = $2, tg_warm_at = NOW()
        WHERE id = $1 AND tg_warm_stage = $3
        RETURNING id`,
      [r.id, stage, r.tg_warm_stage],
    );
    if (!claimed.length) continue;

    const locale: KpTgLocale = r.locale === "de" ? "de" : "ru";
    const res = await sendKpTgWarm(r.client_tg_chat_id, {
      companyName: r.company_name || r.url,
      locale,
      siteReadyUrl: null,
      kpUrl: kpShareUrlWithPassword(r.share_token, r.share_password),
    }, stage);

    if (res.ok) {
      sent++;
      continue;
    }
    failed++;
    errors.push(`${r.id}: ${res.error}`);
    if (isDeadChat(res.error)) {
      await query(`UPDATE kp_generations SET tg_warm_stage = $2 WHERE id = $1`, [r.id, FINAL_STAGE]);
      stopped++;
    }
  }

  return NextResponse.json({ ok: true, picked: rows.length, sent, failed, stopped, errors });
}
