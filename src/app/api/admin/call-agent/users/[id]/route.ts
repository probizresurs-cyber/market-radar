/**
 * Прокси из админки MarketRadar к /api/admin/users/:id Call-Agent.
 *
 * Env:
 *  - CA_BASE_URL      — базовый URL Call-Agent (по умолчанию http://127.0.0.1:3030).
 *  - CA_ADMIN_TOKEN   — shared secret, должен совпадать с .env Call-Agent.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const base = (process.env.CA_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
  const token = process.env.CA_ADMIN_TOKEN;
  if (!token || token.length < 16) {
    return NextResponse.json(
      { ok: false, error: "CA_ADMIN_TOKEN is not configured on MarketRadar server" },
      { status: 500 }
    );
  }

  // Forward tenant_id if provided by the caller (scopes the lookup to a specific tenant)
  const tenantIdParam = _req.nextUrl.searchParams.get("tenant_id");
  const caUrl = new URL(`${base}/api/admin/users/${id}`);
  if (tenantIdParam) {
    caUrl.searchParams.set("tenant_id", tenantIdParam);
  }

  try {
    const r = await fetch(caUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({
      ok: false,
      error: `Bad JSON from Call-Agent (${r.status})`,
    }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Call-Agent unreachable: ${msg}`, base },
      { status: 502 }
    );
  }
}
