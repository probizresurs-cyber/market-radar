import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface UserRow { id: string; email: string; name: string | null; role: string; }

export async function GET() {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, user: null });

    const rows = await query<UserRow>("SELECT id, email, name, role FROM users WHERE id = $1", [session.userId]);
    const user = rows[0];
    if (!user) return NextResponse.json({ ok: false, user: null });

    return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error("me error", e);
    return NextResponse.json({ ok: false, user: null });
  }
}
