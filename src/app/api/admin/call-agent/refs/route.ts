/**
 * Прокси из админки MarketRadar к /api/admin/refs Call-Agent.
 * См. ../users/route.ts для деталей.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function caEnv() {
  const base = (process.env.CA_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
  const token = process.env.CA_ADMIN_TOKEN;
  return { base, token };
}

export async function GET() {
  const guard = await ensureAdmin();
  if (guard) return guard;
  const { base, token } = caEnv();
  if (!token || token.length < 16) return NextResponse.json({ ok: false, error: "CA_ADMIN_TOKEN not configured" }, { status: 500 });

  try {
    const r = await fetch(`${base}/api/admin/refs`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Call-Agent unreachable: ${msg}`, base }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await ensureAdmin();
  if (guard) return guard;
  const { base, token } = caEnv();
  if (!token || token.length < 16) return NextResponse.json({ ok: false, error: "CA_ADMIN_TOKEN not configured" }, { status: 500 });

  const body = await req.text();
  try {
    const r = await fetch(`${base}/api/admin/refs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": req.headers.get("content-type") || "application/json",
      },
      body,
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Call-Agent unreachable: ${msg}`, base }, { status: 502 });
  }
}
