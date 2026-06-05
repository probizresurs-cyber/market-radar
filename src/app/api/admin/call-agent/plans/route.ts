/**
 * Прокси из админки MarketRadar к /api/admin/plans Call-Agent.
 *
 * GET → список тарифов
 * POST → создать/обновить тариф (id в теле → update, нет id → insert)
 * PUT → обновить тариф (id + поля в теле)
 *
 * Env:
 *  - CA_BASE_URL      — базовый URL Call-Agent (default http://127.0.0.1:3030)
 *  - CA_ADMIN_TOKEN   — shared secret (должен совпадать с CA .env)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkSession() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return null;
  return session;
}

function caBase() {
  return (process.env.CA_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
}

function caToken() {
  return process.env.CA_ADMIN_TOKEN || "";
}

function isTokenValid(token: string): boolean {
  return token.length >= 16;
}

function tokenError() {
  return NextResponse.json(
    { ok: false, error: "CA_ADMIN_TOKEN is not configured on MarketRadar server" },
    { status: 500 }
  );
}

export async function GET() {
  const session = await checkSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const token = caToken();
  if (!token || !isTokenValid(token)) return tokenError();

  try {
    const r = await fetch(`${caBase()}/api/admin/plans`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Call-Agent unreachable: ${msg}`, base: caBase() }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const session = await checkSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const token = caToken();
  if (!token || !isTokenValid(token)) return tokenError();

  try {
    const body = await req.json();
    const r = await fetch(`${caBase()}/api/admin/plans`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Call-Agent unreachable: ${msg}`, base: caBase() }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await checkSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const token = caToken();
  if (!token || !isTokenValid(token)) return tokenError();

  try {
    const body = await req.json();
    const r = await fetch(`${caBase()}/api/admin/plans`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Call-Agent unreachable: ${msg}`, base: caBase() }, { status: 502 });
  }
}
