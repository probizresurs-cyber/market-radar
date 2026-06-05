/**
 * Прокси MR → CA /api/admin/promos
 *
 * Зачем прокси: CA_ADMIN_TOKEN не должен попасть в браузер;
 * авторизация через сессию администратора MR.
 *
 * Env:
 *  CA_BASE_URL    — базовый URL Call-Agent (по умолчанию http://127.0.0.1:3030).
 *  CA_ADMIN_TOKEN — shared secret, совпадает с .env Call-Agent.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function makeProxy(method: string, body?: unknown) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const base = (process.env.CA_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
  const token = process.env.CA_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "CA_ADMIN_TOKEN is not configured on MarketRadar server" },
      { status: 500 }
    );
  }

  try {
    const fetchOpts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    };
    if (body !== undefined) {
      fetchOpts.body = JSON.stringify(body);
    }

    const r = await fetch(`${base}/api/admin/promos`, fetchOpts);
    const data = await r
      .json()
      .catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Call-Agent unreachable: ${msg}`, base },
      { status: 502 }
    );
  }
}

export async function GET() {
  return makeProxy("GET");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return makeProxy("POST", body);
}
