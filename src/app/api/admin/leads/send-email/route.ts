/**
 * POST /api/admin/leads/send-email
 *
 * Тело: { leadIds: string[], template: string, subject: string, fromAccount?: 'hello'|'noreply' }
 *
 * Рассылает письма выбранным лидам со ссылкой на их экспресс-отчёт.
 *
 * Плейсхолдеры в template/subject:
 *   {domain}        — me-dent.ru
 *   {company}       — Стоматология Менделеев (или domain, если company пуст)
 *   {report_url}    — https://marketradar24.ru/r/{slug}
 *   {summary}       — oneLineSummary из последнего отчёта
 *   {score}         — overallScore (число)
 *   {niche_average} — nicheAverage
 *
 * Если у лида нет contact_email — пропускаем. Если нет готового отчёта —
 * тоже пропускаем (нечего показывать в /r/{slug}).
 *
 * После успешной отправки:
 *   1) lead.last_contact_at = NOW()
 *   2) lead.status = 'contacted' (если был 'new' или 'in_progress')
 *   3) Запись в lead_status_history + автоматическая заметка о письме.
 *
 * Throttling делает sendMail (1 письмо/сек), плюс пул на 3 коннекта.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { sendMail, type MailAccount } from "@/lib/mailer";
import type { Lead, LeadReport, LeadStatus } from "@/lib/lead-types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 90;

interface BodyShape {
  leadIds: string[];
  subject: string;
  template: string;
  fromAccount?: MailAccount;
  /** Перекрытие subject/body для конкретных лидов — после ручного редактирования
   *  в админ-превью. Если ключа в perLeadOverrides нет — используется общий шаблон. */
  perLeadOverrides?: Record<string, { subject?: string; body?: string }>;
}

interface LeadWithReport extends Lead {
  report_data: LeadReport | null;
}

const PUBLIC_HOST = process.env.PUBLIC_HOST?.replace(/\/$/, "") || "https://marketradar24.ru";

function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Минимальная безопасность для HTML-вставки (защита от случайных html-тегов в шаблоне). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Конвертит plain-text шаблон с переносами в HTML с <p>+<a>.
 *  Дополнительно инжектит pixel-tracker открытия и проксирует CTA-ссылку
 *  через /api/track/click/{emailId} для замера CTR.                       */
