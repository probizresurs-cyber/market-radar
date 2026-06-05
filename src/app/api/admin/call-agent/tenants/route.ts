/**
 * Прокси из админки MarketRadar к /api/admin/tenants Call-Agent.
 *
 * Зачем прокси, а не прямой fetch из браузера:
 *  - shared secret CA_ADMIN_TOKEN не должен попасть в браузер;
 *  - вызов идёт через сессию админа MR (проверяем role === "admin").
 *
 * Env:
 *  - CA_BASE_URL  — базовый URL Call-Agent (по умолчанию http://127.0.0.1:3030).
 *  - CA_ADMIN_TOKEN — должен совпадать с тем, что прописан в .env Call-Agent.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
    const r = await fetch(`${base}/api/admin/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: `Bad JSON from Call-Agent (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Call-Agent unreachable: ${msg}`, base },
      { status: 502 }
    );
  }
}
