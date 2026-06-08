import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ─── Admin auth guard ────────────────────────────────────────────────────────
// Перенесено из src/middleware.ts: Next 16 запрещает одновременно middleware.ts
// и proxy.ts ("Please use proxy only") — наличие обоих ломало production build.
// Логика гварда теперь живёт здесь, единым Edge-обработчиком.
//
// Зеркало секрета из @/lib/auth — Edge runtime не может импортировать lib/auth
// (там next/headers).
const RAW_SECRET = process.env.JWT_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("JWT_SECRET is required in production"); })()
    : "mr_dev_only_fallback_DO_NOT_USE_IN_PROD");
const JWT_SECRET = new TextEncoder().encode(RAW_SECRET);
const COOKIE_NAME = "mr_token";

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload as { role?: string }).role === "admin";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Route admine.* subdomain to /admin prefix
  if (host.startsWith("admine.")) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
      // Гвард для /admin даже на admine.-поддомене (кроме страницы логина).
      if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !(await isAdmin(request))) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/admin" + (pathname === "/" ? "/dashboard" : pathname);
    // После rewrite путь становится /admin/... — гвардим (кроме /admin/login).
    if (!url.pathname.startsWith("/admin/login") && !(await isAdmin(request))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.rewrite(url);
  }

  // Гвард /admin/** на основном домене (кроме /admin/login).
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!(await isAdmin(request))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // ─── Referral cookie (First-Touch, 60 days) ─────────────────────────────────
  // Accept both ?rf= (partner referral) and ?ref= (admin-generated bonus link).
  // Both codes are stored in the same cookie — the register handler later
  // checks each against the partners table AND the referral_links table.
  const rfCode =
    request.nextUrl.searchParams.get("rf") ||
    request.nextUrl.searchParams.get("ref");
  let response = NextResponse.next();

  if (rfCode && !request.cookies.get("mr_ref")) {
    // Strip both params from URL to keep it clean
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("rf");
    cleanUrl.searchParams.delete("ref");
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