function plainToHtml(plain: string, clickUrl: string, openPixelUrl: string): string {
  const paragraphs = plain
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      // Заменяем одиночные \n внутри параграфа на <br/>.
      const safe = escapeHtml(p).replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 14px;line-height:1.6;color:#1a1f2e;font-size:15px">${safe}</p>`;
    })
    .join("");
  return `<!doctype html>
<html lang="ru"><body style="margin:0;padding:0;background:#f5f5fa">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f5f5fa">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" style="max-width:580px;width:100%;background:#fff;border-radius:12px;padding:32px 28px;border:1px solid #e5e7eb">
        <tr><td>
          ${paragraphs}
          <div style="margin:24px 0">
            <a href="${clickUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px">Открыть экспресс-отчёт →</a>
          </div>
          <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5">
            Это автоматический аудит на основе публичных данных вашего сайта.<br/>
            Если письмо отправлено по ошибке — просто проигнорируйте.
          </p>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#94a3b8;margin-top:14px;text-align:center">
        MarketRadar24 · marketradar24.ru
      </div>
    </td></tr>
  </table>
  <!-- Pixel-tracker открытий. Часть email-клиентов прокачивает картинки через свой
       прокси (Gmail) — тогда мы увидим один открытие на адрес и фиксацию момента
       без точного IP. Этого достаточно для метрики «дошло до inbox». -->
  <img src="${openPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;opacity:0" />
</body></html>`;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as BodyShape;
    if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return NextResponse.json({ ok: false, error: "leadIds обязателен (массив)" }, { status: 400 });
    }
    if (!body.subject?.trim() || !body.template?.trim()) {
      return NextResponse.json({ ok: false, error: "subject и template обязательны" }, { status: 400 });
    }

    // Загружаем выбранных лидов + последний done-отчёт через LATERAL.
    const ids = body.leadIds.slice(0, 200); // cap на один вызов
    const rows = await query<LeadWithReport>(
      `SELECT l.*, r.data AS report_data
         FROM leads l
         LEFT JOIN LATERAL (
           SELECT data FROM lead_reports
            WHERE lead_id = l.id AND status = 'done'
            ORDER BY created_at DESC LIMIT 1
         ) r ON true
        WHERE l.id = ANY($1::text[])`,
      [ids],
    );

    const results: Array<{ leadId: string; domain: string; ok: boolean; reason?: string; messageId?: string }> = [];

    for (const lead of rows) {
      if (!lead.contact_email) {
        results.push({ leadId: lead.id, domain: lead.domain, ok: false, reason: "нет email" });
        continue;
      }
      if (!lead.report_data) {
        results.push({ leadId: lead.id, domain: lead.domain, ok: false, reason: "нет готового отчёта" });
        continue;
      }

      // Прямой URL отчёта — пойдёт в plain-text fallback (туда tracker
      // не воткнёшь). HTML-версия письма использует tracking-обёртки.
      const reportUrl = `${PUBLIC_HOST}/r/${lead.slug}`;

      // Создаём запись lead_emails ЗАРАНЕЕ, чтобы tracking-URL'ы знали свой ID.
      // Если письмо не отправится — запись осталась, но events не будет, что норм.
      const emailId = randomUUID();
      await query(
        `INSERT INTO lead_emails (id, lead_id, subject, to_email, sent_by, sent_by_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [emailId, lead.id, "", lead.contact_email, session.userId, session.email ?? null],
      );
      const clickUrl = `${PUBLIC_HOST}/api/track/click/${emailId}`;
      const openPixelUrl = `${PUBLIC_HOST}/api/track/open/${emailId}`;

      const vars = {
        domain: lead.domain,
        company: lead.company_name || lead.domain,
        // В шаблоне {report_url} = tracking-обёртка, в plain — прямая.
        report_url: clickUrl,
        summary: lead.report_data.oneLineSummary ?? "",
        score: lead.report_data.overallScore ?? 0,
        niche_average: lead.report_data.nicheAverage ?? 0,
      };

      // Сначала применяем шаблон с плейсхолдерами, потом — поверх — override
      // от админа из preview-окна (если он там что-то редактировал вручную).
      // Override НЕ перерендерится с плейсхолдерами — admin уже видел финальный
      // текст и сам решил что нужно изменить.
      const override = body.perLeadOverrides?.[lead.id];
      const subject = override?.subject ?? fillTemplate(body.subject, vars);
      const plain = override?.body ?? fillTemplate(body.template, { ...vars, report_url: reportUrl });
      const html = plainToHtml(plain, clickUrl, openPixelUrl);

      // Заполняем subject в записи теперь, когда он сформирован.
      await query(`UPDATE lead_emails SET subject = $1 WHERE id = $2`, [subject, emailId]);

      const sendRes = await sendMail({
        to: lead.contact_email,
        subject,
        html,
        text: plain + `\n\n${reportUrl}`,
        from: body.fromAccount ?? "hello",
      });

      if (sendRes.ok) {
        results.push({ leadId: lead.id, domain: lead.domain, ok: true, messageId: sendRes.messageId });
        if (sendRes.messageId) {
          await query(`UPDATE lead_emails SET message_id = $1 WHERE id = $2`, [sendRes.messageId, emailId]);
        }

        // Обновляем CRM: last_contact_at + статус → contacted (если был new/in_progress).
        const shouldUpdateStatus = lead.status === "new" || lead.status === "in_progress";
        if (shouldUpdateStatus) {
          await query(
            `UPDATE leads SET last_contact_at = NOW(), status = 'contacted', updated_at = NOW() WHERE id = $1`,
            [lead.id],
          );
          await query(
            `INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by, changed_by_name, note)
             VALUES ($1, $2, $3, 'contacted', $4, $5, $6)`,
            [randomUUID(), lead.id, lead.status, session.userId, session.email ?? null, "Авто: отправлено письмо с отчётом"],
          );
        } else {
          await query(`UPDATE leads SET last_contact_at = NOW(), updated_at = NOW() WHERE id = $1`, [lead.id]);
        }
        // Заметка о письме.
        await query(
          `INSERT INTO lead_notes (id, lead_id, author_id, author_name, body)
             VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), lead.id, session.userId, session.email ?? null, `✉️ Отправлено письмо на ${lead.contact_email}: «${subject}»`],
        );
      } else if (sendRes.skipped) {
        results.push({ leadId: lead.id, domain: lead.domain, ok: false, reason: `SMTP отключён: ${sendRes.error ?? ""}` });
      } else {
        results.push({ leadId: lead.id, domain: lead.domain, ok: false, reason: sendRes.error ?? "send failed" });
      }
    }

    const sent = results.filter(r => r.ok).length;
    const failed = results.length - sent;

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      results,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("admin/leads/send-email error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
