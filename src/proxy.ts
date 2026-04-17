import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Route admine.* subdomain to /admin prefix
  if (host.startsWith("admine.")) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/admin" + (pathname === "/" ? "/dashboard" : pathname);
    return NextResponse.rewrite(url);
  }

  // ─── Referral cookie (First-Touch, 60 days) ─────────────────────────────────
  const rfCode = request.nextUrl.searchParams.get("rf");
  let response = NextResponse.next();

  if (rfCode && !request.cookies.get("mr_ref")) {
    // Strip ?rf= from URL to keep it clean
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("rf");
    response = NextResponse.redirect(cleanUrl);
    response.cookies.set("mr_ref", rfCode, {
      maxAge: 60 * 60 * 24 * 60, // 60 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    // Also store cookie creation timestamp
    response.cookies.set("mr_ref_ts", Date.now().toString(), {
      maxAge: 60 * 60 * 24 * 60,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
