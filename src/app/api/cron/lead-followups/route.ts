/**
 * Дожим лида самообслуживания — тех, кто пришёл на /new, оставил email и
 * получил разбор.
 *
 * Зачем отдельно от kp-followups: та серия ведёт в Telegram и только тех, кому
 * менеджер отправил пересобранный сайт (rebuild_status='sent'). Лид с рекламы
 * туда не попадает вообще — клик оплачен, КП сгенерировано за деньги, и дальше
 * тишина. Это и была дыра.
 *
 * Вызывается планировщиком раз в час:
 *   curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/lead-followups
 *
 * ЮРИДИЧЕСКАЯ РАМКА. Согласие на обработку ПД и согласие на рекламную рассылку
 * — разные вещи (инструкция юриста, п.3). Поэтому серия разделена:
 *   stage 0 → 1 (+24 ч)  — СЕРВИСНОЕ письмо про заказанный разбор. Уходит всем:
 *                          человек сам запросил документ, это не реклама.
 *   stage 1 → 2 (+72 ч)  — предложение услуг. ТОЛЬКО при marketing_consent_at.
 *   stage 2 → 3 (+7 сут) — последнее касание. ТОЛЬКО при marketing_consent_at.
 * В каждом письме — ссылка отписки; после отписки серия молчит навсегда.
 *
 * Ветвление первого письма по views: открытый разбор и неоткрытый требуют
 * разного разговора. Слать «вы не открыли» тому, кто открыл, — верный способ
 * показать, что письма шлёт робот, который не смотрит.
 */
import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const maxDuration = 120;

const SITE = "https://marketradar24.ru";
const BATCH_LIMIT = 40;

interface Row {
  id: string;
  url: string;
  company_name: string | null;
  share_token: string | null;
  share_password: string | null;
  client_email: string;
  views: number;
  self_followup_stage: number;
  marketing_ok: boolean;
  unsub_token: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(body: string, unsubUrl: string | null): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px">
${body}
<p style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
MarketRadar · <a href="${SITE}" style="color:#4f46e5">marketradar24.ru</a>${
    unsubUrl ? ` · <a href="${unsubUrl}" style="color:#64748b">отписаться от писем</a>` : ""
  }
</p></div>`;
}

/** Письма серии. Каждое возвращает тему и HTML. */
function letter(stage: number, r: Row, kpUrl: string, unsubUrl: string | null) {
  const name = r.company_name || r.url;

  if (stage === 0) {
    // Сервисное: про документ, который человек сам заказал.
    return r.views > 0
      ? {
          subject: `Разбор ${name}: с чего начать`,
          html: layout(
            `<p>Вы открывали разбор по <b>${esc(name)}</b> — спасибо, что дочитали.</p>
<p>Если решаете, с чего начать, короткий ориентир: сначала техника сайта, потом контент, и только затем внешние упоминания. Один слой из четырёх результата не даёт — это единственное, о чём я бы предупредил заранее.</p>
<p><a href="${kpUrl}" style="color:#4f46e5">Открыть разбор снова</a></p>
<p>Если что-то в документе непонятно — просто ответьте на это письмо, разберём.</p>`,
            unsubUrl,
          ),
        }
      : {
          subject: `Ваш разбор ${name} готов — вы его ещё не открывали`,
          html: layout(
            `<p>Вы запрашивали разбор сайта <b>${esc(name)}</b>. Он собран и ждёт по ссылке, но открыт ещё не был.</p>
<p>Внутри: находки с доказательствами, конкуренты поимённо с запросами, по которым они забирают ваших клиентов, прогноз по каналам и план работ с ценами.</p>
<p><a href="${kpUrl}" style="color:#4f46e5;font-weight:600">Открыть разбор</a></p>
<p>Ссылка постоянная — можно вернуться позже.</p>`,
            unsubUrl,
          ),
        };
  }

  if (stage === 1) {
    return {
      subject: `${name}: что делать с находками`,
      html: layout(
        `<p>В разборе по <b>${esc(name)}</b> перечислены находки — но список сам по себе заявок не приносит.</p>
<p>Мы закрываем их четырьмя слоями сразу: техника сайта, контент под извлечение ответа, внешние упоминания и репутация. Сопровождение — от 25 000 ₽/мес, вход — бесплатная проверка, которую вы уже прошли.</p>
<p>Первые изменения обычно через один–три месяца. Раньше не бывает ни у кого, и тот, кто обещает быстрее, обманывает.</p>
<p><a href="${SITE}/geo" style="color:#4f46e5;font-weight:600">Посмотреть, как это устроено</a></p>`,
        unsubUrl,
      ),
    };
  }

  return {
    subject: `${name}: последнее письмо`,
    html: layout(
      `<p>Больше писать не буду — это последнее письмо по разбору <b>${esc(name)}</b>.</p>
<p>Если сейчас не до этого, разбор никуда не денется: <a href="${kpUrl}" style="color:#4f46e5">ссылка</a> работает постоянно.</p>
<p>А если хочется просто обсудить, что из находок важно именно вам, — ответьте на это письмо одной строкой. Без презентаций и обязательств.</p>`,
      unsubUrl,
    ),
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await initDb();

  // Условия входа. Считаем от completed_at — момента, когда разбор реально
  // собрался, а не когда его заказали: иначе долгая генерация съедала бы паузу.
  const rows = await query<Row>(
    `SELECT id, url, company_name, share_token, share_password, client_email, views,
            self_followup_stage, unsub_token,
            (marketing_consent_at IS NOT NULL) AS marketing_ok
       FROM kp_generations
      WHERE status = 'done'
        AND source IN ('public', 'user')
        AND client_email IS NOT NULL
        AND unsubscribed_at IS NULL
        AND platform_user_id IS NULL           -- уже завёл аккаунт: дожимать незачем
        AND rebuild_status IS DISTINCT FROM 'sent'  -- им занимается TG-серия
        AND completed_at IS NOT NULL
        AND (
          (self_followup_stage = 0 AND completed_at < NOW() - INTERVAL '24 hours')
          OR (self_followup_stage = 1 AND completed_at < NOW() - INTERVAL '72 hours'
              AND marketing_consent_at IS NOT NULL)
          OR (self_followup_stage = 2 AND completed_at < NOW() - INTERVAL '7 days'
              AND marketing_consent_at IS NOT NULL)
        )
      ORDER BY completed_at ASC
      LIMIT ${BATCH_LIMIT}`,
  );

  let sent = 0, failed = 0;
  for (const r of rows) {
    const stage = r.self_followup_stage;
    const kpUrl = r.share_token
      ? `${SITE}/kp-share/${r.share_token}?p=${encodeURIComponent(r.share_password ?? "")}`
      : SITE;
    const unsubUrl = r.unsub_token ? `${SITE}/api/unsubscribe?t=${r.unsub_token}` : null;
    const { subject, html } = letter(stage, r, kpUrl, unsubUrl);

    try {
      await sendMail({ to: r.client_email, subject, html });
      sent++;
    } catch (e) {
      failed++;
      console.warn("[lead-followups] отправка не удалась", r.id, String(e).slice(0, 120));
      // Стадию всё равно двигаем: иначе битый адрес будет получать попытку
      // каждый час до конца времён.
    }
    await query(
      `UPDATE kp_generations SET self_followup_stage = $2, self_followup_at = NOW() WHERE id = $1`,
      [r.id, stage + 1],
    );
  }

  return NextResponse.json({ ok: true, picked: rows.length, sent, failed });
}
