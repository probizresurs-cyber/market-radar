import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const referer = req.headers.get("referer") || "";
  const isAdmin = referer.includes("/admin");
  const res = isAdmin
    ? NextResponse.redirect(new URL("/admin/login", req.url))
    : NextResponse.json({ ok: true });
  res.cookies.set("mr_token", "", { maxAge: 0, path: "/" });
  return res;
}

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));
  res.cookies.set("mr_token", "", { maxAge: 0, path: "/" });
  return res;
}
