/**
 * POST /api/workspace/accept  { code }
 * GET  /api/workspace/accept?code=X — превью приглашения (без принятия)
 *
 * Принять приглашение и стать членом workspace'а владельца.
 * Email из сессии должен совпадать с email из инвайта.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { acceptInvite, getInviteByCode } from "@/lib/workspace";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ ok: false, error: "Код обязателен" }, { status: 400 });

  try {
    const invite = await getInviteByCode(code);
    if (!invite) return NextResponse.json({ ok: false, error: "Приглашение не найдено" }, { status: 404 });

    // Получаем имя workspace для UI «вас приглашает в Y»
    const ownerInfo = await query<{ email: string; name: string | null; company_name: string | null }>(
      `SELECT email, name, company_name FROM users WHERE id = $1`,
      [invite.workspaceId],
    );
    const owner = ownerInfo[0];
    return NextResponse.json({
      ok: true,
      invite: {
        ...invite,
        ownerEmail: owner?.email,
        ownerName: owner?.name,
        workspaceName: owner?.company_name || owner?.name || owner?.email,
      },
    });
  } catch (err) {
    console.error("[workspace/accept] preview error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Сначала войдите в свой аккаунт" }, { status: 401 });
  }

  try {
    const body = await req.json() as { code?: string };
    const code = (body.code ?? "").trim();
    if (!code) return NextResponse.json({ ok: false, error: "Код приглашения обязателен" }, { status: 400 });

    const result = await acceptInvite(code, session.userId, session.email);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[workspace/accept] error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 400 });
  }
}
