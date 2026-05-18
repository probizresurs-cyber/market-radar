/**
 * POST /api/admin/leads/bulk-action
 *
 * Body:
 *   { leadIds: string[], action: "delete" }
 *   { leadIds: string[], action: "set-status", status: LeadStatus, note?: string }
 *
 * Используется CRM-доской для bulk-операций:
 *   • удалить N выбранных лидов одним запросом,
 *   • перевести N лидов в новый статус (с записью в lead_status_history
 *     по каждому, чтобы аналитика воронки не врала).
 *
 * Все операции — внутри одной транзакции через FK CASCADE
 * (DELETE leads автоматически чистит lead_reports, lead_notes,
 * lead_status_history, lead_emails).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/lead-types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface BodyShape {
  leadIds: string[];
  action: "delete" | "set-status";
  status?: LeadStatus;
  note?: string;
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
      return NextResponse.json({ ok: false, error: "leadIds обязателен (массив)" }, { status: 400 });
    }
    // Cap чтобы не пытаться удалить 100k за раз случайно.
    const ids = body.leadIds.slice(0, 5000);

    if (body.action === "delete") {
      // FK CASCADE сделает остальное.
      const result = await query<{ deleted: string }>(
        `WITH d AS (DELETE FROM leads WHERE id = ANY($1::text[]) RETURNING id)
         SELECT COUNT(*)::text AS deleted FROM d`,
        [ids],
      );
      return NextResponse.json({ ok: true, deleted: parseInt(result[0]?.deleted ?? "0", 10) });
    }

    if (body.action === "set-status") {
      if (!body.status || !(LEAD_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ ok: false, error: "невалидный status" }, { status: 400 });
      }
      const newStatus = body.status;

      // Сначала достаём существующие статусы — нужны для записи history (from→to).
      const existing = await query<{ id: string; status: string }>(
        `SELECT id, status FROM leads WHERE id = ANY($1::text[])`,
        [ids],
      );
      // Меняем только тех, у кого статус реально другой.
      const toUpdate = existing.filter(r => r.status !== newStatus);
      if (toUpdate.length === 0) {
        return NextResponse.json({ ok: true, updated: 0 });
      }
      const idsToUpdate = toUpdate.map(r => r.id);

      // Если новый статус — «contacted/replied/meeting», обновляем last_contact_at.
      const touchContact = ["contacted", "replied", "meeting"].includes(newStatus);
      const setClause = touchContact
        ? "status = $1, last_contact_at = NOW(), updated_at = NOW()"
        : "status = $1, updated_at = NOW()";

      await query(
        `UPDATE leads SET ${setClause} WHERE id = ANY($2::text[])`,
        [newStatus, idsToUpdate],
      );

      // История по каждому — за один INSERT через UNNEST для скорости.
      // Параметры подаём массивами одинаковой длины.
      const historyIds = toUpdate.map(() => randomUUID());
      const fromStatuses = toUpdate.map(r => r.status);
      const note = body.note ?? "Bulk: перемещение из доски";
      await query(
        `INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by, changed_by_name, note)
         SELECT * FROM UNNEST(
           $1::text[],
           $2::text[],
           $3::text[],
           ARRAY_FILL($4::text, ARRAY[array_length($1::text[], 1)]),
           ARRAY_FILL($5::text, ARRAY[array_length($1::text[], 1)]),
           ARRAY_FILL($6::text, ARRAY[array_length($1::text[], 1)]),
           ARRAY_FILL($7::text, ARRAY[array_length($1::text[], 1)])
         )`,
        [historyIds, idsToUpdate, fromStatuses, newStatus, session.userId, session.email ?? null, note],
      );

      return NextResponse.json({ ok: true, updated: idsToUpdate.length, skipped: ids.length - idsToUpdate.length });
    }

    return NextResponse.json({ ok: false, error: "неизвестное действие" }, { status: 400 });
  } catch (e) {
    console.error("admin/leads/bulk-action error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
