import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface FeatureRow {
  id: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
}

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;
  return session;
}

// GET — список всех фич + количество записей в waitlist на каждую
export async function GET() {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const rows = await query<FeatureRow & { waitlist_count: string }>(
      `SELECT f.id, f.label, f.description, f.enabled, f.sort_order, f.updated_at,
              COUNT(w.id)::text AS waitlist_count
         FROM features f
         LEFT JOIN feature_waitlist w ON w.feature_id = f.id
        GROUP BY f.id
        ORDER BY f.sort_order ASC, f.id ASC`
    );
    return NextResponse.json({
      ok: true,
      features: rows.map(r => ({
        ...r,
        waitlistCount: parseInt(r.waitlist_count, 10) || 0,
      })),
    });
  } catch (e) {
    console.error("admin/features GET error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST — toggle enabled для конкретной фичи
export async function POST(req: Request) {
  try {
    await initDb();
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { id?: string; enabled?: boolean };
    if (!body.id || typeof body.enabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "id и enabled обязательны" }, { status: 400 });
    }
    await query(
      `UPDATE features SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [body.enabled, body.id]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/features POST error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
