// Прокси из админки MR к /api/accounts лидгена (создать/удалить аккаунт).
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cfg() {
  const base = (process.env.LEADGEN_BASE_URL || "http://127.0.0.1:3200/leadgen").replace(/\/+$/, "");
  return { url: `${base}/api/accounts`, token: process.env.LEADGEN_ADMIN_TOKEN || "" };
}
async function guard() { const s = await getSessionUser(); return !!(s && s.role === "admin"); }

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { url, token } = cfg();
  if (!token) return NextResponse.json({ error: "LEADGEN_ADMIN_TOKEN не задан" }, { status: 500 });
  const body = await req.text();
  try {
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body });
    return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `Лидген недоступен: ${(e as Error).message}` }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { url, token } = cfg();
  const companyId = new URL(req.url).searchParams.get("companyId") || "";
  try {
    const r = await fetch(`${url}?companyId=${encodeURIComponent(companyId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `Лидген недоступен: ${(e as Error).message}` }, { status: 502 });
  }
}
