/**
 * GET /api/workspace/list
 *
 * Возвращает все workspace'ы, к которым у текущего юзера есть доступ:
 * собственная (owner) + те куда он приглашён (editor/viewer).
 * Используется при инициализации фронта для построения workspace-switcher'а.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listAccessibleWorkspaces } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

  try {
    const workspaces = await listAccessibleWorkspaces(session.userId);
    return NextResponse.json({ ok: true, workspaces });
  } catch (err) {
    console.error("[workspace/list] error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
