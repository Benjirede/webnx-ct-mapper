import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './app/lib/auth'; // Adjust path if using src/

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, auth API, and static Next.js assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('webnx_session')?.value;
  const session = await verifySession(token);

  if (!session) {
    // Return 401 JSON for unauthenticated API calls
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Redirect unauthenticated browser visits to /login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Forward verified username in a request header so API routes can log it in audit_log
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-name', session.username);
  requestHeaders.set('x-user-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
