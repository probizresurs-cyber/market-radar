/**
 * GET  /api/activity-log — просмотр лога активности
 *   Пользователь видит только свои записи.
 *   Admin видит все + может фильтровать по user_id, action, entity_type.
 *
 * POST /api/activity-log — ручная запись события (обычно вызывается server-side)
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logActivity, queryActivityLogs } from "@/lib/activity-log";
import type { ActivityAction, ActivityEntity } from "@/lib/activity-log";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const url = new URL(req.url);
  const isAdmin = session.role === "admin";

  const filterUserId = isAdmin && url.searchParams.get("user_id")
    ? url.searchParams.get("user_id")!
    : isAdmin
    ? undefined               // admin without filter = see all
    : session.userId;         // regular user sees only own logs

  const opts = {
    userId: filterUserId,
    action: url.searchParams.get("action") as ActivityAction | undefined,
    entityType: url.searchParams.get("entity_type") as ActivityEntity | undefined,
    entityId: url.searchParams.get("entity_id") ?? undefined,
    from: url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined,
    to: url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined,
    limit: Math.min(Number(url.searchParams.get("limit") || 50), isAdmin ? 500 : 100),
    offset: Number(url.searchParams.get("offset") || 0),
  };

  const logs = await queryActivityLogs(opts);
  return NextResponse.json({ ok: true, logs });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const body = await req.json();
  const { action, entityType, entityId, metadata } = body;

  if (!action) {
    return NextResponse.json({ ok: false, error: "action required" }, { status: 400 });
  }

  // Extract IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || null;
  const userAgent = req.headers.get("user-agent") || null;

  await logActivity({
    userId: session.userId,
    action: action as ActivityAction,
    entityType: entityType as ActivityEntity ?? null,
    entityId: entityId ?? null,
    metadata: metadata ?? null,
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
