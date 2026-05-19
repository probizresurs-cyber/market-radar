/**
 * /api/admin/leads/[id]
 *
 *   GET    — детали лида + последний отчёт + заметки + история статусов
 *   PATCH  — обновление статуса / заметки / контактов / тегов
 *   DELETE — удалить лид (вместе с отчётами/заметками/историей через FK CASCADE)
 *
 * При смене статуса автоматически пишется запись в lead_status_history.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/lead-types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;
  return session;
}

interface LeadRow {
  id: string;
  domain: string;
  company_name: string | null;
  contact_person_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_telegram: string | null;
  city: string | null;
  niche: string | null;
  slug: string;
  status: LeadStatus;
  assigned_to: string | null;
  source: string | null;
  tags: string[] | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { id } = await params;

    const leadRows = await query<LeadRow>(`SELECT * FROM leads WHERE id = $1`, [id]);
    if (!leadRows.length) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    const reportRows = await query(
      `SELECT id, data, model, cost_cents, status, error_message, generated_at, created_at
         FROM lead_reports WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [id],
    );

    const notesRows = await query(
      `SELECT id, author_id, author_name, body, created_at
         FROM lead_notes WHERE lead_id = $1 ORDER BY created_at DESC`,
      [id],
    );

    const historyRows = await query(
      `SELECT id, from_status, to_status, changed_by, changed_by_name, note, created_at
         FROM lead_status_history WHERE lead_id = $1 ORDER BY created_at DESC`,
      [id],
    );

    const emailRows = await query(
      `SELECT id, subject, to_email, message_id, sent_at, open_count,
              first_opened_at, last_opened_at, click_count,
              first_clicked_at, last_clicked_at, sent_by_name
         FROM lead_emails WHERE lead_id = $1 ORDER BY sent_at DESC LIMIT 20`,
      [id],
    );

    return NextResponse.json({
      ok: true,
      lead: leadRows[0],
      reports: reportRows,
      notes: notesRows,
      history: historyRows,
      emails: emailRows,
    });
  } catch (e) {
    console.error("admin/leads/[id] GET error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

interface PatchBody {
  status?: LeadStatus;
  status_note?: string;
  contact_person_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_telegram?: string | null;
  company_name?: string | null;
  niche?: string | null;
  city?: string | null;
  tags?: string[] | null;
  /** Добавить заметку */
  add_note?: string;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({})) as PatchBody;

    // Сначала загрузим текущее состояние (для истории статусов и проверки существования).
    const existing = await query<LeadRow>(`SELECT * FROM leads WHERE id = $1`, [id]);
    if (!existing.length) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const lead = existing[0];

    // Собираем UPDATE из присутствующих полей. updated_at всегда обновляем.
    const updates: string[] = [];
    const values: unknown[] = [];
    function set<K extends keyof PatchBody>(field: string, value: PatchBody[K]) {
      values.push(value);
      updates.push(`${field} = $${values.length}`);
    }
    if (body.contact_person_name !== undefined) set("contact_person_name", body.contact_person_name);
    if (body.contact_email !== undefined) set("contact_email", body.contact_email);
    if (body.contact_phone !== undefined) set("contact_phone", body.contact_phone);
    if (body.contact_telegram !== undefined) set("contact_telegram", body.contact_telegram);
    if (body.company_name !== undefined) set("company_name", body.company_name);
    if (body.niche !== undefined) set("niche", body.niche);
    if (body.city !== undefined) set("city", body.city);
    if (body.tags !== undefined) set("tags", body.tags);

    let statusChanged = false;
    if (body.status && (LEAD_STATUSES as readonly string[]).includes(body.status) && body.status !== lead.status) {
      set("status", body.status);
      statusChanged = true;
      // last_contact_at обновляем при «contacted» / «replied» / «meeting» — это
      // удобно для фильтра «давно не трогали».
      if (body.status === "contacted" || body.status === "replied" || body.status === "meeting") {
        values.push(new Date().toISOString());
        updates.push(`last_contact_at = $${values.length}`);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await query(
        `UPDATE leads SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
        values,
      );
    }

    // История статусов (если меняли).
    if (statusChanged) {
      await query(
        `INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by, changed_by_name, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), id, lead.status, body.status, session.userId, session.email ?? null, body.status_note ?? null],
      );
    }

    // Заметка (если переданa).
    if (body.add_note && body.add_note.trim()) {
      await query(
        `INSERT INTO lead_notes (id, lead_id, author_id, author_name, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), id, session.userId, session.email ?? null, body.add_note.trim()],
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/leads/[id] PATCH error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { id } = await params;
    await query(`DELETE FROM leads WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/leads/[id] DELETE error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
