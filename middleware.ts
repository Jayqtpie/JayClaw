import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionCookieValue } from '@/lib/auth';

const PUBLIC_PATHS = new Set<string>(['/login', '/api/auth/login']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow Next internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap')
  ) {
    return NextResponse.next();
  }

  // allow login and auth endpoints
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  // require auth for API + pages
  const cookie = req.cookies.get('occ_session')?.value;
  const ok = !!verifySessionCookieValue(cookie);
  if (ok) return NextResponse.next();

  // API routes get 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
