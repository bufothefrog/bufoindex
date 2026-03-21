import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Block demo routes in true production (allow in staging/dev)
  if (process.env.VERCEL_ENV === 'production' ||
      (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO !== 'true')) {
    if (request.nextUrl.pathname.startsWith('/demo')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/demo/:path*',
};