import { NextResponse } from "next/server";
import { kpManagerPassword, signKpManagerToken, kpManagerCookie, isKpManager } from "@/lib/kp-manager-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// GET — проверка текущей сессии менеджера (для гидрации страницы).
export async function GET() {
  return NextResponse.json({ ok: true, authed: await isKpManager() });
}

// POST { password } — вход менеджера. Пароль сверяется на сервере.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  // Защита от перебора: 10 попыток на IP за 15 минут, затем блок.
  const rl = checkRateLimit(ip, { keyPrefix: "kp-login", maxRequests: 10, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Слишком много попыток. Подождите 15 минут." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (password !== kpManagerPassword()) {
    return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
  }

  const token = await signKpManagerToken();
  const c = kpManagerCookie(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
