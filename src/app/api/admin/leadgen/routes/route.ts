/**
 * Прокси из админки MarketRadar к /api/routes лидгена (маршрутизация задач→аккаунт).
 * Гейт — сессия админа MR (role === "admin"); к лидгену ходим по shared-токену.
 * Env: LEADGEN_BASE_URL (по умолч. http://127.0.0.1:3200/leadgen), LEADGEN_ADMIN_TOKEN.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cfg() {
  const base = (process.env.LEADGEN_BASE_URL || "http://127.0.0.1:3200/leadgen").replace(/\/+$/, "");
  const token = process.env.LEADGEN_ADMIN_TOKEN || "";
  return { url: `${base}/api/routes`, token };
}

async function guard() {
  const s = await getSessionUser();
  if (!s || s.role !== "admin") return false;
  return true;
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { url, token } = cfg();
  if (!token) return NextResponse.json({ error: "LEADGEN_ADMIN_TOKEN не задан на сервере MarketRadar" }, { status: 500 });
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `Лидген недоступен: ${(e as Error).message}` }, { status: 502 });
  }
}

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
  const task = new URL(req.url).searchParams.get("task") || "";
  try {
    const r = await fetch(`${url}?task=${encodeURIComponent(task)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `Лидген недоступен: ${(e as Error).message}` }, { status: 502 });
  }
}
