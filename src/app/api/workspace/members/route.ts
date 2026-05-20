/**
 * GET    /api/workspace/members                 — список членов + pending invites
 * PATCH  /api/workspace/members  { memberId, role }    — сменить роль члена
 * DELETE /api/workspace/members?memberId=X      — убрать члена
 *
 * Все операции — только в собственной workspace (session.userId = workspaceId).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listMembers,
  listPendingInvites,
  removeMember,
  updateMemberRole,
} from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const [members, pendingInvites] = await Promise.all([
      listMembers(session.userId),
      listPendingInvites(session.userId),
    ]);
    return NextResponse.json({ ok: true, members, pendingInvites });
  } catch (err) {
    console.error("[workspace/members] list error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const body = await req.json() as { memberId?: string; role?: "editor" | "viewer" };
    const memberId = (body.memberId ?? "").trim();
    const role = body.role;
    if (!memberId) return NextResponse.json({ ok: false, error: "memberId обязателен" }, { status: 400 });
    if (role !== "editor" && role !== "viewer") {
      return NextResponse.json({ ok: false, error: "Роль должна быть editor или viewer" }, { status: 400 });
    }

    await updateMemberRole(session.userId, memberId, role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[workspace/members] patch error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ ok: false, error: "memberId обязателен" }, { status: 400 });

  try {
    await removeMember(session.userId, memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[workspace/members] delete error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
