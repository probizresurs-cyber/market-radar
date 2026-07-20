import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Лёгкий гейт для менеджерских страниц /kp-ru и /kp-de.
 * Это НЕ полноценные аккаунты — общий пароль команды (env KP_MANAGER_PASSWORD,
 * по умолчанию "Radar"). После ввода ставим подписанную куку (jose, тот же
 * JWT_SECRET, что у основной авторизации). Пароль сверяется ТОЛЬКО на сервере —
 * в клиент он никогда не уходит.
 */

const RAW_SECRET = process.env.JWT_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("JWT_SECRET is required in production."); })()
    : "mr_dev_only_fallback_DO_NOT_USE_IN_PROD");
const SECRET = new TextEncoder().encode(RAW_SECRET);
const COOKIE_NAME = "kp_manager";

export function kpManagerPassword(): string {
  return process.env.KP_MANAGER_PASSWORD || "Radar";
}

export async function signKpManagerToken(): Promise<string> {
  return new SignJWT({ role: "kp-manager" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function isKpManager(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.role === "kp-manager";
  } catch {
    return false;
  }
}

export function kpManagerCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    },
  };
}

export const KP_MANAGER_COOKIE = COOKIE_NAME;
