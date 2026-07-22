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
import { sendMail } from "@/lib/mailer";

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

  // ── Ранний дожим ДО пересборки (Фаза A воронки) ──────────────────────────
  // Самая массовая потеря: КП отправлено (kp_sent_at из менеджерки), но клиент
  // так и не нажал «Да, интересно». Две email-серии от даты отправки:
  //   nudge 1: +2 дня, nudge 2: +5 дней. Если клиент запустил пересборку
  // (rebuild_status NOT NULL) — серия не трогает его вообще.
  interface NudgeRow {
    id: string; url: string; company_name: string | null; locale: string;
    share_token: string | null; share_password: string | null;
    kp_sent_to: string; kp_nudge_stage: number; views: number;
  }
  const nudgeRows = await query<NudgeRow>(
    `SELECT id, url, company_name, locale, share_token, share_password, kp_sent_to, kp_nudge_stage, views
     FROM kp_generations
     WHERE status = 'done'
       AND kp_sent_at IS NOT NULL AND kp_sent_to IS NOT NULL
       AND rebuild_status IS NULL
       AND (
         (kp_nudge_stage = 0 AND kp_sent_at < NOW() - INTERVAL '2 days')
         OR
         (kp_nudge_stage = 1 AND kp_sent_at < NOW() - INTERVAL '5 days')
       )
     ORDER BY kp_sent_at ASC
     LIMIT ${BATCH_LIMIT}`,
  );

  let nudged = 0;
  for (const r of nudgeRows) {
    const stage = r.kp_nudge_stage === 0 ? 1 : 2;
    const locale = r.locale === "de" ? "de" : "ru";
    const name = r.company_name || r.url;
    const link = `${SITE}/kp-share/${r.share_token}`;
    const opened = r.views > 0;

    const N: Record<string, { subject: string; body: string; last: string }> = {
      ru: {
        subject: `Разбор для ${name} — пара минут, чтобы посмотреть`,
        body: opened
          ? `Вы открывали наш разбор «${name}» — если появились вопросы по находкам или плану, просто ответьте на это письмо, разберём вместе. Ссылка на разбор: ${link} (пароль: ${r.share_password}).`
          : `Несколько дней назад мы отправили персональный разбор «${name}» — сайт, видимость в поиске и у ИИ, конкуренты. Открыть можно тут: ${link} (пароль: ${r.share_password}).`,
        last: `Последнее напоминание по разбору «${name}» — дальше не будем беспокоить. Если тема актуальна, разбор здесь: ${link} (пароль: ${r.share_password}). Вопросы — ответом на это письмо.`,
      },
      de: {
        subject: `Analyse für ${name} — ein paar Minuten für einen Blick`,
        body: opened
          ? `Sie haben unsere Analyse „${name}" geöffnet — bei Fragen zu den Erkenntnissen oder dem Plan antworten Sie einfach auf diese E-Mail. Link zur Analyse: ${link} (Passwort: ${r.share_password}).`
          : `Vor einigen Tagen haben wir Ihnen die persönliche Analyse „${name}" gesendet — Website, Sichtbarkeit in Suche und KI, Wettbewerber. Hier öffnen: ${link} (Passwort: ${r.share_password}).`,
        last: `Letzte Erinnerung zur Analyse „${name}" — danach melden wir uns nicht mehr. Falls relevant: ${link} (Passwort: ${r.share_password}). Fragen — einfach antworten.`,
      },
    };
    const n = N[locale];
    const text = stage === 1 ? n.body : n.last;
    const mail = await sendMail({
      to: r.kp_sent_to,
      subject: n.subject,
      html: `<p style="font-size:14.5px;color:#374151;line-height:1.6;font-family:system-ui,sans-serif;">${text.replace(link, `<a href="${link}" style="color:#2a78d6;">${link}</a>`)}</p>`,
      from: "hello",
    });
    // Stage двигаем даже при ошибке — иначе долбим один адрес каждый запуск.
    await query("UPDATE kp_generations SET kp_nudge_stage = $2 WHERE id = $1", [r.id, stage]);
    if (mail.ok && !mail.skipped) nudged++;
    else errors.push(`nudge ${r.id}: ${mail.error ?? "skipped"}`);
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent, nudgeChecked: nudgeRows.length, nudged, errors });
}
