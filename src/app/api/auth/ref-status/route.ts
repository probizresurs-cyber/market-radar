import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, initDb } from "@/lib/db";

export const runtime = "nodejs";

// Lets the /register page know whether the current visitor is on a referral
// link — the cookie is httpOnly, so the client can't read it directly. When
// referral is active, the register form requires a company name.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const refCode = cookieStore.get("mr_ref")?.value;

    if (!refCode) {
      return NextResponse.json({ ok: true, hasReferral: false });
    }

    await initDb();
    // Look up the link so we can surface its display name (e.g. "Партнёрка
    // Иванова") and confirm it's still usable. Expired / capped / inactive
    // links fall back to a normal signup (no company requirement).
    const rows = await query<{
      code: string; name: string;
      is_active: boolean; valid_to: string | null;
      max_uses: number | null; used_count: number;
    }>(
      `SELECT code, name, is_active, valid_to, max_uses, used_count
         FROM referral_links WHERE code = $1`,
      [refCode.toUpperCase()],
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, hasReferral: false });
    }
    const link = rows[0];
    const notExpired = !link.valid_to || new Date(link.valid_to).getTime() > Date.now();
    const underCap = link.max_uses == null || link.used_count < link.max_uses;
    const usable = link.is_active && notExpired && underCap;

    return NextResponse.json({
      ok: true,
      hasReferral: usable,
      code: usable ? link.code : null,
      name: usable ? link.name : null,
    });
  } catch (e) {
    console.error("ref-status error", e);
    return NextResponse.json({ ok: false, hasReferral: false }, { status: 500 });
  }
}
