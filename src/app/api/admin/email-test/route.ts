/**
 * Админ-эндпоинт для теста SMTP.
 *
 * GET  /api/admin/email-test                  — verify TCP+TLS+AUTH для всех 3 аккаунтов
 * POST /api/admin/email-test  { to, account } — отправить тестовое письмо
 *
 * Доступ: только role=admin.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendMail, verifyMailAccount, type MailAccount } from "@/lib/mailer";
import { testEmail } from "@/lib/email-templates";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const accounts: MailAccount[] = ["noreply", "billing", "hello"];
  const results: Record<string, { ok: boolean; error?: string }> = {};
  for (const a of accounts) {
    results[a] = await verifyMailAccount(a);
  }
  return NextResponse.json({ ok: true, accounts: results });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body.to ?? "").trim();
  const account = (body.account ?? "noreply") as MailAccount;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Не указан или некорректен email" }, { status: 400 });
  }
  if (!["noreply", "billing", "hello"].includes(account)) {
    return NextResponse.json({ ok: false, error: "Неизвестный аккаунт" }, { status: 400 });
  }

  const tmpl = testEmail({ account });
  const result = await sendMail({
    ...tmpl,
    to,
    from: account,
  });

  return NextResponse.json(result);
}
