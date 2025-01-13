// src/middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === '/login' || path === '/'

  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value || ''

  // Redirect authenticated users trying to access login/public pages to dashboard
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect unauthenticated users trying to access protected pages to login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Protected routes
    '/dashboard',
    '/dashboard/:path*',
    '/settings',
    '/settings/:path*',
    '/new-post',
    '/new-post/:path*',
    // Auth routes
    '/login',
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}