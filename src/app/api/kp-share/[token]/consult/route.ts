/**
 * POST /api/kp-share/[token]/consult { contact } — заявка на консультацию
 * прямо из разбора.
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

export const runtime = "nodejs";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  await initDb();
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const contact = String(body.contact ?? "").trim().slice(0, 200);

  // Контакт обязателен: заявка без способа связи — не заявка, а событие
  // аналитики, и менеджеру с ней делать нечего.
  if (contact.length < 5) {
    return NextResponse.json({ ok: false, error: "Оставьте телефон, email или ник в Telegram" }, { status: 400 });
  }

  const rows = await query<{ id: string; company_name: string | null; url: string; client_email: string | null; consult_requested_at: string | null }>(
    `SELECT id, company_name, url, client_email, consult_requested_at
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
            consult_contact = $2
      WHERE id = $1`,
    [r.id, contact],
  );

  if (firstTime) {
    await notifyKpManager(
      `📞 <b>Запрос консультации из разбора</b>\n` +
      `${esc(r.company_name || r.url)} — ${esc(r.url)}\n` +
      `Контакт: <b>${esc(contact)}</b>\n` +
      `${r.client_email ? `Email лида: ${esc(r.client_email)}\n` : ""}` +
      `Человек прочитал разбор и хочет поговорить — это тёплый контакт, не заявка на пересборку.`,
    );
  }

  return NextResponse.json({ ok: true });
}
