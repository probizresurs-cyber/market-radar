import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Mirror of the secret logic in @/lib/auth — middleware runs in Edge runtime
// and cannot import from lib/auth directly (uses next/headers).
const RAW_SECRET = process.env.JWT_SECRET ??
  (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET is required in production'); })()
    : 'mr_dev_only_fallback_DO_NOT_USE_IN_PROD');

const JWT_SECRET = new TextEncoder().encode(RAW_SECRET);
const COOKIE_NAME = 'mr_token';

async function getAdminFromRequest(req: NextRequest): Promise<{ role: string } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { role: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Protect /admin/** except /admin/login
  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const user = await getAdminFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
