/**
 * GET /api/kp-sozdavaya-check
 *
 * Говорит /kp-sozdavaya, залогинен ли сейчас именно выделенный аккаунт
 * этого клиента — без раскрытия его email в клиентском бандле/публичном
 * репозитории. Реальный email сравнивается ТОЛЬКО на сервере, из
 * переменной окружения SOZDAVAYA_ACCOUNT_EMAIL (задаётся в .env.local на
 * проде, не коммитится). Если переменная не задана — всегда false, а не
 * ошибка: страница просто продолжит искать профиль по имени, как раньше.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser().catch(() => null);
  const target = process.env.SOZDAVAYA_ACCOUNT_EMAIL;
  const isSozdavayaAccount = !!session && !!target && session.email.toLowerCase() === target.toLowerCase();
  return NextResponse.json({ ok: true, isSozdavayaAccount });
}
