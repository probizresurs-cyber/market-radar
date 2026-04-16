import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query, initDb } from "@/lib/db";
import { signToken, setTokenCookie } from "@/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await initDb();
    const { name, email, password } = await req.json();
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Некорректные данные" }, { status: 400 });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "Email уже зарегистрирован" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    await query(
      "INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)",
      [id, email.toLowerCase(), passwordHash, name ?? null, "user"]
    );

    // ─── Partner attribution (First-Touch) ──────────────────────────────────
    const cookieStore = await cookies();
    const refCode = cookieStore.get("mr_ref")?.value;
    const refTs = cookieStore.get("mr_ref_ts")?.value;

    if (refCode) {
      // Find active partner by referral_code
      const partnerRows = await query<{ id: string }>(
        "SELECT id FROM partners WHERE referral_code = $1 AND status = 'active'",
        [refCode]
      );
      if (partnerRows.length > 0) {
        const partnerId = partnerRows[0].id;
        await query(
          `INSERT INTO partner_clients (id, partner_id, client_user_id, attributed_at, cookie_set_at)
           VALUES ($1, $2, $3, NOW(), $4)
           ON CONFLICT (client_user_id) DO NOTHING`,
          [
            randomUUID(),
            partnerId,
            id,
            refTs ? new Date(Number(refTs)).toISOString() : null,
          ]
        );
      }
    }

    const token = await signToken({ userId: id, email: email.toLowerCase(), role: "user" });
    const cookie = setTokenCookie(token);
    const res = NextResponse.json({ ok: true, user: { id, name, email: email.toLowerCase(), role: "user" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(cookie.name, cookie.value, cookie.options as any);

    // Clear referral cookies after attribution
    if (refCode) {
      res.cookies.set("mr_ref", "", { maxAge: 0, path: "/" });
      res.cookies.set("mr_ref_ts", "", { maxAge: 0, path: "/" });
    }

    return res;
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
