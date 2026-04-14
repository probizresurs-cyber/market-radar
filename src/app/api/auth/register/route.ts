import { NextResponse } from "next/server";
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

    const token = await signToken({ userId: id, email: email.toLowerCase(), role: "user" });
    const cookie = setTokenCookie(token);
    const res = NextResponse.json({ ok: true, user: { id, name, email: email.toLowerCase(), role: "user" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(cookie.name, cookie.value, cookie.options as any);
    return res;
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
