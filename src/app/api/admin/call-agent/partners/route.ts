/**
 * Прокси из админки MarketRadar к /api/admin/partners Call-Agent.
 *
 * Env:
 *  - CA_BASE_URL     — базовый URL Call-Agent (по умолчанию http://127.0.0.1:3030).
 *  - CA_ADMIN_TOKEN  — должен совпадать с тем, что прописан в .env Call-Agent.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getBase(): Promise<string> {
  return (process.env.CA_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
}

async function getToken(): Promise<string | null> {
  return process.env.CA_ADMIN_TOKEN || null;
}

async function authGuard(): Promise<NextResponse | null> {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const guard = await authGuard();
  if (guard) return guard;

  const base = await getBase();
  const token = await getToken();
  if (!token || token.length < 16) {
    return NextResponse.json(
      { ok: false, error: "CA_ADMIN_TOKEN is not configured on MarketRadar server" },
      { status: 500 }
    );
  }

  try {
    const r = await fetch(`${base}/api/admin/partners`, {
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
  const guard = await authGuard();
  if (guard) return guard;

  const base = await getBase();
  const token = await getToken();
  if (!token || token.length < 16) {
    return NextResponse.json(
      { ok: false, error: "CA_ADMIN_TOKEN is not configured on MarketRadar server" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${base}/api/admin/partners`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Call-Agent unreachable: ${msg}`, base }, { status: 502 });
  }
}
