/**
 * POST /api/kp-share/[token]/consult { contact | email+phone+telegram, kind,
 * interest } — заявка на консультацию прямо из разбора.
 *
 * Раньше кнопка «запросить консультацию» просто скроллила к форме пересборки
 * сайта. То есть человек, готовый поговорить, но НЕ готовый заказывать
 * пересборку, упирался в форму не про то — и уходил молча. Часть покупателей
 * не берёт услугу с документа, им нужен разговор; для них это был тупик.
 *
 * Теперь это отдельная сущность: фиксируем факт и контакт в
 * kp_generations.consult_*, менеджер получает сигнал в Telegram сразу.
 * Отдельная колонка, а не rebuild_status, потому что это другая воронка:
 * консультация может закончиться и продажей сопровождения, и ничем, но она
 * не означает согласия на пересборку.
 */
import { NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";
import { notifyKpManager } from "@/lib/kp-tg-funnel";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  await initDb();
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  // Два типа заявки из одного документа: «поговорить» (consult) и «начать
  // сопровождение» (service). Второй — главный конвертер, у него отдельная
  // форма с email и телефоном; собираем их в одну строку контакта, но тип
  // сохраняем, чтобы менеджер сразу видел, с чем к человеку идти.
  const kind = body.kind === "service" ? "service" : "consult";
  const email = String(body.email ?? "").trim().slice(0, 160);
  const phone = String(body.phone ?? "").trim().slice(0, 40);
  // Telegram — равноправный канал, а не приписка: часть аудитории не оставляет
  // почту вовсе, и требовать её значит терять готового к разговору человека.
  const telegram = String(body.telegram ?? "").trim().slice(0, 64);
  const tgNick = telegram ? (telegram.startsWith("@") ? telegram : `@${telegram}`) : "";
  const contact = kind === "service"
    ? [email, phone, tgNick].filter(Boolean).join(", ")
    : String(body.contact ?? "").trim().slice(0, 200);
  // Какой тариф/услуга заинтересовали («SEO/GEO — Рост», «SMM — дополнительно»,
  // «Разовое ускорение сайта»). Поле необязательное: старый клиент его не шлёт,
  // и заявка без него всё равно должна проходить — это подсказка менеджеру, а
  // не условие приёма. Строка свободная, поэтому режем длину и экранируем
  // при выводе в HTML-сообщение.
  const interest = String(body.interest ?? "").trim().slice(0, 200);

  // Контакт обязателен: заявка без способа связи — не заявка, а событие
  // аналитики, и менеджеру с ней делать нечего.
  if (contact.length < 5) {
    return NextResponse.json({ ok: false, error: "Оставьте телефон, email или ник в Telegram" }, { status: 400 });
  }

  const rows = await query<{
    id: string; company_name: string | null; url: string; client_email: string | null;
    consult_requested_at: string | null; share_token: string | null; share_password: string | null;
  }>(
    `SELECT id, company_name, url, client_email, consult_requested_at, share_token, share_password
       FROM kp_generations WHERE share_token = $1`,
    [token],
  );
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Разбор не найден" }, { status: 404 });

  // Повторное нажатие — не новая заявка: обновляем контакт, но менеджера
  // дёргаем один раз, чтобы кнопка не превращалась в спам-пушку.
  const firstTime = !r.consult_requested_at;
  await query(
    `UPDATE kp_generations
        SET consult_requested_at = COALESCE(consult_requested_at, NOW()),
            consult_contact = $2,
            consult_kind = $3,
            client_email = COALESCE(client_email, $4),
            client_phone = COALESCE(client_phone, $5),
            client_tg_nick = COALESCE(client_tg_nick, $6),
            -- Интерес перезаписываем непустым значением: человек мог сначала
            -- нажать «поговорить», а потом вернуться и выбрать тариф. Пустой
            -- повтор не должен стирать то, что уже было указано.
            consult_interest = COALESCE(NULLIF($7, ''), consult_interest)
      WHERE id = $1`,
    [r.id, contact, kind, email || null, phone || null, tgNick || null, interest],
  );

  if (firstTime) {
    // Ссылку на КП добавляет notifyKpManager — менеджер должен открыть тот же
    // документ, что читал клиент, а не искать его по названию компании.
    const interestLine = interest ? `Интересует: <b>${esc(interest)}</b>\n` : "";
    await notifyKpManager(
      kind === "service"
        ? `🔥 <b>Заявка на сопровождение из разбора</b>\n` +
          `${esc(r.company_name || r.url)} — ${esc(r.url)}\n` +
          `Контакт: <b>${esc(contact)}</b>\n` +
          interestLine +
          `Человек дочитал разбор и просит начать работу. Самый горячий тип заявки — отвечать первым делом.`
        : `📞 <b>Запрос консультации из разбора</b>\n` +
          `${esc(r.company_name || r.url)} — ${esc(r.url)}\n` +
          `Контакт: <b>${esc(contact)}</b>\n` +
          interestLine +
          `${r.client_email ? `Email лида: ${esc(r.client_email)}\n` : ""}` +
          `Человек прочитал разбор и хочет поговорить — это тёплый контакт, не заявка на пересборку.`,
      { shareToken: r.share_token, sharePassword: r.share_password },
    );
  }

  // Подтверждение клиенту. Без него человек, оставивший заявку, не получал
  // ни одного следа: экран «принято» закрывается — и всё, вспомнить, куда и
  // кому он написал, не по чему. Письмо решает и обратную задачу: у него
  // появляется ветка переписки, в которую можно просто ответить.
  if (firstTime && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const name = r.company_name || r.url;
    try {
      await sendMail({
        to: email,
        subject: kind === "service" ? `Заявка по ${name} принята` : `Запрос консультации по ${name} принят`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px">
<p>Получили вашу заявку по <b>${esc(name)}</b>.</p>
<p>Что дальше: разберём ваш случай и свяжемся в течение рабочего дня — с планом на первый месяц
и точной суммой, без общих слов. Ни звонков-догонялок, ни автодозвона.</p>
<p>Если что-то нужно уточнить или добавить — просто ответьте на это письмо.</p>
<p style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
MarketRadar · <a href="https://marketradar24.ru" style="color:#4f46e5">marketradar24.ru</a>
</p></div>`,
      });
    } catch (e) {
      // Заявка уже сохранена и менеджер уведомлён — сбой почты не повод
      // возвращать человеку ошибку.
      console.warn("[consult] подтверждение не ушло", r.id, String(e).slice(0, 120));
    }
  }

  return NextResponse.json({ ok: true });
}
