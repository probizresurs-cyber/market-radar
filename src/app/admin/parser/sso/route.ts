/**
 * Сквозной вход в парсер из админки: под админ-сессией MR выписываем валидную
 * cookie сессии парсера (mpr_session, та же HMAC-схема + общий SESSION_SECRET)
 * и редиректим в /parser. Парсер видит сессию — второй логин не нужен.
 * Env: PARSER_SESSION_SECRET (= SESSION_SECRET парсера), PARSER_ADMIN_LOGIN (по умолч. admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 24 * 7;

function parserSessionCookie(): string | null {
  const secret = process.env.PARSER_SESSION_SECRET;
  if (!secret) return null;
  const login = process.env.PARSER_ADMIN_LOGIN || "admin";
  const payload = Buffer.from(JSON.stringify({ login, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `mpr_session=${payload}.${sig}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export async function GET(req: NextRequest) {
  const u = await getSessionUser();
  if (!u || u.role !== "admin") return NextResponse.redirect(new URL("/admin/login", req.url));
  const cookie = parserSessionCookie();
  if (!cookie) return new NextResponse("PARSER_SESSION_SECRET не задан на сервере MarketRadar", { status: 500 });
  const res = NextResponse.redirect(new URL("/parser", req.url));
  res.headers.append("Set-Cookie", cookie);
  return res;
}
