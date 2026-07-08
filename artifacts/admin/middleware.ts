import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ───────────────────────────────────────────────────────────────────────────
// D-004 fix: dev-time auth guard.
//
// IMPORTANT: this admin panel ships as a static export (`output: "export"` in
// next.config.ts), which means middleware does NOT run in production. This
// middleware only protects the dev server (next dev). For production, real
// access control is enforced API-side: every admin endpoint requires a valid
// JWT, and the 401 interceptor in lib/axios-client.ts bounces to /login.
// Treat this as defense-in-depth / developer convenience, not a security
// boundary.
// ───────────────────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const token = req.cookies.get('streampro_access_token')?.value
    || req.headers.get('authorization')?.replace('Bearer ', '');
  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  if (!token && !isLoginPage) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
  if (token && isLoginPage) {
    const homeUrl = new URL('/', req.url);
    return NextResponse.redirect(homeUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|api).*)'],
};
