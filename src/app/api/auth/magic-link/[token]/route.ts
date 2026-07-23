/**
 * GET /api/auth/magic-link/<token>
 *
 * Редим одноразовой ссылки входа (см. src/lib/magic-link.ts,
 * POST /api/kp-generate/<id>/magic-link). Публичный эндпоинт — сам токен и
 * есть аутентификация. Переход по ссылке = акт согласия клиента, поэтому
 * consent_accepted_at/consent_ip фиксируются здесь, а не при выдаче ссылки.
 *
 * Успех → ставит обычную сессионную JWT-куку (как логин) и редиректит на "/".
 * Провал (просрочен/уже использован/не найден) → редирект на /login с флагом
 * для дружелюбного сообщения.
 */
import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { signToken, setTokenCookie } from "@/lib/auth";
import { consumeMagicLink } from "@/lib/magic-link";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  await initDb();
  const { token } = await ctx.params;
  const origin = new URL(req.url).origin;

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    return NextResponse.redirect(`${origin}/login?magicLinkError=1`);
  }

  const rows = await query<{ id: string; email: string; role: string; consent_accepted_at: string | null }>(
    `SELECT id, email, role, consent_accepted_at FROM users WHERE id = $1`,
    [consumed.userId],
  );
  const user = rows[0];
  if (!user) {
    return NextResponse.redirect(`${origin}/login?magicLinkError=1`);
  }

  if (!user.consent_accepted_at) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
    await query(`UPDATE users SET consent_accepted_at = NOW(), consent_ip = COALESCE(consent_ip, $2) WHERE id = $1`, [user.id, ip]);
  }

  const jwt = await signToken({ userId: user.id, email: user.email, role: user.role });
  const cookie = setTokenCookie(jwt);
  const res = NextResponse.redirect(`${origin}/`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.cookies.set(cookie.name, cookie.value, cookie.options as any);
  return res;
}
