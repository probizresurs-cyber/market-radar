/**
 * POST /api/admin/leads/[id]/enrich
 *
 * Скрейпит сайт лида (главная + контактные страницы), находит email/телефоны
 * и опционально (когда withAI=true в body) имена контактных лиц через Haiku.
 *
 * Стратегия обновления:
 *   • email — заполняется только если у лида он сейчас пустой (НЕ перетираем
 *     ручные правки CRM-менеджера). Берётся первый найденный с приоритетом
 *     email на домене сайта.
 *   • phone — то же самое.
 *   • contact_person_name — то же. Берём первого из persons.
 *
 * Возвращает: { ok, found: {emails, phones, persons}, applied: {field: oldValue}, pagesScanned }
 * чтобы UI мог показать «нашли X, применили Y».
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { enrichLeadContacts } from "@/lib/lead-enricher";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Params {
  params: Promise<{ id: string }>;
}

interface LeadRow {
  id: string;
  domain: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_person_name: string | null;
}

export async function POST(req: Request, { params }: Params) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { withAI?: boolean };

    const rows = await query<LeadRow>(
      `SELECT id, domain, contact_email, contact_phone, contact_person_name FROM leads WHERE id = $1`,
      [id],
    );
    if (!rows.length) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
    const lead = rows[0];

    const found = await enrichLeadContacts(lead.domain, { withAI: body.withAI !== false });

    // Решаем что применить: только пустые поля. Никаких overrides.
    const updates: Record<string, string> = {};
    if (!lead.contact_email && found.emails[0]) updates.contact_email = found.emails[0];
    if (!lead.contact_phone && found.phones[0]) updates.contact_phone = found.phones[0];
    if (!lead.contact_person_name && found.persons[0]?.name) updates.contact_person_name = found.persons[0].name;

    if (Object.keys(updates).length > 0) {
      const keys = Object.keys(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
      const values = keys.map(k => updates[k]);
      await query(
        `UPDATE leads SET ${setClauses}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
        [...values, id],
      );
    }

    return NextResponse.json({
      ok: true,
      found,
      applied: updates,            // что записали в БД (с какими значениями)
      skipped: {                   // что нашли но не применили — уже было
        contact_email: !!lead.contact_email && found.emails.length > 0,
        contact_phone: !!lead.contact_phone && found.phones.length > 0,
        contact_person_name: !!lead.contact_person_name && found.persons.length > 0,
      },
    });
  } catch (e) {
    console.error("leads/[id]/enrich error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
