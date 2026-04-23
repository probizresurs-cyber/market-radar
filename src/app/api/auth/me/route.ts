import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  company_name: string | null;
  website: string | null;
  phone: string | null;
  telegram: string | null;
}

export async function GET() {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, user: null });

    const rows = await query<UserRow>(
      "SELECT id, email, name, role, company_name, website, phone, telegram FROM users WHERE id = $1",
      [session.userId],
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ ok: false, user: null });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyName: user.company_name,
        website: user.website,
        phone: user.phone,
        telegram: user.telegram,
      },
    });
  } catch (e) {
    console.error("me error", e);
    return NextResponse.json({ ok: false, user: null });
  }
}
