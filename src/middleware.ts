import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Route admine.* subdomain to /admin prefix
  if (host.startsWith("admine.")) {
    // Already under /admin — let through
    if (pathname.startsWith("/admin") || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
      return NextResponse.next();
    }
    // Rewrite root → /admin/dashboard (or /admin/login)
    const url = request.nextUrl.clone();
    url.pathname = "/admin" + (pathname === "/" ? "/dashboard" : pathname);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
