/**
 * Доставка готового КП лиду — email и/или Telegram.
 *
 * Закрывает самую дорогую утечку воронки: КП собирается 2–3 минуты, и до
 * этого модуля ссылка жила ТОЛЬКО на открытой странице. Человек закрыл
 * вкладку — и первое касание случалось через 24 часа (сервисное письмо
 * дожима). Мы доводили посетителя до конверсии, тратили генерацию — и
 * молчали сутки.
 *
 * Вызывается из kp-queue по завершении генерации. Правила:
 *  - только source public/user: менеджерские КП разносит менеджер;
 *  - идемпотентно через ready_notified_at — ретрай очереди не шлёт дубль;
 *  - это СЕРВИСНОЕ сообщение (человек сам запросил документ), поэтому
 *    marketing_consent не требуется; ссылка отписки всё равно есть;
 *  - ошибка генерации публичного лида уходит менеджеру в TG: лид с
 *    контактом и упавшим КП — это задача «собери руками», а не тишина.
 */
import { query } from "./db";
import { sendMail } from "./mailer";
import { sendKpTgMessage, notifyKpManager } from "./kp-tg-funnel";

const SITE = "https://marketradar24.ru";

interface KpRow {
  id: string;
  url: string;
  company_name: string | null;
  status: string;
  source: string;
  share_token: string | null;
  share_password: string | null;
  client_email: string | null;
  client_tg_chat_id: string | null;
  unsub_token: string | null;
  error: string | null;
  ready_notified_at: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function notifyKpReady(kpId: string): Promise<void> {
  const rows = await query<KpRow>(
    `SELECT id, url, company_name, status, source, share_token, share_password,
            client_email, client_tg_chat_id, unsub_token, error, ready_notified_at
       FROM kp_generations WHERE id = $1`,
    [kpId],
  );
  const r = rows[0];
  if (!r) return;
  if (r.source !== "public" && r.source !== "user") return;

  const name = r.company_name || r.url;

  if (r.status === "error") {
    // Публичный лид с контактом и упавшей генерацией — менеджеру, руками.
    if (r.client_email || r.client_tg_chat_id) {
      await notifyKpManager(
        `⚠️ <b>КП лида не собралось</b>\n${esc(name)} — ${esc(r.url)}\n` +
        `Контакт: ${esc(r.client_email ?? "только Telegram")}\n` +
        `Ошибка: ${esc((r.error ?? "").slice(0, 200))}\n` +
        `Клиенту обещано «соберём вручную в течение рабочего дня».`,
        // Токен есть даже у упавшей генерации, если она успела его получить —
        // тогда менеджер сразу видит, что именно клиент открывал.
        { shareToken: r.share_token, sharePassword: r.share_password },
      );
    }
    return;
  }
  if (r.status !== "done" || !r.share_token || r.ready_notified_at) return;

  // Метку ставим ДО отправки: лучше потерять одну нотификацию на падении
  // процесса, чем заспамить дублями при гонке ретраев.
  const claimed = await query<{ id: string }>(
    `UPDATE kp_generations SET ready_notified_at = NOW()
      WHERE id = $1 AND ready_notified_at IS NULL RETURNING id`,
    [r.id],
  );
  if (!claimed.length) return;

  const kpUrl = `${SITE}/kp-share/${r.share_token}?p=${encodeURIComponent(r.share_password ?? "")}`;

  if (r.client_email) {
    const unsub = r.unsub_token ? `${SITE}/api/unsubscribe?t=${r.unsub_token}` : null;
    try {
      await sendMail({
        to: r.client_email,
        subject: `Разбор ${name} готов`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px">
<p>Ваш разбор по <b>${esc(name)}</b> собран.</p>
<p>Внутри: находки с доказательствами, конкуренты поимённо с запросами, по которым они забирают ваших клиентов, прогноз по каналам и план работ с ценами.</p>
<p><a href="${kpUrl}" style="color:#4f46e5;font-weight:600">Открыть разбор</a></p>
<p>Ссылка постоянная — можно вернуться в любой момент. Вопросы — просто ответьте на это письмо.</p>
<p style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
MarketRadar · <a href="${SITE}" style="color:#4f46e5">marketradar24.ru</a>${unsub ? ` · <a href="${unsub}" style="color:#64748b">отписаться от писем</a>` : ""}
</p></div>`,
      });
    } catch (e) {
      console.warn("[kp-notify] email не ушёл", r.id, String(e).slice(0, 120));
    }
  }

  if (r.client_tg_chat_id) {
    try {
      await sendKpTgMessage(
        r.client_tg_chat_id,
        `✅ <b>Разбор «${esc(name)}» готов.</b>\n\nНаходки, конкуренты, прогноз и план работ с ценами — по кнопке ниже. Ссылка постоянная.`,
        [[{ text: "Открыть разбор", url: kpUrl }]],
      );
    } catch (e) {
      console.warn("[kp-notify] tg не ушёл", r.id, String(e).slice(0, 120));
    }
  }
}
