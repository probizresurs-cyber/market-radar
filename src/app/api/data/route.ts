import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query, initDb } from "@/lib/db";
import { canWriteInWorkspace, getRoleInWorkspace } from "@/lib/workspace";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface DataRow { key: string; value: unknown; }

/**
 * Резолвим целевую workspace для CRUD:
 *  - если в запросе есть workspaceId — это foreign workspace, проверяем
 *    что у юзера есть нужная роль (read для GET, write для POST/DELETE).
 *  - если нет — пишем/читаем в свою собственную (= session.userId).
 */
async function resolveTargetWorkspace(
  sessionUserId: string,
  targetWorkspaceId: string | null,
  needWrite: boolean,
): Promise<{ ok: true; workspaceId: string } | { ok: false; status: number; error: string }> {
  const wsId = targetWorkspaceId || sessionUserId;
  if (wsId === sessionUserId) return { ok: true, workspaceId: wsId };

  if (needWrite) {
    const canWrite = await canWriteInWorkspace(sessionUserId, wsId);
    if (!canWrite) return { ok: false, status: 403, error: "Нет прав на запись в этот workspace" };
  } else {
    const role = await getRoleInWorkspace(sessionUserId, wsId);
    if (!role) return { ok: false, status: 403, error: "Нет доступа к workspace" };
  }
  return { ok: true, workspaceId: wsId };
}

export async function GET(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const workspaceParam = searchParams.get("workspaceId");

    const resolved = await resolveTargetWorkspace(session.userId, workspaceParam, false);
    if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });

    if (key) {
      const rows = await query<DataRow>("SELECT value FROM user_data WHERE user_id = $1 AND key = $2", [resolved.workspaceId, key]);
      return NextResponse.json({ ok: true, value: rows[0]?.value ?? null });
    }

    const rows = await query<DataRow>("SELECT key, value FROM user_data WHERE user_id = $1", [resolved.workspaceId]);
    const data: Record<string, unknown> = {};
    for (const row of rows) data[row.key] = row.value;
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("data GET error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

    const body = await req.json() as { key?: string; value?: unknown; workspaceId?: string };
    if (!body.key) return NextResponse.json({ ok: false, error: "key обязателен" }, { status: 400 });

    const resolved = await resolveTargetWorkspace(session.userId, body.workspaceId ?? null, true);
    if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });

    await query(
      `INSERT INTO user_data (id, user_id, key, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $4, updated_at = NOW()`,
      [randomUUID(), resolved.workspaceId, body.key, JSON.stringify(body.value)]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("data POST error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDb();
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const workspaceParam = searchParams.get("workspaceId");
    if (!key) return NextResponse.json({ ok: false, error: "key обязателен" }, { status: 400 });

    const resolved = await resolveTargetWorkspace(session.userId, workspaceParam, true);
    if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });

    await query("DELETE FROM user_data WHERE user_id = $1 AND key = $2", [resolved.workspaceId, key]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("data DELETE error", e);
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
