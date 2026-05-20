/**
 * POST  /api/workspace/invite           — создать приглашение и отправить email
 * DELETE /api/workspace/invite?code=X   — отозвать приглашение
 *
 * Только owner workspace'а может приглашать. workspace_id берётся из сессии
 * (= собственный userId владельца).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createInvite, revokeInvite } from "@/lib/workspace";
import { sendMail } from "@/lib/mailer";
import { query } from "@/lib/db";

export const runtime = "nodejs";

function siteUrl(req: NextRequest): string {
  // Приоритет: env override > заголовки запроса > fallback.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "company24.pro";
  return `${proto}://${host}`;
}

function inviteEmailHtml(params: {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  role: "editor" | "viewer";
  acceptUrl: string;
}): string {
  const roleLabel = params.role === "editor" ? "редактор" : "наблюдатель";
  const roleDesc = params.role === "editor"
    ? "Вы сможете запускать анализы, генерировать контент и редактировать дашборд."
    : "У вас будет доступ к данным для просмотра — без возможности изменений.";

  return `
<div style="font-family: -apple-system,Segoe UI,Roboto,sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
  <div style="padding: 32px 20px; background: linear-gradient(135deg,#1e293b,#334155); border-radius: 14px 14px 0 0; text-align: center;">
    <div style="color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">MarketRadar</div>
    <div style="color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px;">Вас пригласили в команду</div>
  </div>
  <div style="background: #fff; padding: 32px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 14px 14px;">
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      <b>${escapeHtml(params.inviterName || params.inviterEmail)}</b> приглашает вас присоединиться
      к рабочему пространству <b>«${escapeHtml(params.workspaceName)}»</b> в роли <b>${roleLabel}</b>.
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
      ${roleDesc}
    </p>
    <a href="${params.acceptUrl}" style="display: inline-block; padding: 14px 28px; background: #6366F1; color: #fff; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 15px;">
      Принять приглашение
    </a>
    <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 24px 0 0;">
      Если кнопка не работает — скопируйте ссылку:<br>
      <span style="word-break: break-all; color: #6366F1;">${params.acceptUrl}</span>
    </p>
    <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 16px 0 0;">
      Приглашение действительно 7 дней. Если вы не ожидали это письмо — просто проигнорируйте его.
    </p>
  </div>
</div>
  `.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const body = await req.json() as { email?: string; role?: "editor" | "viewer" };
    const email = (body.email ?? "").trim();
    const role = body.role ?? "viewer";

    if (!email) return NextResponse.json({ ok: false, error: "Email обязателен" }, { status: 400 });
    if (role !== "editor" && role !== "viewer") {
      return NextResponse.json({ ok: false, error: "Роль должна быть editor или viewer" }, { status: 400 });
    }

    const workspaceId = session.userId;

    // Создаём (или возвращаем существующий) invite
    const invite = await createInvite({ workspaceId, email, role, invitedBy: session.userId });

    // Подгрузим имя инвайтера + название workspace из users
    const ownerInfo = await query<{ name: string | null; email: string; company_name: string | null }>(
      `SELECT name, email, company_name FROM users WHERE id = $1`,
      [session.userId],
    );
    const ownerRow = ownerInfo[0];
    const workspaceName = ownerRow?.company_name?.trim()
      || ownerRow?.name?.trim()
      || ownerRow?.email
      || "Команда";

    const acceptUrl = `${siteUrl(req)}/invite/${encodeURIComponent(invite.id)}`;

    // Отправляем письмо. Если SMTP не настроен — это не критично, invite в БД уже
    // создан, владельцу просто покажем ссылку чтобы он переслал вручную.
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const result = await sendMail({
        to: email,
        from: "hello",
        subject: `${ownerRow?.name || ownerRow?.email || "MarketRadar"} приглашает вас в команду`,
        html: inviteEmailHtml({
          workspaceName,
          inviterName: ownerRow?.name ?? "",
          inviterEmail: ownerRow?.email ?? session.email,
          role,
          acceptUrl,
        }),
      });
      emailSent = result.ok;
      if (!result.ok) emailError = result.error;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Не удалось отправить письмо";
    }

    return NextResponse.json({
      ok: true,
      invite: { ...invite, acceptUrl },
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error("[workspace/invite] error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ ok: false, error: "Код приглашения обязателен" }, { status: 400 });

  try {
    await revokeInvite(session.userId, code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[workspace/invite] revoke error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
