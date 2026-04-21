import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface WaitlistRow {
  id: string;
  feature_id: string;
  user_id: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  feature_label: string;
}

export async function GET(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const url = new URL(req.url);
    const featureId = url.searchParams.get("feature") || null;

    const rows = await query<WaitlistRow>(
      `SELECT w.id, w.feature_id, w.user_id, w.email, w.note, w.created_at,
              u.email AS user_email, u.name AS user_name,
              f.label AS feature_label
         FROM feature_waitlist w
         LEFT JOIN users u    ON u.id = w.user_id
         LEFT JOIN features f ON f.id = w.feature_id
        WHERE ($1::text IS NULL OR w.feature_id = $1)
        ORDER BY w.created_at DESC
        LIMIT 500`,
      [featureId]
    );
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    console.error("admin/features/waitlist error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
