import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, initDb } from "@/lib/db";
import { signToken, setTokenCookie } from "@/lib/auth";
import { checkPasswordAttempts, resetPasswordAttempts, rateLimitHeaders } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

interface UserRow { id: string; email: string; password_hash: string; name: string | null; role: string; }

export async function POST(req: Request) {
  try {
    await initDb();
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Введите email и пароль" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("x-real-ip")
      || "unknown";

    // Rate limit: 5 failed attempts per IP/email → 15 min block
    const attemptKey = `${ip}:${email.toLowerCase()}`;
    const rateCheck = checkPasswordAttempts(attemptKey);
    if (!rateCheck.allowed) {
      const minutesLeft = rateCheck.retryAfterMs ? Math.ceil(rateCheck.retryAfterMs / 60000) : 15;
      return NextResponse.json(
        { ok: false, error: `Слишком много попыток. Попробуйте через ${minutesLeft} мин.` },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const rows = await query<UserRow>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ ok: false, error: "Неверный email или пароль" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Log failed attempt (counter already incremented by checkPasswordAttempts)
      await logActivity({ userId: user.id, action: "error", entityType: "user", metadata: { reason: "wrong_password", ip } });
      return NextResponse.json({ ok: false, error: "Неверный email или пароль" }, { status: 401 });
    }

    // Success — reset attempt counter
    resetPasswordAttempts(attemptKey);

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    const cookie = setTokenCookie(token);
    const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.cookies.set(cookie.name, cookie.value, cookie.options as any);

    // Audit log
    await logActivity({ userId: user.id, action: "login", entityType: "user", entityId: user.id, ipAddress: ip, userAgent: req.headers.get("user-agent") });

    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
