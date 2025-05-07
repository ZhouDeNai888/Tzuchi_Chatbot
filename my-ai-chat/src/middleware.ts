import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get access token from cookies or auth header
  const token = request.cookies.get('access_token')?.value;
  
  // Define public paths that don't require authentication
  const publicPaths = ['/login', '/register', '/api/token', '/api/login','/api/embed.js'];
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname === path || 
    request.nextUrl.pathname === `${path}/`
  );
  
  // Define protected paths that require authentication
  const protectedPaths = [
    '/accounts', 
    '/agent', 
    '/departments', 
    '/history',
    '/knowledge', 
    '/profile', 
    '/share'
  ];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));
  
  // Root path (homepage) requires auth
  const isRootPath = request.nextUrl.pathname === '/';

  // API paths (except public ones) require auth
  const isApiPath = request.nextUrl.pathname.startsWith('/api') && 
                   !publicPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // Redirect to login if trying to access protected content without a token
  if (!token && (isProtectedPath || isRootPath || isApiPath)) {
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to home if trying to access login/register with a valid token
  if (token && isPublicPath) {
    const redirectUrl = new URL('/', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except static files and assets
    '/((?!_next/static|_next/image|favicon\\.ico|public/).*)',
  ],
};
