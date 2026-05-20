/**
 * GET /api/workspace/snapshot?id=<workspaceId>
 *
 * Возвращает все user_data ключи владельца workspace'а.
 * Доступно только если запрашивающий — owner / editor / viewer этой workspace.
 *
 * Фронт вызывает этот endpoint при переключении на «чужую» workspace:
 * данные не лежат в localStorage у member'а, надо подтянуть с сервера.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRoleInWorkspace, getWorkspaceSnapshot } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("id");
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: "id workspace обязателен" }, { status: 400 });
  }

  try {
    const role = await getRoleInWorkspace(session.userId, workspaceId);
    if (!role) return NextResponse.json({ ok: false, error: "Нет доступа к workspace" }, { status: 403 });

    const snapshot = await getWorkspaceSnapshot(workspaceId);
    return NextResponse.json({ ok: true, role, snapshot });
  } catch (err) {
    console.error("[workspace/snapshot] error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
