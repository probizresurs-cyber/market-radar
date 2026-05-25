import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// КРИТИЧНО: НЕ оставляем fallback на public-строку. Если JWT_SECRET
// случайно отвалится при деплое (например забыли пробросить .env), мы
// должны падать громко на boot'е, а НЕ начать подписывать токены публично
// известной строкой — иначе любой, кто прочитает репо, форжит admin-токен.
// В dev допускаем fallback (NODE_ENV=development), на проде — throw.
const RAW_SECRET = process.env.JWT_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("JWT_SECRET is required in production. Set it in .env before starting the server."); })()
    : "mr_dev_only_fallback_DO_NOT_USE_IN_PROD");

const JWT_SECRET = new TextEncoder().encode(RAW_SECRET);
const COOKIE_NAME = "mr_token";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setTokenCookie(token: string): { name: string; value: string; options: object } {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    },
  };
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
