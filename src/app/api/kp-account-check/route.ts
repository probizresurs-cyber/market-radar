/**
 * GET /api/kp-account-check?client=<slug>
 *
 * Обобщение /api/kp-sozdavaya-check на несколько клиентских КП-страниц:
 * говорит странице /kp-<client>, залогинен ли сейчас выделенный аккаунт
 * этого клиента — без раскрытия email в клиентском бандле/репозитории.
 * Email сравнивается ТОЛЬКО на сервере из env `<CLIENT>_ACCOUNT_EMAIL`
 * (белый список ниже — произвольные env-переменные через query читать
 * нельзя). Нет переменной → false, страница ищет профиль по имени.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

const CLIENT_ENV: Record<string, string | undefined> = {
  sozdavaya: process.env.SOZDAVAYA_ACCOUNT_EMAIL,
  biglife: process.env.BIGLIFE_ACCOUNT_EMAIL,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = (searchParams.get("client") ?? "").toLowerCase();
  const target = CLIENT_ENV[client];
  const session = await getSessionUser().catch(() => null);
  const isClientAccount = !!session && !!target && session.email.toLowerCase() === target.toLowerCase();
  return NextResponse.json({ ok: true, isClientAccount });
}
