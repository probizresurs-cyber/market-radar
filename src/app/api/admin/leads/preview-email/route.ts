/**
 * POST /api/admin/leads/preview-email
 *
 * Body: { leadIds: string[], subject: string, template: string }
 *
 * Возвращает массив того, что РЕАЛЬНО получит каждый лид после подстановки
 * плейсхолдеров (но БЕЗ отправки). Это нужно админу чтобы:
 *   1. Увидеть как будет выглядеть письмо для конкретного получателя
 *   2. Отредактировать subject/body индивидуально перед массовой рассылкой
 *   3. Понять кому НЕ уйдёт (нет email / нет отчёта)
 *
 * Возврат:
 *   {
 *     ok: true,
 *     previews: [
 *       { leadId, domain, email, subject, body, canSend: true },
 *       { leadId, domain, email: null, canSend: false, reason: "нет email" }
 *     ]
 *   }
 *
 * После просмотра админ может отредактировать subject/body для конкретных лидов
 * и отправить через POST /send-email с `perLeadOverrides` (см. отдельный коммит).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import type { Lead, LeadReport } from "@/lib/lead-types";

export const runtime = "nodejs";

interface BodyShape {
  leadIds: string[];
  subject: string;
  template: string;
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

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as BodyShape;
    if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return NextResponse.json({ ok: false, error: "leadIds обязателен" }, { status: 400 });
    }

    const ids = body.leadIds.slice(0, 200);
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

    const previews = rows.map(lead => {
      const reportUrl = `${PUBLIC_HOST}/r/${lead.slug}`;
      const vars = {
        domain: lead.domain,
        company: lead.company_name || lead.domain,
        report_url: reportUrl,
        summary: lead.report_data?.oneLineSummary ?? "",
        score: lead.report_data?.overallScore ?? 0,
        niche_average: lead.report_data?.nicheAverage ?? 0,
      };
      const renderedSubject = fillTemplate(body.subject, vars);
      const renderedBody = fillTemplate(body.template, vars);

      if (!lead.contact_email) {
        return {
          leadId: lead.id,
          domain: lead.domain,
          companyName: lead.company_name,
          email: null,
          subject: renderedSubject,
          body: renderedBody,
          canSend: false,
          reason: "нет email",
        };
      }
      if (!lead.report_data) {
        return {
          leadId: lead.id,
          domain: lead.domain,
          companyName: lead.company_name,
          email: lead.contact_email,
          subject: renderedSubject,
          body: renderedBody,
          canSend: false,
          reason: "нет готового отчёта",
        };
      }
      return {
        leadId: lead.id,
        domain: lead.domain,
        companyName: lead.company_name,
        email: lead.contact_email,
        subject: renderedSubject,
        body: renderedBody,
        reportUrl,
        canSend: true,
      };
    });

    return NextResponse.json({ ok: true, previews });
  } catch (e) {
    console.error("admin/leads/preview-email error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
