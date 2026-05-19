/**
 * POST /api/admin/leads/enrich-batch
 *
 * Bulk-обогащение контактами. Тот же API что generate-batch: UI вызывает
 * нас в цикле, мы возвращаем партию из N лидов с найденными контактами и
 * сколько осталось. UI продолжает пока remaining > 0.
 *
 * Body: { leadIds?: string[], limit?: number, withAI?: boolean }
 *   - leadIds — конкретные лиды (если хочется обогатить только выбранные)
 *   - limit — сколько брать если leadIds не задан. Default 10
 *   - withAI — задействовать ли Haiku для извлечения имён. Default true
 *
 * Берёт только лидов где хоть одно поле пусто (contact_email / phone / person).
 * Лиды у которых все три заполнены — пропускаются (нечего обогащать).
 *
 * Concurrency=5: каждый enrich = 6-8 параллельных fetch'ей сайтов + опц AI.
 * На партию из 5 — ~10 секунд, на 100 лидов ≈ 3-4 минуты.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { enrichLeadContacts } from "@/lib/lead-enricher";

export const runtime = "nodejs";
export const maxDuration = 90;

const BATCH_SIZE = parseInt(process.env.ENRICH_BATCH_SIZE ?? "10", 10);
const CONCURRENCY = parseInt(process.env.ENRICH_CONCURRENCY ?? "5", 10);

interface BodyShape {
  leadIds?: string[];
  limit?: number;
  withAI?: boolean;
}

interface LeadRow {
  id: string;
  domain: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_person_name: string | null;
}

async function enrichOne(lead: LeadRow, withAI: boolean): Promise<{ leadId: string; domain: string; applied: Record<string, string>; foundCount: number; error?: string }> {
  try {
    const found = await enrichLeadContacts(lead.domain, { withAI });
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
        [...values, lead.id],
      );
    }
    return {
      leadId: lead.id,
      domain: lead.domain,
      applied: updates,
      foundCount: found.emails.length + found.phones.length + found.persons.length,
    };
  } catch (e) {
    return {
      leadId: lead.id,
      domain: lead.domain,
      applied: {},
      foundCount: 0,
      error: e instanceof Error ? e.message : "error",
    };
  }
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
    const withAI = body.withAI !== false;

    let targets: LeadRow[];
    if (body.leadIds && body.leadIds.length > 0) {
      const ids = body.leadIds.slice(0, 50);
      targets = await query<LeadRow>(
        `SELECT id, domain, contact_email, contact_phone, contact_person_name
           FROM leads WHERE id = ANY($1::text[])`,
        [ids],
      );
    } else {
      const limit = Math.min(body.limit ?? BATCH_SIZE, 50);
      targets = await query<LeadRow>(
        `SELECT id, domain, contact_email, contact_phone, contact_person_name
           FROM leads
          WHERE (contact_email IS NULL OR contact_phone IS NULL OR contact_person_name IS NULL)
          ORDER BY created_at ASC
          LIMIT $1`,
        [limit],
      );
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        results: [],
        remaining: 0,
        message: "Все лиды уже имеют контакты",
      });
    }

    // Обрабатываем чанками с CONCURRENCY параллельных вызовов
    const results: Array<{ leadId: string; domain: string; applied: Record<string, string>; foundCount: number; error?: string }> = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const chunk = targets.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(l => enrichOne(l, withAI)));
      results.push(...chunkResults);
    }

    // Сколько лидов с пустыми контактами осталось — UI поймёт продолжать ли цикл
    const remainingRows = await query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM leads
        WHERE (contact_email IS NULL OR contact_phone IS NULL OR contact_person_name IS NULL)`,
    );
    const remaining = parseInt(remainingRows[0]?.cnt ?? "0", 10);

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
      remaining,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("admin/leads/enrich-batch error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка сервера" }, { status: 500 });
  }
}
