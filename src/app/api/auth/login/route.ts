import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, initDb } from "@/lib/db";
import { signToken, setTokenCookie } from "@/lib/auth";

export const runtime = "nodejs";

interface UserRow { id: string; email: string; password_hash: string; name: string | null; role: string; }

export async function POST(req: Request) {
  try {
    await initDb();
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Введите email и пароль" }, { status: 400 });
    }

    const rows = await query<UserRow>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ ok: false, error: "Неверный email или пароль" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Неверный email или пароль" }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    const cookie = setTokenCookie(token);
    const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(cookie.name, cookie.value, cookie.options as any);
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
