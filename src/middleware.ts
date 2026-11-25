import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET;

  // Fail closed if secret is unavailable
  if (!secret) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Server authentication misconfigured' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = await getToken({ req: request, secret });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = String(token.role || '');

  if (pathname.startsWith('/caregiver') && role !== 'CAREGIVER') {
    if (role === 'CLINICIAN') return NextResponse.redirect(new URL('/doctor', request.url));
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname.startsWith('/doctor') && role !== 'CLINICIAN') {
    if (role === 'CAREGIVER') return NextResponse.redirect(new URL('/caregiver', request.url));
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/caregiver',
    '/caregiver/:path*',
    '/doctor',
    '/doctor/:path*',
    '/profile',
    '/check-in',
  ],
};
