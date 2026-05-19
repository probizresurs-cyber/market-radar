/**
 * Admin Leads API
 *
 *   GET  /api/admin/leads               — список лидов (фильтры в query)
 *   POST /api/admin/leads/import        — массовый импорт из CSV (см. ./import/route.ts)
 *   PATCH /api/admin/leads/[id]         — обновление полей лида (см. ./[id]/route.ts)
 *
 * Доступ — только админу. CSV-импорт идемпотентен по domain (ON CONFLICT DO NOTHING).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { LEAD_STATUSES } from "@/lib/lead-types";

export const runtime = "nodejs";

interface LeadListRow {
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
  status: string;
  assigned_to: string | null;
  source: string | null;
  tags: string[] | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  report_status: string | null;
  report_generated_at: string | null;
  notes_count: string; // pg COUNT приходит строкой
}

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(req: Request) {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("q")?.trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 1000);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    // LATERAL для последнего отчёта на лид + counts по заметкам.
    // ORDER BY created_at DESC чтобы свежие импорты были сверху.
    const filters: string[] = [];
    const params: unknown[] = [];
    if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      filters.push(`l.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      filters.push(`(LOWER(l.domain) LIKE $${params.length} OR LOWER(COALESCE(l.company_name,'')) LIKE $${params.length} OR LOWER(COALESCE(l.contact_email,'')) LIKE $${params.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    params.push(limit, offset);
    const limitPh = `$${params.length - 1}`;
    const offsetPh = `$${params.length}`;

    const rows = await query<LeadListRow>(
      `SELECT
         l.*,
         lr.status      AS report_status,
         lr.generated_at AS report_generated_at,
         COALESCE(nc.cnt::text, '0') AS notes_count
       FROM leads l
       LEFT JOIN LATERAL (
         SELECT status, generated_at FROM lead_reports
          WHERE lead_id = l.id
          ORDER BY created_at DESC LIMIT 1
       ) lr ON true
       LEFT JOIN (
         SELECT lead_id, COUNT(*) AS cnt FROM lead_notes GROUP BY lead_id
       ) nc ON nc.lead_id = l.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ${limitPh} OFFSET ${offsetPh}`,
      params,
    );

    const totalRows = await query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM leads l ${where}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalRows[0]?.cnt ?? "0", 10);

    const statusCounts = await query<{ status: string; cnt: string }>(
      `SELECT status, COUNT(*)::text AS cnt FROM leads GROUP BY status`,
    );
    const byStatus: Record<string, number> = {};
    for (const r of statusCounts) byStatus[r.status] = parseInt(r.cnt, 10);

    return NextResponse.json({
      ok: true,
      leads: rows.map(r => ({ ...r, notes_count: parseInt(r.notes_count, 10) || 0 })),
      total,
      byStatus,
    });
  } catch (e) {
    console.error("admin/leads GET error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
